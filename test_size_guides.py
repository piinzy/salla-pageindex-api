import os, unittest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
os.environ['DASHBOARD_PASSWORD']='testing-password-only'
os.environ['DASHBOARD_SESSION_SECRET']='testing-session-secret-for-unit-tests-only'
import size_guides as sg

G={'title':'دليل المقاسات','button_label':'دليل المقاسات','unit':'cm','measurement_type':'garment',
   'columns':[{'label':'محيط الصدر','kind':'measurement'},{'label':'EU','kind':'text'}],
   'rows':[{'size':'S','values':['90','36']},{'size':'M','values':['94','38']}],
   'instructions':'اختبار فقط','notes':'','color':'#177e65'}

class SizeGuideTests(unittest.TestCase):
    def test_grid_shape(self):
        with self.assertRaises(ValidationError):sg.Guide(**{**G,'rows':[{'size':'S','values':['90']}]})
    def test_category_theme_and_style_options(self):
        old=sg.Guide(**G)  # guides saved before these options existed
        self.assertEqual((old.category,old.theme,old.table_style,old.density,old.corners,old.depth3d,old.header_icon),
                         ('general','classic','zebra','comfortable','soft',True,True))
        new=sg.Guide(**{**G,'category':'pets','theme':'paws','table_style':'cards','density':'compact','corners':'round','depth3d':False,'header_icon':False})
        self.assertEqual((new.category,new.theme,new.table_style,new.depth3d),('pets','paws','cards',False))
        for bad in [{'category':'cars'},{'theme':'neon'},{'table_style':'grid'},{'density':'tiny'},{'corners':'blob'},{'depth3d':'maybe'}]:
            with self.subTest(bad=bad),self.assertRaises(ValidationError):sg.Guide(**{**G,**bad})
    def test_themes_and_categories_match_the_window_script(self):
        import re,pathlib
        script=pathlib.Path('static/size-guide-renderer.js').read_text(encoding='utf-8')
        themes=re.findall(r"\{id:'([a-z]+)',name:'[^']+',accent",script)
        cats=re.findall(r"\{id:'([a-z]+)',name:'[^']+',emblem",script)
        self.assertEqual(set(themes),set(sg.Guide.model_fields['theme'].annotation.__args__))
        self.assertEqual(set(cats),set(sg.Guide.model_fields['category'].annotation.__args__))
    def test_every_starter_template_is_a_valid_guide(self):
        import json, pathlib, shutil, subprocess
        if not shutil.which('node'):self.skipTest('node is not installed')
        script=("const fs=require('fs');const w={};new Function('window',fs.readFileSync('static/size-guide-catalog.js','utf8'))(w);"
                "console.log(JSON.stringify(w.SizeGuideCatalog.templates.map(t=>w.SizeGuideCatalog.fresh(t.id))))")
        out=subprocess.run(['node','-e',script],capture_output=True,text=True,check=True,cwd=pathlib.Path(__file__).parent).stdout
        guides=json.loads(out);self.assertGreaterEqual(len(guides),20)
        for guide in guides:
            with self.subTest(category=guide['category'],columns=len(guide['columns'])):
                parsed=sg.Guide(**guide)  # every key the editor produces is accepted by the server
                self.assertTrue(parsed.calculator)
        self.assertEqual(set(guides[0]),set(sg.Guide.model_fields),'the editor and the server agree on every field')
    def test_catalog_script_is_served(self):
        import button_settings as bs
        app=FastAPI();app.include_router(bs.router);r=TestClient(app).get('/size-guide-catalog.js')
        self.assertEqual(r.status_code,200);self.assertIn('SizeGuideCatalog',r.text)
    def test_reject_invalid_color(self):
        with self.assertRaises(ValidationError):sg.Guide(**{**G,'color':'red;url(evil)'})
    def test_blank_draft_allowed_but_not_published(self):
        g=sg.Guide(**{**G,'rows':[{'size':'S','values':['','']}]})
        with self.assertRaises(sg.HTTPException):sg.validate_publish(g)
    def test_duplicate_sizes_not_published(self):
        g=sg.Guide(**{**G,'rows':[{'size':'M','values':['90','36']},{'size':'m','values':['94','38']}]})
        with self.assertRaises(sg.HTTPException):sg.validate_publish(g)
    def test_draft_save_preserves_published_snapshot(self):
        with patch.object(sg,'product'),patch.object(sg,'query',return_value={'version':3,'is_published':True}) as q:
            sg.save_guide('42','123',sg.SaveGuide(version=2,guide=G,action='draft'))
            sql,args=q.call_args.args[:2]
            self.assertIn('ELSE published END',sql);self.assertFalse(args[1]);self.assertEqual(args[-3:],('123','42',2))
    def test_publish_is_explicit(self):
        with patch.object(sg,'product'),patch.object(sg,'query',return_value={'version':3,'is_published':True}) as q:
            sg.save_guide('42','123',sg.SaveGuide(version=2,guide=G,action='publish'))
            self.assertTrue(q.call_args.args[1][1])
    def test_conflict_rejected(self):
        with patch.object(sg,'product'),patch.object(sg,'query',return_value=None):
            with self.assertRaises(sg.HTTPException) as e:sg.save_guide('42','123',sg.SaveGuide(version=1,guide=G))
            self.assertEqual(e.exception.status_code,409)
    def test_private_routes_require_auth(self):
        app=FastAPI();app.include_router(sg.router);c=TestClient(app)
        with patch.object(sg,'query') as q:
            self.assertEqual(c.get('/dashboard-api/size-guides?merchant=123').status_code,401)
            self.assertEqual(c.put('/dashboard-api/size-guides/42?merchant=123',json={'version':0,'guide':G}).status_code,401)
            q.assert_not_called()
    def test_public_only_returns_published_visible_product(self):
        app=FastAPI();app.include_router(sg.router);c=TestClient(app)
        with patch.object(sg,'query',return_value={'guide':G,'product_name':'اختبار'}) as q:
            r=c.get('/public/size-guides/123/42');self.assertEqual(r.status_code,200)
            self.assertEqual(set(r.json()),{'guide','product_name','button_settings'})
            self.assertEqual(r.json()['button_settings']['design'],'outline')
            self.assertEqual(r.headers['access-control-allow-origin'],'*')
            self.assertEqual(r.headers['cache-control'],'no-store')
            sql,args=q.call_args.args[:2];self.assertIn('g.published IS NOT NULL',sql);self.assertIn('c.status IN',sql);self.assertEqual(args,('123','42'))
    def test_no_public_draft(self):
        with patch.object(sg,'query',return_value=None):self.assertEqual(sg.public_guide('123','42').status_code,404)
    def test_bad_public_identifier_does_not_query(self):
        with patch.object(sg,'query') as q:
            self.assertEqual(sg.public_guide('123','abc').status_code,404);q.assert_not_called()
    def test_unpublish_scoped_and_versioned(self):
        with patch.object(sg,'product'),patch.object(sg,'query',return_value={'version':3,'is_published':False}) as q:
            sg.unpublish('42','123',sg.Version(version=2))
            self.assertEqual(q.call_args.args[1],('123','42',2));self.assertIn('published=NULL',q.call_args.args[0])
if __name__=='__main__':unittest.main()
