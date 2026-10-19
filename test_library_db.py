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
import dashboard, size_guides as sg, size_library as lib, size_stats as stats, button_settings as bs
from test_size_guides import G

@unittest.skipUnless(DB, 'TEST_DATABASE_URL not set')
class LibraryDatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        dashboard.query('CREATE TABLE IF NOT EXISTS stores (merchant_id TEXT PRIMARY KEY, access_token TEXT, refresh_token TEXT, store_name TEXT)')
        dashboard.initialize(); sg.initialize(); bs.initialize(); stats.initialize()
        app = FastAPI()
        for router in (sg.router, lib.router, stats.router):
            app.include_router(router)
        app.dependency_overrides[dashboard.authenticated] = lambda: None
        cls.client = TestClient(app)

    def setUp(self):
        for table in ('size_guide_events', 'size_guide_library', 'product_size_guides', 'dashboard_catalog', 'stores'):
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

if __name__ == '__main__':
    unittest.main()
