from fastapi import FastAPI, Request, HTTPException
import os
import psycopg2
from dotenv import load_dotenv
import requests

load_dotenv()

app = FastAPI(title="Salla PageIndex AI Search")

# دالة مساعدة للاتصال بقاعدة بيانات Neon وإنشاء الجداول إذا لم تكن موجودة
def init_db():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return
    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        # جدول لتخزين بيانات المتاجر ورمز الوصول (Access Token)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS stores (
                merchant_id TEXT PRIMARY KEY,
                access_token TEXT,
                refresh_token TEXT,
                store_name TEXT
            );
        """)
        # جدول لتخزين المنتجات المستخرجة
        cur.execute("""
            CREATE TABLE IF NOT EXISTS products (
                product_id TEXT PRIMARY KEY,
                merchant_id TEXT,
                title TEXT,
                description TEXT,
                price NUMERIC,
                url TEXT
            );
        """)
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Database Init Error: {e}")

# تشغيل إنشاء الجداول عند بدء تشغيل التطبيق
@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/api/test-db")
def test_db():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL is not set")
    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        cur.execute("SELECT version();")
        db_version = cur.fetchone()
        cur.close()
        conn.close()
        return {
            "status": "success", 
            "message": "Connected to Neon Database successfully!",
            "postgres_version": db_version[0]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/auth/callback")
def auth_callback(code: str = None):
    """
    مسار استقبال رمز المصادقة (Authorization Code) من سلة عند تثبيت التطبيق
    """
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code not found")
    
    client_id = os.getenv("SALLA_CLIENT_ID")
    client_secret = os.getenv("SALLA_CLIENT_SECRET")
    redirect_uri = os.getenv("SALLA_REDIRECT_URI")
    
    # طلب Access Token من سلة باستخدام الكود المؤقت
    token_url = "https://accounts.salla.sa/oauth2/token"
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
        "code": code
    }
    
    response = requests.post(token_url, data=payload)
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Failed to get token from Salla: {response.text}")
    
    token_data = response.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    
    # جلب معلومات التاجر أو المتجر الحالي
    headers = {"Authorization": f"Bearer {access_token}"}
    merchant_res = requests.get("https://api.salla.dev/admin/v2/oauth2/user/info", headers=headers)
    
    merchant_id = "default_merchant"
    store_name = "My Salla Store"
    if merchant_res.status_code == 200:
        user_info = merchant_res.json().get("data", {})
        merchant_id = str(user_info.get("id", "default_merchant"))
        store_name = user_info.get("name", "My Salla Store")
        
    # حفظ التوكن في قاعدة بيانات Neon
    database_url = os.getenv("DATABASE_URL")
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO stores (merchant_id, access_token, refresh_token, store_name)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (merchant_id) 
        DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, store_name = EXCLUDED.store_name;
    """, (merchant_id, access_token, refresh_token, store_name))
    conn.commit()
    cur.close()
    conn.close()
    
    return {
        "status": "success",
        "message": f"App installed and connected successfully for store: {store_name}!"
    }

@app.post("/webhook")
async def salla_webhook(request: Request):
    try:
        payload = await request.json()
        event = payload.get("event")
        print(f"Received Salla Webhook Event: {event}")
        return {"status": "success", "event_received": event}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "Salla PageIndex Backend with Neon is running successfully!"}
