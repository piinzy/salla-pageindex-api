import os, unittest
from unittest.mock import patch, MagicMock
os.environ['DATABASE_URL']='postgresql://test'
os.environ['DASHBOARD_PASSWORD']='testing-password-only'
os.environ['DASHBOARD_SESSION_SECRET']='test-session-secret-not-for-production-12345'
from fastapi import FastAPI
from fastapi.testclient import TestClient
import dashboard as d
app=FastAPI();app.include_router(d.router)
class DashboardTests(unittest.TestCase):
    def setUp(self): self.client=TestClient(app,base_url='https://testserver')
    def test_authentication(self):
        with patch.object(d,'query',return_value={'attempts':1}):
            self.assertEqual(self.client.get('/dashboard-api/stores').status_code,401)
            self.assertEqual(self.client.post('/dashboard-api/login',json={'password':'wrong'}).status_code,401)
            r=self.client.post('/dashboard-api/login',json={'password':'testing-password-only'})
            self.assertEqual(r.status_code,200)
            self.assertIn('HttpOnly',r.headers['set-cookie']);self.assertIn('Secure',r.headers['set-cookie'])
            self.assertEqual(self.client.post('/dashboard-api/logout').status_code,403)
            self.assertEqual(self.client.post('/dashboard-api/logout',headers={'X-Dashboard-Request':'1'}).status_code,200)
    def test_throttle(self):
        with patch.object(d,'query',return_value={'attempts':21}):
            self.assertEqual(self.client.post('/dashboard-api/login',json={'password':'testing-password-only'}).status_code,429)
    def test_catalog_query_is_scoped_and_parameterized(self):
        with patch.object(d,'require_store'), patch.object(d,'query',side_effect=[{'n':0},[]]) as q:
            d.products('123',q="' OR 1=1 --",page=1)
            for call in q.call_args_list:
                self.assertIn('merchant_id=%s',call.args[0]);self.assertEqual(call.args[1][0],'123')
                self.assertNotIn("' OR 1=1",call.args[0])
    def run_sync(self,results):
        conn=MagicMock(); cur=conn.cursor.return_value.__enter__.return_value;cur.fetchone.return_value=(True,)
        def query(sql,args=(),one=False):
            if sql.startswith('SELECT access_token'): return {'access_token':'test-token'}
        with patch.object(d,'db',return_value=conn),patch.object(d,'query',side_effect=query) as q,patch.object(d,'salla_get',side_effect=results):
            d.sync('123','job')
        return conn,cur,q
    def test_pagination_complete_snapshot(self):
        pages=[{'data':[{'id':1,'name':'فستان','price':{'amount':99}}],'pagination':{'totalPages':2,'total':2}}, {'data':[{'id':2,'name':'بلوزة'}],'pagination':{'totalPages':2,'total':2}}]
        conn,cur,q=self.run_sync(pages)
        self.assertEqual(sum(c.args[0]==d.UPSERT for c in cur.execute.call_args_list),2)
        self.assertTrue(any(c.args[0].startswith('DELETE') for c in cur.execute.call_args_list))
        conn.__exit__.assert_called_with(None,None,None)
        self.assertIn("state='success'",q.call_args.args[0])
    def test_failed_second_page_keeps_old_snapshot(self):
        conn,cur,q=self.run_sync([{'data':[{'id':1}],'pagination':{'totalPages':2,'total':2}},RuntimeError('upstream failed')])
        self.assertFalse(any(c.args[0].startswith('DELETE') for c in cur.execute.call_args_list))
        self.assertIs(conn.__exit__.call_args.args[0],RuntimeError)
        self.assertIn("state='failed'",q.call_args.args[0])
    def test_incomplete_count_keeps_old_snapshot(self):
        conn,cur,q=self.run_sync([{'data':[{'id':1}],'pagination':{'totalPages':1,'total':2}}])
        self.assertFalse(any(c.args[0].startswith('DELETE') for c in cur.execute.call_args_list))
        self.assertIn("state='failed'",q.call_args.args[0])
    def test_normalize_strips_html(self):
        row=d.normalize({'id':12,'name':'Dress','description':'<p>Hello &amp; welcome</p>','price':{'amount':90,'currency':'SAR'}},'123')
        self.assertEqual(row[:3],('123','12','Dress'));self.assertNotIn('<p>',row[3]);self.assertEqual(row[5],90)
if __name__=='__main__': unittest.main()
