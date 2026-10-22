"""Plans per store: a 7-day trial (3 AI photo reads), then 389 SAR/month (50 AI photo reads a month) with extra credits tied to the store."""
from datetime import datetime, timedelta, timezone
import logging, os, re
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from psycopg2.extras import Json
from dashboard import query, authenticated, require_store

logger = logging.getLogger('billing')
router = APIRouter()

PRICE, CURRENCY = 389, 'SAR'
TRIAL_DAYS, TRIAL_AI, PAID_AI = 7, 3, 50
GRACE_DAYS = 2   # a late renewal event should not cut a paying store off

def enforcing():
    """Plans are always recorded; limits only apply once BILLING_ENFORCE is switched on."""
    return os.getenv('BILLING_ENFORCE', '').strip().lower() in ('1', 'true', 'yes', 'on')

def initialize():
    query('''CREATE TABLE IF NOT EXISTS store_billing (
        merchant_id TEXT PRIMARY KEY, plan TEXT NOT NULL DEFAULT 'trial', installed BOOLEAN NOT NULL DEFAULT TRUE,
        trial_ends_at TIMESTAMPTZ NOT NULL, paid_until TIMESTAMPTZ,
        ai_trial_used INTEGER NOT NULL DEFAULT 0, ai_month TEXT NOT NULL DEFAULT '', ai_month_used INTEGER NOT NULL DEFAULT 0,
        extra_credits INTEGER NOT NULL DEFAULT 0 CHECK (extra_credits >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())''')
    query('''CREATE TABLE IF NOT EXISTS billing_events (
        id BIGSERIAL PRIMARY KEY, merchant_id TEXT NOT NULL, kind TEXT NOT NULL, detail JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now())''')

def month_key(now):
    return now.strftime('%Y-%m')

def parse_time(value):
    """Salla sends dates as ISO strings, 'YYYY-MM-DD HH:MM:SS' or {date: ...}; anything else is ignored."""
    if isinstance(value, dict):
        value = value.get('date')
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip().replace('Z', '+00:00')
    for candidate in (text, text.replace(' ', 'T', 1)):
        try:
            moment = datetime.fromisoformat(candidate)
            return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None

def compute(row, now):
    """Pure: what a store may do right now, from its billing row."""
    paid_until = row.get('paid_until')
    paid = row['plan'] == 'paid' and (paid_until is None or now < paid_until + timedelta(days=GRACE_DAYS))
    trial = row['plan'] == 'trial' and now < row['trial_ends_at']
    active = row['installed'] and (paid or trial)
    plan = 'uninstalled' if not row['installed'] else 'paid' if paid else 'trial' if trial else 'expired'
    if plan == 'paid':
        limit, used = PAID_AI, row['ai_month_used'] if row['ai_month'] == month_key(now) else 0
    elif plan == 'trial':
        limit, used = TRIAL_AI, row['ai_trial_used']
    else:
        limit, used = 0, 0
    own = max(limit - used, 0)
    extra = row['extra_credits'] if active else 0
    days = max((row['trial_ends_at'] - now).days + (1 if (row['trial_ends_at'] - now).seconds else 0), 0) if plan == 'trial' else None
    return {'plan': plan, 'active': active, 'price': PRICE, 'currency': CURRENCY, 'trial_days_left': days,
            'paid_until': paid_until.isoformat() if paid_until else None,
            'ai': {'limit': limit, 'used': min(used, limit), 'plan_remaining': own, 'extra': extra, 'remaining': own + extra}}

def ensure(merchant):
    query('''INSERT INTO store_billing(merchant_id,trial_ends_at) VALUES(%s, now() + make_interval(days => %s))
        ON CONFLICT (merchant_id) DO NOTHING''', (merchant, TRIAL_DAYS))

def get_row(merchant):
    ensure(merchant)
    return query('SELECT * FROM store_billing WHERE merchant_id=%s', (merchant,), True)

def state(merchant):
    result = compute(get_row(merchant), datetime.now(timezone.utc))
    result['enforced'] = enforcing()
    return result

def storefront_allowed(merchant):
    """Shoppers only see guides of stores whose plan is active (always true while enforcement is off)."""
    if not enforcing():
        return True
    # A store that predates billing starts its trial the first time it is checked.
    return compute(get_row(merchant), datetime.now(timezone.utc))['active']

def consume_ai(merchant):
    """Take one AI photo read from the store's allowance, then from its extra credits. Returns where it came from."""
    if not enforcing():
        return None
    now = datetime.now(timezone.utc)
    row = get_row(merchant)
    current = compute(row, now)
    if not current['active']:
        raise HTTPException(402, 'انتهت فترة التجربة أو الاشتراك. اشترك من صفحة التطبيق في سلة لمتابعة الاستيراد بالذكاء الاصطناعي.')
    if current['plan'] == 'trial':
        if query("""UPDATE store_billing SET ai_trial_used=ai_trial_used+1,updated_at=now()
                    WHERE merchant_id=%s AND ai_trial_used<%s RETURNING 1""", (merchant, TRIAL_AI), True):
            return 'plan'
    else:
        query('UPDATE store_billing SET ai_month=%s,ai_month_used=0 WHERE merchant_id=%s AND ai_month<>%s', (month_key(now), merchant, month_key(now)))
        if query("""UPDATE store_billing SET ai_month_used=ai_month_used+1,updated_at=now()
                    WHERE merchant_id=%s AND ai_month_used<%s RETURNING 1""", (merchant, PAID_AI), True):
            return 'plan'
    if query('UPDATE store_billing SET extra_credits=extra_credits-1,updated_at=now() WHERE merchant_id=%s AND extra_credits>0 RETURNING 1', (merchant,), True):
        return 'extra'
    if current['plan'] == 'trial':
        raise HTTPException(402, f'استخدمت صور التجربة ({TRIAL_AI}). اشترك للحصول على {PAID_AI} صورة شهريًا.')
    raise HTTPException(402, f'استهلكت {PAID_AI} صورة هذا الشهر. اشحن رصيدًا إضافيًا أو انتظر الشهر القادم.')

def refund_ai(merchant, source):
    """A failed read costs nothing."""
    if source == 'extra':
        query('UPDATE store_billing SET extra_credits=extra_credits+1 WHERE merchant_id=%s', (merchant,))
    elif source == 'plan':
        query('''UPDATE store_billing SET ai_trial_used=GREATEST(ai_trial_used-(CASE WHEN plan='trial' THEN 1 ELSE 0 END),0),
                 ai_month_used=GREATEST(ai_month_used-(CASE WHEN plan='paid' AND ai_month=%s THEN 1 ELSE 0 END),0) WHERE merchant_id=%s''',
              (month_key(datetime.now(timezone.utc)), merchant))

def log(merchant, kind, detail):
    query('INSERT INTO billing_events(merchant_id,kind,detail) VALUES(%s,%s,%s)', (merchant, kind, Json(detail)))

def apply_event(event, merchant, data):
    """Salla app lifecycle events. Unknown events are ignored, so a new event name never breaks the webhook."""
    now = datetime.now(timezone.utc)
    ensure(merchant)
    data = data if isinstance(data, dict) else {}
    if event == 'app.uninstalled':
        query('UPDATE store_billing SET installed=FALSE,updated_at=now() WHERE merchant_id=%s', (merchant,))
        query('UPDATE stores SET access_token=NULL,refresh_token=NULL WHERE merchant_id=%s', (merchant,))
    elif event in ('app.installed', 'app.store.authorize'):
        query('UPDATE store_billing SET installed=TRUE,updated_at=now() WHERE merchant_id=%s', (merchant,))
    elif event == 'app.trial.started':
        end = parse_time(data.get('trial_end_date') or data.get('end_date') or data.get('expires_at'))
        if end:
            query("UPDATE store_billing SET trial_ends_at=%s,installed=TRUE,updated_at=now() WHERE merchant_id=%s AND plan='trial'", (end, merchant))
    elif event in ('app.subscription.started', 'app.subscription.renewed'):
        end = parse_time(data.get('end_date') or data.get('expires_at') or data.get('subscription_end_date')) or now + timedelta(days=31)
        query("UPDATE store_billing SET plan='paid',paid_until=%s,installed=TRUE,updated_at=now() WHERE merchant_id=%s", (end, merchant))
    elif event in ('app.subscription.expired', 'app.trial.expired'):
        if event == 'app.subscription.expired' or query("SELECT 1 FROM store_billing WHERE merchant_id=%s AND plan='trial'", (merchant,), True):
            query("UPDATE store_billing SET plan='expired',updated_at=now() WHERE merchant_id=%s", (merchant,))
    elif event in ('app.subscription.canceled', 'app.trial.canceled'):
        # Cancelled but already paid for: access runs until paid_until. A cancelled trial ends now.
        if event == 'app.trial.canceled':
            query("UPDATE store_billing SET plan='expired',updated_at=now() WHERE merchant_id=%s AND plan='trial'", (merchant,))
    else:
        return False
    log(merchant, event, {})
    return True

class Credits(BaseModel):
    model_config = ConfigDict(extra='forbid')
    credits: int = Field(ge=1, le=1000)
    note: str = Field(default='', max_length=200)

@router.get('/dashboard-api/billing', dependencies=[Depends(authenticated)])
def billing_state(merchant: str):
    require_store(merchant)
    return state(merchant)

@router.post('/dashboard-api/billing/credits', dependencies=[Depends(authenticated)])
def add_credits(merchant: str, body: Credits, request: Request):
    """Operator only (a merchant's embedded session cannot grant itself credits)."""
    if getattr(request.state, 'dashboard_merchant', None):
        raise HTTPException(403, 'إضافة الرصيد من مشغّل التطبيق فقط.')
    require_store(merchant)
    ensure(merchant)
    query('UPDATE store_billing SET extra_credits=extra_credits+%s,updated_at=now() WHERE merchant_id=%s', (body.credits, merchant))
    log(merchant, 'credits.added', {'credits': body.credits, 'note': body.note})
    return state(merchant)
