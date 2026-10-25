"""App wiring and schema regressions after removing obsolete search scaffolding."""
import os
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
import main


class AppTests(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ,{'DATABASE_URL':'postgresql://test', 'SALLA_WEBHOOK_SECRET':'test-webhook-only'})
        self.env.start();self.addCleanup(self.env.stop)
        self.client=TestClient(main.app)

    def test_public_listing_pages_are_wired_into_the_real_app(self):
        for path in ('/about','/privacy'):
            r=self.client.get(path);self.assertEqual(r.status_code,200,path);self.assertIn('text/html',r.headers['content-type'])
        self.assertEqual(self.client.get('/').json()['status'],'ok','the root stays a plain health check')

    def test_app_lifecycle_events_reach_billing_and_bad_input_is_refused(self):
        headers={'X-Salla-Token':'test-webhook-only'}
        with patch.object(main,'billing_event',return_value=True) as billing:
            r=self.client.post('/webhook',headers=headers,json={'event':'app.uninstalled','merchant':123,'data':{}})
            self.assertEqual((r.status_code,r.json()['status']),(200,'success'));billing.assert_called_once_with('app.uninstalled','123',{})
            for bad in ('x',None,True,'1'*40):
                self.assertEqual(self.client.post('/webhook',headers=headers,json={'event':'app.uninstalled','merchant':bad}).status_code,400)
        with patch.object(main,'billing_event',return_value=False):
            self.assertEqual(self.client.post('/webhook',headers=headers,json={'event':'app.new.thing','merchant':1}).json()['status'],'ignored')
        self.assertEqual(self.client.post('/webhook',json={'event':'app.uninstalled','merchant':1}).status_code,401)

    def test_order_events_reach_the_size_insights_and_never_fail_the_webhook(self):
        headers={'X-Salla-Token':'test-webhook-only'}
        with patch.object(main,'orders_event',return_value=True) as orders:
            r=self.client.post('/webhook',headers=headers,json={'event':'order.created','merchant':77,'data':{'id':5}})
            self.assertEqual((r.status_code,r.json()['status']),(200,'success'));orders.assert_called_once_with('order.created','77',{'id':5})
            self.assertEqual(self.client.post('/webhook',headers=headers,json={'event':'order.created','merchant':'x','data':{}}).status_code,400)
        with patch.object(main,'orders_event',side_effect=RuntimeError('boom')):
            r=self.client.post('/webhook',headers=headers,json={'event':'order.created','merchant':77,'data':{}})
            self.assertEqual((r.status_code,r.json()['status']),(200,'ignored'),'a malformed order must not make Salla retry')

    def test_root_and_head_are_lightweight(self):
        with patch.object(main.psycopg2,'connect') as connect:
            self.assertEqual(self.client.get('/').json(),{'status':'ok','service':'salla-size-guides'})
            self.assertEqual(self.client.head('/').status_code,200)
            connect.assert_not_called()

    def test_schema_only_creates_store_authorization_table(self):
        conn=MagicMock();cur=conn.cursor.return_value.__enter__.return_value
        with patch.object(main.psycopg2,'connect',return_value=conn):main.init_db()
        statements=[call.args[0] for call in cur.execute.call_args_list]
        self.assertEqual(len(statements),1)
        self.assertIn('CREATE TABLE IF NOT EXISTS stores',statements[0])
        self.assertNotIn('CREATE TABLE IF NOT EXISTS products',statements[0])

    def test_health_returns_status_without_database_details(self):
        conn=MagicMock();cur=conn.cursor.return_value.__enter__.return_value
        with patch.object(main.psycopg2,'connect',return_value=conn):
            r=self.client.get('/health')
        self.assertEqual(r.status_code,200)
        self.assertEqual(set(r.json()),{'status','service'})
        cur.execute.assert_called_once_with('SELECT 1;')

    def test_health_fails_without_exposing_connection(self):
        with patch.object(main.psycopg2,'connect',side_effect=main.psycopg2.OperationalError('secret-database-url')):
            r=self.client.get('/health')
        self.assertEqual(r.status_code,503)
        self.assertNotIn('secret-database-url',r.text)

    def test_obsolete_diagnostic_route_removed(self):
        self.assertEqual(self.client.get('/api/test-db').status_code,404)

    def test_easy_mode_authorization_remains_functional(self):
        with patch.object(main,'save_webhook_authorization') as save:
            r=self.client.post('/webhook',headers={'X-Salla-Token':'test-webhook-only'},json={
                'event':'app.store.authorize','merchant':123,
                'data':{'access_token':'test-access','refresh_token':'test-refresh'}})
        self.assertEqual(r.status_code,200)
        save.assert_called_once_with('123','test-access','test-refresh')
        self.assertNotIn('test-access',r.text)

    def test_product_webhook_remains_connected(self):
        with patch.object(main,'update_product_event') as update:
            r=self.client.post('/webhook',headers={'X-Salla-Token':'test-webhook-only'},json={
                'event':'product.updated','merchant':123,'data':{'id':42}})
        self.assertEqual(r.status_code,200)
        update.assert_called_once_with('123','product.updated',{'id':42})


if __name__=='__main__':unittest.main()
