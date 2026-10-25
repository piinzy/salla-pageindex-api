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
    def test_measure_images_accept_https_or_small_uploads_only(self):
        up='data:image/jpeg;base64,'+'A'*200
        ok=sg.Guide(**{**G,'how_images':['https://cdn.example.com/a.jpg',up],'how_art':'women'})
        self.assertEqual(ok.how_art,'women');self.assertEqual(sg.Guide(**G).how_art,'none')
        with self.assertRaises(ValidationError):sg.Guide(**{**G,'how_art':'dogs'})
        for bad in ['http://x.example.com/a.jpg','data:image/svg+xml;base64,'+'A'*200,'data:text/html;base64,'+'A'*200,'data:image/jpeg;base64,'+'A'*300001,'javascript:alert(1)']:
            with self.subTest(bad=bad[:40]),self.assertRaises(ValidationError):sg.Guide(**{**G,'how_images':[bad]})
    def test_side_images_accept_https_or_small_uploads_only(self):
        ok=sg.Guide(**{**G,'theme':'linen','side_image':'https://cdn.example.com/tee.png','side_image_back':'data:image/webp;base64,'+'A'*100})
        self.assertEqual(ok.theme,'linen');self.assertEqual(sg.Guide(**G).side_image,'')
        for bad in ['http://x.example.com/a.png','javascript:alert(1)','data:image/svg+xml;base64,'+'A'*100]:
            with self.subTest(bad=bad[:30]),self.assertRaises(ValidationError):sg.Guide(**{**G,'side_image':bad})
    def test_painted_parts_are_checked(self):
        good=[{'target':'head','col':-1},{'target':'head','col':-2,'bg':'#ffffff'},{'target':'head','col':3},{'target':'size','row':-1},{'target':'size','row':2,'fg':'#101010','bold':True},
              {'target':'col','col':1},{'target':'row','row':0,'align':'center'},{'target':'cell','row':1,'col':1,'bg':'#abcdef'}]
        self.assertEqual(len(sg.Guide(**{**G,'cell_styles':good}).cell_styles),8);self.assertEqual(sg.Guide(**G).cell_styles,[])
        for bad in [{'target':'head','col':-3},{'target':'head','row':0,'col':1},{'target':'size','row':-2},{'target':'size','row':1,'col':1},{'target':'col'},{'target':'row'},{'target':'cell','row':1},
                    {'target':'col','row':2,'col':1},{'target':'x'},{'target':'cell','row':1,'col':1,'bg':'red'},{'target':'cell','row':1,'col':1,'align':'left'},{'target':'cell','row':30,'col':1},
                    {'target':'cell','row':1,'col':1,'extra':1}]:
            with self.subTest(bad=bad),self.assertRaises(ValidationError):sg.Guide(**{**G,'cell_styles':[bad]})
        with self.assertRaises(ValidationError):sg.Guide(**{**G,'cell_styles':[{'target':'col','col':0}]*151})
        self.assertNotIn('cell_styles',sg.STYLE_FIELDS,'painted parts belong to one table, not to a reusable look')
    def test_side_layout_and_column_widths_are_checked(self):
        ok=sg.Guide(**{**G,'side_layout':'start','side_3d':True,'col_widths':[20,40,40]})
        self.assertEqual((ok.side_layout,ok.side_3d,ok.col_widths),('start',True,[20,40,40]))
        old=sg.Guide(**G);self.assertEqual((old.side_layout,old.side_3d,old.col_widths),('auto',False,[]))
        for bad in [{'side_layout':'left'},{'side_3d':'maybe'},{'col_widths':[2]},{'col_widths':[81]},{'col_widths':['x']},{'col_widths':[10]*12}]:
            with self.subTest(bad=bad),self.assertRaises(ValidationError):sg.Guide(**{**G,**bad})
    def test_snippet_is_per_store_or_one_for_every_store(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        app=FastAPI();app.include_router(sg.router);app.dependency_overrides[sg.authenticated]=lambda:None
        with patch.object(sg,'require_store'):
            client=TestClient(app)
            own=client.get('/dashboard-api/size-guide-snippet?merchant=123').json()
            every=client.get('/dashboard-api/size-guide-snippet?merchant=123&generic=true').json()
        self.assertIn('script.dataset.merchant = "123"',own['javascript']);self.assertFalse(own['generic'])
        self.assertNotIn('merchant',every['javascript']);self.assertNotIn('123',every['javascript']);self.assertTrue(every['generic'])
        self.assertIn('/size-guide-widget.js',every['javascript']);self.assertNotIn('BASE',every['javascript']);self.assertNotIn('STORE',every['javascript'])
    def test_layout_type_and_fit_level_are_checked(self):
        ok=sg.Guide(**{**G,'layout_type':'page','fit_level':'slim'});self.assertEqual((ok.layout_type,ok.fit_level),('page','slim'))
        old=sg.Guide(**G);self.assertEqual((old.layout_type,old.fit_level),('tabs',''),'guides saved before keep their tabs')
        for bad in [{'layout_type':'carousel'},{'fit_level':'huge'},{'layout_type':''}]:
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
    def test_ready_made_looks_are_valid_appearance_only(self):
        import json, pathlib, shutil, subprocess
        if not shutil.which('node'):self.skipTest('node is not installed')
        script=("const fs=require('fs');const w={};new Function('window',fs.readFileSync('static/size-guide-catalog.js','utf8'))(w);"
                "console.log(JSON.stringify({presets:w.SizeGuideCatalog.stylePresets,fields:w.SizeGuideCatalog.STYLE_FIELDS}))")
        data=json.loads(subprocess.run(['node','-e',script],capture_output=True,text=True,check=True,cwd=pathlib.Path(__file__).parent).stdout)
        self.assertEqual(set(data['fields']),set(sg.STYLE_FIELDS),'editor and server agree on what a look contains')
        self.assertEqual(len(data['presets']),0,'the owner adds the ready-made looks; none ship by default')
        accents={'classic':'#177e65','rose':'#b4456a','velvet':'#7b2338','gold':'#a8812c','tailor':'#23375b','slate':'#3d4a56','sport':'#d9480f','leather':'#8a5a35','paws':'#d9701a','mint':'#1b8f7c','night':'#7be0c3','linen':'#2d2630','minimal':'#2b2b2b'}
        for preset in data['presets']:
            with self.subTest(preset=preset['id']):
                style=sg.GuideStyle(**{**preset['style'],'color':accents[preset['style']['theme']]})
                full=sg.Guide(**{**G,**style.model_dump()})   # a look can always be applied to a guide
                self.assertEqual(full.columns[0].label,'محيط الصدر')
    def test_style_model_never_carries_content(self):
        for content in ['title','columns','rows','notes','instructions','category','language','calculator','how_video','logo_url','size_label']:
            self.assertNotIn(content,sg.STYLE_FIELDS);self.assertNotIn(content,sg.GuideStyle.model_fields)
        with self.assertRaises(ValidationError):sg.GuideStyle(title='x')
        with self.assertRaises(ValidationError):sg.GuideStyle(color='red')
    def test_catalog_script_is_served(self):
        import button_settings as bs
        app=FastAPI();app.include_router(bs.router);r=TestClient(app).get('/size-guide-catalog.js')
        self.assertEqual(r.status_code,200);self.assertIn('SizeGuideCatalog',r.text)
    def test_reject_invalid_color(self):
        with self.assertRaises(ValidationError):sg.Guide(**{**G,'color':'red;url(evil)'})
    def test_blank_draft_allowed_but_not_published(self):
        g=sg.Guide(**{**G,'rows':[{'size':'S','values':['','']}]})
        with self.assertRaises(sg.HTTPException):sg.validate_publish(g)
    def test_body_table_validated_and_published_strictly(self):
        body={'title':'قياسات الجسم','columns':[{'label':'الصدر','kind':'measurement'}],'rows':[{'size':'S','values':['82-86']}]}
        g=sg.Guide(**{**G,'body_table':body});sg.validate_publish(g)
        with self.assertRaises(ValidationError):sg.Guide(**{**G,'body_table':{**body,'rows':[{'size':'S','values':['1','2']}]}})
        with self.assertRaises(ValidationError):sg.Guide(**{**G,'body_table':{**body,'columns':[{'label':'a'},{'label':'A'}],'rows':[{'size':'S','values':['1','2']}]}})
        with self.assertRaises(ValidationError):sg.Guide(**{**G,'body_table':{**body,'extra':1}})
        with self.assertRaises(sg.HTTPException):sg.validate_publish(sg.Guide(**{**G,'body_table':{**body,'rows':[{'size':'S','values':['']}]}}))
        with self.assertRaises(sg.HTTPException):sg.validate_publish(sg.Guide(**{**G,'body_table':{**body,'rows':[{'size':'S','values':['1']},{'size':'s','values':['2']}]}}))
        self.assertIsNone(sg.Guide(**G).body_table)
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
