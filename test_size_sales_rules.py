"""Order-based size insights and category rules for products without a guide."""
import os, unittest
from unittest.mock import patch
DB = os.environ.get('TEST_DATABASE_URL')
if DB:
    os.environ['DATABASE_URL'] = DB
os.environ.setdefault('DASHBOARD_PASSWORD', 'testing-password-only')
os.environ.setdefault('DASHBOARD_SESSION_SECRET', 'testing-session-secret-for-unit-tests-only')
from fastapi import FastAPI
from fastapi.testclient import TestClient
import dashboard, size_guides as sg, size_library as lib, size_rules as rules, size_sales as sales
from test_size_guides import G

ORDER = {'id': 1001, 'status': {'slug': 'under_review'}, 'customer': {'name': 'سر', 'mobile': '0500000000'}, 'items': [
    {'id': 1, 'product_id': 11, 'quantity': 2, 'options': [{'name': 'اللون', 'value': {'name': 'أحمر'}}, {'name': 'المقاس', 'value': {'name': 'M'}}]},
    {'id': 2, 'product': {'id': '12'}, 'quantity': 1, 'options': [{'name': 'Size', 'value': 'L'}]},
    {'id': 3, 'product_id': 13, 'quantity': 1, 'options': [{'name': 'اللون', 'value': 'أزرق'}]},
    {'id': 4, 'name': 'no product id', 'quantity': 1}, 'junk', {'product_id': 'x1', 'quantity': 1}]}

class PureTests(unittest.TestCase):
    def test_lines_become_product_size_quantity_and_ignore_junk(self):
        self.assertEqual(sorted(sales.parse_items(ORDER)), [('11', 'M', 2), ('12', 'L', 1), ('13', 'غير محدد', 1)])
        self.assertEqual(sales.parse_items({'items': [{'product_id': 5, 'quantity': 1, 'options': [{'name': 'المقاس', 'value': 'S'}]}, {'product_id': 5, 'quantity': 3, 'options': [{'name': 'المقاس', 'value': 'S'}]}]}), [('5', 'S', 4)])
        self.assertEqual(sales.parse_items({'items': [{'product_id': 5, 'quantity': -3}, {'product_id': 6, 'quantity': True}, {'product_id': 7, 'quantity': 10**6}]}), [('5', 'غير محدد', 1), ('6', 'غير محدد', 1), ('7', 'غير محدد', 1)])
        for bad in (None, [], 'x', {'items': 'x'}, {'items': None}):
            self.assertEqual(sales.parse_items(bad), [])
    def test_no_customer_data_is_ever_returned_by_the_parser(self):
        flat = repr(sales.parse_items(ORDER))
        for secret in ('سر', '0500000000', 'customer'):
            self.assertNotIn(secret, flat)
    def test_order_ids_and_statuses(self):
        for data, expected in (({'id': 7}, '7'), ({'order_id': '8'}, '8'), ({'order': {'id': 9}}, '9'), ({'id': 'x'}, ''), ({'id': True}, ''), (None, ''), ({}, '')):
            self.assertEqual(sales.order_id_of(data), expected)
        self.assertEqual(sales.status_of({'status': {'slug': 'Canceled'}}), 'canceled'); self.assertEqual(sales.status_of({'status': 'restored'}), 'restored'); self.assertEqual(sales.status_of({}), '')
    def rows(self, *spec):
        return [{'product_id': p, 'size': s, 'sold': a, 'returned': b} for p, s, a, b in spec]
    def test_only_a_size_far_above_its_product_average_raises_an_alert(self):
        rows = self.rows(('1', 'S', 10, 1), ('1', 'M', 12, 6), ('1', 'L', 8, 1), ('1', 'غير محدد', 5, 0))
        alerts, top = sales.build_insights(rows, {'1': 'فستان'})
        self.assertEqual([(a['kind'], a['size']) for a in alerts], [('size', 'M')])
        self.assertIn('50%', alerts[0]['message']); self.assertEqual(top[0]['title'], 'فستان'); self.assertEqual(top[0]['sold'], 35)
    def test_small_samples_never_alert(self):
        self.assertEqual(sales.build_insights(self.rows(('1', 'M', 3, 3)), {})[0], [])
        self.assertEqual(sales.build_insights(self.rows(('1', 'M', 4, 1), ('1', 'S', 6, 0)), {})[0], [])
    def test_a_product_returned_everywhere_is_flagged_as_a_whole(self):
        alerts, _ = sales.build_insights(self.rows(('1', 'S', 5, 2), ('1', 'M', 5, 2), ('1', 'L', 5, 2)), {})
        self.assertEqual([(a['kind'], a['returned']) for a in alerts], [('product', 6)])

@unittest.skipUnless(DB, 'TEST_DATABASE_URL not set')
class DatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        dashboard.query('CREATE TABLE IF NOT EXISTS stores (merchant_id TEXT PRIMARY KEY, access_token TEXT, refresh_token TEXT, store_name TEXT)')
        dashboard.initialize(); sg.initialize(); rules.initialize(); sales.initialize()
        app = FastAPI()
        for r in (sg.router, lib.router, rules.router, sales.router, dashboard.router):
            app.include_router(r)
        app.dependency_overrides[dashboard.authenticated] = lambda: None
        cls.client = TestClient(app)
    def setUp(self):
        for t in ('size_sales', 'size_guide_rules', 'product_categories', 'product_size_guides', 'size_guide_library', 'dashboard_catalog', 'stores'):
            dashboard.query(f'DELETE FROM {t}')
        dashboard.query("INSERT INTO stores(merchant_id,access_token) VALUES('1','t'),('2','t')")
        for m, pid, status in (('1', '11', 'sale'), ('1', '12', 'sale'), ('1', '13', 'sale'), ('1', '14', 'hidden'), ('2', '11', 'sale')):
            dashboard.query("INSERT INTO dashboard_catalog(merchant_id,product_id,title,status) VALUES(%s,%s,%s,%s)", (m, pid, 'منتج ' + pid, status))
        for m, pid, cat in (('1', '11', '100'), ('1', '12', '100'), ('1', '12', '200'), ('1', '13', '200'), ('1', '14', '100'), ('2', '11', '100')):
            dashboard.query("INSERT INTO product_categories(merchant_id,product_id,category_id,category_name) VALUES(%s,%s,%s,%s)", (m, pid, cat, 'فئة ' + cat))
        self.lib_a = self.library('1', 'فساتين'); self.lib_b = self.library('1', 'قمصان')
    def library(self, merchant, name):
        r = self.client.post(f'/dashboard-api/size-library?merchant={merchant}', json={'version': 0, 'name': name, 'guide': G, 'action': 'draft'})
        self.assertEqual(r.status_code, 200, r.text); return r.json()['library_id']

    def test_overview_counts_products_without_a_guide(self):
        d = self.client.get('/dashboard-api/size-rules?merchant=1').json()
        self.assertEqual(d['missing'], 3, 'hidden products are not counted'); self.assertEqual({c['id']: c['products'] for c in d['categories']}, {'100': 3, '200': 2})
        self.assertEqual(len(d['latest']), 3)
        self.assertEqual(self.client.get('/dashboard-api/products?merchant=1&guide=none').json()['total'], 4)
        self.assertEqual(self.client.get('/dashboard-api/products?merchant=1&guide=maybe').status_code, 400)
    def test_rules_link_only_products_without_a_guide_and_never_cross_stores(self):
        dashboard.query("INSERT INTO product_size_guides(merchant_id,product_id,draft) VALUES('1','12',%s)", (dashboard.Json(G) if hasattr(dashboard, 'Json') else __import__('psycopg2.extras').extras.Json(G),))
        self.assertEqual(self.client.put('/dashboard-api/size-rules?merchant=1', json={'category_id': '100', 'library_id': self.lib_a}).status_code, 200)
        r = self.client.post('/dashboard-api/size-rules/apply?merchant=1').json()
        self.assertEqual(r['linked'], 2, 'product 12 keeps its own guide; 11 and the hidden 14 join'); self.assertEqual(r['missing'], 1)
        linked = {x['product_id']: x['library_id'] for x in dashboard.query("SELECT product_id,library_id FROM product_size_guides WHERE merchant_id='1' ORDER BY product_id")}
        self.assertEqual(linked, {'11': self.lib_a, '12': None, '14': self.lib_a})
        self.assertEqual(dashboard.query("SELECT count(*)::int AS n FROM product_size_guides WHERE merchant_id='2'", (), True)['n'], 0)
        self.assertEqual(self.client.post('/dashboard-api/size-rules/apply?merchant=1').json()['linked'], 0, 'idempotent')
    def test_oldest_rule_wins_and_a_new_product_event_applies_rules(self):
        self.client.put('/dashboard-api/size-rules?merchant=1', json={'category_id': '200', 'library_id': self.lib_b}); self.client.put('/dashboard-api/size-rules?merchant=1', json={'category_id': '100', 'library_id': self.lib_a})
        self.assertEqual(rules.apply_rules('1', ['12']), ['12'])
        self.assertEqual(dashboard.query("SELECT library_id FROM product_size_guides WHERE merchant_id='1' AND product_id='12'", (), True)['library_id'], self.lib_b)
        with patch.object(dashboard, 'salla_get', return_value={'data': {'id': 13, 'name': 'جديد', 'status': 'sale', 'categories': [{'id': 100, 'name': 'فئة 100'}]}}):
            dashboard.update_product_event('1', 'product.updated', {'id': 13})
        self.assertEqual(dashboard.query("SELECT library_id FROM product_size_guides WHERE merchant_id='1' AND product_id='13'", (), True)['library_id'], self.lib_a, 'moved into category 100')
        self.assertEqual([c['category_id'] for c in dashboard.query("SELECT category_id FROM product_categories WHERE merchant_id='1' AND product_id='13'")], ['100'])
        dashboard.update_product_event('1', 'product.deleted', {'id': 13})
        self.assertEqual(dashboard.query("SELECT count(*)::int AS n FROM product_categories WHERE merchant_id='1' AND product_id='13'", (), True)['n'], 0)
    def test_rule_validation(self):
        put = lambda **b: self.client.put('/dashboard-api/size-rules?merchant=1', json=b).status_code
        self.assertEqual(put(category_id='999', library_id=self.lib_a), 404, 'a category the store does not have')
        self.assertEqual(put(category_id='100', library_id='0' * 12), 404)
        for bad in ({'category_id': 'x', 'library_id': self.lib_a}, {'category_id': '100', 'library_id': 'nope'}, {'category_id': '100', 'library_id': self.lib_a, 'extra': 1}):
            self.assertEqual(put(**bad), 422)
        self.assertEqual(self.client.put('/dashboard-api/size-rules?merchant=2', json={'category_id': '100', 'library_id': self.lib_a}).status_code, 404, 'another store\'s guide is not reachable')
        self.assertEqual(self.client.delete('/dashboard-api/size-rules/777?merchant=1').status_code, 404)
        self.client.put('/dashboard-api/size-rules?merchant=1', json={'category_id': '100', 'library_id': self.lib_a})
        self.assertEqual(self.client.delete('/dashboard-api/size-rules/100?merchant=1').json()['rules'], [])

    def test_order_events_build_the_insights_and_refunds_count_as_returns(self):
        def order(i, size, status=None):
            sales.orders_event('order.created', '1', {'id': i, 'items': [{'product_id': 11, 'quantity': 1, 'options': [{'name': 'المقاس', 'value': size}]}]})
        for i in range(1, 7): order(i, 'M')
        for i in range(7, 14): order(i, 'S')
        self.assertTrue(sales.orders_event('order.created', '1', {'id': 1, 'items': [{'product_id': 11, 'quantity': 1, 'options': [{'name': 'المقاس', 'value': 'M'}]}]}), 'a repeated event is not double counted')
        for i in (1, 2, 3): self.assertTrue(sales.orders_event('order.refunded', '1', {'id': i}))
        self.assertTrue(sales.orders_event('order.status.updated', '1', {'id': 4, 'status': {'slug': 'restored'}}))
        self.assertTrue(sales.orders_event('order.status.updated', '1', {'id': 13, 'status': {'slug': 'canceled'}}))
        self.assertFalse(sales.orders_event('order.status.updated', '1', {'id': 5, 'status': {'slug': 'delivered'}})); self.assertFalse(sales.orders_event('order.created', '1', {'items': []}))
        self.assertFalse(sales.orders_event('order.shipment.created', '1', {'id': 5}))
        d = self.client.get('/dashboard-api/size-insights?merchant=1').json()
        by = {s['size']: s for s in d['products'][0]['sizes']}
        self.assertEqual((by['M']['sold'], by['M']['returned']), (6, 4)); self.assertEqual((by['S']['sold'], by['S']['returned']), (6, 0), 'the cancelled order is not a sale')
        self.assertEqual((d['sold'], d['returned']), (12, 4)); self.assertEqual([(a['size'], a['returned']) for a in d['alerts']], [('M', 4)]); self.assertEqual(d['products'][0]['title'], 'منتج 11')
        self.assertEqual(self.client.get('/dashboard-api/size-insights?merchant=2').json()['sold'], 0, 'other stores see nothing')
        self.assertEqual(self.client.get('/dashboard-api/size-insights?merchant=1&days=3').status_code, 400)
        self.assertEqual(dashboard.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='size_sales' AND column_name ILIKE ANY(ARRAY['%%customer%%','%%mobile%%','%%email%%','%%address%%'])", (), True)['n'], 0)

if __name__ == '__main__':
    unittest.main()
