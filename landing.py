"""Public pages for the app listing: a marketing page and the privacy policy. No login, no store data."""
import html,os
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router=APIRouter()
STATIC=Path(__file__).parent/'static'
UPDATED='2026-10-25'

def contact():
    email=os.environ.get('SUPPORT_EMAIL','').strip()
    if '@' in email and ' ' not in email and len(email)<=120:
        safe=html.escape(email,quote=True)
        return f'راسلنا على <a href="mailto:{safe}">{safe}</a>.',f'<a href="mailto:{safe}">{safe}</a>'
    return 'تواصل معنا من صفحة التطبيق في متجر تطبيقات سلة.','دعم التطبيق من متجر سلة'

def page(name):
    long,short=contact()
    text=(STATIC/name).read_text(encoding='utf-8').replace('{{CONTACT_SHORT}}',short).replace('{{CONTACT}}',long).replace('{{DATE}}',UPDATED)
    return HTMLResponse(text,headers={'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'})

@router.api_route('/about',methods=['GET','HEAD'],include_in_schema=False)
def about():return page('landing.html')

@router.api_route('/privacy',methods=['GET','HEAD'],include_in_schema=False)
def privacy():return page('privacy.html')
