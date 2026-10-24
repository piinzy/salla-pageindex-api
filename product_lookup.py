"""Product lookup for the dashboard: up to eight products by name or SKU with the state of their size guide."""
import re
from fastapi import APIRouter, Depends, HTTPException
from dashboard import query, authenticated, require_store

router = APIRouter()
LOOKUP_LIMIT = 8

def like(word):
    return '%' + word.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'

@router.get('/dashboard-api/product-lookup', dependencies=[Depends(authenticated)])
def product_lookup(merchant: str, q: str = ''):
    """Up to eight products matching the name or SKU, each with the state of its size guide."""
    require_store(merchant)
    if len(q) > 200:
        raise HTTPException(400, 'نص البحث طويل.')
    clauses, args = ['c.merchant_id=%s'], [merchant]
    for word in q.split()[:10]:
        clauses.append('(c.title ILIKE %s OR c.sku ILIKE %s)')
        args.extend([like(word)] * 2)
    rows = query('''SELECT c.product_id,c.title,c.sku,c.price,c.currency,c.quantity,c.status,c.image,c.url,
        g.product_id IS NOT NULL AS has_guide,g.library_id,l.name AS library_name,
        CASE WHEN g.library_id IS NOT NULL THEN l.published IS NOT NULL ELSE g.published IS NOT NULL END AS is_published,
        CASE WHEN g.library_id IS NOT NULL THEN l.draft IS DISTINCT FROM l.published ELSE g.draft IS DISTINCT FROM g.published END AS has_changes
        FROM dashboard_catalog c
        LEFT JOIN product_size_guides g ON g.merchant_id=c.merchant_id AND g.product_id=c.product_id
        LEFT JOIN size_guide_library l ON l.merchant_id=g.merchant_id AND l.library_id=g.library_id
        WHERE ''' + ' AND '.join(clauses) + ' ORDER BY (c.sku ILIKE %s) DESC,c.title,c.product_id LIMIT %s',
                 args + [like(q.strip()) if q.strip() else '', LOOKUP_LIMIT])
    return {'items': rows}
