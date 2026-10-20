import os, unittest
from unittest.mock import patch, MagicMock
import requests
from fastapi import FastAPI
from fastapi.testclient import TestClient
os.environ.setdefault('DASHBOARD_PASSWORD', 'testing-password-only')
os.environ.setdefault('DASHBOARD_SESSION_SECRET', 'testing-session-secret-for-unit-tests-only')
import quick_edit as qe, dashboard

TOKEN = 'unit-test-access-token-0123456789'

def response(status=200, data=None, error=None):
    r = MagicMock(status_code=status)
    r.json.return_value = {'data': data} if data is not None else ({'error': {'message': error}} if error else {})
    return r

class FakeDb:
    """Answers the handful of queries the edit makes, and records the writes."""
    def __init__(self, current=None, token=TOKEN):
        self.current = {'title': 'فستان', 'price': 240, 'quantity': 5} if current is None else current
        self.token, self.writes = token, []
    def __call__(self, sql, args=(), one=False):
        if 'SELECT title,price,quantity' in sql: return self.current
        if 'SELECT access_token' in sql: return {'access_token': self.token}
        if 'SELECT product_id,title,sku' in sql: return {'product_id': '42', 'title': 'فستان جديد', 'price': 199, 'quantity': 5}
        self.writes.append((sql.split()[0] + ' ' + sql.split()[1], args)); return None

class QuickEditTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI(); app.include_router(qe.router)
        app.dependency_overrides[dashboard.authenticated] = lambda: None
        self.client = TestClient(app)
        patcher = patch.object(qe, 'require_store'); patcher.start(); self.addCleanup(patcher.stop)
        self.db = FakeDb(); patcher = patch.object(qe, 'query', self.db); patcher.start(); self.addCleanup(patcher.stop)

    def put(self, body, product='42'):
        return self.client.put(f'/dashboard-api/products/{product}?merchant=123', json=body)

    def test_login_is_required(self):
        app = FastAPI(); app.include_router(qe.router); client = TestClient(app)
        with patch.object(qe.requests, 'put') as call:
            self.assertEqual(client.put('/dashboard-api/products/42?merchant=123', json={'price': 1}).status_code, 401)
            self.assertEqual(client.get('/dashboard-api/product-lookup?merchant=123').status_code, 401)
            call.assert_not_called()

    def test_only_changed_fields_are_sent_with_the_store_token(self):
        updated = {'id': 42, 'name': 'فستان جديد', 'price': {'amount': 199, 'currency': 'SAR'}, 'sku': 'DR-42', 'quantity': 5, 'status': 'sale'}
        with patch.object(qe.requests, 'put', return_value=response(200, updated)) as call:
            r = self.put({'name': 'فستان جديد', 'price': '199', 'quantity': 5})   # quantity is unchanged
        self.assertEqual(r.status_code, 200, r.text)
        url, kwargs = call.call_args.args[0], call.call_args.kwargs
        self.assertTrue(url.endswith('/products/42')); self.assertEqual(kwargs['json'], {'name': 'فستان جديد', 'price': 199.0})
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer ' + TOKEN); self.assertFalse(kwargs['allow_redirects'])
        self.assertEqual(r.json()['changed'], {'name': {'from': 'فستان', 'to': 'فستان جديد'}, 'price': {'from': 240.0, 'to': 199.0}})
        self.assertNotIn(TOKEN, r.text)
        kinds = [w[0] for w in self.db.writes]; self.assertEqual(kinds, ['INSERT INTO', 'INSERT INTO'], 'catalog upsert + audit row')

    def test_falls_back_to_the_sent_values_when_salla_returns_no_product(self):
        with patch.object(qe.requests, 'put', return_value=response(200)):
            self.assertEqual(self.put({'quantity': 9}).status_code, 200)
        self.assertEqual(self.db.writes[0][0], 'UPDATE dashboard_catalog'); self.assertEqual(self.db.writes[0][1][:3], (None, None, 9))

    def test_nothing_is_sent_without_a_real_change_or_with_bad_values(self):
        with patch.object(qe.requests, 'put') as call:
            self.assertEqual(self.put({'price': 240, 'quantity': 5, 'name': 'فستان'}).status_code, 400)
            for bad in [{}, {'price': 0}, {'price': -3}, {'price': 'NaN'}, {'price': 1.234}, {'quantity': -1}, {'quantity': 2.5}, {'quantity': '7'},
                        {'name': ''}, {'name': 'x' * 256}, {'sku': 'NEW'}, {'status': 'hidden'}, {'price': 10, 'description': 'x'}]:
                with self.subTest(bad=bad): self.assertEqual(self.put(bad).status_code, 422)
            self.assertEqual(self.put({'price': 1}, product='abc').status_code, 404)
            call.assert_not_called(); self.assertEqual(self.db.writes, [])

    def test_unknown_product_and_disconnected_store(self):
        with patch.object(qe.requests, 'put') as call:
            self.db.current = None; self.assertEqual(self.put({'price': 1}).status_code, 404)
            self.db.current = {'title': 'x', 'price': 1, 'quantity': 1}; self.db.token = ''; self.assertEqual(self.put({'price': 2}).status_code, 403)
            call.assert_not_called()

    def test_salla_errors_become_clear_messages_and_change_nothing(self):
        cases = [(401, 401, 'انتهت'), (403, 403, 'قراءة وكتابة'), (404, 404, 'غير موجود'), (422, 422, 'رفضت القيم'), (429, 429, 'التمهل'), (500, 502, 'HTTP 500')]
        for salla, ours, text in cases:
            with self.subTest(salla=salla), patch.object(qe.requests, 'put', return_value=response(salla, error='السعر غير صالح')), patch.object(qe.logger, 'error') as log:
                r = self.put({'price': 100})
                self.assertEqual(r.status_code, ours); self.assertIn(text, r.json()['detail']); self.assertNotIn(TOKEN, r.text + str(log.call_args_list))
            self.assertEqual(self.db.writes, [], 'a failed edit never touches the local catalog or the log')
        with patch.object(qe.requests, 'put', return_value=response(422, error='السعر غير صالح')):
            self.assertIn('السعر غير صالح', self.put({'price': 100}).json()['detail'])
        with patch.object(qe.requests, 'put', side_effect=requests.ConnectionError(f'boom {TOKEN}')), self.assertLogs('salla_backend', 'ERROR') as logs:
            r = self.put({'price': 100})
        self.assertEqual(r.status_code, 502); self.assertNotIn(TOKEN, r.text + '\n'.join(logs.output))

    def test_lookup_is_parameterised_and_limited(self):
        calls = []
        with patch.object(qe, 'query', side_effect=lambda sql, args=(), one=False: calls.append((sql, args)) or []):
            self.assertEqual(self.client.get('/dashboard-api/product-lookup?merchant=123&q=' + "x'; DROP TABLE a;-- 50%_").status_code, 200)
            self.assertEqual(self.client.get('/dashboard-api/product-lookup?merchant=123&q=' + 'a' * 201).status_code, 400)
        sql, args = calls[0]; self.assertNotIn('DROP', sql); self.assertEqual(args[0], '123'); self.assertEqual(args[-1], qe.LOOKUP_LIMIT)
        self.assertTrue(any('\\%' in str(a) for a in args), 'wildcards typed by the merchant are escaped')

if __name__ == '__main__':
    unittest.main()
