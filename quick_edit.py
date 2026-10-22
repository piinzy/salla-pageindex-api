"""Quick product lookup for the dashboard and a careful, audited edit of a product's basic data in Salla."""
import decimal, logging, math, re
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from psycopg2.extras import Json
from dashboard import API, query, authenticated, require_store, normalize, UPSERT

router = APIRouter()
logger = logging.getLogger('salla_backend')
DIGITS = re.compile(r'[0-9]{1,30}')
LOOKUP_LIMIT = 8

def initialize():
    # Old and new values of every edit made from the app, so a mistake can always be undone by hand.
    query('''CREATE TABLE IF NOT EXISTS product_edit_log (
        id BIGSERIAL PRIMARY KEY, merchant_id TEXT NOT NULL, product_id TEXT NOT NULL,
        changes JSONB NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now())''')

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

class ProductEdit(BaseModel):
    """Only fields Salla documents for the product update; the SKU and status are shown but never changed here."""
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    price: decimal.Decimal | None = Field(default=None, gt=0, le=10_000_000, decimal_places=2)
    quantity: int | None = Field(default=None, ge=0, le=1_000_000, strict=True)

    @field_validator('price')
    @classmethod
    def finite(cls, value):
        if value is not None and not value.is_finite():
            raise ValueError('السعر غير صالح')
        return value

    @model_validator(mode='after')
    def something_to_change(self):
        if self.name is None and self.price is None and self.quantity is None:
            raise ValueError('لم يُحدَّد أي تغيير')
        return self

def number(value):
    return float(value) if value is not None else None

def salla_error(response):
    status = response.status_code
    if status == 401:
        return 401, 'انتهت صلاحية رمز الوصول. أعد إرسال رمز الوصول من سلة ثم حاول مجددًا.'
    if status == 403:
        return 403, 'سلة رفضت التعديل: التطبيق لا يملك صلاحية «قراءة وكتابة المنتجات». فعّلها من بوابة الشركاء ثم أعد تثبيت التطبيق.'
    if status == 404:
        return 404, 'المنتج غير موجود في سلة. قد يكون حُذف؛ زامن المنتجات.'
    if status == 422:
        try:
            detail = str(response.json().get('error', {}).get('message') or '')[:160]
        except ValueError:
            detail = ''
        return 422, 'سلة رفضت القيم المدخلة' + (': ' + detail if detail else '.')
    if status == 429:
        return 429, 'سلة تطلب التمهل. انتظر قليلًا ثم حاول مجددًا.'
    return 502, f'تعذر تحديث المنتج في سلة (HTTP {status}).'

@router.put('/dashboard-api/products/{product_id}', dependencies=[Depends(authenticated)])
def edit_product(product_id: str, merchant: str, body: ProductEdit):
    require_store(merchant)
    if not DIGITS.fullmatch(product_id):
        raise HTTPException(404, 'المنتج غير موجود.')
    current = query('SELECT title,price,quantity FROM dashboard_catalog WHERE merchant_id=%s AND product_id=%s', (merchant, product_id), True)
    if not current:
        raise HTTPException(404, 'المنتج غير موجود في هذا المتجر. زامن المنتجات أولًا.')
    token = (query('SELECT access_token FROM stores WHERE merchant_id=%s', (merchant,), True) or {}).get('access_token')
    if not token:
        raise HTTPException(403, 'المتجر غير مربوط.')
    sent, changes = {}, {}
    for field, new in (('name', body.name), ('price', number(body.price)), ('quantity', body.quantity)):
        old = current['title' if field == 'name' else field]
        old = number(old) if field == 'price' else old
        if new is not None and new != old:
            sent[field] = new
            changes[field] = {'from': old, 'to': new}
    if not sent:
        raise HTTPException(400, 'لا يوجد تغيير عن القيم الحالية.')
    def put(access):
        return requests.put(f'{API}/products/{product_id}', json=sent, timeout=(5, 25), allow_redirects=False,
                            headers={'Authorization': 'Bearer ' + access, 'Accept': 'application/json'})
    try:
        response = put(token)
        if response.status_code == 401:
            # Expired token: renew it once and retry.
            from salla_tokens import refresh, TokenError
            try:
                response = put(refresh(merchant, token))
            except TokenError as error:
                logger.warning('Token refresh failed: %s', error)   # the original 401 is reported below
    except requests.RequestException as error:
        logger.error('Salla product update failed: %s', type(error).__name__)
        raise HTTPException(502, 'تعذر الاتصال بسلة. حاول لاحقًا.') from None
    if response.status_code not in (200, 201):
        status, message = salla_error(response)
        logger.error('Salla product update returned HTTP %s', response.status_code)
        raise HTTPException(status, message)
    # Keep the local catalog in step: prefer what Salla returned, else the values we sent.
    try:
        returned = response.json().get('data')
        row = normalize(returned, merchant) if isinstance(returned, dict) and str(returned.get('id')) == product_id else None
    except (ValueError, RuntimeError, AttributeError):
        row = None
    if row:
        query(UPSERT, row)
    else:
        query('''UPDATE dashboard_catalog SET title=COALESCE(%s,title),price=COALESCE(%s,price),quantity=COALESCE(%s,quantity),updated_at=now()
            WHERE merchant_id=%s AND product_id=%s''', (sent.get('name'), sent.get('price'), sent.get('quantity'), merchant, product_id))
    query('INSERT INTO product_edit_log(merchant_id,product_id,changes) VALUES(%s,%s,%s)', (merchant, product_id, Json(changes)))
    fresh = query('SELECT product_id,title,sku,price,currency,quantity,status,image,url FROM dashboard_catalog WHERE merchant_id=%s AND product_id=%s',
                  (merchant, product_id), True)
    return {'product': fresh, 'changed': changes}
