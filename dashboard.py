"""Product catalog for size guides; scoped merchant and operator dashboard access."""
import hashlib, hmac, html, os, re, secrets, time, uuid
from contextlib import closing
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

router = APIRouter()
API = 'https://api.salla.dev/admin/v2'

def db():
    return psycopg2.connect(os.environ['DATABASE_URL'], connect_timeout=10)

def query(sql, args=(), one=False):
    with closing(db()) as conn, conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql,args)
        if cur.description:
            rows=cur.fetchall()
            return (dict(rows[0]) if rows else None) if one else [dict(x) for x in rows]

def initialize():
    query('''CREATE TABLE IF NOT EXISTS dashboard_catalog (
        merchant_id TEXT NOT NULL, product_id TEXT NOT NULL, title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '', sku TEXT NOT NULL DEFAULT '', price NUMERIC,
        currency TEXT NOT NULL DEFAULT 'SAR', image TEXT, url TEXT, status TEXT,
        quantity NUMERIC, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (merchant_id,product_id))''')
    query('''CREATE TABLE IF NOT EXISTS dashboard_jobs (
        id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, state TEXT NOT NULL,
        processed INTEGER NOT NULL DEFAULT 0, total INTEGER, message TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ)''')
    query('CREATE INDEX IF NOT EXISTS dashboard_jobs_store_time ON dashboard_jobs(merchant_id, started_at DESC)')
    query('''CREATE TABLE IF NOT EXISTS dashboard_login_limits (
        key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start TIMESTAMPTZ NOT NULL)''')


def signing_key():
    key=os.getenv('DASHBOARD_SESSION_SECRET','')
    if len(key)<32 or len(os.getenv('DASHBOARD_PASSWORD',''))<12:
        raise HTTPException(503,'أضف إعدادات دخول لوحة التحكم في Render أولًا.')
    return key.encode()

def authenticated(request:Request):
    authorization=request.headers.get('authorization','')
    embedded=request.headers.get('x-size-guide-embedded')=='1'
    if authorization or embedded:
        # An invalid embedded session must never fall back to an operator cookie.
        from embedded_auth import verify_session
        if not authorization.startswith('Bearer '):
            raise HTTPException(401,'جلسة التطبيق مطلوبة.')
        identity=verify_session(authorization[7:])
        merchant=str(identity['merchant_id'])
        if any(value!=merchant for value in request.query_params.getlist('merchant')):
            raise HTTPException(403,'لا يمكنك الوصول إلى بيانات متجر آخر.')
        if not query("SELECT merchant_id FROM stores WHERE merchant_id=%s AND COALESCE(access_token,'')<>''",(merchant,),True):
            raise HTTPException(403,'هذا المتجر غير مربوط بالتطبيق.')
        if request.method not in ('GET','HEAD') and request.headers.get('x-dashboard-request')!='1':
            raise HTTPException(403,'طلب غير موثق.')
        request.state.dashboard_merchant=merchant
        return identity
    key=signing_key()
    value=request.cookies.get('dashboard_session','')
    try:
        expiry,nonce,sig=value.split('.')
        expected=hmac.new(key,f'{expiry}.{nonce}'.encode(),hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig,expected) or int(expiry)<time.time(): raise ValueError()
    except (ValueError,TypeError):
        raise HTTPException(401,'يرجى تسجيل الدخول.')
    if request.method not in ('GET','HEAD') and request.headers.get('x-dashboard-request')!='1':
        raise HTTPException(403,'طلب غير موثق.')

class Login(BaseModel):
    password:str=Field(max_length=512)

@router.get('/dashboard',include_in_schema=False)
def dashboard_page():
    return FileResponse(Path(__file__).parent/'static/dashboard.html',headers={'Cache-Control':'no-store'})

@router.post('/dashboard-api/login')
def login(body:Login,request:Request):
    key=signing_key()
    # Shared throttling survives restarts; passwords and tokens never enter logs.
    ip=request.client.host if request.client else 'unknown'
    ipkey=hmac.new(key,ip.encode(),hashlib.sha256).hexdigest()
    row=query('''INSERT INTO dashboard_login_limits VALUES (%s,1,now())
        ON CONFLICT(key) DO UPDATE SET
        attempts=CASE WHEN dashboard_login_limits.window_start < now()-interval '15 minutes' THEN 1 ELSE dashboard_login_limits.attempts+1 END,
        window_start=CASE WHEN dashboard_login_limits.window_start < now()-interval '15 minutes' THEN now() ELSE dashboard_login_limits.window_start END
        RETURNING attempts''',(ipkey,),one=True)
    if row['attempts']>20: raise HTTPException(429,'محاولات كثيرة. حاول بعد 15 دقيقة.')
    if not hmac.compare_digest(body.password.encode(),os.environ['DASHBOARD_PASSWORD'].encode()):
        raise HTTPException(401,'كلمة المرور غير صحيحة.')
    value=f'{int(time.time())+28800}.{secrets.token_hex(24)}'
    value+='.'+hmac.new(key,value.encode(),hashlib.sha256).hexdigest()
    response=JSONResponse({'ok':True})
    response.set_cookie('dashboard_session',value,secure=True,httponly=True,samesite='strict',max_age=28800,path='/')
    return response

@router.post('/dashboard-api/logout',dependencies=[Depends(authenticated)])
def logout():
    response=JSONResponse({'ok':True}); response.delete_cookie('dashboard_session',path='/'); return response

@router.get('/dashboard-api/stores',dependencies=[Depends(authenticated)])
def stores(request:Request):
    merchant=getattr(request.state,'dashboard_merchant',None)
    return query('''SELECT merchant_id,store_name,
        COALESCE(access_token,'')<>'' AS connected,
        (SELECT count(*) FROM dashboard_catalog c WHERE c.merchant_id=s.merchant_id) AS product_count,
        (SELECT max(finished_at) FROM dashboard_jobs j WHERE j.merchant_id=s.merchant_id AND j.state='success') AS last_sync
        FROM stores s '''+('WHERE s.merchant_id=%s ' if merchant else '')+'ORDER BY merchant_id',
        (merchant,) if merchant else ())

def require_store(merchant):
    if not query('SELECT merchant_id FROM stores WHERE merchant_id=%s',(merchant,),True):
        raise HTTPException(404,'المتجر غير موجود.')

@router.get('/dashboard-api/products',dependencies=[Depends(authenticated)])
def products(merchant:str,q:str='',status:str='',page:int=1):
    require_store(merchant)
    if page<1 or len(q)>200: raise HTTPException(400,'معايير بحث غير صالحة.')
    clauses=['merchant_id=%s']; args=[merchant]
    if q.strip():
        for word in q.split()[:10]:
            clauses.append("(title ILIKE %s OR sku ILIKE %s OR description ILIKE %s)")
            word=word.replace('\\','\\\\').replace('%','\\%').replace('_','\\_')
            args.extend(['%'+word+'%']*3)
    if status: clauses.append('status=%s'); args.append(status)
    where=' AND '.join(clauses)
    total=query('SELECT count(*) AS n FROM dashboard_catalog WHERE '+where,args,True)['n']
    rows=query('SELECT * FROM dashboard_catalog WHERE '+where+' ORDER BY title,product_id LIMIT 24 OFFSET %s',args+[(page-1)*24])
    return {'items':rows,'total':total,'page':page,'pages':max(1,(total+23)//24)}

@router.get('/dashboard-api/jobs',dependencies=[Depends(authenticated)])
def jobs(merchant:str):
    require_store(merchant)
    return query('SELECT * FROM dashboard_jobs WHERE merchant_id=%s ORDER BY started_at DESC LIMIT 20',(merchant,))

def salla_get(path, token, params=None, merchant=None):
    for attempt in range(3):
        r=requests.get(API+path,headers={'Authorization':'Bearer '+token,'Accept':'application/json'},params=params,timeout=(5,20),allow_redirects=False)
        if r.status_code==429 or r.status_code>=500:
            if attempt<2: time.sleep(2**attempt); continue
        if r.status_code==401:
            if merchant:
                # Renew the store's token once and retry with it.
                from salla_tokens import refresh
                return salla_get(path,refresh(merchant,token),params)
            raise RuntimeError('انتهت صلاحية رمز الوصول. أعد تثبيت التطبيق من سلة.')
        if r.status_code==403: raise RuntimeError('سلة رفضت الوصول. تحقق من صلاحية قراءة المنتجات في التطبيق.')
        if r.status_code!=200: raise RuntimeError(f'تعذر جلب المنتجات من سلة (HTTP {r.status_code}).')
        data=r.json()
        if not isinstance(data,dict) or data.get('success') is False: raise RuntimeError('استجابة غير صالحة من سلة.')
        return data

def normalize(p,merchant):
    pid=p.get('id')
    if isinstance(pid,bool) or not str(pid).isdigit(): raise RuntimeError('منتج بدون معرّف صالح.')
    price=p.get('price') or {}
    amount=price.get('amount') if isinstance(price,dict) else price
    currency=price.get('currency','SAR') if isinstance(price,dict) else 'SAR'
    desc=html.unescape(re.sub('<[^>]+>',' ',str(p.get('description') or '')))
    return (str(merchant),str(pid),str(p.get('name') or pid),desc,str(p.get('sku') or ''),amount,currency,
            p.get('main_image'),p.get('url') or (p.get('urls') or {}).get('customer'),p.get('status'),p.get('quantity'))

UPSERT='''INSERT INTO dashboard_catalog (merchant_id,product_id,title,description,sku,price,currency,image,url,status,quantity)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(merchant_id,product_id) DO UPDATE SET
 title=EXCLUDED.title,description=EXCLUDED.description,sku=EXCLUDED.sku,price=EXCLUDED.price,
 currency=EXCLUDED.currency,image=EXCLUDED.image,url=EXCLUDED.url,status=EXCLUDED.status,quantity=EXCLUDED.quantity,updated_at=now()'''

def sync(merchant,job):
    processed=0
    try:
        with closing(db()) as conn, conn, conn.cursor() as cur:
            cur.execute('SELECT pg_try_advisory_xact_lock(hashtext(%s))',('catalog:'+merchant,))
            if not cur.fetchone()[0]: raise RuntimeError('توجد مزامنة أخرى لهذا المتجر. انتظر اكتمالها.')
            row=query('SELECT access_token FROM stores WHERE merchant_id=%s',(merchant,),True)
            if not row or not row['access_token']: raise RuntimeError('المتجر غير مربوط.')
            query("UPDATE dashboard_jobs SET state='running' WHERE id=%s",(job,))
            page=1; seen=set()
            while True:
                result=salla_get('/products',row['access_token'],{'page':page,'per_page':50},merchant)
                items=result.get('data')
                if not isinstance(items,list): raise RuntimeError('قائمة المنتجات الواردة غير صالحة.')
                pagination=result.get('pagination') or {}
                totalpages=pagination.get('totalPages')
                if not isinstance(totalpages,int) or totalpages<0: raise RuntimeError('معلومات صفحات سلة غير مكتملة؛ لم يتم استبدال الكتالوج.')
                for p in items:
                    record=normalize(p,merchant)
                    if record[1] in seen: raise RuntimeError('تكرار غير متوقع بين صفحات سلة. أعد المزامنة.')
                    seen.add(record[1]); cur.execute(UPSERT,record); processed+=1
                query('UPDATE dashboard_jobs SET processed=%s,total=%s WHERE id=%s',(processed,pagination.get('total'),job))
                if page>=totalpages: break
                if not items or page>=2000: raise RuntimeError('لم تكتمل صفحات المنتجات؛ أعد المحاولة.')
                page+=1
            expected_total=pagination.get('total')
            if not isinstance(expected_total,int) or expected_total!=processed:
                raise RuntimeError('تغير عدد المنتجات أثناء المزامنة؛ أعد المحاولة. تم الاحتفاظ بالكتالوج السابق.')
            # Only a complete successful snapshot removes stale local entries.
            cur.execute('DELETE FROM dashboard_catalog WHERE merchant_id=%s AND NOT (product_id=ANY(%s))',(merchant,list(seen)))
        query("UPDATE dashboard_jobs SET state='success',processed=%s,finished_at=now(),message='اكتملت المزامنة' WHERE id=%s",(processed,job))
    except Exception as exc:
        message=str(exc) if isinstance(exc,RuntimeError) else 'تعذر إكمال المزامنة. تحقق من الاتصال بقاعدة البيانات وسلة ثم أعد المحاولة.'
        query("UPDATE dashboard_jobs SET state='failed',message=%s,finished_at=now() WHERE id=%s",(message,job))

def enqueue(merchant,tasks):
    require_store(merchant)
    job=uuid.uuid4().hex
    query("INSERT INTO dashboard_jobs(id,merchant_id,state) VALUES (%s,%s,'queued')",(job,merchant))
    tasks.add_task(sync,merchant,job)
    return {'job_id':job}

@router.post('/dashboard-api/sync',dependencies=[Depends(authenticated)],status_code=202)
def start_sync(merchant:str,tasks:BackgroundTasks):
    return enqueue(merchant,tasks)

# Product webhook updates use a fresh complete Salla representation; no secret data returned.
def update_product_event(merchant,event,data):
    product_id=data.get('id') if isinstance(data,dict) else None
    if not str(product_id).isdigit(): raise HTTPException(400,'Invalid product ID')
    with closing(db()) as conn, conn, conn.cursor() as cur:
        cur.execute('SELECT pg_advisory_xact_lock(hashtext(%s))',('catalog:'+merchant,))
        if event=='product.deleted':
            cur.execute('DELETE FROM dashboard_catalog WHERE merchant_id=%s AND product_id=%s',(merchant,str(product_id)))
        else:
            row=query('SELECT access_token FROM stores WHERE merchant_id=%s',(merchant,),True)
            if not row: raise HTTPException(404,'Unknown merchant')
            p=salla_get('/products/'+str(product_id),row['access_token'],None,merchant).get('data')
            if not isinstance(p,dict): raise HTTPException(502,'Invalid product response')
            cur.execute(UPSERT,normalize(p,merchant))
