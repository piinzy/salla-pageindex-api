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
        for design in ['link','outline','solid','pill','soft','dashed','split','band','card','icon','row','tile']:
            self.assertEqual(bs.ButtonSettings(design=design).design,design)
        for bad in [{'design':'unknown'},{'label':'x'*41},{'subtitle':'x'*81},{'merchant':'999'}]:
            with self.assertRaises(ValidationError):bs.ButtonSettings(**bad)
        for key in ['background_color','text_color','border_color','icon_color','secondary_text_color']:
            with self.subTest(key=key),self.assertRaises(ValidationError):
                bs.ButtonSettings(**{key:'red;url(https://evil.test)'})

    def test_legacy_floating_and_new_placement_validation(self):
        old=bs.ButtonSettings(design='floating',text_color='#123456')
        self.assertEqual((old.design,old.placement,old.bottom_offset),('pill','floating_left',24))
        self.assertEqual(old.text_color,'#123456')
        self.assertEqual(bs.ButtonSettings(design='pill').placement,'above_price')
        for place in bs.ButtonSettings.model_fields['placement'].annotation.__args__:
            settings=bs.ButtonSettings(placement=place,mobile_placement=place)
            self.assertEqual(settings.placement,place)
        for bad in [{'placement':'bad'},{'mobile_placement':'bad'}, {'size':'huge'},
                    {'alignment':'evil'},{'edge_offset':49},{'edge_offset':-1},
                    {'bottom_offset':241},{'bottom_offset':1.5},{'edge_offset':True}]:
            with self.subTest(bad=bad),self.assertRaises(ValidationError):bs.ButtonSettings(**bad)

    def test_new_size_depth_icon_and_device_options(self):
        s=bs.ButtonSettings(scale=130,width='full',radius=12,depth='deep',effect='tilt',icon='paw',devices='mobile')
        self.assertEqual((s.scale,s.width,s.radius,s.depth,s.effect,s.icon,s.devices),(130,'full',12,'deep','tilt','paw','mobile'))
        old=bs.ButtonSettings()  # settings saved before these options existed keep a sensible look
        self.assertEqual((old.scale,old.width,old.radius,old.depth,old.effect,old.icon,old.devices,old.extra_buttons),
                         (100,'auto',-1,'soft','lift','ruler','all',[]))
        for bad in [{'scale':69},{'scale':151},{'scale':99.5},{'radius':-2},{'radius':33},{'depth':'huge'},{'effect':'spin'},
                    {'icon':'<svg>'},{'devices':'tv'},{'width':'wide'}]:
            with self.subTest(bad=bad),self.assertRaises(ValidationError):bs.ButtonSettings(**bad)

    def test_extra_buttons_are_limited_and_validated(self):
        extra=[{'design':'icon','placement':'image_top_left','devices':'mobile','label':'قياسات'},{'design':'glass'},{'design':'chip'}]
        s=bs.ButtonSettings(extra_buttons=extra)
        self.assertEqual([b.design for b in s.extra_buttons],['icon','glass','chip'])
        self.assertEqual(s.model_dump()['extra_buttons'][0]['placement'],'image_top_left')
        for bad in [[{}]*4,[{'design':'unknown'}],[{'extra_buttons':[]}],[{'background_color':'red'}],[{'merchant':'999'}]]:
            with self.subTest(bad=bad),self.assertRaises(ValidationError):bs.ButtonSettings(extra_buttons=bad)
        legacy=bs.ButtonSettings(extra_buttons=[{'design':'floating'}]).extra_buttons[0]
        self.assertEqual((legacy.design,legacy.placement),('pill','floating_left'))

    def test_designs_and_placements_match_the_storefront_script(self):
        import re,pathlib
        script=pathlib.Path('static/size-guide-button.js').read_text(encoding='utf-8')
        listed=lambda name:re.findall(r"id:'([a-z_0-9]+)'",re.search(name+r' = \[(.*?)\n  \];',script,re.S).group(1))
        self.assertEqual(set(listed('const designs')),set(bs.ButtonStyle.model_fields['design'].annotation.__args__))
        self.assertEqual(set(listed('const placements')),set(bs.ButtonStyle.model_fields['placement'].annotation.__args__))
        self.assertEqual(set(listed('const icons')),set(bs.ButtonStyle.model_fields['icon'].annotation.__args__))

    def test_public_guide_returns_extra_buttons_and_new_guide_fields(self):
        settings=bs.ButtonSettings(extra_buttons=[{'design':'icon'}]).model_dump()
        guide={**G,'category':'shoes','theme':'sport','table_style':'cards','depth3d':False}
        with patch.object(sg,'query',return_value={'guide':guide,'product_name':'منتج','button_settings':settings}):
            data=json.loads(sg.public_guide('123','42').body)
        self.assertEqual(data['button_settings']['extra_buttons'][0]['design'],'icon');self.assertEqual(data['guide']['theme'],'sport')

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
        for path in ['/size-guide-button.js','/button-settings-admin.js','/size-guide-placement.js','/button-studio.css']:
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
