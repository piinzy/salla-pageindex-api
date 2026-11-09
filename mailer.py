"""The welcome email a merchant gets once, right after installing the app. Sent through Resend's HTTP API (hosts such as Render
block outbound SMTP on small plans). Without RESEND_API_KEY and MAIL_FROM nothing is sent and the app works as before."""
import html
import logging
import os
import re

import requests

from dashboard import query

logger = logging.getLogger('size_guide.mail')
API = 'https://api.resend.com/emails'
USER_INFO_URL = 'https://accounts.salla.sa/oauth2/user/info'
# Salla gives its demo stores a made-up owner address on this domain (no mailbox exists), so mail to it only bounces.
DEMO_DOMAINS = {'email.partners'}


def initialize():
    query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ')


def configured():
    return bool(os.getenv('RESEND_API_KEY', '').strip() and os.getenv('MAIL_FROM', '').strip())


def owner_info(access_token):
    """(store name, owner address) from Salla, or (None, None): a failure never blocks an installation."""
    try:
        response = requests.get(USER_INFO_URL, headers={'Authorization': f'Bearer {access_token}', 'Accept': 'application/json'},
                                timeout=(5, 15), allow_redirects=False)
        info = response.json().get('data', {}) if response.ok else {}
        merchant = info.get('merchant', {}) if isinstance(info, dict) else {}
    except (requests.RequestException, ValueError, AttributeError):
        return None, None
    name = merchant.get('name') if isinstance(merchant, dict) else None
    email = (info.get('email') if isinstance(info, dict) else None) or (merchant.get('email') if isinstance(merchant, dict) else None)
    return (name.strip()[:120] if isinstance(name, str) and name.strip() else None,
            email.strip()[:200] if isinstance(email, str) and re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', email.strip()) else None)


def welcome_message(store_name, base, support):
    """(subject, html, text). Table layout with inline styles: the only thing every mail app renders the same. The two images are
    served by this app (/email-assets) and must be absolute https URLs."""
    name = html.escape(store_name or 'متجرك')
    base = html.escape(base)
    app_id = ''.join(ch for ch in os.getenv('SALLA_APP_ID', '').strip() if ch.isdigit())
    open_url = f'https://s.salla.sa/embedded/app/{app_id}/size-guide' if app_id else 'https://salla.sa'
    contact = (f'<a href="mailto:{html.escape(support)}" style="color:#10143f;font-weight:700">{html.escape(support)}</a>'
               if support else 'صفحة التطبيق في متجر تطبيقات سلة')
    font = "font-family:Tahoma,'Segoe UI',Arial,sans-serif"
    step = lambda n, title, text: f'''<tr><td style="padding:0 0 14px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1ff;border-radius:16px"><tr>
<td width="64" valign="top" align="center" style="padding:16px 8px 16px 16px"><div style="width:36px;height:36px;line-height:36px;border-radius:18px;background:#0b0b0d;color:#ffffff;font-weight:700;font-size:16px;text-align:center;{font}">{n}</div></td>
<td valign="top" style="padding:16px 0 16px 18px;{font};color:#10143f;text-align:right"><div style="font-weight:700;font-size:16px;line-height:1.5">{title}</div><div style="font-size:14px;line-height:1.8;color:#454b7a;padding-top:2px">{text}</div></td></tr></table></td></tr>'''
    subject = 'أهلاً بك في دليلك بلس'
    body = f'''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>{subject}</title></head>
<body style="margin:0;padding:0;background:#e3e8ff;{font}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#e3e8ff">تم تثبيت التطبيق على {name}، وتجربتك المجانية بدأت. هذه خطواتك الثلاث للبدء.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#e3e8ff"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:28px;overflow:hidden">
<tr><td bgcolor="#b6c3fa" align="center" style="background:#b6c3fa;padding:32px 24px 0 24px">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
<td valign="middle" style="padding-left:12px"><img src="{base}/email-assets/logo.png" width="52" height="52" alt="" style="display:block;border-radius:14px;border:0"></td>
<td valign="middle" style="{font};font-size:28px;font-weight:700;color:#10143f">دليلك بلس</td></tr></table>
<div style="{font};font-size:30px;line-height:1.4;font-weight:700;color:#10143f;padding:22px 0 6px 0">أهلاً بك! 👋</div>
<div style="{font};font-size:16px;line-height:1.8;color:#232a63;padding:0 8px 18px 8px">تم تثبيت التطبيق على <b>{name}</b>، وتجربتك المجانية (7 أيام) بدأت الآن.</div>
<img src="{base}/email-assets/character.jpg" width="320" alt="دليلك بلس" style="display:block;width:320px;max-width:100%;height:auto;border:0;margin:0 auto"></td></tr>
<tr><td style="padding:30px 28px 8px 28px">
<div style="{font};font-size:20px;font-weight:700;color:#10143f;padding-bottom:16px;text-align:right">ابدأ في 3 خطوات</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
{step('1', 'افتح التطبيق', 'من لوحة سلة: التطبيقات المثبتة ثم «دليلك بلس»، وزامن منتجاتك.')}
{step('2', 'أنشئ جدول المقاسات', 'اختر هيكلًا جاهزًا أو الصق جدولك من Excel أو ارفع صورة جدول، ثم اربطه بمنتج أو بفئة كاملة وانشره.')}
{step('3', 'فعّل الزر في متجرك', 'اختر تصميم الزر ومكانه، وأضف كود التطبيق مرة واحدة في بوابة سلة، فيظهر الزر في كل منتج له جدول.')}
</table></td></tr>
<tr><td align="center" style="padding:10px 28px 8px 28px"><a href="{open_url}" style="display:inline-block;background:#0b0b0d;color:#ffffff;text-decoration:none;{font};font-weight:700;font-size:17px;line-height:1;padding:17px 34px;border-radius:14px">افتح لوحة التطبيق</a></td></tr>
<tr><td style="padding:22px 28px 6px 28px;{font};font-size:14px;line-height:1.9;color:#454b7a;text-align:right">
أسئلة سريعة؟ <a href="{base}/faq" style="color:#10143f;font-weight:700">الأسئلة الشائعة</a>، أو راسلنا: {contact}</td></tr>
<tr><td bgcolor="#eef1ff" align="center" style="background:#eef1ff;padding:18px 28px;{font};font-size:12px;line-height:1.8;color:#7a80ab">وصلتك هذه الرسالة مرة واحدة لأنك ثبّت التطبيق. لا نرسل رسائل تسويقية.<br>دليلك بلس · من عائلة متكامل</td></tr>
</table></td></tr></table></body></html>'''
    text = (f'أهلاً بك في «دليلك بلس»\n\nتم تثبيت التطبيق على {store_name or "متجرك"}، وتجربتك المجانية (7 أيام) بدأت الآن.\n\n'
            '1) افتح التطبيق: لوحة سلة ← التطبيقات المثبتة ← دليلك بلس، وزامن منتجاتك.\n'
            '2) أنشئ جدول المقاسات واربطه بمنتج أو بفئة وانشره.\n3) فعّل الزر: اختر تصميمه ومكانه وأضف كود التطبيق مرة واحدة في بوابة سلة.\n\n'
            f'افتح لوحة التطبيق: {open_url}\nالأسئلة الشائعة: {html.unescape(base)}/faq\n'
            + (f'للتواصل: {support}\n' if support else ''))
    return subject, body, text


def is_demo(email):
    return email.rsplit('@', 1)[-1].lower() in DEMO_DOMAINS


def message(email, subject, body, text=''):
    """The request body. MAIL_BCC (optional) gets a blind copy. A demo store's made-up address is never mailed: the copy goes to
    MAIL_BCC instead, or nothing is sent."""
    bcc = os.getenv('MAIL_BCC', '').strip()
    bcc = bcc if bcc and '@' in bcc and ' ' not in bcc else ''
    data = {'from': os.getenv('MAIL_FROM', '').strip(), 'to': [email], 'subject': subject, 'html': body}
    if text:
        data['text'] = text
    if is_demo(email):
        if not bcc:
            return None
        data['to'] = [bcc]
    elif bcc and bcc.lower() != email.lower():
        data['bcc'] = [bcc]
    return data


def send_welcome(merchant, access_token):
    """Best effort and once per store: a mail problem never affects installing the app."""
    try:
        if not configured():
            logger.info('Welcome email skipped for merchant %s: not configured', merchant)
            return False
        row = query('SELECT welcome_sent_at FROM stores WHERE merchant_id=%s', (merchant,), one=True)
        if not row or row['welcome_sent_at']:
            return False
        name, email = owner_info(access_token)
        if not email:
            logger.info('Welcome email skipped for merchant %s: no address', merchant)
            return False
        base = os.getenv('PUBLIC_BASE_URL', '').strip().rstrip('/') or 'https://sizes.mutakaml.com'
        subject, body, text = welcome_message(name, base, os.getenv('SUPPORT_EMAIL', '').strip())
        payload = message(email, subject, body, text)
        if payload is None:
            logger.info('Welcome email skipped for merchant %s: demo-store address and no MAIL_BCC', merchant)
            return False
        response = requests.post(API, timeout=(5, 15), headers={'Authorization': 'Bearer ' + os.getenv('RESEND_API_KEY', '').strip()},
                                 json=payload)
        if not response.ok:
            logger.warning('Welcome email refused for merchant %s: HTTP %s', merchant, response.status_code)
            return False
        query('UPDATE stores SET welcome_sent_at=now() WHERE merchant_id=%s', (merchant,))
        logger.info('Welcome email sent for merchant %s', merchant)
        return True
    except Exception as error:   # never let mail affect an installation
        logger.warning('Welcome email failed for merchant %s: %s', merchant, type(error).__name__)
        return False
