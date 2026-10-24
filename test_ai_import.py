import base64, json, os, unittest
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
FULL = {**CHART, 'title': 'دليل مقاسات الفساتين', 'product_name': 'فستان كريب', 'size_header': 'المقاس', 'measurement_type': 'body', 'category': 'women',
        'language': 'ar', 'instructions': 'الصدر: حول أعرض نقطة.\nالخصر: حول أنحف نقطة.', 'notes': 'قماش مطاطي', 'other_text': 'ماركة أورورا', 'other_tables': 1}

def gemini(payload, status=200, message=None):
    r = MagicMock(status_code=status)
    if status == 200:
        r.json.return_value = {'candidates': [{'content': {'parts': [{'text': payload if isinstance(payload, str) else json.dumps(payload)}]}}]}
    else:
        r.json.return_value = {'error': {'message': message or 'failure'}}
    return r

class AiImportTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI(); app.include_router(ai.router)
        app.dependency_overrides[dashboard.authenticated] = lambda: None
        self.client = TestClient(app); ai._calls.clear(); ai._preferred = None
        patcher = patch.object(ai, 'require_store'); patcher.start(); self.addCleanup(patcher.stop)
        env = patch.dict(os.environ, {'GEMINI_API_KEY': KEY, 'GEMINI_MODEL': ''}); env.start(); self.addCleanup(env.stop)

    def post(self, image=PNG):
        return self.client.post('/dashboard-api/size-guide-ai-import?merchant=123', json={'image': image})

    def models_called(self, call):
        return [c.args[0].split('/models/')[1].split(':')[0] for c in call.call_args_list]

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
        self.assertEqual([c['kind'] for c in data['columns']], ['measurement', 'measurement', 'text'], 'EU is a size system, not a measurement')
        self.assertEqual(data['rows'][1], {'size': 'M', 'values': ['96', '', '38']})
        self.assertEqual(data['unit'], 'cm'); self.assertTrue(any('فارغة' in w for w in data['warnings']))
        url, kwargs = call.call_args.args[0], call.call_args.kwargs
        self.assertNotIn(KEY, url); self.assertEqual(kwargs['headers'], {'x-goog-api-key': KEY}); self.assertEqual(kwargs['timeout'], (5, ai.ATTEMPT_SECONDS))
        self.assertIn('gemini-3-flash-preview', url, 'the quick model that answers for new keys comes first')
        parts = kwargs['json']['contents'][0]['parts']; self.assertEqual(parts[1]['inline_data']['mime_type'], 'image/png')
        self.assertEqual(kwargs['json']['generationConfig']['responseMimeType'], 'application/json')
        for field in ('title', 'instructions', 'notes', 'other_text', 'unit', 'category', 'size_header'):
            self.assertIn(field, kwargs['json']['generationConfig']['responseSchema']['properties'])
        self.assertNotIn(KEY, r.text)

    def test_everything_printed_in_the_image_is_returned(self):
        with patch.object(ai.requests, 'post', return_value=gemini(FULL)):
            data = self.post().json()
        self.assertEqual((data['title'], data['size_label'], data['unit'], data['measurement_type'], data['category'], data['language']),
                         ('دليل مقاسات الفساتين', 'المقاس', 'cm', 'body', 'women', 'ar'))
        self.assertEqual(data['instructions'], 'الصدر: حول أعرض نقطة.\nالخصر: حول أنحف نقطة.', 'line breaks are kept')
        self.assertEqual(data['notes'], 'قماش مطاطي\nماركة أورورا', 'notes and the other printed text are joined')
        self.assertTrue(any('جدول آخر' in w for w in data['warnings']))
        # nothing the model says is trusted: odd values become "not found"
        wild = {**CHART, 'category': 'cars', 'unit': 'furlong', 'measurement_type': 'x', 'language': 'fr', 'other_tables': 'many',
                'title': 'T' * 300, 'size_header': 'S' * 80, 'instructions': 'a\x00b\x07c\r\n\n\n\n\nd  e', 'notes': 'N' * 5000, 'other_text': 'O' * 5000}
        with patch.object(ai.requests, 'post', return_value=gemini(wild)):
            data = self.post().json()
        self.assertEqual((data['category'], data['unit'], data['measurement_type'], data['language']), (None, None, None, None))
        self.assertEqual((len(data['title']), len(data['size_label']), len(data['notes'])), (100, 20, 2000)); self.assertEqual(data['instructions'], 'abc\n\nd e')
        self.assertFalse(any('جدول آخر' in w for w in data['warnings']))
        with patch.object(ai.requests, 'post', return_value=gemini(CHART)):
            plain = self.post().json()
        self.assertEqual((plain['title'], plain['instructions'], plain['notes'], plain['category']), ('', '', 'مرجع', None), 'a chart with no extra text returns empty fields')

    def test_a_chart_printed_sideways_with_two_units_comes_back_one_row_per_size(self):
        # La Vallee style: sizes across the top, measurements down the side, each size with IN and CM sub-columns
        sideways = {'layout': 'sizes_across', 'units_present': ['cm', 'in'], 'unit': 'cm', 'size_header': 'المقاس', 'category': 'women', 'measurement_type': 'body', 'language': 'ar',
                    'columns': ['محيط الصدر', 'الطول', 'الأكمام'], 'instructions': 'الصدر: أكبر جزء.', 'other_text': 'لافالي',
                    'rows': [{'size': '38/S', 'values': ['91.4', '147.3', '61']}, {'size': '40/M', 'values': ['96.5', '147.3', '61']}]}
        with patch.object(ai.requests, 'post', return_value=gemini(sideways)) as call:
            data = self.post().json()
        self.assertEqual([c['label'] for c in data['columns']], ['محيط الصدر', 'الطول', 'الأكمام'])
        self.assertEqual([r['size'] for r in data['rows']], ['38/S', '40/M']); self.assertEqual(data['rows'][0]['values'], ['91.4', '147.3', '61'])
        self.assertEqual((data['unit'], data['layout'], data['units_present'], data['size_label']), ('cm', 'sizes_across', ['cm', 'in'], 'المقاس'))
        text = ' '.join(data['warnings']); self.assertIn('بالمقلوب', text); self.assertIn('الوحدتين', text)
        prompt = call.call_args.kwargs['json']['contents'][0]['parts'][0]['text']
        for rule in ('ORIENTATION', 'one ROW per size', 'transpose', 'ONLY the centimetre', 'never make separate columns', 'Arabic wording'):
            self.assertIn(rule, prompt)
        props = call.call_args.kwargs['json']['generationConfig']['responseSchema']['properties']
        self.assertEqual(props['layout']['enum'], ['sizes_down', 'sizes_across', 'unknown']); self.assertIn('units_present', props)
        # only inches printed: no "both units" note
        inches = {**sideways, 'unit': 'in', 'units_present': ['in'], 'layout': 'sizes_down'}
        with patch.object(ai.requests, 'post', return_value=gemini(inches)):
            data = self.post().json()
        self.assertEqual((data['unit'], data['layout'], data['warnings']), ('in', 'sizes_down', []))
        with patch.object(ai.requests, 'post', return_value=gemini({**sideways, 'layout': 'bogus', 'units_present': 'cm'})):
            data = self.post().json()
        self.assertEqual((data['layout'], data['units_present']), (None, []), 'odd values are ignored')

    def test_columns_named_only_by_units_flag_a_misread_chart(self):
        misread = {'columns': ['IN', 'سم', 'IN 3', 'CM 4', 'انش'], 'rows': [{'size': 'S/38', 'values': ['36', '91.4', '38', '96.5', '40']}]}
        with patch.object(ai.requests, 'post', return_value=gemini(misread)):
            data = self.post().json()
        self.assertTrue(any('تبديل الصفوف والأعمدة' in w for w in data['warnings']))
        fine = {'columns': ['Chest', 'Waist', 'Length cm'], 'rows': [{'size': 'S', 'values': ['90', '70', '100']}]}
        with patch.object(ai.requests, 'post', return_value=gemini(fine)):
            self.assertFalse(any('قُرئ بشكل خاطئ' in w for w in self.post().json()['warnings']))

    def test_size_column_listed_among_the_headers_is_realigned(self):
        chart = {'columns': ['Size', 'Bust', 'Waist'], 'rows': [{'size': 'S', 'values': ['80', '60']}, {'size': 'M', 'values': ['84', '64']}]}
        with patch.object(ai.requests, 'post', return_value=gemini(chart)):
            data = self.post().json()
        self.assertEqual([c['label'] for c in data['columns']], ['Bust', 'Waist']); self.assertEqual(data['size_label'], 'Size')
        self.assertEqual(data['rows'][0]['values'], ['80', '60'])
        chart2 = {**chart, 'columns': ['Bust', 'Waist'], 'size_header': 'Size'}      # already correct: nothing is dropped
        with patch.object(ai.requests, 'post', return_value=gemini(chart2)):
            self.assertEqual([c['label'] for c in self.post().json()['columns']], ['Bust', 'Waist'])
        for label, kind in [('EU', 'text'), ('UK 6', 'text'), ('us', 'text'), ('Size', 'text'), ('مقاس الحذاء', 'text'), ('Euro', 'measurement'), ('Waist', 'measurement')]:
            with self.subTest(label=label), patch.object(ai.requests, 'post', return_value=gemini({'columns': [label], 'rows': [{'size': 'S', 'values': ['38']}]})):
                self.assertEqual(self.post().json()['columns'][0]['kind'], kind)

    def test_kinds_and_sanitising_of_untrusted_model_output(self):
        wild = {'columns': ['<b>x</b>', 'x', 'x', 'نص'] + [f'c{i}' for i in range(20)], 'unit': 'furlong',
                'rows': [{'size': 'S' * 80, 'values': ['٩٠', '1.5', '<script>', 'EU 36'] + ['1'] * 40}] * 60}
        with patch.object(ai.requests, 'post', return_value=gemini(wild)):
            data = self.post().json()
        self.assertEqual(len(data['columns']), ai.MAX_COLUMNS); self.assertEqual(len(data['rows']), ai.MAX_ROWS)
        labels = [c['label'].casefold() for c in data['columns']]; self.assertEqual(len(set(labels)), len(labels))
        self.assertEqual([c['kind'] for c in data['columns']][:4], ['measurement', 'measurement', 'text', 'text'])
        self.assertTrue(all(len(r['size']) <= 30 and len(r['values']) == len(data['columns']) for r in data['rows']))
        import size_guides as sg
        sg.Guide(title='t', columns=data['columns'], rows=data['rows'])     # accepted by the guide model as it is

    def style_post(self):
        return self.client.post('/dashboard-api/size-guide-ai-style?merchant=123', json={'image': PNG})

    def test_a_table_picture_becomes_an_appearance_proposal(self):
        look = {'accent': '#B4456A', 'header_bg': '#F9E3EA', 'header_text': '#4A2332', 'row_alt': 'pink', 'border_color': '#f1dde4', 'text_color': '', 'paper_color': '#fffafb',
                'size_bg': '#ffffff', 'size_text': 'javascript:alert(1)', 'table_style': 'cards', 'header_style': 'tint', 'size_style': 'blob', 'corners': 'round',
                'density': 'compact', 'border_style': 'thin', 'font_scale': 'huge', 'title': 'ignored', 'rows': [1]}
        with patch.object(ai.requests, 'post', return_value=gemini(look)) as call:
            r = self.style_post()
        self.assertEqual(r.status_code, 200)
        style = r.json()['style']
        self.assertEqual((style['color'], style['header_bg'], style['paper_color']), ('#b4456a', '#f9e3ea', '#fffafb'))
        self.assertEqual((style['row_alt'], style['size_text'], style['text_color']), ('', '', ''), 'anything that is not #rrggbb is dropped')
        self.assertEqual((style['table_style'], style['corners'], style['density']), ('cards', 'round', 'compact'))
        for gone in ('size_style', 'font_scale', 'title', 'rows'):
            self.assertNotIn(gone, style)
        sent = call.call_args.kwargs['json']
        self.assertIn('visual design', sent['contents'][0]['parts'][0]['text']); self.assertIn('header_bg', sent['generationConfig']['responseSchema']['properties'])
    def test_an_empty_style_answer_is_refused_politely(self):
        with patch.object(ai.requests, 'post', return_value=gemini({'accent': 'none'})):
            r = self.style_post()
        self.assertEqual(r.status_code, 502); self.assertIn('تصميم الجدول', r.json()['detail'])
    def test_style_read_needs_the_same_checks_as_the_import(self):
        self.assertEqual(self.client.post('/dashboard-api/size-guide-ai-style?merchant=123', json={'image': 'AAAA' * 10}).status_code, 400)

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

    def test_a_retired_or_busy_model_moves_on_to_the_next(self):
        retired = gemini(None, 404, 'This model models/x is no longer available to new users.')
        with patch.object(ai.requests, 'post', side_effect=[retired, gemini(None, 503, 'high demand'), requests.ReadTimeout('slow'), gemini(CHART)]) as call:
            r = self.post()
        self.assertEqual(r.status_code, 200, r.text); self.assertEqual(self.models_called(call), list(ai.DEFAULT_MODELS))
        self.assertEqual(ai._preferred, ai.DEFAULT_MODELS[3], 'the model that answered is remembered')
        with patch.object(ai.requests, 'post', return_value=gemini(CHART)) as call:
            self.post()
        self.assertEqual(self.models_called(call), [ai.DEFAULT_MODELS[3]], 'and tried first next time')
        self.assertEqual(self.client.get('/dashboard-api/size-guide-ai-status?merchant=123').status_code, 200)

    def test_configured_models_come_before_the_defaults(self):
        with patch.dict(os.environ, {'GEMINI_MODEL': 'my-model, other-model'}), patch.object(ai.requests, 'post', side_effect=[gemini(None, 404, 'gone'), gemini(CHART)]) as call:
            self.assertEqual(self.post().status_code, 200)
        self.assertEqual(self.models_called(call), ['my-model', 'other-model'])

    def test_when_every_model_fails_the_reason_is_clear(self):
        cases = [(503, 503, 'مزدحمة'), (500, 503, 'مزدحمة'), (429, 429, 'حد الاستخدام'), (404, 502, 'HTTP 404')]
        for google, ours, text in cases:
            with self.subTest(google=google), patch.object(ai.requests, 'post', return_value=gemini(None, google, f'raw {KEY} detail')) as call, patch.object(ai.logger, 'error') as log:
                ai._calls.clear(); r = self.post()
                self.assertEqual(r.status_code, ours); self.assertIn(text, r.json()['detail']); self.assertEqual(call.call_count, len(ai.DEFAULT_MODELS))
                self.assertNotIn(KEY, r.text + str(log.call_args_list))
        with patch.object(ai.requests, 'post', return_value=gemini(None, 404, 'Model gone')):
            self.assertIn('Model gone', self.post().json()['detail'])     # the merchant sees Google's own reason
        with patch.object(ai.requests, 'post', side_effect=requests.ReadTimeout('slow')):
            self.assertEqual(self.post().status_code, 504)
        with patch.object(ai.requests, 'post', side_effect=requests.ConnectionError(f'boom {KEY}')), self.assertLogs('salla_backend', 'ERROR') as logs:
            r = self.post()
        self.assertEqual(r.status_code, 502); self.assertIn('تعذر الاتصال', r.json()['detail']); self.assertNotIn(KEY, r.text + '\n'.join(logs.output))

    def test_a_rejected_key_or_request_stops_at_once(self):
        for status, message, text in [(403, f'API key not valid {KEY}', 'رفضت Google المفتاح'), (401, 'bad', 'رفضت Google المفتاح'),
                                      (400, 'API key not valid. Please pass a valid API key.', 'رفضت Google المفتاح'), (400, 'Image too small', 'رفضت Google الصورة')]:
            with self.subTest(status=status, message=message[:12]), patch.object(ai.requests, 'post', return_value=gemini(None, status, message)) as call:
                ai._calls.clear(); r = self.post()
                self.assertEqual(r.status_code, 502); self.assertIn(text, r.json()['detail']); self.assertEqual(call.call_count, 1, 'other models use the same key and image')
                self.assertNotIn(KEY, r.text)

    def test_unreadable_answers_are_reported(self):
        for payload in ['not json', {'columns': [], 'rows': []}, {'columns': ['a'], 'rows': []}, '[1,2]']:
            with self.subTest(payload=str(payload)[:15]), patch.object(ai.requests, 'post', return_value=gemini(payload)):
                ai._calls.clear(); self.assertEqual(self.post().status_code, 502)
        broken = MagicMock(status_code=200); broken.json.return_value = {'candidates': []}
        with patch.object(ai.requests, 'post', return_value=broken):
            self.assertEqual(self.post().status_code, 502)

    def test_the_total_time_is_bounded(self):
        # clock reads: rate limiter, start, then one per attempt; the third attempt would begin with only 5 s of the 90 s left
        clock = iter([0, 0, 0, 50, 85] + [500] * 20)
        with patch.object(ai.time, 'time', side_effect=lambda: next(clock)), patch.object(ai.requests, 'post', side_effect=requests.ReadTimeout('slow')) as call:
            r = self.post()
        self.assertEqual(r.status_code, 504); self.assertEqual(call.call_count, 2, 'no new attempt starts when little time is left')
        self.assertEqual(call.call_args_list[1].kwargs['timeout'], (5, 40), 'an attempt never outlasts the remaining time')

    def test_hourly_limit_per_store(self):
        with patch.object(ai.requests, 'post', return_value=gemini(CHART)):
            codes = [self.post().status_code for _ in range(ai.MAX_PER_HOUR + 1)]
            self.assertEqual(codes[:-1], [200] * ai.MAX_PER_HOUR); self.assertEqual(codes[-1], 429)
            self.assertTrue(ai.allow('another-store'))

if __name__ == '__main__':
    unittest.main()
