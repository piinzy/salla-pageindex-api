"""Salla size guides: store authorization, product events and app entry points."""
from contextlib import closing
import hmac
import logging
import os
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, Request, HTTPException
from starlette.concurrency import run_in_threadpool
import psycopg2
from dotenv import load_dotenv
import requests

# Hosting environment values take precedence over local development files.
PROJECT_ROOT = Path(__file__).resolve().parent
load_dotenv(PROJECT_ROOT / ".env.local", override=False)
load_dotenv(PROJECT_ROOT / ".env", override=False)

from dashboard import router as dashboard_router, initialize as initialize_dashboard, update_product_event

app = FastAPI(title="Salla Product Size Guides")
from size_guides import router as size_router, initialize as initialize_size_guides
app.include_router(dashboard_router)
app.include_router(size_router)
from button_settings import router as button_router, initialize as initialize_button_settings
app.include_router(button_router)
from size_library import router as library_router
from size_stats import router as stats_router, initialize as initialize_size_stats
from ai_import import router as ai_router
from size_presets import router as presets_router, initialize as initialize_size_presets
for extra_router in (library_router, stats_router, ai_router, presets_router):
    app.include_router(extra_router)
from embedded import router as embedded_router, RedactTokenQuery
app.include_router(embedded_router)
logging.getLogger('uvicorn.access').addFilter(RedactTokenQuery())
logger = logging.getLogger("salla_backend")

CALLBACK_PATH = "/auth/callback"
TOKEN_URL = "https://accounts.salla.sa/oauth2/token"
USER_INFO_URL = "https://accounts.salla.sa/oauth2/user/info"
HTTP_TIMEOUT = (10, 30)

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
    # Schema setup uses a direct connection; requests use pooled DATABASE_URL.
    database_url = os.getenv("DATABASE_URL_UNPOOLED") or os.getenv("DATABASE_URL")
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
    except psycopg2.Error as exc:
        # لا نطبع سلسلة الاتصال أو كلمات المرور في السجلات.
        logger.error("Database initialization failed: %s", type(exc).__name__)


@app.on_event("startup")
def startup_event():
    init_db()
    initialize_dashboard()
    initialize_size_guides()
    initialize_button_settings()
    initialize_size_stats()
    initialize_size_presets()


@app.api_route("/health", methods=["GET", "HEAD"], include_in_schema=False)
def health():
    database_url = required_env("DATABASE_URL")
    try:
        with closing(psycopg2.connect(database_url, connect_timeout=10)) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
                cur.fetchone()
        return {"status": "ok", "service": "salla-size-guides"}
    except psycopg2.Error as exc:
        logger.error("Database check failed: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Service temporarily unavailable") from None


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


def save_webhook_authorization(merchant_id, access_token, refresh_token):
    database_url = required_env("DATABASE_URL")
    try:
        with closing(psycopg2.connect(database_url, connect_timeout=10)) as conn:
            with conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO stores (merchant_id, access_token, refresh_token, store_name)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (merchant_id) DO UPDATE SET
                            access_token = EXCLUDED.access_token,
                            refresh_token = EXCLUDED.refresh_token;
                    """, (merchant_id, access_token, refresh_token, merchant_id))
    except psycopg2.Error as exc:
        logger.error("Webhook authorization save failed: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Could not save store authorization") from None


@app.post("/webhook")
async def salla_webhook(request: Request):
    # Token security mode: use the webhook secret, NOT the OAuth client secret.
    secret = required_env("SALLA_WEBHOOK_SECRET")
    strategy = request.headers.get("x-salla-security-strategy", "Token").lower()
    if strategy != "token":
        raise HTTPException(status_code=401, detail="Expected Token webhook security strategy")
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        authorization = authorization[7:]
    candidates = (
        request.headers.get("x-salla-token", ""),
        request.headers.get("x-salla-signature", ""),
        authorization,
    )
    if not any(hmac.compare_digest(value.encode(), secret.encode()) for value in candidates):
        raise HTTPException(status_code=401, detail="Invalid webhook authentication")
    try:
        payload = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid webhook JSON") from None
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook payload must be a JSON object")
    event = payload.get("event")
    if not isinstance(event, str) or not event or len(event) > 150:
        raise HTTPException(status_code=400, detail="Invalid webhook event")
    if event.startswith("product."):
        merchant = payload.get("merchant")
        if isinstance(merchant, bool) or not str(merchant).isdigit():
            raise HTTPException(status_code=400, detail="Invalid merchant ID")
        await run_in_threadpool(update_product_event, str(merchant), event, payload.get("data"))
        return {"status": "success", "event_received": event}
    if event != "app.store.authorize":
        return {"status": "ignored", "event_received": event}
    merchant_id = payload.get("merchant")
    if (isinstance(merchant_id, bool) or not isinstance(merchant_id, (str, int))
            or not str(merchant_id).isascii() or not str(merchant_id).isdigit()
            or len(str(merchant_id)) > 30 or int(merchant_id) <= 0):
        raise HTTPException(status_code=400, detail="Invalid merchant ID")
    data = payload.get("data")
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Missing authorization data")
    access_token, refresh_token = data.get("access_token"), data.get("refresh_token")
    if not all(isinstance(t, str) and t.strip() for t in (access_token, refresh_token)):
        raise HTTPException(status_code=400, detail="Missing access or refresh token")
    merchant_id = str(merchant_id)
    await run_in_threadpool(save_webhook_authorization, merchant_id, access_token, refresh_token)
    logger.info("Store authorization saved for merchant %s", merchant_id)
    return {"status": "success", "event_received": event, "merchant_id": merchant_id}


@app.api_route("/", methods=["GET", "HEAD"])
def read_root():
    return {"status": "ok", "service": "salla-size-guides"}
