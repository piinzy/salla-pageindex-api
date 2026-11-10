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
    def test_appearance_control_is_available_on_home_and_dashboard(self):
        from pathlib import Path
        static=Path(landing.__file__).parent/'static'
        home=self.c.get('/about').text
        self.assertEqual(home.count('role="switch"'),1)
        self.assertIn('src="/brand-assets/daylight-switch.js',home)
        self.assertIn('src="/brand-assets/app-theme.js"',(static/'dashboard.html').read_text())
        self.assertIn('/dashboard-night.css',(static/'dashboard.html').read_text())
        header=(static/'dashboard.html').read_text().split('<header class="top">',1)[1].split('</header>',1)[0]
        self.assertEqual(header.count('role="switch"'),1)
        self.assertIn('id="store"',header)
        self.assertIn('data-ld-part="toggle-daylight"',header)
        for page in ('faq.html','privacy.html','size-guide-widget.js','size-guide-renderer.js'):
            source=(static/page).read_text()
            self.assertNotIn('daylight-switch.js',source)
            self.assertNotIn('data-ld-part="toggle-daylight"',source)
        for name in ('daylight-switch.js','daylight-switch.css','app-theme.js','landing-night.css'):
            self.assertEqual(self.c.get('/brand-assets/'+name).status_code,200)

    def test_dashboard_mascot_accessories_are_served_for_every_scene(self):
        from xml.etree import ElementTree
        response=self.c.get('/brand-assets/fuzz-props.svg')
        self.assertEqual(response.status_code,200)
        self.assertIn('image/svg+xml',response.headers['content-type'])
        root=ElementTree.fromstring(response.content)
        ids={el.get('id') for el in root.findall('{http://www.w3.org/2000/svg}symbol')}
        self.assertTrue({'ruler','books','switch','chart','preview','heart'} <= ids)

    def test_support_email_is_escaped_and_optional(self):
        with patch.dict(os.environ,{'SUPPORT_EMAIL':'x"><script>@a.b'}):self.assertNotIn('><script>@a.b',self.c.get('/about').text)
        with patch.dict(os.environ,{'SUPPORT_EMAIL':''}):
            r=self.c.get('/about');self.assertNotIn('mailto:',r.text);self.assertIn('متجر تطبيقات سلة',r.text)
    def test_head_supported(self):
        self.assertEqual(self.c.head('/about').status_code,200)
if __name__=='__main__':unittest.main()


class FaqAndMailTests(unittest.TestCase):
    def setUp(self):
        import landing, mailer
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        app=FastAPI();app.include_router(landing.router);self.c=TestClient(app);self.mailer=mailer

    def test_faq_and_email_assets(self):
        r=self.c.get('/faq');self.assertEqual(r.status_code,200);self.assertIn('الأسئلة الشائعة',r.text);self.assertNotIn('{{',r.text)
        for n in ('logo.png','character.jpg'):self.assertEqual(self.c.get('/email-assets/'+n).status_code,200)
        self.assertEqual(self.c.get('/email-assets/x.png').status_code,404)

    def test_welcome_message_and_demo_address(self):
        s,b,t=self.mailer.welcome_message('<b>متجر</b>','https://sizes.mutakaml.com','info@mutakaml.com')
        self.assertIn('دليلك بلس',s);self.assertNotIn('<b>متجر</b>',b);self.assertIn('/email-assets/logo.png',b)
        os_env={'MAIL_FROM':'a@b.c','MAIL_BCC':''}
        with unittest.mock.patch.dict('os.environ',os_env):
            self.assertIsNone(self.mailer.message('x@email.partners','s','b'))
        with unittest.mock.patch.dict('os.environ',{'MAIL_FROM':'a@b.c','MAIL_BCC':'me@b.c'}):
            self.assertEqual(self.mailer.message('x@email.partners','s','b')['to'],['me@b.c'])
            self.assertEqual(self.mailer.message('m@shop.sa','s','b')['bcc'],['me@b.c'])
