"""Keeps a store's Salla access token alive: refresh tokens are single use, so one request per store at a time."""
from contextlib import closing
import logging, os
import psycopg2
import requests

logger = logging.getLogger('salla_tokens')
TOKEN_URL = 'https://accounts.salla.sa/oauth2/token'

class TokenError(RuntimeError):
    pass

def refresh(merchant, stale=None):
    try:
        return _refresh(merchant, stale)
    except psycopg2.Error as error:
        logger.error('Token refresh database error: %s', type(error).__name__)
        raise TokenError('تعذر حفظ الصلاحية الجديدة. حاول لاحقًا.') from None

def _refresh(merchant, stale=None):
    """Return a working access token. If another request already refreshed it (token differs from `stale`), reuse that."""
    from dashboard import db
    client_id, secret = os.getenv('SALLA_CLIENT_ID', '').strip(), os.getenv('SALLA_CLIENT_SECRET', '').strip()
    if not client_id or not secret:
        raise TokenError('بيانات تطبيق سلة غير مضبوطة على الخادم.')
    revoked = False
    with closing(db()) as conn:
        with conn, conn.cursor() as cur:
            cur.execute('SELECT pg_advisory_xact_lock(hashtext(%s))', ('token:' + merchant,))
            cur.execute('SELECT access_token,refresh_token FROM stores WHERE merchant_id=%s', (merchant,))
            row = cur.fetchone()
            if not row or not row[1]:
                raise TokenError('المتجر غير مربوط. أعد تثبيت التطبيق من سلة.')
            access, refresh_token = row
            if stale and access and access != stale:
                return access
            try:
                response = requests.post(TOKEN_URL, timeout=(5, 20), allow_redirects=False, headers={'Accept': 'application/json'},
                                         data={'grant_type': 'refresh_token', 'refresh_token': refresh_token, 'client_id': client_id, 'client_secret': secret})
            except requests.RequestException as error:
                logger.error('Token refresh failed to connect: %s', type(error).__name__)
                raise TokenError('تعذر الاتصال بسلة لتجديد الصلاحية.') from None
            if response.status_code in (400, 401):
                cur.execute('UPDATE stores SET access_token=NULL,refresh_token=NULL WHERE merchant_id=%s', (merchant,))
                revoked = True
            elif response.status_code != 200:
                raise TokenError(f'تعذر تجديد صلاحية المتجر (HTTP {response.status_code}).')
            else:
                try:
                    data = response.json()
                except ValueError:
                    data = {}
                new_access, new_refresh = data.get('access_token'), data.get('refresh_token')
                if not all(isinstance(t, str) and t.strip() for t in (new_access, new_refresh)):
                    raise TokenError('ردّت سلة بدون رموز صالحة.')
                cur.execute('UPDATE stores SET access_token=%s,refresh_token=%s WHERE merchant_id=%s', (new_access, new_refresh, merchant))
                return new_access
    if revoked:
        logger.warning('Refresh token rejected for merchant %s; store marked disconnected', merchant)
        raise TokenError('انتهت صلاحية ربط المتجر. أعد تثبيت التطبيق من سلة.')
