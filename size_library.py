"""Shared size guides ("library") plus bulk copy / link / publish across products."""
import re, secrets
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from psycopg2.extras import Json
from dashboard import query, authenticated, require_store
from size_guides import Guide, validate_publish

router = APIRouter()
MAX_LIBRARIES = 50
MAX_PRODUCTS = 200
LIBRARY_ID = re.compile(r'[0-9a-f]{12}')
DIGITS = re.compile(r'[0-9]{1,30}')

def library_id(value):
    if not LIBRARY_ID.fullmatch(value):
        raise HTTPException(404, 'الجدول المشترك غير موجود.')
    return value

class ProductIds(BaseModel):
    model_config = ConfigDict(extra='forbid')
    product_ids: list[str] = Field(min_length=1, max_length=MAX_PRODUCTS)
    @field_validator('product_ids')
    @classmethod
    def digits_only(cls, values):
        if any(not DIGITS.fullmatch(v) for v in values):
            raise ValueError('معرّف منتج غير صالح')
        return list(dict.fromkeys(values))

class LibraryBody(BaseModel):
    model_config = ConfigDict(extra='forbid')
    version: int = Field(ge=0)
    name: str = Field(min_length=1, max_length=80)
    guide: Guide
    action: Literal['draft', 'publish'] = 'draft'
    @field_validator('name')
    @classmethod
    def clean_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError('اسم الجدول مطلوب')
        return value

class Version(BaseModel):
    version: int = Field(ge=1)

class CopyBody(ProductIds):
    source_product_id: str
    overwrite: bool = False
    publish: bool = False
    @field_validator('source_product_id')
    @classmethod
    def source_digits(cls, value):
        if not DIGITS.fullmatch(value):
            raise ValueError('معرّف منتج غير صالح')
        return value

class BulkBody(ProductIds):
    action: Literal['publish', 'unpublish']

def existing_products(merchant, ids):
    rows = query('SELECT product_id FROM dashboard_catalog WHERE merchant_id=%s AND product_id=ANY(%s)', (merchant, ids))
    return {r['product_id'] for r in rows}

def get_library(merchant, lib):
    row = query('SELECT name,draft,published,version FROM size_guide_library WHERE merchant_id=%s AND library_id=%s', (merchant, lib), True)
    if not row:
        raise HTTPException(404, 'الجدول المشترك غير موجود.')
    return row

@router.get('/dashboard-api/size-library', dependencies=[Depends(authenticated)])
def list_library(merchant: str):
    require_store(merchant)
    return query('''SELECT l.library_id,l.name,l.version,l.updated_at,l.published IS NOT NULL AS is_published,
        l.draft IS DISTINCT FROM l.published AS has_changes,l.draft->>'category' AS category,l.draft->>'theme' AS theme,
        (SELECT count(*) FROM product_size_guides g WHERE g.merchant_id=l.merchant_id AND g.library_id=l.library_id) AS product_count
        FROM size_guide_library l WHERE l.merchant_id=%s ORDER BY l.updated_at DESC''', (merchant,))

@router.post('/dashboard-api/size-library', dependencies=[Depends(authenticated)])
def create_library(merchant: str, body: LibraryBody):
    require_store(merchant)
    if body.version != 0:
        raise HTTPException(400, 'نسخة غير صالحة لجدول جديد.')
    if query('SELECT count(*) AS n FROM size_guide_library WHERE merchant_id=%s', (merchant,), True)['n'] >= MAX_LIBRARIES:
        raise HTTPException(400, 'وصلت للحد الأقصى من الجداول المشتركة.')
    publish = body.action == 'publish'
    if publish:
        validate_publish(body.guide)
    guide = body.guide.model_dump()
    lib = secrets.token_hex(6)
    row = query('''INSERT INTO size_guide_library(merchant_id,library_id,name,draft,published,published_at)
        VALUES(%s,%s,%s,%s,%s,CASE WHEN %s THEN now() END) RETURNING library_id,version,published IS NOT NULL AS is_published''',
                (merchant, lib, body.name, Json(guide), Json(guide) if publish else None, publish), True)
    return row

@router.get('/dashboard-api/size-library/{lib}', dependencies=[Depends(authenticated)])
def read_library(lib: str, merchant: str):
    require_store(merchant)
    lib = library_id(lib)
    row = get_library(merchant, lib)
    products = query('''SELECT g.product_id,c.title,c.sku FROM product_size_guides g
        JOIN dashboard_catalog c USING(merchant_id,product_id) WHERE g.merchant_id=%s AND g.library_id=%s ORDER BY c.title''', (merchant, lib))
    return {'library_id': lib, 'name': row['name'], 'guide': row['draft'], 'version': row['version'],
            'is_published': row['published'] is not None, 'products': products}

@router.put('/dashboard-api/size-library/{lib}', dependencies=[Depends(authenticated)])
def save_library(lib: str, merchant: str, body: LibraryBody):
    require_store(merchant)
    lib = library_id(lib)
    publish = body.action == 'publish'
    if publish:
        validate_publish(body.guide)
    guide = body.guide.model_dump()
    row = query('''UPDATE size_guide_library SET name=%s,draft=%s,
        published=CASE WHEN %s THEN %s ELSE published END,published_at=CASE WHEN %s THEN now() ELSE published_at END,
        version=version+1,updated_at=now() WHERE merchant_id=%s AND library_id=%s AND version=%s
        RETURNING library_id,version,published IS NOT NULL AS is_published''',
                (body.name, Json(guide), publish, Json(guide), publish, merchant, lib, body.version), True)
    if not row:
        raise HTTPException(409, 'تم تعديل الجدول المشترك من نافذة أخرى. أعد فتحه قبل الحفظ.')
    return row

@router.post('/dashboard-api/size-library/{lib}/unpublish', dependencies=[Depends(authenticated)])
def unpublish_library(lib: str, merchant: str, body: Version):
    require_store(merchant)
    lib = library_id(lib)
    row = query('''UPDATE size_guide_library SET published=NULL,published_at=NULL,version=version+1,updated_at=now()
        WHERE merchant_id=%s AND library_id=%s AND version=%s RETURNING library_id,version,published IS NOT NULL AS is_published''',
                (merchant, lib, body.version), True)
    if not row:
        raise HTTPException(409, 'النسخة تغيرت. أعد فتح الجدول المشترك.')
    return row

@router.delete('/dashboard-api/size-library/{lib}', dependencies=[Depends(authenticated)])
def delete_library(lib: str, merchant: str):
    require_store(merchant)
    lib = library_id(lib)
    linked = query('SELECT count(*) AS n FROM product_size_guides WHERE merchant_id=%s AND library_id=%s', (merchant, lib), True)['n']
    if linked:
        raise HTTPException(409, f'لا يمكن حذف جدول مرتبط بـ {linked} منتج. افصل المنتجات أولًا.')
    if not query('DELETE FROM size_guide_library WHERE merchant_id=%s AND library_id=%s RETURNING library_id', (merchant, lib), True):
        raise HTTPException(404, 'الجدول المشترك غير موجود.')
    return {'deleted': True}

@router.post('/dashboard-api/size-library/{lib}/link', dependencies=[Depends(authenticated)])
def link_products(lib: str, merchant: str, body: ProductIds):
    require_store(merchant)
    lib = library_id(lib)
    get_library(merchant, lib)
    rows = query('''INSERT INTO product_size_guides(merchant_id,product_id,draft,library_id)
        SELECT l.merchant_id,p.pid,l.draft,l.library_id FROM size_guide_library l, unnest(%s::text[]) AS p(pid)
        WHERE l.merchant_id=%s AND l.library_id=%s
        AND p.pid IN (SELECT product_id FROM dashboard_catalog WHERE merchant_id=%s)
        ON CONFLICT(merchant_id,product_id) DO UPDATE SET library_id=EXCLUDED.library_id,
        version=product_size_guides.version+1,updated_at=now() RETURNING product_id''',
                 (body.product_ids, merchant, lib, merchant))
    returned = {r['product_id'] for r in rows}
    done = [p for p in body.product_ids if p in returned]   # in the order asked, whatever order the database answered
    return {'linked': done, 'skipped': [p for p in body.product_ids if p not in done]}

@router.post('/dashboard-api/size-guides/unlink', dependencies=[Depends(authenticated)])
def unlink_products(merchant: str, body: ProductIds):
    """The product keeps what customers see today: a private copy of the shared guide."""
    require_store(merchant)
    rows = query('''UPDATE product_size_guides g SET draft=l.draft,published=l.published,published_at=l.published_at,
        library_id=NULL,version=g.version+1,updated_at=now() FROM size_guide_library l
        WHERE g.merchant_id=%s AND g.product_id=ANY(%s) AND g.library_id IS NOT NULL
        AND l.merchant_id=g.merchant_id AND l.library_id=g.library_id RETURNING g.product_id''', (merchant, body.product_ids))
    returned = {r['product_id'] for r in rows}
    done = [p for p in body.product_ids if p in returned]   # in the order asked, whatever order the database answered
    return {'unlinked': done, 'skipped': [p for p in body.product_ids if p not in done]}

@router.post('/dashboard-api/size-guides/copy', dependencies=[Depends(authenticated)])
def copy_guide(merchant: str, body: CopyBody):
    """Independent copies of one product's guide; existing guides are only replaced when asked."""
    require_store(merchant)
    targets = [p for p in body.product_ids if p != body.source_product_id]
    if not targets:
        raise HTTPException(400, 'اختر منتجات أخرى غير المنتج المصدر.')
    source = query('''SELECT COALESCE(l.draft,g.draft) AS draft FROM product_size_guides g
        LEFT JOIN size_guide_library l ON l.merchant_id=g.merchant_id AND l.library_id=g.library_id
        WHERE g.merchant_id=%s AND g.product_id=%s''', (merchant, body.source_product_id), True)
    if not source:
        raise HTTPException(404, 'لا يوجد جدول للمنتج المصدر.')
    guide = Guide(**source['draft'])
    if body.publish:
        validate_publish(guide)
    data = guide.model_dump()
    if not body.overwrite:
        taken = {r['product_id'] for r in query('SELECT product_id FROM product_size_guides WHERE merchant_id=%s AND product_id=ANY(%s)', (merchant, targets))}
        targets = [p for p in targets if p not in taken]
    if not targets:
        return {'copied': [], 'skipped': body.product_ids}
    rows = query('''INSERT INTO product_size_guides(merchant_id,product_id,draft,published,published_at,library_id)
        SELECT %s,p.pid,%s::jsonb,CASE WHEN %s THEN %s::jsonb END,CASE WHEN %s THEN now() END,NULL FROM unnest(%s::text[]) AS p(pid)
        WHERE p.pid IN (SELECT product_id FROM dashboard_catalog WHERE merchant_id=%s)
        ON CONFLICT(merchant_id,product_id) DO UPDATE SET draft=EXCLUDED.draft,
        published=CASE WHEN %s THEN EXCLUDED.published ELSE product_size_guides.published END,
        published_at=CASE WHEN %s THEN EXCLUDED.published_at ELSE product_size_guides.published_at END,
        library_id=NULL,version=product_size_guides.version+1,updated_at=now() RETURNING product_id''',
                 (merchant, Json(data), body.publish, Json(data), body.publish, targets, merchant, body.publish, body.publish))
    returned = {r['product_id'] for r in rows}
    done = [p for p in body.product_ids if p in returned]   # in the order asked, whatever order the database answered
    return {'copied': done, 'skipped': [p for p in body.product_ids if p not in done]}

@router.post('/dashboard-api/size-guides/bulk', dependencies=[Depends(authenticated)])
def bulk_state(merchant: str, body: BulkBody):
    """Publish drafts or hide guides for many products; linked products follow their shared guide."""
    require_store(merchant)
    rows = query('SELECT product_id,draft,library_id FROM product_size_guides WHERE merchant_id=%s AND product_id=ANY(%s)', (merchant, body.product_ids))
    found = {r['product_id']: r for r in rows}
    ok, skipped = [], []
    for pid in body.product_ids:
        row = found.get(pid)
        if not row:
            skipped.append({'product_id': pid, 'reason': 'لا يوجد جدول'})
        elif row['library_id']:
            skipped.append({'product_id': pid, 'reason': 'مرتبط بجدول مشترك'})
        elif body.action == 'publish':
            try:
                validate_publish(Guide(**row['draft']))
                ok.append(pid)
            except HTTPException as error:
                skipped.append({'product_id': pid, 'reason': error.detail})
            except ValueError:
                skipped.append({'product_id': pid, 'reason': 'جدول غير صالح'})
        else:
            ok.append(pid)
    if ok and body.action == 'publish':
        query('''UPDATE product_size_guides SET published=draft,published_at=now(),version=version+1,updated_at=now()
            WHERE merchant_id=%s AND product_id=ANY(%s) AND library_id IS NULL''', (merchant, ok))
    elif ok:
        query('''UPDATE product_size_guides SET published=NULL,published_at=NULL,version=version+1,updated_at=now()
            WHERE merchant_id=%s AND product_id=ANY(%s) AND library_id IS NULL''', (merchant, ok))
    return {'updated': ok, 'skipped': skipped}
