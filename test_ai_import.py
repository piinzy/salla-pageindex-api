import base64, os, unittest
from unittest.mock import patch, MagicMock
import requests
from fastapi import FastAPI
from fastapi.testclient import TestClient
os.environ.setdefault('DASHBOARD_PASSWORD', 'testing-password-only')
os.environ.setdefault('DASHBOARD_SESSION_SECRET', 'testing-session-secret-for-unit-tests-only')
import ai_import as ai, dashboard

KEY = 'unit-test-key-not-real-0123456789'
PNG = base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'0' * 64).decode()
CHART = {'columns': ['الصدر', 'الخصر', 'EU'], 'unit': 'cm', 'notes': 'مرجع',
         'rows': [{'size': 'S', 'values': ['90-94', '70', '36']}, {'size': 'M', 'values': ['96', '', '38']}]}

def gemini(payload, status=200):
    response = MagicMock(status_code=status)
    response.json.return_value = {'candidates': [{'content': {'parts': [{'text': payload if isinstance(payload, str) else __import__('json').dumps(payload)}]}}]}
    return response

class AiImportTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI(); app.include_router(ai.router)
        app.dependency_overrides[dashboard.authenticated] = lambda: None
        self.client = TestClient(app); ai._calls.clear()
        patcher = patch.object(ai, 'require_store'); patcher.start(); self.addCleanup(patcher.stop)
        env = patch.dict(os.environ, {'GEMINI_API_KEY': KEY}); env.start(); self.addCleanup(env.stop)

    def post(self, image=PNG):
        return self.client.post('/dashboard-api/size-guide-ai-import?merchant=123', json={'image': image})

    def test_requires_login(self):
        app = FastAPI(); app.include_router(ai.router)
        with patch.object(ai.requests, 'post') as call:
            self.assertEqual(TestClient(app).post('/dashboard-api/size-guide-ai-import?merchant=123', json={'image': PNG}).status_code, 401)
            self.assertEqual(TestClient(app).get('/dashboard-api/size-guide-ai-status?merchant=123').status_code, 401)
            call.assert_not_called()

    def test_reads_a_chart_and_keeps_the_key_in_a_header_only(self):
        with patch.object(ai.requests, 'post', return_value=gemini(CHART)) as call:
            r = self.post('data:image/png;base64,' + PNG)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertEqual([c['label'] for c in data['columns']], ['الصدر', 'الخصر', 'EU'])
        self.assertEqual([c['kind'] for c in data['columns']], ['measurement', 'measurement', 'measurement'])
        self.assertEqual(data['rows'][1], {'size': 'M', 'values': ['96', '', '38']})
        self.assertEqual(data['unit'], 'cm'); self.assertTrue(any('فارغة' in w for w in data['warnings']))
        url = call.call_args.args[0]; kwargs = call.call_args.kwargs
        self.assertNotIn(KEY, url); self.assertEqual(kwargs['headers'], {'x-goog-api-key': KEY}); self.assertEqual(kwargs['timeout'], 45)
        parts = kwargs['json']['contents'][0]['parts']
        self.assertEqual(parts[1]['inline_data']['mime_type'], 'image/png')
        self.assertEqual(kwargs['json']['generationConfig']['responseMimeType'], 'application/json')
        self.assertNotIn(KEY, r.text)

    def test_kinds_and_sanitising_of_untrusted_model_output(self):
        wild = {'columns': ['<b>x</b>', 'x', 'x', 'نص'] + [f'c{i}' for i in range(20)], 'unit': 'furlong',
                'rows': [{'size': 'S' * 80, 'values': ['٩٠', '1.5', '<script>', 'EU 36'] + ['1'] * 40}] * 60}
        with patch.object(ai.requests, 'post', return_value=gemini(wild)):
            data = self.post().json()
        self.assertEqual(len(data['columns']), ai.MAX_COLUMNS); self.assertEqual(len(data['rows']), ai.MAX_ROWS)
        labels = [c['label'].casefold() for c in data['columns']]; self.assertEqual(len(set(labels)), len(labels))
        self.assertEqual([c['kind'] for c in data['columns']][:4], ['measurement', 'measurement', 'text', 'text'])
        self.assertTrue(all(len(r['size']) <= 30 and len(r['values']) == len(data['columns']) for r in data['rows']))
        self.assertIsNone(data['unit'])
        # it must be accepted by the guide model once the merchant keeps it
        import size_guides as sg
        sg.Guide(title='t', columns=data['columns'], rows=data['rows'])

    def test_bad_images_never_reach_the_service(self):
        big = base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'0' * (ai.MAX_IMAGE_BYTES + 1)).decode()
        with patch.object(ai.requests, 'post') as call:
            for bad in ['!!!not base64!!!' * 3, base64.b64encode(b'GIF89a' + b'0' * 50).decode(), base64.b64encode(b'RIFF1234WAVE' + b'0' * 50).decode(), big]:
                self.assertEqual(self.post(bad).status_code, 400)
            call.assert_not_called()

    def test_missing_key_and_status(self):
        with patch.dict(os.environ, {'GEMINI_API_KEY': '', 'GOOGLE_API_KEY': ''}):
            r = self.post(); self.assertEqual(r.status_code, 503); self.assertIn('GEMINI_API_KEY', r.json()['detail'])
            self.assertEqual(self.client.get('/dashboard-api/size-guide-ai-status?merchant=123').json(), {'available': False})
        self.assertEqual(self.client.get('/dashboard-api/size-guide-ai-status?merchant=123').json(), {'available': True})

    def test_service_failures_are_clear_and_leak_nothing(self):
        for response, expected in [(gemini(CHART, 429), 429), (gemini(CHART, 403), 502), (gemini(CHART, 500), 502)]:
            with patch.object(ai.requests, 'post', return_value=response), patch.object(ai.logger, 'error') as log:
                r = self.post()
                self.assertEqual(r.status_code, expected); self.assertNotIn(KEY, r.text)
                self.assertNotIn(KEY, str(log.call_args_list))
        for payload in ['not json', {'columns': [], 'rows': []}, {'columns': ['a'], 'rows': []}, '[1,2]']:
            with patch.object(ai.requests, 'post', return_value=gemini(payload)):
                self.assertEqual(self.post().status_code, 502)
        with patch.object(ai.requests, 'post', side_effect=requests.ConnectionError(f'boom {KEY}')), self.assertLogs('salla_backend', level='ERROR') as logs:
            r = self.post()
        self.assertEqual(r.status_code, 502); self.assertNotIn(KEY, r.text); self.assertNotIn(KEY, '\n'.join(logs.output))

    def test_hourly_limit_per_store(self):
        with patch.object(ai.requests, 'post', return_value=gemini(CHART)):
            codes = [self.post().status_code for _ in range(ai.MAX_PER_HOUR + 1)]
            self.assertEqual(codes[:-1], [200] * ai.MAX_PER_HOUR); self.assertEqual(codes[-1], 429)
            self.assertTrue(ai.allow('another-store'))

if __name__ == '__main__':
    unittest.main()
