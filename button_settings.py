"""Versioned, merchant-scoped appearance settings shared by published guides."""
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from psycopg2.extras import Json
from dashboard import authenticated, query, require_store

router = APIRouter()
HEX = r'^#[0-9a-fA-F]{6}$'

class ButtonSettings(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    design: Literal['link', 'outline', 'pill', 'band', 'floating', 'card'] = 'outline'
    label: str = Field(default='', max_length=40)
    subtitle: str = Field(default='اختاري مقاسك بثقة', max_length=80)
    background_color: str = Field(default='#ffffff', pattern=HEX)
    text_color: str = Field(default='#243c30', pattern=HEX)
    border_color: str = Field(default='#d9e3dc', pattern=HEX)
    icon_color: str = Field(default='#243c30', pattern=HEX)
    secondary_text_color: str = Field(default='#63756a', pattern=HEX)

class SaveButtonSettings(BaseModel):
    model_config = ConfigDict(extra='forbid')
    version: int = Field(ge=0)
    settings: ButtonSettings

def initialize():
    query('''CREATE TABLE IF NOT EXISTS size_guide_button_settings (
        merchant_id TEXT PRIMARY KEY, settings JSONB NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now())''')

@router.get('/dashboard-api/button-settings', dependencies=[Depends(authenticated)])
def get_settings(merchant: str):
    require_store(merchant)
    row = query('SELECT settings,version FROM size_guide_button_settings WHERE merchant_id=%s',
                (merchant,), True)
    return JSONResponse(row or {'settings': ButtonSettings().model_dump(), 'version': 0},
                        headers={'Cache-Control': 'no-store'})

@router.put('/dashboard-api/button-settings', dependencies=[Depends(authenticated)])
def save_settings(merchant: str, body: SaveButtonSettings):
    require_store(merchant)
    settings = body.settings.model_dump()
    if body.version == 0:
        row = query('''INSERT INTO size_guide_button_settings(merchant_id,settings)
            VALUES(%s,%s) ON CONFLICT(merchant_id) DO NOTHING RETURNING version''',
                    (merchant, Json(settings)), True)
    else:
        row = query('''UPDATE size_guide_button_settings
            SET settings=%s,version=version+1,updated_at=now()
            WHERE merchant_id=%s AND version=%s RETURNING version''',
                    (Json(settings), merchant, body.version), True)
    if not row:
        raise HTTPException(409, 'تغيرت إعدادات الزر من نافذة أخرى. أعد تحميل الإعدادات ثم احفظ.')
    return JSONResponse({'settings': settings, 'version': row['version']},
                        headers={'Cache-Control': 'no-store'})

@router.get('/size-guide-button.js', include_in_schema=False)
def button_script():
    return FileResponse(Path(__file__).parent / 'static/size-guide-button.js',
                        media_type='application/javascript',
                        headers={'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'})

@router.get('/button-settings-admin.js', include_in_schema=False)
def settings_admin_script():
    return FileResponse(Path(__file__).parent / 'static/button-settings-admin.js',
                        media_type='application/javascript',
                        headers={'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'})
