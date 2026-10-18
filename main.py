from fastapi import FastAPI, Request, HTTPException
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Salla PageIndex AI Search")

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

@app.post("/webhook")
async def salla_webhook(request: Request):
    """
    مسار استقبال التنبيهات (Webhooks) من منصة سلة
    عندما يتم إنشاء، تحديث، أو حذف منتج في متجرك، ستقوم سلة بإرسال إشعار إلى هذا الرابط.
    """
    try:
        payload = await request.json()
        event = payload.get("event")
        data = payload.get("data", {})
        
        # طباعة الحدث في سجلات السيرفر للتأكد من وصوله
        print(f"Received Salla Event: {event}")
        
        # هنا سنقوم لاحقاً بإضافة منطق تخزين أو تحديث المنتجات في قاعدة بيانات Neon
        
        return {"status": "success", "event_received": event}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "Salla PageIndex Backend with Neon is running successfully!"}
