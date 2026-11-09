"""Public pages for the app listing: a marketing page and the privacy policy. No login, no store data."""
import html,os
from pathlib import Path
from fastapi import APIRouter
from fastapi import HTTPException
from fastapi.responses import FileResponse, HTMLResponse

router=APIRouter()
STATIC=Path(__file__).parent/'static'
UPDATED='2026-10-25'

def contact():
    email=os.environ.get('SUPPORT_EMAIL','').strip()
    if '@' in email and ' ' not in email and len(email)<=120:
        safe=html.escape(email,quote=True)
        return f'راسلنا على <a href="mailto:{safe}">{safe}</a>.',f'<a href="mailto:{safe}">{safe}</a>'
    return 'تواصل معنا من صفحة التطبيق في متجر تطبيقات سلة.','دعم التطبيق من متجر سلة'

def big_email():
    email=os.environ.get('SUPPORT_EMAIL','').strip()
    if '@' in email and ' ' not in email and len(email)<=120:
        safe=html.escape(email,quote=True)
        return f'<a class="email" href="mailto:{safe}">{safe}</a>'
    return ''

def page(name):
    long,short=contact()
    text=(STATIC/name).read_text(encoding='utf-8').replace('{{EMAIL_BIG}}',big_email()).replace('{{CONTACT_SHORT}}',short).replace('{{CONTACT}}',long).replace('{{DATE}}',UPDATED)
    return HTMLResponse(text,headers={'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'})

@router.api_route('/about',methods=['GET','HEAD'],include_in_schema=False)
def about():return page('landing.html')

@router.api_route('/faq',methods=['GET','HEAD'],include_in_schema=False)
def faq():return page('faq.html')

EMAIL_ASSETS={'logo.png':'image/png','character.jpg':'image/jpeg'}

@router.get('/email-assets/{name}',include_in_schema=False)
def email_asset(name:str):
    if name not in EMAIL_ASSETS:raise HTTPException(404)
    return FileResponse(STATIC/'email'/name,media_type=EMAIL_ASSETS[name],headers={'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'})

@router.api_route('/privacy',methods=['GET','HEAD'],include_in_schema=False)
def privacy():return page('privacy.html')


BRAND={'bear.webp':'image/webp','fuzz.webp':'image/webp','fuzz.js':'application/javascript','fuzz.css':'text/css','app.css':'text/css','DMSans-Regular.woff2':'font/woff2','Epilogue-Black.woff2':'font/woff2'}

@router.get('/brand-assets/{name}',include_in_schema=False)
def brand_asset(name:str):
    # The character and the same fonts as the family's other app (DM Sans, Epilogue; Arabic is PingARLT from Salla's CDN) the public pages use: served by the app itself, no third-party CDN.
    if name not in BRAND:raise HTTPException(404)
    return FileResponse(STATIC/'brand'/name,media_type=BRAND[name],headers={'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'})
