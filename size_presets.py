"""Per-store saved designs ("styles") and reusable notes ("phrases") for the guide editor."""
import re, secrets
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from psycopg2.extras import Json
from dashboard import query, authenticated, require_store
from size_guides import GuideStyle

router = APIRouter()
MAX_PER_KIND = 20
PRESET_ID = re.compile(r'[0-9a-f]{12}')

def initialize():
    query('''CREATE TABLE IF NOT EXISTS size_guide_presets (
        merchant_id TEXT NOT NULL, preset_id TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL,
        data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY(merchant_id,preset_id))''')

class PresetBody(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    kind: Literal['style', 'phrase']
    name: str = Field(min_length=1, max_length=40)
    style: GuideStyle | None = None
    text: str | None = Field(default=None, min_length=1, max_length=300)
    @model_validator(mode='after')
    def matches_kind(self):
        if self.kind == 'style' and (self.style is None or self.text is not None):
            raise ValueError('النمط يحتاج إعدادات التصميم فقط')
        if self.kind == 'phrase' and (not (self.text or '').strip() or self.style is not None):
            raise ValueError('الجملة تحتاج نصًا فقط')
        return self

@router.get('/dashboard-api/size-presets', dependencies=[Depends(authenticated)])
def list_presets(merchant: str):
    require_store(merchant)
    rows = query('SELECT preset_id,kind,name,data FROM size_guide_presets WHERE merchant_id=%s ORDER BY created_at', (merchant,))
    pick = lambda kind: [{'preset_id': r['preset_id'], 'name': r['name'], **r['data']} for r in rows if r['kind'] == kind]
    return {'styles': pick('style'), 'phrases': pick('phrase')}

@router.post('/dashboard-api/size-presets', dependencies=[Depends(authenticated)])
def create_preset(merchant: str, body: PresetBody):
    require_store(merchant)
    data = {'style': body.style.model_dump()} if body.kind == 'style' else {'text': body.text.strip()}
    preset = secrets.token_hex(6)
    # One statement: the limit and the insert cannot be raced apart by two open windows.
    row = query('''INSERT INTO size_guide_presets(merchant_id,preset_id,kind,name,data)
        SELECT %s,%s,%s,%s,%s WHERE (SELECT count(*) FROM size_guide_presets WHERE merchant_id=%s AND kind=%s)<%s
        RETURNING preset_id''', (merchant, preset, body.kind, body.name, Json(data), merchant, body.kind, MAX_PER_KIND), True)
    if not row:
        raise HTTPException(400, f'وصلت للحد الأقصى ({MAX_PER_KIND}). احذف عنصرًا قبل إضافة آخر.')
    return {'preset_id': preset, 'name': body.name, **data}

@router.delete('/dashboard-api/size-presets/{preset}', dependencies=[Depends(authenticated)])
def delete_preset(preset: str, merchant: str):
    require_store(merchant)
    if not PRESET_ID.fullmatch(preset) or not query(
            'DELETE FROM size_guide_presets WHERE merchant_id=%s AND preset_id=%s RETURNING preset_id', (merchant, preset), True):
        raise HTTPException(404, 'العنصر غير موجود.')
    return {'deleted': True}
