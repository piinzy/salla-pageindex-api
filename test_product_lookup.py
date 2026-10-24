import os, unittest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
os.environ.setdefault('DASHBOARD_PASSWORD', 'testing-password-only')
os.environ.setdefault('DASHBOARD_SESSION_SECRET', 'testing-session-secret-for-unit-tests-only')
import product_lookup as pl, dashboard

class ProductLookupTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI(); app.include_router(pl.router)
        app.dependency_overrides[dashboard.authenticated] = lambda: None
        self.client = TestClient(app)
        patcher = patch.object(pl, 'require_store'); patcher.start(); self.addCleanup(patcher.stop)

    def test_login_is_required_and_there_is_no_product_edit_route(self):
        app = FastAPI(); app.include_router(pl.router); anonymous = TestClient(app)
        self.assertEqual(anonymous.get('/dashboard-api/product-lookup?merchant=123').status_code, 401)
        self.assertIn(self.client.put('/dashboard-api/products/42?merchant=123', json={'price': 1}).status_code, (404, 405), 'the app never writes product data to Salla')

    def test_lookup_is_parameterised_and_limited(self):
        calls = []
        with patch.object(pl, 'query', side_effect=lambda sql, args=(), one=False: calls.append((sql, args)) or []):
            self.assertEqual(self.client.get('/dashboard-api/product-lookup?merchant=123&q=' + "x'; DROP TABLE a;-- 50%_").status_code, 200)
            self.assertEqual(self.client.get('/dashboard-api/product-lookup?merchant=123&q=' + 'a' * 201).status_code, 400)
        sql, args = calls[0]; self.assertNotIn('DROP', sql); self.assertEqual(args[0], '123'); self.assertEqual(args[-1], pl.LOOKUP_LIMIT)
        self.assertTrue(any('\\%' in str(a) for a in args), 'wildcards typed by the merchant are escaped')

if __name__ == '__main__':
    unittest.main()
