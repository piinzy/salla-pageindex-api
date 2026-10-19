import logging
import os
import time
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
import dashboard as d
import embedded as e
import embedded_auth as auth
import size_guides as sg
import button_settings as bs
from test_size_guides import G

app = FastAPI()
for router in (d.router, sg.router, e.router, bs.router):
    app.include_router(router)


class EmbeddedTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            'SALLA_APP_ID': '755502526',
            'DASHBOARD_SESSION_SECRET': 'isolated-embedded-test-signing-secret-12345',
            'DASHBOARD_PASSWORD': 'testing-password-only',
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = TestClient(app, base_url='https://testserver')
        self.identity = {'merchant_id': '123', 'user_id': '456'}
        self.token = auth.issue_session(self.identity)
        self.headers = {'Authorization': 'Bearer ' + self.token,
                        'X-Dashboard-Request': '1', 'X-Size-Guide-Embedded': '1'}

    def upstream(self, **changes):
        data = {**self.identity, 'exp': datetime.fromtimestamp(time.time()+120, timezone.utc).isoformat()}
        data.update(changes)
        return MagicMock(status_code=200, json=lambda: {'success': True, 'data': data})

    def test_server_verifies_token_with_fixed_app_identity(self):
        with patch.object(auth.requests, 'post', return_value=self.upstream()) as post:
            identity = auth.verify_salla_token('test-salla-token')
        self.assertEqual(identity, self.identity)
        self.assertEqual(post.call_args.args[0], auth.INTROSPECT_URL)
        self.assertEqual(post.call_args.kwargs['headers']['S-Source'], '755502526')
        self.assertFalse(post.call_args.kwargs['allow_redirects'])

    def test_invalid_expired_or_missing_identity_never_authenticates(self):
        for change in ({'exp':'2000-01-01T00:00:00Z'}, {'merchant_id':None},
                       {'merchant_id':True}, {'user_id':''}, {'exp':'bad'}, {'exp':float('nan')}):
            with self.subTest(change=change), patch.object(auth.requests,'post',return_value=self.upstream(**change)):
                with self.assertRaises(auth.HTTPException): auth.verify_salla_token('test')
        with patch.object(auth.requests,'post',return_value=MagicMock(status_code=200,json=lambda:{'success':False})):
            with self.assertRaises(auth.HTTPException): auth.verify_salla_token('test')

    def test_verification_outage_fails_closed(self):
        with patch.object(auth.requests,'post',side_effect=auth.requests.Timeout()):
            with self.assertRaises(auth.HTTPException) as error: auth.verify_salla_token('test')
            self.assertEqual(error.exception.status_code,503)

    def test_token_exchange_returns_no_store_access_token_and_sets_no_cookie(self):
        with patch.object(e,'query',side_effect=[{'attempts':1},{'merchant_id':'123'}]), \
             patch.object(e,'verify_salla_token',return_value=self.identity):
            response=self.client.post('/dashboard-api/embedded-session',json={'token':'test-salla-token'},headers={'X-Dashboard-Request':'1'})
        self.assertEqual(response.status_code,200)
        self.assertNotIn('set-cookie',response.headers)
        self.assertEqual(response.headers['cache-control'],'no-store')
        data=response.json()
        self.assertEqual(set(data),{'session_token','app_id','merchant_id','expires_in'})
        self.assertEqual(auth.verify_session(data['session_token'])['merchant_id'],'123')

    def test_exchange_rejects_client_supplied_identity(self):
        with patch.object(e,'query') as query:
            response=self.client.post('/dashboard-api/embedded-session',json={'token':'test','merchant_id':'999'},headers={'X-Dashboard-Request':'1'})
        self.assertEqual(response.status_code,422)
        query.assert_not_called()

    def test_exchange_requires_connected_store(self):
        with patch.object(e,'query',side_effect=[{'attempts':1},None]),patch.object(e,'verify_salla_token',return_value=self.identity):
            r=self.client.post('/dashboard-api/embedded-session',json={'token':'test'},headers={'X-Dashboard-Request':'1'})
        self.assertEqual(r.status_code,403)

    def test_exchange_is_rate_limited(self):
        with patch.object(e,'query',return_value={'attempts':61}),patch.object(e,'verify_salla_token') as verify:
            r=self.client.post('/dashboard-api/embedded-session',json={'token':'test'},headers={'X-Dashboard-Request':'1'})
        self.assertEqual(r.status_code,429);verify.assert_not_called()

    def test_stores_are_filtered_on_server(self):
        def query(sql,args=(),one=False):
            if 'store_name' in sql:
                self.assertIn('WHERE s.merchant_id=%s',sql)
                self.assertEqual(args,('123',))
                return [{'merchant_id':'123','store_name':'متجر الاختبار'}]
            return {'merchant_id':'123'}
        with patch.object(d,'query',side_effect=query):
            r=self.client.get('/dashboard-api/stores',headers=self.headers)
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()[0]['merchant_id'],'123')

    def test_all_private_store_routes_reject_cross_store_access_before_query(self):
        cases=[('GET','products',None),('GET','jobs',None),('POST','sync',None),
               ('GET','size-guides',None),('GET','size-guides/42',None),
               ('PUT','size-guides/42',{'version':0,'guide':G}),
               ('POST','size-guides/42/unpublish',{'version':1}),('GET','size-guide-snippet',None),
               ('GET','button-settings',None),('PUT','button-settings',{'version':0,'settings':{}})]
        with patch.object(d,'query') as dq,patch.object(sg,'query') as sq,patch.object(bs,'query') as bq:
            for method,path,body in cases:
                with self.subTest(path=path,method=method):
                    r=self.client.request(method,'/dashboard-api/'+path+'?merchant=999',json=body,headers=self.headers)
                    self.assertEqual(r.status_code,403)
            dq.assert_not_called();sq.assert_not_called();bq.assert_not_called()

    def test_duplicate_merchant_parameter_is_rejected(self):
        with patch.object(d,'query') as query:
            r=self.client.get('/dashboard-api/products?merchant=999&merchant=123',headers=self.headers)
        self.assertEqual(r.status_code,403);query.assert_not_called()

    def test_own_product_guide_can_be_saved(self):
        with patch.object(d,'query',return_value={'merchant_id':'123'}), \
             patch.object(sg,'query',side_effect=[{'product_id':'42','title':'اختبار'}, None, {'version':1,'is_published':True}]) as query:
            r=self.client.put('/dashboard-api/size-guides/42?merchant=123',
                              json={'version':0,'guide':G,'action':'publish'},headers=self.headers)
        self.assertEqual(r.status_code,200)
        self.assertEqual(query.call_args.args[1][:2],('123','42'))

    def test_session_tampering_expiry_and_wrong_app_rejected(self):
        with self.assertRaises(auth.HTTPException): auth.verify_session(self.token[:-1]+('a' if self.token[-1]!='a' else 'b'))
        with patch.object(auth.time,'time',return_value=time.time()+auth.SESSION_SECONDS+1):
            with self.assertRaises(auth.HTTPException): auth.verify_session(self.token)
        with patch.dict(os.environ,{'SALLA_APP_ID':'999'}):
            with self.assertRaises(auth.HTTPException): auth.verify_session(self.token)

    def test_no_fallback_to_operator_cookie_for_invalid_embedded_session(self):
        with patch.object(d,'query',return_value={'attempts':1}):
            self.assertEqual(self.client.post('/dashboard-api/login',json={'password':'testing-password-only'}).status_code,200)
        with patch.object(d,'query') as query:
            r=self.client.get('/dashboard-api/stores',headers={'X-Size-Guide-Embedded':'1','Authorization':'Bearer invalid'})
        self.assertEqual(r.status_code,401);query.assert_not_called()

    def test_embedded_works_without_operator_password(self):
        with patch.dict(os.environ,{'DASHBOARD_PASSWORD':''}),patch.object(d,'query',side_effect=[{'merchant_id':'123'}, []]):
            self.assertEqual(self.client.get('/dashboard-api/stores',headers=self.headers).status_code,200)

    def test_uninstall_revokes_app_session(self):
        with patch.object(d,'query',return_value=None):
            self.assertEqual(self.client.get('/dashboard-api/stores',headers=self.headers).status_code,403)

    def test_html_has_salla_only_framing_and_private_referrers(self):
        r=self.client.get('/salla/embedded?token=test-secret')
        self.assertEqual(r.status_code,200)
        self.assertIn('frame-ancestors https://s.salla.sa',r.headers['content-security-policy'])
        self.assertEqual(r.headers['referrer-policy'],'no-referrer')
        self.assertNotIn('test-secret',r.text)
        self.assertIn('<body class="embedded">',r.text)
        self.assertLess(r.text.index('salla-embedded.js'),r.text.index('/size-guide-admin.js'))
        self.assertNotIn('salla-embedded.js',self.client.get('/dashboard').text)
        for asset in e.ASSETS:
            self.assertEqual(self.client.get('/embedded-assets/'+asset).status_code,200)
        self.assertEqual(self.client.get('/embedded-assets/main.py').status_code,404)

    def test_access_logs_redact_query_credentials(self):
        record=logging.LogRecord('uvicorn.access',20,'',0,'%s - "%s %s HTTP/%s" %d',
                                 ('127.0.0.1','GET','/salla/embedded?token=test-secret&theme=dark','1.1',200),None)
        self.assertTrue(e.RedactTokenQuery().filter(record))
        self.assertNotIn('test-secret',record.getMessage())
        self.assertIn('theme=dark',record.getMessage())


if __name__=='__main__': unittest.main()
