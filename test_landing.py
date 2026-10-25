import os,unittest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
import landing

class LandingTests(unittest.TestCase):
    def setUp(self):
        app=FastAPI();app.include_router(landing.router);self.c=TestClient(app)
    def test_public_pages_render_without_login(self):
        with patch.dict(os.environ,{'SUPPORT_EMAIL':'help@example.com'}):
            about=self.c.get('/about');privacy=self.c.get('/privacy')
        self.assertEqual((about.status_code,privacy.status_code),(200,200))
        self.assertIn('text/html',about.headers['content-type'])
        self.assertIn('دليلك بلس',about.text);self.assertIn('389',about.text);self.assertIn('7 أيام',about.text)
        self.assertIn('mailto:help@example.com',about.text);self.assertIn('mailto:help@example.com',privacy.text)
        self.assertNotIn('{{',about.text+privacy.text,'every placeholder is filled')
        self.assertIn('لا نخزّن أسماء العملاء',privacy.text)
    def test_support_email_is_escaped_and_optional(self):
        with patch.dict(os.environ,{'SUPPORT_EMAIL':'x"><script>@a.b'}):self.assertNotIn('><script>@a.b',self.c.get('/about').text)
        with patch.dict(os.environ,{'SUPPORT_EMAIL':''}):
            r=self.c.get('/about');self.assertNotIn('mailto:',r.text);self.assertIn('متجر تطبيقات سلة',r.text)
    def test_head_supported(self):
        self.assertEqual(self.c.head('/about').status_code,200)
if __name__=='__main__':unittest.main()
