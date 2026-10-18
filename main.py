from contextlib import closing
import logging
import os
from urllib.parse import urlsplit

from fastapi import FastAPI, Request, HTTPException
import psycopg2
from dotenv import load_dotenv
import requests

load_dotenv()

app = FastAPI(title="Salla PageIndex AI Search")
logger = logging.getLogger("salla_backend")

CALLBACK_PATH = "/auth/callback"
TOKEN_URL = "https://accounts.salla.sa/oauth2/token"
USER_INFO_URL = "https://accounts.salla.sa/oauth2/user/info"
HTTP_TIMEOUT = (10, 30)

# في Render وفي لوحة مطوري سلة، استخدم القيمة نفسها:
# https://salla-pageindex-api.onrender.com/auth/callback


def required_env(name):
    value = os.getenv(name, "").strip()
    if not value:
        raise HTTPException(status_code=500, detail=f"{name} is not set in Render")
    return value


def response_json(response, label):
    try:
        data = response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail=f"Invalid JSON from Salla {label}") from None
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail=f"Invalid response from Salla {label}")
    return data


# إنشاء الجداول إذا لم تكن موجودة، دون حذف البيانات الحالية.
def init_db():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        logger.error("DATABASE_URL is not set")
        return
    try:
        with closing(psycopg2.connect(database_url, connect_timeout=10)) as conn:
            with conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS stores (
                            merchant_id TEXT PRIMARY KEY,
                            access_token TEXT,
                            refresh_token TEXT,
                            store_name TEXT
                        );
                    """)
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
    except psycopg2.Error as exc:
        # لا نطبع سلسلة الاتصال أو كلمات المرور في السجلات.
        logger.error("Database initialization failed: %s", type(exc).__name__)


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/api/test-db")
def test_db():
    database_url = required_env("DATABASE_URL")
    try:
        with closing(psycopg2.connect(database_url, connect_timeout=10)) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                db_version = cur.fetchone()[0]
        return {
            "status": "success",
            "message": "Connected to Neon Database successfully!",
            "postgres_version": db_version,
        }
    except psycopg2.Error as exc:
        logger.error("Database check failed: %s", type(exc).__name__)
        raise HTTPException(status_code=500, detail="Database connection failed") from None


@app.get(CALLBACK_PATH)
def auth_callback(code: str = None, error: str = None):
    """استقبال كود التفويض في وضع Custom Mode وحفظ بيانات المتجر الحقيقي."""
    if error:
        raise HTTPException(status_code=400, detail="Salla authorization was not completed")
    if not code:
        raise HTTPException(
            status_code=400,
            detail="Authorization code not found. Start from the Salla app installation link.",
        )

    client_id = required_env("SALLA_CLIENT_ID")
    client_secret = required_env("SALLA_CLIENT_SECRET")
    redirect_uri = required_env("SALLA_REDIRECT_URI")
    database_url = required_env("DATABASE_URL")

    # منع أخطاء النسخ، مثل لصق صيغة Markdown أو إضافة مسار مختلف.
    try:
        parsed_uri = urlsplit(redirect_uri)
        valid_uri = (
            parsed_uri.scheme == "https"
            and bool(parsed_uri.hostname)
            and parsed_uri.path == CALLBACK_PATH
            and not parsed_uri.query
            and not parsed_uri.fragment
            and not parsed_uri.username
            and not parsed_uri.password
            and not any(char.isspace() for char in redirect_uri)
        )
    except ValueError:
        valid_uri = False
    if not valid_uri:
        raise HTTPException(
            status_code=500,
            detail="SALLA_REDIRECT_URI must be the plain HTTPS URL ending in /auth/callback",
        )

    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
        "code": code,
    }

    try:
        token_res = requests.post(
            TOKEN_URL,
            data=payload,
            headers={"Accept": "application/json"},
            timeout=HTTP_TIMEOUT,
            allow_redirects=False,
        )
        if token_res.status_code != 200:
            # لا نعيد محتوى استجابة التوكن الخام إلى المتصفح.
            raise HTTPException(
                status_code=502,
                detail=(
                    f"Salla token request failed (HTTP {token_res.status_code}). "
                    "Check the app credentials and matching Redirect URI, then start a new authorization."
                ),
            )

        token_data = response_json(token_res, "token endpoint")
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        if not isinstance(access_token, str) or not access_token.strip():
            raise HTTPException(status_code=502, detail="Salla did not return an access token")
        if not isinstance(refresh_token, str) or not refresh_token.strip():
            raise HTTPException(
                status_code=502,
                detail="Salla did not return a refresh token. Include offline_access and authorize again.",
            )

        merchant_res = requests.get(
            USER_INFO_URL,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            timeout=HTTP_TIMEOUT,
            allow_redirects=False,
        )
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="The request to Salla timed out") from None
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Could not connect to Salla") from None

    if merchant_res.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Could not fetch Salla store information (HTTP {merchant_res.status_code})",
        )

    user_response = response_json(merchant_res, "user information endpoint")
    user_info = user_response.get("data")
    merchant = user_info.get("merchant") if isinstance(user_info, dict) else None
    merchant_id = merchant.get("id") if isinstance(merchant, dict) else None

    # data.id يخص المستخدم؛ معرّف المتجر الصحيح هو data.merchant.id.
    # لا نحفظ التوكن باسم default_merchant عند فشل تحديد المتجر.
    if (
        user_response.get("success") is False
        or isinstance(merchant_id, bool)
        or not isinstance(merchant_id, (str, int))
        or not str(merchant_id).isdigit()
        or int(merchant_id) <= 0
    ):
        raise HTTPException(status_code=502, detail="Salla response is missing a valid merchant ID")

    merchant_id = str(merchant_id)
    store_name = merchant.get("name")
    if not isinstance(store_name, str) or not store_name.strip():
        store_name = merchant_id

    try:
        with closing(psycopg2.connect(database_url, connect_timeout=10)) as conn:
            with conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO stores (merchant_id, access_token, refresh_token, store_name)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (merchant_id)
                        DO UPDATE SET
                            access_token = EXCLUDED.access_token,
                            refresh_token = EXCLUDED.refresh_token,
                            store_name = EXCLUDED.store_name;
                    """, (merchant_id, access_token, refresh_token, store_name))
    except psycopg2.Error as exc:
        logger.error("Store authorization save failed: %s", type(exc).__name__)
        raise HTTPException(status_code=500, detail="Could not save the store authorization") from None

    return {
        "status": "success",
        "merchant_id": merchant_id,
        "message": f"App installed and connected successfully for store: {store_name}!",
    }


@app.post("/webhook")
async def salla_webhook(request: Request):
    # يستقبل الأحداث ويسجل أسماءها فقط؛ مزامنة المنتجات لم تُنفذ بعد.
    try:
        payload = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid webhook JSON") from None
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook payload must be a JSON object")
    event = payload.get("event")
    logger.info("Received Salla webhook event: %s", event)
    return {"status": "success", "event_received": event}


@app.get("/")
def read_root():
    return {"message": "Salla PageIndex Backend with Neon is running successfully!"}
