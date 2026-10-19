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
