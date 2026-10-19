"""Salla token verification and short-lived, merchant-scoped app sessions."""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from datetime import datetime

import requests
from fastapi import HTTPException

INTROSPECT_URL = 'https://api.salla.dev/exchange-authority/v1/introspect'
SESSION_SECONDS = 3600


def app_id():
    value = os.getenv('SALLA_APP_ID', '').strip()
    if not re.fullmatch(r'[0-9]{1,30}', value):
        raise HTTPException(503, 'أضف SALLA_APP_ID في إعدادات Render. معرّف تطبيقك: 755502526.')
    return value


def key():
    value = os.getenv('DASHBOARD_SESSION_SECRET', '')
    if len(value) < 32:
        raise HTTPException(503, 'إعداد مفتاح جلسة لوحة التحكم غير مكتمل في Render.')
    return value.encode()


def identifier(value):
    return not isinstance(value, bool) and bool(re.fullmatch(r'[0-9]{1,30}', str(value)))


def verify_salla_token(token):
    """Identity comes only from Salla's server, never from URL merchant parameters."""
    source = app_id()
    try:
        response = requests.post(
            INTROSPECT_URL,
            headers={'S-Source': source, 'Accept': 'application/json'},
            json={'token': token, 'env': 'prod', 'iss': 'merchant-dashboard', 'subject': 'embedded-page'},
            timeout=(5, 15), allow_redirects=False,
        )
    except requests.RequestException:
        raise HTTPException(503, 'تعذر التحقق من الجلسة لدى سلة. حاول مجددًا.') from None
    if response.status_code in (401, 403):
        raise HTTPException(401, 'جلسة سلة غير صالحة أو منتهية. أعد فتح التطبيق من سلة.')
    if response.status_code != 200:
        raise HTTPException(502, 'خدمة التحقق من سلة غير متاحة الآن. حاول مجددًا.')
    try:
        body = response.json()
        if not isinstance(body, dict) or body.get('success') is not True:
            raise ValueError()
        data = body['data']
        merchant, user = data['merchant_id'], data['user_id']
        if not identifier(merchant) or not identifier(user):
            raise ValueError()
        expiry = data['exp']
        if isinstance(expiry, str):
            dt = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
            if dt.tzinfo is None:
                raise ValueError()
            expiry = dt.timestamp()
        if isinstance(expiry, bool) or not isinstance(expiry, (int, float)) or not expiry > time.time():
            raise ValueError()
    except (ValueError, TypeError, KeyError, OverflowError):
        raise HTTPException(401, 'لم تُقبل جلسة سلة. أعد فتح التطبيق من لوحة التاجر.') from None
    return {'merchant_id': str(merchant), 'user_id': str(user)}


def issue_session(identity):
    now = int(time.time())
    claims = {**identity, 'aud': app_id(), 'iat': now, 'exp': now + SESSION_SECONDS,
              'nonce': secrets.token_hex(16)}
    payload = base64.urlsafe_b64encode(json.dumps(claims, separators=(',', ':')).encode()).decode().rstrip('=')
    value = 'sg1.' + payload
    signature = hmac.new(key(), value.encode(), hashlib.sha256).hexdigest()
    return value + '.' + signature


def verify_session(token):
    signing_key, audience = key(), app_id()
    try:
        if len(token) > 4096:
            raise ValueError()
        prefix, payload, signature = token.split('.')
        expected = hmac.new(signing_key, f'{prefix}.{payload}'.encode(), hashlib.sha256).hexdigest()
        if prefix != 'sg1' or not hmac.compare_digest(signature, expected):
            raise ValueError()
        data = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        now = time.time()
        if (data['aud'] != audience or type(data['exp']) is not int or type(data['iat']) is not int
                or data['exp'] <= now or data['iat'] > now + 30
                or data['exp'] - data['iat'] != SESSION_SECONDS
                or not identifier(data['merchant_id']) or not identifier(data['user_id'])):
            raise ValueError()
    except (ValueError, TypeError, KeyError, UnicodeError):
        raise HTTPException(401, 'انتهت جلسة التطبيق. أعد فتحه من سلة.') from None
    return data
