"""Plans, AI allowance and credits per store, lifecycle events and token renewal."""
import os, unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock
DB = os.environ.get('TEST_DATABASE_URL')
if DB:
    os.environ['DATABASE_URL'] = DB
os.environ.setdefault('DASHBOARD_PASSWORD', 'testing-password-only')
os.environ.setdefault('DASHBOARD_SESSION_SECRET', 'testing-session-secret-for-unit-tests-only')
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
import billing, dashboard

NOW = datetime(2026, 6, 15, 12, 0, tzinfo=timezone.utc)
def row(**kw):
    base = dict(plan='trial', installed=True, trial_ends_at=NOW + timedelta(days=5), paid_until=None, ai_trial_used=0, ai_month='2026-06', ai_month_used=0, extra_credits=0)
    return {**base, **kw}

class PureTests(unittest.TestCase):
    def test_trial_allows_three_reads_for_seven_days(self):
        s = billing.compute(row(ai_trial_used=1), NOW)
        self.assertEqual((s['plan'], s['active'], s['trial_days_left']), ('trial', True, 5))
        self.assertEqual(s['ai'], {'limit': 3, 'used': 1, 'plan_remaining': 2, 'extra': 0, 'remaining': 2})
    def test_trial_over_means_expired_and_no_reads(self):
        s = billing.compute(row(trial_ends_at=NOW - timedelta(seconds=1), extra_credits=9), NOW)
        self.assertEqual((s['plan'], s['active'], s['ai']['remaining']), ('expired', False, 0), 'credits are frozen while inactive')
    def test_paid_gets_fifty_a_month_and_a_new_month_resets(self):
        paid = row(plan='paid', paid_until=NOW + timedelta(days=20), ai_month_used=50, extra_credits=4)
        s = billing.compute(paid, NOW)
        self.assertEqual((s['plan'], s['ai']['plan_remaining'], s['ai']['remaining']), ('paid', 0, 4))
        later = billing.compute(paid, NOW + timedelta(days=17))   # July
        self.assertEqual((later['plan'], later['ai']['used'], later['ai']['plan_remaining']), ('paid', 0, 50))
    def test_late_renewal_has_a_grace_period(self):
        r = row(plan='paid', paid_until=NOW - timedelta(days=1))
        self.assertTrue(billing.compute(r, NOW)['active'])
        self.assertFalse(billing.compute(r, NOW + timedelta(days=2))['active'])
    def test_uninstalled_store_is_inactive(self):
        self.assertEqual(billing.compute(row(installed=False, plan='paid'), NOW)['plan'], 'uninstalled')
    def test_dates_from_salla_in_common_shapes(self):
        for value in ('2026-07-01T10:00:00Z', '2026-07-01 10:00:00', {'date': '2026-07-01 10:00:00.000000'}):
            self.assertEqual(billing.parse_time(value).year, 2026, value)
        for bad in (None, '', 5, 'soon', []):
            self.assertIsNone(billing.parse_time(bad))
    def test_enforcement_is_opt_in(self):
        with patch.dict(os.environ, {'BILLING_ENFORCE': ''}):
            self.assertFalse(billing.enforcing()); self.assertIsNone(billing.consume_ai('1'))
        with patch.dict(os.environ, {'BILLING_ENFORCE': 'true'}):
            self.assertTrue(billing.enforcing())

@unittest.skipUnless(DB, 'TEST_DATABASE_URL not set')
class DatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        dashboard.query('CREATE TABLE IF NOT EXISTS stores (merchant_id TEXT PRIMARY KEY, access_token TEXT, refresh_token TEXT, store_name TEXT)')
        billing.initialize()
        app = FastAPI(); app.include_router(billing.router)
        app.dependency_overrides[dashboard.authenticated] = lambda: None
        cls.client = TestClient(app)
    def setUp(self):
        for t in ('billing_events', 'store_billing', 'stores'):
            dashboard.query(f'DELETE FROM {t}')
        dashboard.query("INSERT INTO stores(merchant_id,access_token,refresh_token) VALUES('1','a','r'),('2','a','r')")
        self.env = patch.dict(os.environ, {'BILLING_ENFORCE': 'true'}); self.env.start()
    def tearDown(self):
        self.env.stop()

    def test_new_store_starts_a_seven_day_trial_with_three_reads(self):
        s = billing.state('1')
        self.assertEqual((s['plan'], s['trial_days_left'], s['ai']['remaining']), ('trial', 7, 3))
        for _ in range(3):
            self.assertEqual(billing.consume_ai('1'), 'plan')
        with self.assertRaises(HTTPException) as e:
            billing.consume_ai('1')
        self.assertEqual(e.exception.status_code, 402); self.assertIn('صور التجربة', e.exception.detail)
        self.assertEqual(billing.state('2')['ai']['remaining'], 3, 'allowances never cross stores')
    def test_failed_read_is_refunded(self):
        source = billing.consume_ai('1'); self.assertEqual(billing.state('1')['ai']['remaining'], 2)
        billing.refund_ai('1', source); self.assertEqual(billing.state('1')['ai']['remaining'], 3)
    def test_subscription_then_extra_credits_then_exhaustion(self):
        billing.apply_event('app.subscription.started', '1', {'end_date': (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()})
        self.assertEqual(billing.state('1')['plan'], 'paid')
        dashboard.query("UPDATE store_billing SET ai_month=%s,ai_month_used=49 WHERE merchant_id='1'", (billing.month_key(datetime.now(timezone.utc)),))
        self.assertEqual(billing.consume_ai('1'), 'plan')
        with self.assertRaises(HTTPException) as e:
            billing.consume_ai('1')
        self.assertIn('اشحن رصيدًا', e.exception.detail)
        r = self.client.post('/dashboard-api/billing/credits?merchant=1', json={'credits': 2, 'note': 'test'})
        self.assertEqual(r.status_code, 200); self.assertEqual(r.json()['ai']['extra'], 2)
        self.assertEqual(billing.consume_ai('1'), 'extra'); self.assertEqual(billing.state('1')['ai']['extra'], 1)
        billing.refund_ai('1', 'extra'); self.assertEqual(billing.state('1')['ai']['extra'], 2)
    def test_credits_endpoint_rejects_bad_amounts_and_merchant_sessions(self):
        for bad in (0, -1, 1001, 'x'):
            self.assertEqual(self.client.post('/dashboard-api/billing/credits?merchant=1', json={'credits': bad}).status_code, 422)
        self.assertEqual(self.client.post('/dashboard-api/billing/credits?merchant=1', json={'credits': 1, 'extra': 1}).status_code, 422)
        app = FastAPI(); app.include_router(billing.router)
        def merchant_session(request: Request):
            request.state.dashboard_merchant = '1'
        app.dependency_overrides[dashboard.authenticated] = merchant_session
        self.assertEqual(TestClient(app).post('/dashboard-api/billing/credits?merchant=1', json={'credits': 5}).status_code, 403)
        self.assertEqual(billing.state('1')['ai']['extra'], 0)
    def test_uninstall_stops_access_and_wipes_tokens_reinstall_restores(self):
        self.assertTrue(billing.storefront_allowed('1'))
        billing.apply_event('app.uninstalled', '1', {})
        self.assertEqual(billing.state('1')['plan'], 'uninstalled'); self.assertFalse(billing.storefront_allowed('1'))
        self.assertIsNone(dashboard.query("SELECT access_token FROM stores WHERE merchant_id='1'", (), True)['access_token'])
        billing.apply_event('app.store.authorize', '1', {})
        self.assertEqual(billing.state('1')['plan'], 'trial')
    def test_expiry_and_cancellation_events(self):
        billing.apply_event('app.subscription.started', '1', {})
        billing.apply_event('app.subscription.canceled', '1', {}); self.assertEqual(billing.state('1')['plan'], 'paid', 'paid time is honoured')
        billing.apply_event('app.subscription.expired', '1', {}); self.assertEqual(billing.state('1')['plan'], 'expired'); self.assertFalse(billing.storefront_allowed('1'))
        billing.apply_event('app.trial.canceled', '2', {}); self.assertEqual(billing.state('2')['plan'], 'expired')
        self.assertFalse(billing.apply_event('app.something.new', '1', {}), 'unknown events are ignored')
    def test_storefront_is_open_while_enforcement_is_off(self):
        billing.apply_event('app.subscription.expired', '1', {})
        with patch.dict(os.environ, {'BILLING_ENFORCE': ''}):
            self.assertTrue(billing.storefront_allowed('1'))

@unittest.skipUnless(DB, 'TEST_DATABASE_URL not set')
class TokenRefreshTests(unittest.TestCase):
    def setUp(self):
        dashboard.query('CREATE TABLE IF NOT EXISTS stores (merchant_id TEXT PRIMARY KEY, access_token TEXT, refresh_token TEXT, store_name TEXT)')
        dashboard.query('DELETE FROM stores'); dashboard.query("INSERT INTO stores(merchant_id,access_token,refresh_token) VALUES('1','old','r1')")
        self.env = patch.dict(os.environ, {'SALLA_CLIENT_ID': 'cid', 'SALLA_CLIENT_SECRET': 'sec'}); self.env.start()
    def tearDown(self):
        self.env.stop()
    @staticmethod
    def reply(status, body=None):
        m = MagicMock(); m.status_code = status; m.json.return_value = body or {}; return m
    def test_refresh_saves_both_new_tokens_and_skips_when_already_renewed(self):
        import salla_tokens
        with patch('salla_tokens.requests.post', return_value=self.reply(200, {'access_token': 'new', 'refresh_token': 'r2'})) as post:
            self.assertEqual(salla_tokens.refresh('1', 'old'), 'new')
            self.assertEqual(post.call_args.kwargs['data']['refresh_token'], 'r1')
            self.assertEqual(salla_tokens.refresh('1', 'old'), 'new', 'a second caller with the stale token reuses the new one')
            self.assertEqual(post.call_count, 1)
        self.assertEqual(dashboard.query("SELECT access_token,refresh_token FROM stores WHERE merchant_id='1'", (), True), {'access_token': 'new', 'refresh_token': 'r2'})
    def test_rejected_refresh_token_disconnects_the_store(self):
        import salla_tokens
        with patch('salla_tokens.requests.post', return_value=self.reply(400)):
            with self.assertRaises(salla_tokens.TokenError):
                salla_tokens.refresh('1', 'old')
        self.assertIsNone(dashboard.query("SELECT refresh_token FROM stores WHERE merchant_id='1'", (), True)['refresh_token'])
    def test_server_errors_keep_the_tokens(self):
        import salla_tokens
        with patch('salla_tokens.requests.post', return_value=self.reply(503)):
            with self.assertRaises(salla_tokens.TokenError):
                salla_tokens.refresh('1', 'old')
        self.assertEqual(dashboard.query("SELECT refresh_token FROM stores WHERE merchant_id='1'", (), True)['refresh_token'], 'r1')
    def test_salla_get_renews_once_on_401(self):
        first, second = self.reply(401), self.reply(200, {'data': [1]}); second.json.return_value = {'data': [1]}
        with patch('dashboard.requests.get', side_effect=[first, second]) as get, \
             patch('salla_tokens.requests.post', return_value=self.reply(200, {'access_token': 'new', 'refresh_token': 'r2'})):
            self.assertEqual(dashboard.salla_get('/products', 'old', None, '1'), {'data': [1]})
            self.assertEqual(get.call_args.kwargs['headers']['Authorization'], 'Bearer new')

if __name__ == '__main__':
    unittest.main()
