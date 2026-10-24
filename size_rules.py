"""Products without a size guide, and rules that link a product to a shared guide by its Salla category."""
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from dashboard import query, authenticated, require_store

router = APIRouter()
MAX_RULES = 50
DIGITS = re.compile(r'[0-9]{1,30}')
LIBRARY_ID = re.compile(r'[0-9a-f]{12}')

def initialize():
    query('''CREATE TABLE IF NOT EXISTS product_categories (
        merchant_id TEXT NOT NULL, product_id TEXT NOT NULL, category_id TEXT NOT NULL, category_name TEXT NOT NULL DEFAULT '',
        PRIMARY KEY(merchant_id,product_id,category_id))''')
    query('CREATE INDEX IF NOT EXISTS product_categories_by_category ON product_categories(merchant_id,category_id)')
    query('''CREATE TABLE IF NOT EXISTS size_guide_rules (
        merchant_id TEXT NOT NULL, category_id TEXT NOT NULL, category_name TEXT NOT NULL DEFAULT '', library_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(merchant_id,category_id))''')

def save_categories(cur, merchant, product):
    """Keep a product's categories as Salla last reported them (same transaction as the catalog row)."""
    pid = str(product.get('id'))
    cur.execute('DELETE FROM product_categories WHERE merchant_id=%s AND product_id=%s', (merchant, pid))
    seen = set()
    for item in (product.get('categories') or [])[:30]:
        if not isinstance(item, dict) or isinstance(item.get('id'), bool) or not DIGITS.fullmatch(str(item.get('id', ''))):
            continue
        cid = str(item['id'])
        if cid in seen:
            continue
        seen.add(cid)
        cur.execute('INSERT INTO product_categories(merchant_id,product_id,category_id,category_name) VALUES(%s,%s,%s,%s)',
                    (merchant, pid, cid, str(item.get('name') or '')[:120]))

def apply_rules(merchant, product_ids=None):
    """Link products that have no guide yet to the shared guide of their category (the oldest matching rule wins).
    A product that already has a guide of its own is never touched."""
    rows = query('''INSERT INTO product_size_guides(merchant_id,product_id,draft,library_id)
        SELECT DISTINCT ON (pc.product_id) r.merchant_id,pc.product_id,l.draft,l.library_id
        FROM size_guide_rules r
        JOIN size_guide_library l ON l.merchant_id=r.merchant_id AND l.library_id=r.library_id
        JOIN product_categories pc ON pc.merchant_id=r.merchant_id AND pc.category_id=r.category_id
        JOIN dashboard_catalog c ON c.merchant_id=pc.merchant_id AND c.product_id=pc.product_id
        WHERE r.merchant_id=%s AND (%s::text[] IS NULL OR pc.product_id=ANY(%s))
        AND NOT EXISTS(SELECT 1 FROM product_size_guides g WHERE g.merchant_id=r.merchant_id AND g.product_id=pc.product_id)
        ORDER BY pc.product_id,r.created_at,r.category_id
        ON CONFLICT(merchant_id,product_id) DO NOTHING RETURNING product_id''', (merchant, product_ids, product_ids))
    return [r['product_id'] for r in rows]

class RuleBody(BaseModel):
    model_config = ConfigDict(extra='forbid')
    category_id: str = Field(pattern=r'^[0-9]{1,30}$')
    library_id: str = Field(pattern=r'^[0-9a-f]{12}$')

MISSING = '''FROM dashboard_catalog c WHERE c.merchant_id=%s AND c.status IN ('sale','out','out-and-notify')
    AND NOT EXISTS(SELECT 1 FROM product_size_guides g WHERE g.merchant_id=c.merchant_id AND g.product_id=c.product_id)'''

@router.get('/dashboard-api/size-rules', dependencies=[Depends(authenticated)])
def overview(merchant: str):
    require_store(merchant)
    rules = query('''SELECT r.category_id,r.category_name,r.library_id,COALESCE(l.name,'') AS library_name,
        (SELECT count(*)::int FROM product_categories pc WHERE pc.merchant_id=r.merchant_id AND pc.category_id=r.category_id) AS products
        FROM size_guide_rules r LEFT JOIN size_guide_library l ON l.merchant_id=r.merchant_id AND l.library_id=r.library_id
        WHERE r.merchant_id=%s ORDER BY r.created_at,r.category_id''', (merchant,))
    categories = query('''SELECT category_id AS id,max(category_name) AS name,count(*)::int AS products,
        count(*) FILTER (WHERE NOT EXISTS(SELECT 1 FROM product_size_guides g WHERE g.merchant_id=pc.merchant_id AND g.product_id=pc.product_id))::int AS without_guide
        FROM product_categories pc WHERE merchant_id=%s GROUP BY category_id ORDER BY max(category_name),category_id''', (merchant,))
    missing = query('SELECT count(*)::int AS n ' + MISSING, (merchant,), True)['n']
    latest = query('SELECT c.product_id,c.title,c.sku,c.image ' + MISSING + ' ORDER BY c.updated_at DESC LIMIT 8', (merchant,))
    return {'rules': rules, 'categories': categories, 'missing': missing, 'latest': latest}

@router.put('/dashboard-api/size-rules', dependencies=[Depends(authenticated)])
def save_rule(merchant: str, body: RuleBody):
    require_store(merchant)
    cat = query('SELECT max(category_name) AS name FROM product_categories WHERE merchant_id=%s AND category_id=%s HAVING count(*)>0', (merchant, body.category_id), True)
    if not cat:
        raise HTTPException(404, 'الفئة غير موجودة في منتجاتك. زامن المنتجات أولًا.')
    if not query('SELECT 1 FROM size_guide_library WHERE merchant_id=%s AND library_id=%s', (merchant, body.library_id), True):
        raise HTTPException(404, 'الجدول المشترك غير موجود.')
    if not query('SELECT 1 FROM size_guide_rules WHERE merchant_id=%s AND category_id=%s', (merchant, body.category_id), True) \
            and query('SELECT count(*)::int AS n FROM size_guide_rules WHERE merchant_id=%s', (merchant,), True)['n'] >= MAX_RULES:
        raise HTTPException(400, f'الحد الأقصى {MAX_RULES} قاعدة.')
    query('''INSERT INTO size_guide_rules(merchant_id,category_id,category_name,library_id) VALUES(%s,%s,%s,%s)
        ON CONFLICT(merchant_id,category_id) DO UPDATE SET library_id=EXCLUDED.library_id,category_name=EXCLUDED.category_name''',
          (merchant, body.category_id, cat['name'] or '', body.library_id))
    return overview(merchant)

@router.delete('/dashboard-api/size-rules/{category_id}', dependencies=[Depends(authenticated)])
def delete_rule(category_id: str, merchant: str):
    require_store(merchant)
    if not DIGITS.fullmatch(category_id):
        raise HTTPException(404, 'القاعدة غير موجودة.')
    if not query('DELETE FROM size_guide_rules WHERE merchant_id=%s AND category_id=%s RETURNING 1', (merchant, category_id), True):
        raise HTTPException(404, 'القاعدة غير موجودة.')
    return overview(merchant)

@router.post('/dashboard-api/size-rules/apply', dependencies=[Depends(authenticated)])
def apply_now(merchant: str):
    """Link every product that has no guide yet; products with their own guide stay as they are."""
    require_store(merchant)
    done = apply_rules(merchant)
    return {'linked': len(done), **overview(merchant)}
