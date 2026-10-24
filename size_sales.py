"""Which sizes customers buy and send back, from Salla order events.
Only product, size and quantity are kept: no customer, address or payment data ever reaches this table."""
import re
from fastapi import APIRouter, Depends, HTTPException
from dashboard import query, authenticated, require_store

router = APIRouter()
DIGITS = re.compile(r'[0-9]{1,30}')
SIZE_NAME = re.compile(r'مقاس|حجم|قياس|size', re.I)
UNKNOWN = 'غير محدد'
CANCELLED = {'canceled', 'cancelled'}
RETURNED = {'restoring', 'restored', 'refunded', 'returned'}
MIN_SOLD, MIN_SIZE_SOLD, MIN_RETURNED, ALERT_RATE = 8, 4, 2, 0.25

def initialize():
    query('''CREATE TABLE IF NOT EXISTS size_sales (
        merchant_id TEXT NOT NULL, order_id TEXT NOT NULL, product_id TEXT NOT NULL, size TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'placed',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(merchant_id,order_id,product_id,size))''')
    query('CREATE INDEX IF NOT EXISTS size_sales_by_time ON size_sales(merchant_id,created_at)')

def text(value):
    """A label that may arrive as a string or as {name: ...}."""
    if isinstance(value, dict):
        value = value.get('name') or value.get('label') or value.get('value')
    return re.sub(r'\s+', ' ', str(value)).strip()[:40] if isinstance(value, (str, int, float)) and not isinstance(value, bool) else ''

def order_id_of(data):
    if not isinstance(data, dict):
        return ''
    for candidate in (data.get('id'), data.get('order_id'), (data.get('order') or {}).get('id') if isinstance(data.get('order'), dict) else None):
        if isinstance(candidate, (str, int)) and not isinstance(candidate, bool) and DIGITS.fullmatch(str(candidate)):
            return str(candidate)
    return ''

def parse_items(data):
    """[(product_id, size, quantity)] for the lines of an order; the size is the option named like a size, else 'غير محدد'."""
    out = {}
    for item in (data.get('items') or data.get('products') or [])[:100] if isinstance(data, dict) else []:
        if not isinstance(item, dict):
            continue
        product = item.get('product') if isinstance(item.get('product'), dict) else {}
        pid = next((str(v) for v in (item.get('product_id'), product.get('id')) if isinstance(v, (str, int)) and not isinstance(v, bool) and DIGITS.fullmatch(str(v))), '')
        if not pid:
            continue
        size = ''
        for option in (item.get('options') or [])[:20]:
            if isinstance(option, dict) and SIZE_NAME.search(text(option.get('name'))):
                size = text(option.get('value')) or text(option.get('values'))
                if size:
                    break
        qty = item.get('quantity')
        qty = qty if isinstance(qty, int) and not isinstance(qty, bool) and 1 <= qty <= 999 else 1
        key = (pid, size or UNKNOWN)
        out[key] = out.get(key, 0) + qty
    return [(pid, size, qty) for (pid, size), qty in out.items()]

def status_of(data):
    status = data.get('status') if isinstance(data, dict) else None
    if isinstance(status, dict):
        status = status.get('slug') or status.get('name')
    return str(status or '').strip().lower()

def orders_event(event, merchant, data):
    """Order events from Salla. Returns False for events this feature does not use."""
    oid = order_id_of(data)
    if not oid:
        return False
    if event == 'order.created':
        for pid, size, qty in parse_items(data):
            query('''INSERT INTO size_sales(merchant_id,order_id,product_id,size,quantity) VALUES(%s,%s,%s,%s,%s)
                ON CONFLICT(merchant_id,order_id,product_id,size) DO UPDATE SET quantity=EXCLUDED.quantity''', (merchant, oid, pid, size, qty))
        return True
    new = None
    if event == 'order.cancelled':
        new = 'cancelled'
    elif event == 'order.refunded':
        new = 'refunded'
    elif event in ('order.status.updated', 'order.updated'):
        status = status_of(data)
        new = 'cancelled' if status in CANCELLED else 'refunded' if status in RETURNED else None
    if not new:
        return False
    query('UPDATE size_sales SET status=%s WHERE merchant_id=%s AND order_id=%s', (new, merchant, oid))
    return True

def build_insights(rows, titles):
    """Pure: per-product and per-size totals, and the sizes that come back far more often than the product's average."""
    products = {}
    for r in rows:
        p = products.setdefault(r['product_id'], {'product_id': r['product_id'], 'title': titles.get(r['product_id']) or r['product_id'], 'sold': 0, 'returned': 0, 'sizes': []})
        p['sold'] += r['sold']; p['returned'] += r['returned']
        p['sizes'].append({'size': r['size'], 'sold': r['sold'], 'returned': r['returned'], 'rate': round(r['returned'] / r['sold'], 3) if r['sold'] else 0})
    alerts = []
    for p in products.values():
        p['rate'] = round(p['returned'] / p['sold'], 3) if p['sold'] else 0
        p['sizes'].sort(key=lambda s: (-s['sold'], s['size']))
        if p['sold'] < MIN_SOLD:
            continue
        for s in p['sizes']:
            if s['size'] != UNKNOWN and s['sold'] >= MIN_SIZE_SOLD and s['returned'] >= MIN_RETURNED and s['rate'] >= ALERT_RATE and s['rate'] >= 1.5 * p['rate']:
                alerts.append({'kind': 'size', 'product_id': p['product_id'], 'title': p['title'], 'size': s['size'], 'sold': s['sold'], 'returned': s['returned'], 'rate': s['rate'],
                               'message': f"{round(s['rate'] * 100)}% من مبيعات المقاس {s['size']} رُجعت ({s['returned']} من {s['sold']}). راجع قياسات هذا المقاس في الجدول."})
        if p['returned'] >= MIN_RETURNED and p['rate'] >= 0.3 and not any(a['product_id'] == p['product_id'] for a in alerts):
            alerts.append({'kind': 'product', 'product_id': p['product_id'], 'title': p['title'], 'size': '', 'sold': p['sold'], 'returned': p['returned'], 'rate': p['rate'],
                           'message': f"{round(p['rate'] * 100)}% من مبيعات هذا المنتج رُجعت ({p['returned']} من {p['sold']}). قد يكون الجدول لا يطابق القياسات الفعلية."})
    alerts.sort(key=lambda a: (-a['returned'], -a['rate'], a['product_id']))
    top = sorted(products.values(), key=lambda p: (-p['sold'], p['product_id']))[:20]
    return alerts[:20], top

@router.get('/dashboard-api/size-insights', dependencies=[Depends(authenticated)])
def insights(merchant: str, days: int = 90):
    require_store(merchant)
    if not 7 <= days <= 365:
        raise HTTPException(400, 'المدة غير صالحة.')
    rows = query('''SELECT product_id,size,sum(quantity) FILTER (WHERE status<>'cancelled')::int AS sold,
        sum(quantity) FILTER (WHERE status='refunded')::int AS returned FROM size_sales
        WHERE merchant_id=%s AND created_at>now()-make_interval(days=>%s) GROUP BY product_id,size
        HAVING sum(quantity) FILTER (WHERE status<>'cancelled')>0''', (merchant, days))
    for r in rows:
        r['returned'] = r['returned'] or 0
    titles = {r['product_id']: r['title'] for r in query('SELECT product_id,title FROM dashboard_catalog WHERE merchant_id=%s AND product_id=ANY(%s)', (merchant, list({r['product_id'] for r in rows})))} if rows else {}
    alerts, top = build_insights(rows, titles)
    since = query('SELECT min(created_at) AS since FROM size_sales WHERE merchant_id=%s', (merchant,), True)['since']
    sold = sum(r['sold'] for r in rows); returned = sum(r['returned'] for r in rows)
    return {'days': days, 'since': since.isoformat() if since else None, 'sold': sold, 'returned': returned, 'rate': round(returned / sold, 3) if sold else 0,
            'alerts': alerts, 'products': top}
