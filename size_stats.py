"""Privacy-friendly usage counters: how often a guide is opened or the size finder is used."""
import re
from fastapi import APIRouter, Depends, HTTPException, Response
from dashboard import query, authenticated, require_store

router = APIRouter()
CORS = {'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}
DIGITS = re.compile(r'[0-9]{1,30}')
KINDS = {'open': 'opens', 'recommend': 'calcs'}

def initialize():
    query('''CREATE TABLE IF NOT EXISTS size_guide_events (
        merchant_id TEXT NOT NULL, product_id TEXT NOT NULL, day DATE NOT NULL DEFAULT current_date,
        opens INTEGER NOT NULL DEFAULT 0, calcs INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(merchant_id,product_id,day))''')

@router.post('/public/size-guides/{merchant}/{product_id}/event', include_in_schema=False)
def record_event(merchant: str, product_id: str, t: str = ''):
    """No body, no cookies and no personal data: only a per-day counter, and only for products that have a guide."""
    if not DIGITS.fullmatch(merchant) or not DIGITS.fullmatch(product_id) or t not in KINDS:
        return Response(status_code=204, headers=CORS)
    column = KINDS[t]  # fixed allow-list, never user text
    query(f'''INSERT INTO size_guide_events(merchant_id,product_id,{column})
        SELECT %s,%s,1 WHERE EXISTS(SELECT 1 FROM product_size_guides WHERE merchant_id=%s AND product_id=%s)
        ON CONFLICT(merchant_id,product_id,day) DO UPDATE SET {column}=size_guide_events.{column}+1''',
          (merchant, product_id, merchant, product_id))
    return Response(status_code=204, headers=CORS)

@router.get('/dashboard-api/size-guide-stats', dependencies=[Depends(authenticated)])
def stats(merchant: str, days: int = 30):
    require_store(merchant)
    if not 1 <= days <= 365:
        raise HTTPException(400, 'المدة غير صالحة.')
    daily = query('''SELECT day,sum(opens)::int AS opens,sum(calcs)::int AS calcs FROM size_guide_events
        WHERE merchant_id=%s AND day>current_date-%s GROUP BY day ORDER BY day''', (merchant, days))
    top = query('''SELECT e.product_id,COALESCE(c.title,e.product_id) AS title,sum(e.opens)::int AS opens,sum(e.calcs)::int AS calcs
        FROM size_guide_events e LEFT JOIN dashboard_catalog c ON c.merchant_id=e.merchant_id AND c.product_id=e.product_id
        WHERE e.merchant_id=%s AND e.day>current_date-%s GROUP BY e.product_id,c.title
        ORDER BY sum(e.opens) DESC,sum(e.calcs) DESC LIMIT 10''', (merchant, days))
    guides = query('''SELECT count(*)::int AS n FROM product_size_guides g
        LEFT JOIN size_guide_library l ON l.merchant_id=g.merchant_id AND l.library_id=g.library_id
        WHERE g.merchant_id=%s AND (CASE WHEN g.library_id IS NOT NULL THEN l.published IS NOT NULL ELSE g.published IS NOT NULL END)''',
                   (merchant,), True)
    return {'days': days, 'opens': sum(d['opens'] for d in daily), 'calcs': sum(d['calcs'] for d in daily),
            'published_guides': guides['n'], 'daily': daily, 'top': top}
