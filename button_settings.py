"""Versioned, merchant-scoped appearance settings shared by published guides."""
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator
from psycopg2.extras import Json
from dashboard import authenticated, query, require_store

router = APIRouter()
HEX = r'^#[0-9a-fA-F]{6}$'

DESIGNS = Literal['link', 'outline', 'solid', 'pill', 'soft', 'dashed', 'split', 'band',
                  'card', 'icon', 'row', 'tile', 'gradient', 'glass', 'raised', 'chip']
PLACEMENTS = Literal['above_price', 'below_price', 'below_title', 'before_options',
                     'beside_size', 'above_cart', 'beside_cart', 'image_top_right',
                     'image_top_left', 'image_bottom_right', 'image_bottom_left',
                     'floating_left', 'floating_right', 'side_tab', 'mobile_bar']
MAX_EXTRA_BUTTONS = 3

class ButtonStyle(BaseModel):
    """One button: its look, place and size. The first button of a store is a ButtonStyle too."""
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    design: DESIGNS = 'outline'
    placement: PLACEMENTS = 'above_price'
    mobile_placement: Literal['inherit', 'above_price', 'below_price', 'below_title',
                              'before_options', 'beside_size', 'above_cart', 'beside_cart',
                              'image_top_right', 'image_top_left', 'image_bottom_right',
                              'image_bottom_left', 'floating_left', 'floating_right',
                              'side_tab', 'mobile_bar'] = 'inherit'
    devices: Literal['all', 'desktop', 'mobile'] = 'all'
    alignment: Literal['start', 'center', 'end'] = 'start'
    size: Literal['small', 'medium', 'large'] = 'medium'
    scale: int = Field(default=100, ge=70, le=150, strict=True)
    width: Literal['auto', 'full'] = 'auto'
    radius: int = Field(default=-1, ge=-1, le=32, strict=True)
    depth: Literal['flat', 'soft', 'raised', 'deep'] = 'soft'
    effect: Literal['none', 'lift', 'tilt'] = 'lift'
    icon: Literal['ruler', 'shirt', 'shoe', 'paw', 'tape', 'ruler_flat', 'ruler_tall', 'ruler_double', 'ruler_pencil', 'ruler_set',
                  'tape_case', 'tape_retract', 'tape_coil', 'tape_wave', 'tape_body', 'none'] = 'ruler'
    edge_offset: int = Field(default=16, ge=0, le=48, strict=True)
    bottom_offset: int = Field(default=88, ge=0, le=240, strict=True)

    @model_validator(mode='before')
    @classmethod
    def migrate_legacy_floating(cls, value):
        if isinstance(value, dict) and value.get('design') == 'floating':
            value = dict(value)
            value['design'] = 'pill'
            value.setdefault('placement', 'floating_left')
            # Preserve the previous floating button's bottom spacing.
            value.setdefault('bottom_offset', 24)
        return value
    label: str = Field(default='', max_length=40)
    subtitle: str = Field(default='اختاري مقاسك بثقة', max_length=80)
    background_color: str = Field(default='#ffffff', pattern=HEX)
    text_color: str = Field(default='#243c30', pattern=HEX)
    border_color: str = Field(default='#d9e3dc', pattern=HEX)
    icon_color: str = Field(default='#243c30', pattern=HEX)
    secondary_text_color: str = Field(default='#63756a', pattern=HEX)

class ButtonSettings(ButtonStyle):
    """Store-wide settings: the main button plus up to three extra buttons."""
    extra_buttons: list[ButtonStyle] = Field(default_factory=list, max_length=MAX_EXTRA_BUTTONS)

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

@router.get('/size-guide-placement.js', include_in_schema=False)
def placement_script():
    return FileResponse(Path(__file__).parent / 'static/size-guide-placement.js',
                        media_type='application/javascript',
                        headers={'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'})

@router.get('/button-studio.css', include_in_schema=False)
def studio_styles():
    return FileResponse(Path(__file__).parent / 'static/button-studio.css',
                        media_type='text/css',
                        headers={'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'})

@router.get('/size-guide-catalog.js', include_in_schema=False)
def catalog_script():
    return FileResponse(Path(__file__).parent / 'static/size-guide-catalog.js',
                        media_type='application/javascript',
                        headers={'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'})

@router.get('/size-guide-import.js', include_in_schema=False)
def import_script():
    return FileResponse(Path(__file__).parent / 'static/size-guide-import.js',
                        media_type='application/javascript',
                        headers={'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'})

@router.get('/ui-motion.js', include_in_schema=False)
def motion_script():
    return FileResponse(Path(__file__).parent / 'static/ui-motion.js',
                        media_type='application/javascript',
                        headers={'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'})

@router.get('/size-guide-quick.js', include_in_schema=False)
def quick_script():
    return FileResponse(Path(__file__).parent / 'static/size-guide-quick.js',
                        media_type='application/javascript',
                        headers={'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'})
