"""Embedded dashboard entry point; standalone administrator access stays separate."""
import hashlib
import hmac
import logging
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel, Field, ConfigDict

from dashboard import query
from embedded_auth import app_id, key, verify_salla_token, issue_session, SESSION_SECONDS

router = APIRouter()
STATIC = Path(__file__).parent / 'static'
PAGE_HEADERS = {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "frame-ancestors https://s.salla.sa; object-src 'none'; base-uri 'self'",
}


class RedactTokenQuery(logging.Filter):
    """Uvicorn ordinarily logs the complete iframe URL, including Salla's token."""
    def filter(self, record):
        if isinstance(record.args, tuple) and len(record.args) == 5:
            args = list(record.args)
            if isinstance(args[2], str):
                parts = urlsplit(args[2])
                if parts.query:
                    values = [(k, '[REDACTED]' if k.lower() in
                               ('token', 'access_token', 'refresh_token') else v)
                              for k, v in parse_qsl(parts.query, keep_blank_values=True)]
                    args[2] = urlunsplit((*parts[:3], urlencode(values), parts.fragment))
                    record.args = tuple(args)
        return True


@router.get('/salla/embedded', include_in_schema=False)
def embedded_page():
    content = (STATIC / 'dashboard.html').read_text(encoding='utf-8')
    content = content.replace('<body>', '<body class="embedded">', 1)
    content = content.replace('</head>', '<meta name="referrer" content="no-referrer">'
                              '<link rel="stylesheet" href="/embedded-assets/salla-dashboard.css">'
                              '<script src="/embedded-assets/salla-embedded-sdk-0.2.6.js"></script>'
                              '<script defer src="/embedded-assets/salla-embedded.js"></script></head>', 1)
    # Bootstrap script must run before the existing admin script at the bottom.
    content = content.replace('<script defer src="/embedded-assets/salla-embedded.js"></script>',
                              '<script src="/embedded-assets/salla-embedded.js"></script>')
    return HTMLResponse(content, headers=PAGE_HEADERS)


ASSETS = {
    'salla-dashboard.css': 'text/css',
    'salla-embedded.js': 'application/javascript',
    'salla-embedded-sdk-0.2.6.js': 'application/javascript',
}


@router.get('/embedded-assets/{name}', include_in_schema=False)
def embedded_asset(name: str):
    if name not in ASSETS:
        raise HTTPException(404)
    return FileResponse(STATIC / name, media_type=ASSETS[name],
                        headers={'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'})


class EmbeddedLogin(BaseModel):
    model_config = ConfigDict(extra='forbid')
    token: str = Field(min_length=1, max_length=8192)


@router.post('/dashboard-api/embedded-session')
def embedded_session(body: EmbeddedLogin, request: Request):
    signing_key = key()
    source = app_id()
    if request.headers.get('x-dashboard-request') != '1':
        raise HTTPException(403, 'طلب غير موثق.')
    ip = request.client.host if request.client else 'unknown'
    limit_key = hmac.new(signing_key, ('embedded:' + ip).encode(), hashlib.sha256).hexdigest()
    row = query('''INSERT INTO dashboard_login_limits VALUES (%s,1,now())
        ON CONFLICT(key) DO UPDATE SET
        attempts=CASE WHEN dashboard_login_limits.window_start < now()-interval '15 minutes' THEN 1 ELSE dashboard_login_limits.attempts+1 END,
        window_start=CASE WHEN dashboard_login_limits.window_start < now()-interval '15 minutes' THEN now() ELSE dashboard_login_limits.window_start END
        RETURNING attempts''', (limit_key,), one=True)
    if row['attempts'] > 60:
        raise HTTPException(429, 'محاولات كثيرة. حاول بعد 15 دقيقة.')
    identity = verify_salla_token(body.token)
    store = query("SELECT merchant_id FROM stores WHERE merchant_id=%s AND COALESCE(access_token,'')<>''",
                  (identity['merchant_id'],), one=True)
    if not store:
        raise HTTPException(403, 'هذا المتجر غير مربوط بالتطبيق. أعد إرسال التفويض من سلة.')
    return JSONResponse({'session_token': issue_session(identity), 'merchant_id': identity['merchant_id'],
                         'app_id': source, 'expires_in': SESSION_SECONDS},
                        headers={'Cache-Control': 'no-store', 'Pragma': 'no-cache'})
