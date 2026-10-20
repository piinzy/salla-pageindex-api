"""Real-PostgreSQL checks for the shared library, bulk actions and counters.
Skipped unless TEST_DATABASE_URL points at a throwaway database (the schema is created and the tables are emptied)."""
import os, unittest
DB = os.environ.get('TEST_DATABASE_URL')
if DB:
    os.environ['DATABASE_URL'] = DB
os.environ.setdefault('DASHBOARD_PASSWORD', 'testing-password-only')
os.environ.setdefault('DASHBOARD_SESSION_SECRET', 'testing-session-secret-for-unit-tests-only')
from fastapi import FastAPI
from fastapi.testclient import TestClient
import dashboard, size_guides as sg, size_library as lib, size_stats as stats, size_presets as presets, quick_edit as quick, button_settings as bs
from test_size_guides import G

@unittest.skipUnless(DB, 'TEST_DATABASE_URL not set')
class LibraryDatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        dashboard.query('CREATE TABLE IF NOT EXISTS stores (merchant_id TEXT PRIMARY KEY, access_token TEXT, refresh_token TEXT, store_name TEXT)')
        dashboard.initialize(); sg.initialize(); bs.initialize(); stats.initialize(); presets.initialize(); quick.initialize()
        app = FastAPI()
        for router in (sg.router, lib.router, stats.router, presets.router, quick.router):
            app.include_router(router)
        app.dependency_overrides[dashboard.authenticated] = lambda: None
        cls.client = TestClient(app)

    def setUp(self):
        for table in ('product_edit_log', 'size_guide_presets', 'size_guide_events', 'size_guide_library', 'product_size_guides', 'dashboard_catalog', 'stores'):
            dashboard.query(f'DELETE FROM {table}')
        dashboard.query("INSERT INTO stores(merchant_id,access_token) VALUES('123','t'),('999','t')")
        for pid in ('1', '2', '3', '4'):
            dashboard.query("INSERT INTO dashboard_catalog(merchant_id,product_id,title,status) VALUES('123',%s,%s,'sale')", (pid, 'منتج ' + pid))
        dashboard.query("INSERT INTO dashboard_catalog(merchant_id,product_id,title,status) VALUES('999','1','متجر آخر','sale')")

    def call(self, method, path, merchant='123', **kwargs):
        sep = '&' if '?' in path else '?'
        return self.client.request(method, f'{path}{sep}merchant={merchant}', **kwargs)

    def make_library(self, action='publish', **guide):
        r = self.call('POST', '/dashboard-api/size-library', json={'version': 0, 'name': 'فساتين', 'action': action, 'guide': {**G, **guide}})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()['library_id']

    def public(self, pid, merchant='123'):
        return self.client.get(f'/public/size-guides/{merchant}/{pid}')

    def test_link_publish_edit_and_unlink(self):
        lid = self.make_library()
        r = self.call('POST', f'/dashboard-api/size-library/{lid}/link', json={'product_ids': ['1', '2', '77']})
        self.assertEqual(r.json(), {'linked': ['1', '2'], 'skipped': ['77']})
        self.assertEqual(self.public('1').json()['guide']['title'], 'دليل المقاسات')
        self.assertEqual(self.public('3').status_code, 404, 'unlinked product has no guide')
        # edit and publish once: every linked product follows
        r = self.call('PUT', f'/dashboard-api/size-library/{lid}', json={'version': 1, 'name': 'فساتين', 'action': 'publish', 'guide': {**G, 'title': 'عنوان جديد'}})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual({self.public(p).json()['guide']['title'] for p in ('1', '2')}, {'عنوان جديد'})
        # a draft edit does not reach customers
        self.call('PUT', f'/dashboard-api/size-library/{lid}', json={'version': 2, 'name': 'فساتين', 'guide': {**G, 'title': 'مسودة فقط'}})
        self.assertEqual(self.public('1').json()['guide']['title'], 'عنوان جديد')
        # stale version never overwrites
        r = self.call('PUT', f'/dashboard-api/size-library/{lid}', json={'version': 1, 'name': 'x', 'guide': G})
        self.assertEqual(r.status_code, 409)
        # linked products cannot be edited on their own
        r = self.call('PUT', '/dashboard-api/size-guides/1', json={'version': 2, 'guide': G})
        self.assertEqual(r.status_code, 409); self.assertIn('مشترك', r.json()['detail'])
        self.assertEqual(self.call('POST', '/dashboard-api/size-guides/1/unpublish', json={'version': 2}).status_code, 409)
        info = self.call('GET', '/dashboard-api/size-guides/1').json()
        self.assertEqual(info['library']['name'], 'فساتين'); self.assertEqual(info['guide']['title'], 'مسودة فقط')
        listing = {g['product_id']: g for g in self.call('GET', '/dashboard-api/size-guides').json()}
        self.assertEqual(listing['1']['library_name'], 'فساتين'); self.assertTrue(listing['1']['is_published']); self.assertTrue(listing['1']['has_changes'])
        # unlinking keeps what customers see today and frees the product
        r = self.call('POST', '/dashboard-api/size-guides/unlink', json={'product_ids': ['1', '3']})
        self.assertEqual(r.json(), {'unlinked': ['1'], 'skipped': ['3']})
        self.assertEqual(self.public('1').json()['guide']['title'], 'عنوان جديد')
        self.call('POST', f'/dashboard-api/size-library/{lid}/unpublish', json={'version': 3})
        self.assertEqual(self.public('2').status_code, 404, 'unpublished library hides linked products')
        self.assertEqual(self.public('1').status_code, 200, 'detached copy is unaffected')
        self.assertEqual(self.call('PUT', '/dashboard-api/size-guides/1', json={'version': 2, 'guide': G}).status_code, 200)

    def test_delete_needs_no_linked_products_and_stores_are_isolated(self):
        lid = self.make_library()
        self.call('POST', f'/dashboard-api/size-library/{lid}/link', json={'product_ids': ['1']})
        r = self.call('DELETE', f'/dashboard-api/size-library/{lid}')
        self.assertEqual(r.status_code, 409)
        self.assertEqual(self.call('GET', f'/dashboard-api/size-library/{lid}', merchant='999').status_code, 404)
        self.assertEqual(self.call('POST', f'/dashboard-api/size-library/{lid}/link', merchant='999', json={'product_ids': ['1']}).status_code, 404)
        self.assertEqual(self.call('GET', '/dashboard-api/size-library', merchant='999').json(), [])
        self.call('POST', '/dashboard-api/size-guides/unlink', json={'product_ids': ['1']})
        self.assertEqual(self.call('DELETE', f'/dashboard-api/size-library/{lid}').json(), {'deleted': True})
        self.assertEqual(self.call('GET', '/dashboard-api/size-library/nothex').status_code, 404)

    def test_copy_is_independent_and_never_replaces_silently(self):
        self.call('PUT', '/dashboard-api/size-guides/1', json={'version': 0, 'guide': G, 'action': 'publish'})
        self.call('PUT', '/dashboard-api/size-guides/2', json={'version': 0, 'guide': {**G, 'title': 'جدول المنتج 2'}, 'action': 'draft'})
        r = self.call('POST', '/dashboard-api/size-guides/copy', json={'source_product_id': '1', 'product_ids': ['1', '2', '3', '4', '88']})
        self.assertEqual(r.json()['copied'], ['3', '4']); self.assertEqual(set(r.json()['skipped']), {'1', '2', '88'})
        self.assertEqual(self.public('3').status_code, 404, 'copies are drafts unless published')
        r = self.call('POST', '/dashboard-api/size-guides/copy', json={'source_product_id': '1', 'product_ids': ['2', '3'], 'overwrite': True, 'publish': True})
        self.assertEqual(set(r.json()['copied']), {'2', '3'})
        self.assertEqual(self.public('2').json()['guide']['title'], 'دليل المقاسات')
        # overwriting a linked product detaches it from the shared guide
        lid = self.make_library()
        self.call('POST', f'/dashboard-api/size-library/{lid}/link', json={'product_ids': ['4']})
        self.call('POST', '/dashboard-api/size-guides/copy', json={'source_product_id': '1', 'product_ids': ['4'], 'overwrite': True})
        self.assertIsNone(self.call('GET', '/dashboard-api/size-guides/4').json()['library'])
        # an incomplete source cannot be copied as published
        self.call('PUT', '/dashboard-api/size-guides/1', json={'version': 1, 'guide': {**G, 'rows': [{'size': 'S', 'values': ['', '']}]}})
        bad = self.call('POST', '/dashboard-api/size-guides/copy', json={'source_product_id': '1', 'product_ids': ['3'], 'overwrite': True, 'publish': True})
        self.assertEqual(bad.status_code, 400)

    def test_bulk_publish_and_unpublish(self):
        lid = self.make_library()
        self.call('POST', f'/dashboard-api/size-library/{lid}/link', json={'product_ids': ['4']})
        self.call('PUT', '/dashboard-api/size-guides/1', json={'version': 0, 'guide': G})
        self.call('PUT', '/dashboard-api/size-guides/2', json={'version': 0, 'guide': {**G, 'rows': [{'size': 'S', 'values': ['', '']}]}})
        r = self.call('POST', '/dashboard-api/size-guides/bulk', json={'action': 'publish', 'product_ids': ['1', '2', '3', '4']}).json()
        self.assertEqual(r['updated'], ['1'])
        reasons = {s['product_id']: s['reason'] for s in r['skipped']}
        self.assertEqual(set(reasons), {'2', '3', '4'}); self.assertEqual(reasons['3'], 'لا يوجد جدول'); self.assertEqual(reasons['4'], 'مرتبط بجدول مشترك')
        self.assertEqual(self.public('1').status_code, 200)
        r = self.call('POST', '/dashboard-api/size-guides/bulk', json={'action': 'unpublish', 'product_ids': ['1', '4']}).json()
        self.assertEqual(r['updated'], ['1']); self.assertEqual(self.public('1').status_code, 404); self.assertEqual(self.public('4').status_code, 200)

    def test_events_count_only_real_guides_and_feed_the_stats(self):
        self.call('PUT', '/dashboard-api/size-guides/1', json={'version': 0, 'guide': G, 'action': 'publish'})
        for kind in ('open', 'open', 'recommend', 'bogus'):
            self.assertEqual(self.client.post(f'/public/size-guides/123/1/event?t={kind}').status_code, 204)
        self.client.post('/public/size-guides/123/3/event?t=open')   # no guide: ignored
        self.client.post('/public/size-guides/abc/1/event?t=open')   # invalid id: ignored
        data = self.call('GET', '/dashboard-api/size-guide-stats?days=7').json()
        self.assertEqual((data['opens'], data['calcs'], data['published_guides']), (2, 1, 1))
        self.assertEqual([(t['product_id'], t['opens']) for t in data['top']], [('1', 2)])
        self.assertEqual(self.call('GET', '/dashboard-api/size-guide-stats?days=0').status_code, 400)
        self.assertEqual(self.call('GET', '/dashboard-api/size-guide-stats', merchant='999').json()['opens'], 0)

    def test_lookup_shows_guide_state_and_matches_name_or_sku(self):
        dashboard.query("UPDATE dashboard_catalog SET sku='DR-100',price=240 WHERE merchant_id='123' AND product_id='1'")
        dashboard.query("UPDATE dashboard_catalog SET sku='SH-200',title='حذاء رياضي' WHERE merchant_id='123' AND product_id='2'")
        lid = self.make_library()
        self.call('POST', f'/dashboard-api/size-library/{lid}/link', json={'product_ids': ['1']})
        self.call('PUT', '/dashboard-api/size-guides/2', json={'version': 0, 'guide': G, 'action': 'draft'})
        everything = self.call('GET', '/dashboard-api/product-lookup').json()['items']
        self.assertEqual({p['product_id'] for p in everything}, {'1', '2', '3', '4'}, 'an empty search lists products')
        by = {p['product_id']: p for p in everything}
        self.assertEqual((by['1']['has_guide'], by['1']['library_name'], by['1']['is_published']), (True, 'فساتين', True))
        self.assertEqual((by['2']['has_guide'], by['2']['library_id'], by['2']['is_published']), (True, None, False))
        self.assertEqual((by['3']['has_guide'], by['3']['is_published']), (False, False))
        self.assertEqual([p['product_id'] for p in self.call('GET', '/dashboard-api/product-lookup?q=sh-2').json()['items']], ['2'], 'SKU, case-insensitive')
        self.assertEqual([p['product_id'] for p in self.call('GET', '/dashboard-api/product-lookup?q=حذاء').json()['items']], ['2'])
        self.assertEqual(self.call('GET', '/dashboard-api/product-lookup?q=100%25').json()['items'], [], 'a typed % is not a wildcard')
        self.assertEqual(self.call('GET', '/dashboard-api/product-lookup?q=DR-100', merchant='999').json()['items'], [], 'other stores are invisible')
        dashboard.query("INSERT INTO dashboard_catalog(merchant_id,product_id,title,status) SELECT '123',n::text,'منتج كثير','sale' FROM generate_series(100,130) n")
        self.assertEqual(len(self.call('GET', '/dashboard-api/product-lookup?q=كثير').json()['items']), quick.LOOKUP_LIMIT)

    def test_product_edit_updates_catalog_and_writes_an_audit_row(self):
        from unittest.mock import patch, MagicMock
        dashboard.query("UPDATE dashboard_catalog SET price=240,quantity=5 WHERE merchant_id='123' AND product_id='1'")
        ok = MagicMock(status_code=200); ok.json.return_value = {'data': {'id': 1, 'name': 'فستان معدّل', 'price': {'amount': 199, 'currency': 'SAR'}, 'sku': 'DR-1', 'quantity': 5, 'status': 'sale'}}
        with patch.object(quick.requests, 'put', return_value=ok) as put:
            r = self.call('PUT', '/dashboard-api/products/1', json={'name': 'فستان معدّل', 'price': 199})
        self.assertEqual(r.status_code, 200, r.text); self.assertEqual(put.call_args.kwargs['json'], {'name': 'فستان معدّل', 'price': 199.0})
        row = dashboard.query("SELECT title,price,quantity,sku FROM dashboard_catalog WHERE merchant_id='123' AND product_id='1'", one=True)
        self.assertEqual((row['title'], float(row['price']), float(row['quantity']), row['sku']), ('فستان معدّل', 199.0, 5.0, 'DR-1'))
        log = dashboard.query("SELECT merchant_id,product_id,changes FROM product_edit_log", one=True)
        self.assertEqual((log['merchant_id'], log['product_id'], log['changes']['price']), ('123', '1', {'from': 240.0, 'to': 199.0}))
        # a refused edit leaves the catalog and the log untouched
        refused = MagicMock(status_code=403)
        with patch.object(quick.requests, 'put', return_value=refused):
            self.assertEqual(self.call('PUT', '/dashboard-api/products/1', json={'price': 5}).status_code, 403)
        self.assertEqual(float(dashboard.query("SELECT price FROM dashboard_catalog WHERE merchant_id='123' AND product_id='1'", one=True)['price']), 199.0)
        self.assertEqual(dashboard.query('SELECT count(*) AS n FROM product_edit_log', one=True)['n'], 1)
        # another store's product is never reachable
        with patch.object(quick.requests, 'put') as other:
            self.assertEqual(self.call('PUT', '/dashboard-api/products/2', merchant='999', json={'price': 5}).status_code, 404)
            other.assert_not_called()

    def test_saved_looks_and_phrases_are_per_store_and_limited(self):
        look = {'theme': 'gold', 'color': '#a8812c', 'table_style': 'lines', 'size_style': 'plain'}
        r = self.call('POST', '/dashboard-api/size-presets', json={'kind': 'style', 'name': 'تصميمي', 'style': look})
        self.assertEqual(r.status_code, 200, r.text); pid = r.json()['preset_id']
        self.assertEqual(r.json()['style']['theme'], 'gold'); self.assertEqual(r.json()['style']['density'], 'comfortable', 'unspecified fields get safe defaults')
        self.call('POST', '/dashboard-api/size-presets', json={'kind': 'phrase', 'name': 'جملة', 'text': 'القياسات تقريبية'})
        data = self.call('GET', '/dashboard-api/size-presets').json()
        self.assertEqual([x['name'] for x in data['styles']], ['تصميمي']); self.assertEqual(data['phrases'][0]['text'], 'القياسات تقريبية')
        other = self.call('GET', '/dashboard-api/size-presets', merchant='999').json()
        self.assertEqual(other, {'styles': [], 'phrases': []}, 'stores never see each other\'s designs')
        self.assertEqual(self.call('DELETE', f'/dashboard-api/size-presets/{pid}', merchant='999').status_code, 404)
        self.assertEqual(self.call('DELETE', '/dashboard-api/size-presets/nothex').status_code, 404)
        self.assertEqual(self.call('DELETE', f'/dashboard-api/size-presets/{pid}').json(), {'deleted': True})
        self.assertEqual(self.call('GET', '/dashboard-api/size-presets').json()['styles'], [])
        # content is rejected, and each kind is capped at the limit even when requests arrive together
        bad = self.call('POST', '/dashboard-api/size-presets', json={'kind': 'style', 'name': 'x', 'style': {**look, 'title': 'يتسلل'}})
        self.assertEqual(bad.status_code, 422)
        for i in range(presets.MAX_PER_KIND - 1):   # one phrase was saved above
            self.assertEqual(self.call('POST', '/dashboard-api/size-presets', json={'kind': 'phrase', 'name': f'p{i}', 'text': f'جملة {i}'}).status_code, 200)
        over = self.call('POST', '/dashboard-api/size-presets', json={'kind': 'phrase', 'name': 'زائدة', 'text': 'x'})
        self.assertEqual(over.status_code, 400); self.assertIn('الأقصى', over.json()['detail'])
        self.assertEqual(self.call('POST', '/dashboard-api/size-presets', json={'kind': 'style', 'name': 'ما زال متاحًا', 'style': look}).status_code, 200, 'the limit is per kind')

if __name__ == '__main__':
    unittest.main()
