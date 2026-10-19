import json
import unittest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
import button_settings as bs
import size_guides as sg
import dashboard as d
import embedded_auth as auth
from test_size_guides import G

class ButtonSettingsTests(unittest.TestCase):
    def test_validates_all_designs_and_every_color(self):
        for design in ['link','outline','pill','band','floating','card']:
            self.assertEqual(bs.ButtonSettings(design=design).design,design)
        for bad in [{'design':'unknown'},{'label':'x'*41},{'subtitle':'x'*81},{'merchant':'999'}]:
            with self.assertRaises(ValidationError):bs.ButtonSettings(**bad)
        for key in ['background_color','text_color','border_color','icon_color','secondary_text_color']:
            with self.subTest(key=key),self.assertRaises(ValidationError):
                bs.ButtonSettings(**{key:'red;url(https://evil.test)'})

    def test_existing_store_without_settings_keeps_default(self):
        with patch.object(bs,'require_store'),patch.object(bs,'query',return_value=None) as q:
            data=json.loads(bs.get_settings('123').body)
        self.assertEqual(data,{'settings':bs.ButtonSettings().model_dump(),'version':0})
        self.assertEqual(q.call_args.args[1],('123',))

    def test_create_settings_does_not_modify_guides(self):
        settings=bs.ButtonSettings(design='card',text_color='#123456',label='مقاسات المنتج')
        with patch.object(bs,'require_store'),patch.object(bs,'query',return_value={'version':1}) as q:
            result=bs.save_settings('123',bs.SaveButtonSettings(version=0,settings=settings))
        sql,args=q.call_args.args[:2]
        self.assertIn('ON CONFLICT(merchant_id) DO NOTHING',sql)
        self.assertNotIn('product_size_guides',sql)
        self.assertEqual(args[0],'123');self.assertEqual(args[1].adapted,settings.model_dump())
        self.assertEqual(json.loads(result.body)['settings']['text_color'],'#123456')

    def test_update_is_scoped_and_checks_version(self):
        with patch.object(bs,'require_store'),patch.object(bs,'query',return_value={'version':4}) as q:
            bs.save_settings('123',bs.SaveButtonSettings(version=3,settings={'design':'floating'}))
        self.assertIn('WHERE merchant_id=%s AND version=%s',q.call_args.args[0])
        self.assertEqual(q.call_args.args[1][1:],('123',3))

    def test_stale_save_never_silently_overwrites(self):
        for version in [0,3]:
            with patch.object(bs,'require_store'),patch.object(bs,'query',return_value=None):
                with self.assertRaises(bs.HTTPException) as error:
                    bs.save_settings('123',bs.SaveButtonSettings(version=version,settings={}))
                self.assertEqual(error.exception.status_code,409)

    def test_public_settings_are_joined_to_published_guide_only(self):
        settings=bs.ButtonSettings(design='pill',background_color='#112233').model_dump()
        with patch.object(sg,'query',return_value={'guide':G,'product_name':'منتج','button_settings':settings}) as q:
            data=json.loads(sg.public_guide('123','42').body)
        self.assertEqual(data['button_settings'],settings);self.assertEqual(data['guide'],G)
        sql=q.call_args.args[0]
        self.assertIn('LEFT JOIN size_guide_button_settings b ON b.merchant_id=g.merchant_id',sql)
        self.assertIn('g.published IS NOT NULL',sql)
        self.assertEqual(q.call_args.args[1],('123','42'))

    def test_settings_private_and_assets_available(self):
        app=FastAPI();app.include_router(bs.router);client=TestClient(app)
        with patch.object(bs,'query') as q:
            self.assertEqual(client.get('/dashboard-api/button-settings?merchant=123').status_code,401)
            self.assertEqual(client.put('/dashboard-api/button-settings?merchant=123',json={'version':0,'settings':{}}).status_code,401)
            q.assert_not_called()
        for path in ['/size-guide-button.js','/button-settings-admin.js']:
            r=client.get(path);self.assertEqual(r.status_code,200)
            self.assertEqual(r.headers['cache-control'],'no-cache')

    def test_merchant_can_save_own_settings_using_embedded_session(self):
        app=FastAPI();app.include_router(bs.router);client=TestClient(app)
        import os
        with patch.dict(os.environ,{'SALLA_APP_ID':'755502526'}):
            token=auth.issue_session({'merchant_id':'123','user_id':'456'})
            headers={'Authorization':'Bearer '+token,'X-Size-Guide-Embedded':'1','X-Dashboard-Request':'1'}
            with patch.object(d,'query',return_value={'merchant_id':'123'}),patch.object(bs,'query',return_value={'version':1}) as q:
                r=client.put('/dashboard-api/button-settings?merchant=123',headers=headers,
                    json={'version':0,'settings':{'design':'band','background_color':'#345678'}})
            self.assertEqual(r.status_code,200);self.assertEqual(q.call_args.args[1][0],'123')
            self.assertEqual(r.json()['settings']['background_color'],'#345678')

if __name__=='__main__':unittest.main()
