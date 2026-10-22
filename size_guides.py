"""Per-product sizing guides; only an explicitly published snapshot is public."""
import json, re
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field, ConfigDict, create_model, field_validator, model_validator
from psycopg2.extras import Json
from dashboard import query, authenticated, require_store
from button_settings import ButtonSettings

router=APIRouter()
HEX_OR_EMPTY=r'^(#[0-9a-fA-F]{6})?$'
DATA_IMAGE=re.compile(r'data:image/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]{20,300000}')
HTTPS_URL=re.compile(r'https://[^\s"\'<>\\]{4,480}')
VIDEO_URL=re.compile(r'https://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|player\.vimeo\.com/video/|vimeo\.com/)[A-Za-z0-9_-]{5,20}(?:[?&][A-Za-z0-9_=&.-]{0,60})?')
PUBLIC_HEADERS={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}

def initialize():
    query('''CREATE TABLE IF NOT EXISTS product_size_guides (
        merchant_id TEXT NOT NULL, product_id TEXT NOT NULL,
        draft JSONB NOT NULL, published JSONB, version INTEGER NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), published_at TIMESTAMPTZ,
        PRIMARY KEY(merchant_id,product_id))''')
    # A guide shared by many products: edit once, every linked product follows its published copy.
    query('''CREATE TABLE IF NOT EXISTS size_guide_library (
        merchant_id TEXT NOT NULL, library_id TEXT NOT NULL, name TEXT NOT NULL,
        draft JSONB NOT NULL, published JSONB, version INTEGER NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), published_at TIMESTAMPTZ,
        PRIMARY KEY(merchant_id,library_id))''')
    query('ALTER TABLE product_size_guides ADD COLUMN IF NOT EXISTS library_id TEXT')

class Column(BaseModel):
    model_config=ConfigDict(extra='forbid')
    label:str=Field(min_length=1,max_length=40)
    kind:Literal['measurement','text']='measurement'

class SizeRow(BaseModel):
    model_config=ConfigDict(extra='forbid')
    size:str=Field(max_length=30)
    values:list[str]=Field(min_length=1,max_length=10)

class Guide(BaseModel):
    model_config=ConfigDict(extra='forbid')
    title:str=Field(default='دليل المقاسات',min_length=1,max_length=100)
    button_label:str=Field(default='دليل المقاسات',min_length=1,max_length=40)
    unit:Literal['cm','in']='cm'
    measurement_type:Literal['body','garment']='garment'
    columns:list[Column]=Field(min_length=1,max_length=10)
    rows:list[SizeRow]=Field(min_length=1,max_length=30)
    notes:str=Field(default='',max_length=2000)
    instructions:str=Field(default='',max_length=3000)
    color:str=Field(default='#177e65',pattern=r'^#[0-9a-fA-F]{6}$')
    category:Literal['general','women','men','kids','shoes','pets','accessories']='general'
    theme:Literal['classic','rose','velvet','gold','tailor','slate','sport','leather','paws','mint','night','minimal']='classic'
    table_style:Literal['zebra','lines','cards','plain']='zebra'
    density:Literal['compact','comfortable']='comfortable'
    corners:Literal['sharp','soft','round']='soft'
    depth3d:bool=True
    header_icon:bool=True
    size_style:Literal['chip','pill','square','underline','plain']='chip'
    header_style:Literal['auto','tint','solid','plain','line']='auto'
    border_style:Literal['auto','none','thin','strong']='auto'
    font_scale:Literal['small','medium','large']='medium'
    sticky_size:bool=True
    size_label:str=Field(default='',max_length=20)
    header_bg:str=Field(default='',pattern=HEX_OR_EMPTY)
    header_text:str=Field(default='',pattern=HEX_OR_EMPTY)
    row_alt:str=Field(default='',pattern=HEX_OR_EMPTY)
    border_color:str=Field(default='',pattern=HEX_OR_EMPTY)
    text_color:str=Field(default='',pattern=HEX_OR_EMPTY)
    paper_color:str=Field(default='',pattern=HEX_OR_EMPTY)
    size_bg:str=Field(default='',pattern=HEX_OR_EMPTY)
    size_text:str=Field(default='',pattern=HEX_OR_EMPTY)
    calculator:bool=False
    language:Literal['ar','en','auto']='ar'
    how_images:list[str]=Field(default_factory=list,max_length=4)
    how_diagram:bool=False
    how_video:str=Field(default='',max_length=200)
    logo_url:str=Field(default='',max_length=500)
    @field_validator('how_images')
    @classmethod
    def check_images(cls,values):
        if any(not (HTTPS_URL.fullmatch(v) or DATA_IMAGE.fullmatch(v)) for v in values):raise ValueError('الصورة يجب أن تكون رابط https أو صورة مرفوعة (JPG أو PNG أو WebP)')
        return values
    @field_validator('logo_url')
    @classmethod
    def check_logo(cls,value):
        if value and not HTTPS_URL.fullmatch(value):raise ValueError('رابط الشعار يجب أن يبدأ بـ https')
        return value
    @field_validator('how_video')
    @classmethod
    def check_video(cls,value):
        if value and not VIDEO_URL.fullmatch(value):raise ValueError('أدخل رابط يوتيوب أو فيميو صالحًا')
        return value
    @model_validator(mode='after')
    def validate_grid(self):
        if any(not c.label.strip() for c in self.columns):raise ValueError('اسم العمود مطلوب')
        labels=[c.label.strip().casefold() for c in self.columns]
        if len(labels)!=len(set(labels)):raise ValueError('أسماء الأعمدة مكررة')
        for r in self.rows:
            if len(r.values)!=len(self.columns):raise ValueError('عدد الخلايا لا يطابق الأعمدة')
            if any(len(v)>60 for v in r.values):raise ValueError('قيمة الخلية طويلة')
        return self

# Appearance only (never the table's contents): what a saved design ("preset") may carry.
STYLE_FIELDS=('theme','color','table_style','density','corners','depth3d','header_icon','size_style','header_style','border_style',
              'font_scale','sticky_size','header_bg','header_text','row_alt','border_color','text_color','paper_color','size_bg','size_text')
GuideStyle=create_model('GuideStyle',__config__=ConfigDict(extra='forbid'),
                        **{name:(Guide.model_fields[name].annotation,Guide.model_fields[name]) for name in STYLE_FIELDS})

class SaveGuide(BaseModel):
    model_config=ConfigDict(extra='forbid')
    version:int=Field(ge=0)
    guide:Guide
    action:Literal['draft','publish']='draft'

class Version(BaseModel):
    version:int=Field(ge=1)

def validate_publish(guide):
    sizes=[r.size.strip().casefold() for r in guide.rows]
    if any(not s for s in sizes) or len(set(sizes))!=len(sizes):
        raise HTTPException(400,'أدخل اسمًا فريدًا لكل مقاس قبل النشر.')
    if any(not v.strip() for r in guide.rows for v in r.values):
        raise HTTPException(400,'أكمل جميع الخلايا قبل النشر؛ استخدم — للخانات غير المنطبقة.')

def ensure_not_linked(merchant,product_id):
    row=query('SELECT library_id FROM product_size_guides WHERE merchant_id=%s AND product_id=%s',(merchant,product_id),True)
    if row and row.get('library_id'):
        raise HTTPException(409,'هذا المنتج مرتبط بجدول مشترك. عدّل الجدول المشترك أو افصل الارتباط أولًا.')

def product(merchant,product_id):
    require_store(merchant)
    result=query('SELECT product_id,title,sku,image,status FROM dashboard_catalog WHERE merchant_id=%s AND product_id=%s',(merchant,product_id),True)
    if not result:raise HTTPException(404,'المنتج غير موجود في هذا المتجر. زامن المنتجات أولًا.')
    return result

LINKED="g.library_id IS NOT NULL"
@router.get('/dashboard-api/size-guides',dependencies=[Depends(authenticated)])
def list_guides(merchant:str):
    require_store(merchant)
    return query(f'''SELECT g.product_id,c.title,c.sku,g.version,g.updated_at,g.published_at,g.library_id,l.name AS library_name,
        CASE WHEN {LINKED} THEN l.published IS NOT NULL ELSE g.published IS NOT NULL END AS is_published,
        CASE WHEN {LINKED} THEN l.draft IS DISTINCT FROM l.published ELSE g.draft IS DISTINCT FROM g.published END AS has_changes
        FROM product_size_guides g JOIN dashboard_catalog c USING(merchant_id,product_id)
        LEFT JOIN size_guide_library l ON l.merchant_id=g.merchant_id AND l.library_id=g.library_id
        WHERE g.merchant_id=%s ORDER BY g.updated_at DESC''',(merchant,))

@router.get('/dashboard-api/size-guides/{product_id}',dependencies=[Depends(authenticated)])
def get_guide(product_id:str,merchant:str):
    p=product(merchant,product_id)
    row=query(f'''SELECT COALESCE(l.draft,g.draft) AS draft,g.library_id,l.name AS library_name,
        CASE WHEN {LINKED} THEN l.published IS NOT NULL ELSE g.published IS NOT NULL END AS is_published,g.version
        FROM product_size_guides g LEFT JOIN size_guide_library l ON l.merchant_id=g.merchant_id AND l.library_id=g.library_id
        WHERE g.merchant_id=%s AND g.product_id=%s''',(merchant,product_id),True)
    library={'library_id':row['library_id'],'name':row['library_name']} if row and row.get('library_id') else None
    return {'product':p,'guide':row['draft'] if row else None,'version':row['version'] if row else 0,'is_published':bool(row and row['is_published']),'library':library}

@router.put('/dashboard-api/size-guides/{product_id}',dependencies=[Depends(authenticated)])
def save_guide(product_id:str,merchant:str,body:SaveGuide):
    product(merchant,product_id)
    ensure_not_linked(merchant,product_id)
    if body.action=='publish':validate_publish(body.guide)
    guide=body.guide.model_dump();publish=body.action=='publish'
    if body.version==0:
        row=query('''INSERT INTO product_size_guides(merchant_id,product_id,draft,published,published_at)
            VALUES(%s,%s,%s,%s,CASE WHEN %s THEN now() ELSE NULL END)
            ON CONFLICT(merchant_id,product_id) DO NOTHING RETURNING version,published IS NOT NULL AS is_published''',
            (merchant,product_id,Json(guide),Json(guide) if publish else None,publish),True)
    else:
        row=query('''UPDATE product_size_guides SET draft=%s,
            published=CASE WHEN %s THEN %s ELSE published END,
            published_at=CASE WHEN %s THEN now() ELSE published_at END,
            version=version+1,updated_at=now()
            WHERE merchant_id=%s AND product_id=%s AND version=%s
            RETURNING version,published IS NOT NULL AS is_published''',
            (Json(guide),publish,Json(guide),publish,merchant,product_id,body.version),True)
    if not row:raise HTTPException(409,'تم تعديل الجدول من نافذة أخرى. أعد فتحه قبل الحفظ.')
    return row

@router.post('/dashboard-api/size-guides/{product_id}/unpublish',dependencies=[Depends(authenticated)])
def unpublish(product_id:str,merchant:str,body:Version):
    product(merchant,product_id)
    ensure_not_linked(merchant,product_id)
    row=query('''UPDATE product_size_guides SET published=NULL,published_at=NULL,version=version+1,updated_at=now()
        WHERE merchant_id=%s AND product_id=%s AND version=%s RETURNING version,published IS NOT NULL AS is_published''',
        (merchant,product_id,body.version),True)
    if not row:raise HTTPException(409,'النسخة تغيرت. أعد فتح الجدول.')
    return row

@router.get('/public/size-guides/{merchant}/{product_id}')
def public_guide(merchant:str,product_id:str):
    if not re.fullmatch(r'[0-9]{1,30}',merchant) or not re.fullmatch(r'[0-9]{1,30}',product_id):
        return JSONResponse({'detail':'Not found'},status_code=404,headers=PUBLIC_HEADERS)
    row=query('''SELECT CASE WHEN g.library_id IS NOT NULL THEN l.published ELSE g.published END AS guide,
        c.title AS product_name,b.settings AS button_settings
        FROM product_size_guides g JOIN dashboard_catalog c USING(merchant_id,product_id)
        JOIN stores s ON s.merchant_id=g.merchant_id
        LEFT JOIN size_guide_library l ON l.merchant_id=g.merchant_id AND l.library_id=g.library_id
        LEFT JOIN size_guide_button_settings b ON b.merchant_id=g.merchant_id
        WHERE g.merchant_id=%s AND g.product_id=%s
        AND (CASE WHEN g.library_id IS NOT NULL THEN l.published IS NOT NULL ELSE g.published IS NOT NULL END)
        AND c.status IN ('sale','out','out-and-notify') AND COALESCE(s.access_token,'')<>'' ''',(merchant,product_id),True)
    if not row:return JSONResponse({'detail':'Not found'},status_code=404,headers=PUBLIC_HEADERS)
    row['button_settings']=row.get('button_settings') or ButtonSettings().model_dump()
    return JSONResponse(jsonable_encoder(row),headers=PUBLIC_HEADERS)

@router.get('/size-guide-widget.js',include_in_schema=False)
def widget():
    return FileResponse(Path(__file__).parent/'static/size-guide-widget.js',media_type='application/javascript',headers={'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'})

@router.get('/size-guide-renderer.js',include_in_schema=False)
def renderer():
    return FileResponse(Path(__file__).parent/'static/size-guide-renderer.js',media_type='application/javascript',headers={'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'})

@router.get('/dashboard-api/size-guide-snippet',dependencies=[Depends(authenticated)])
def snippet(merchant:str,request:Request):
    require_store(merchant)
    # Origin is the dashboard origin; the snippet contains public identifiers only.
    origin=str(request.base_url).rstrip('/')
    js='''(() => {
  const script = document.createElement('script');
  script.src = BASE + '/size-guide-widget.js';
  script.dataset.base = BASE;
  script.dataset.merchant = MERCHANT;
  script.defer = true;
  document.head.appendChild(script);
})();'''.replace('BASE',json.dumps(origin)).replace('MERCHANT',json.dumps(merchant))
    return {'javascript':js}

@router.get('/size-guide-admin.js',include_in_schema=False)
def admin_script():
    return FileResponse(Path(__file__).parent/'static/size-guide-admin.js',media_type='application/javascript',headers={'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'})
