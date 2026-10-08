#!/usr/bin/env python3
"""
MnemoniQR · forced-update test (Chromium, Playwright).

Simulates a phone stuck on an old cached version and checks that the new one takes over by itself:
  1. an older build (any version, e.g. 6.3.0 or 5.x) is installed and controlling the page;
  2. the server switches to the current dist/; one visit is enough: the page ends on the new
     version with no tap on any prompt;
  3. a later update while the user is in the middle of a flow does not reload the page: a banner
     appears, and the reload happens as soon as the user is back on the home screen;
  4. an update that arrives on the home screen reloads at once.

Usage: python3 tests/update_e2e.py OLD_DIST_DIR
"""
import functools
import http.server
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEW = os.path.join(ROOT, 'dist')
state = {'dir': None}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=state['dir'], **k)

    def end_headers(self):
        # Worst case for the old client: let the HTTP cache keep everything except what the build marks no-cache
        if self.path.split('?')[0] in ('/', '/index.html', '/sw.js', '/manifest.json'):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, *args):
        pass


def version(page):
    try:
        return page.locator('.version').first.text_content(timeout=2000) or ''
    except Exception:
        return ''



def wait(page, fn, timeout=30000):
    for _ in range(timeout // 200):
        try:
            if fn():
                return True
        except Exception:
            pass  # the page is navigating
        page.wait_for_timeout(200)
    return False


def main():
    old = os.path.abspath(sys.argv[1])
    failed = 0

    def check(name, ok, detail=''):
        nonlocal failed
        print(f"  [{'ok' if ok else 'FAIL'}] {name}" + (f' · {detail}' if detail else ''))
        failed += 0 if ok else 1

    new_ver = 'v' + re.search(r"VERSION = '([\d.]+)'", open(os.path.join(ROOT, 'tools', 'build.py')).read()).group(1)
    state['dir'] = old
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{httpd.server_address[1]}/'

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={'width': 390, 'height': 844})
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('dialog', lambda d: d.accept())
        page.set_default_timeout(20000)

        # 0. first visit of the current version in a fresh profile: no update banner, no reload
        state['dir'] = NEW
        fresh_ctx = browser.new_context(viewport={'width': 390, 'height': 844})
        fresh = fresh_ctx.new_page()
        fresh.goto(base)
        fresh.evaluate('() => { window.__mark = 1; }')
        fresh.click('#encrypt-btn-main')
        wait(fresh, lambda: fresh.evaluate('() => !!navigator.serviceWorker.controller'))
        fresh.wait_for_timeout(4000)
        check('first visit: no update banner, no reload',
              fresh.evaluate('() => window.__mark === 1') and not fresh.is_visible('#update-banner'))
        fresh_ctx.close()

        # 1. old version installed
        state['dir'] = old
        page.goto(base)
        wait(page, lambda: page.evaluate('() => !!navigator.serviceWorker.controller'))
        page.reload()
        old_ver = version(page)
        check('old version installed and controlling', bool(page.evaluate('() => !!navigator.serviceWorker.controller')) and old_ver != new_ver, old_ver)

        # 2. new version deployed: the user just opens the app (the old service worker serves the old shell)
        state['dir'] = NEW
        print('  .. switching server to', new_ver, flush=True)
        page.reload(wait_until='commit')
        ok = wait(page, lambda: version(page) == new_ver)
        check('new version takes over with no user action', ok, f'{old_ver} -> {version(page)}')
        keys = page.evaluate("() => caches.keys()")
        app_caches = [k for k in keys if k.startswith('mnemoniqr-')]
        check('only the new app cache is left', len(app_caches) == 1 and app_caches[0].startswith('mnemoniqr-' + new_ver + '+'), str(keys))

        # 3. next update while the user is typing a phrase: no reload, banner, reload once home
        nxt = tempfile.mkdtemp()
        shutil.copytree(NEW, nxt, dirs_exist_ok=True)
        sw = os.path.join(nxt, 'sw.js')
        src = open(sw).read()
        bare = new_ver[1:]

        def next_sw(path, tag):
            # the build stamps CACHE and VERSION with a content id; a new deployment changes both
            out = re.sub(r"const CACHE = '([^']+)'", lambda m: f"const CACHE = '{m.group(1)}-{tag}'", src)
            out = re.sub(r"const VERSION = '([^']+)'", lambda m: f"const VERSION = '{m.group(1)}-{tag}'", out)
            assert out != src
            with open(path, 'w') as f:
                f.write(out)
        next_sw(sw, 'next')
        page.evaluate('() => { window.__mark = 1; }')
        page.click('#encrypt-btn-main')
        page.wait_for_selector('#step-seed:not([hidden])')
        page.keyboard.type('aban')
        state['dir'] = nxt
        page.evaluate('() => navigator.serviceWorker.getRegistration().then((r) => r.update())')
        banner = wait(page, lambda: page.is_visible('#update-banner'))
        check('mid-flow: banner shown, page not reloaded', banner and page.evaluate('() => window.__mark === 1'),
              f"banner={banner} mark={page.evaluate('() => window.__mark')} step={page.is_visible('#step-seed')}")
        page.click('#seed-back')
        reloaded = wait(page, lambda: page.evaluate('() => window.__mark === undefined && !!document.querySelector(".version")'))
        check('back on home: reloaded into the update', reloaded and not page.is_visible('#update-banner'))

        # 4. an update that arrives on the home screen reloads straight away
        nxt2 = tempfile.mkdtemp()
        shutil.copytree(NEW, nxt2, dirs_exist_ok=True)
        sw2 = os.path.join(nxt2, 'sw.js')
        next_sw(sw2, 'next2')
        page.evaluate('() => { window.__mark = 2; }')
        state['dir'] = nxt2
        page.evaluate('() => navigator.serviceWorker.getRegistration().then((r) => r.update())')
        ok = wait(page, lambda: page.evaluate('() => window.__mark === undefined && !!document.querySelector(".version")'))
        check('on home: reloads by itself, no banner', ok and not page.is_visible('#update-banner'))

        # 5. a page frozen in the background (it cannot answer) is not force-reloaded; it updates once awake
        page.click('#encrypt-btn-main')
        page.wait_for_selector('#step-seed:not([hidden])')
        page.evaluate('() => { window.__mark = 5; }')
        cdp = ctx.new_cdp_session(page)
        page.wait_for_timeout(500)   # let the hello reach the worker
        nxt3 = tempfile.mkdtemp()
        shutil.copytree(NEW, nxt3, dirs_exist_ok=True)
        next_sw(os.path.join(nxt3, 'sw.js'), 'next3')
        state['dir'] = nxt3
        other = ctx.new_page()   # another window triggers the update while the first one is frozen
        cdp.send('Page.setWebLifecycleState', {'state': 'frozen'})
        other.goto(base)
        other.evaluate('() => navigator.serviceWorker.getRegistration().then((r) => r.update())')
        other.wait_for_timeout(6000)
        cdp.send('Page.setWebLifecycleState', {'state': 'active'})
        banner = wait(page, lambda: page.is_visible('#update-banner'), 10000)
        check('frozen page: not reloaded, banner once awake', banner and page.evaluate('() => window.__mark === 5'))
        other.close()
        page.click('#seed-back')
        wait(page, lambda: page.evaluate('() => window.__mark === undefined && !!document.querySelector(".version")'))

        # 6. an update that arrives on the home screen with a dialog open applies when the dialog closes
        page.evaluate('() => { window.__mark = 6; }')
        page.click('#about-btn')
        nxt4 = tempfile.mkdtemp()
        shutil.copytree(NEW, nxt4, dirs_exist_ok=True)
        next_sw(os.path.join(nxt4, 'sw.js'), 'next4')
        state['dir'] = nxt4
        page.evaluate('() => navigator.serviceWorker.getRegistration().then((r) => r.update())')
        banner = wait(page, lambda: page.is_visible('#update-banner'))
        page.keyboard.press('Escape')
        reloaded = wait(page, lambda: page.evaluate('() => window.__mark === undefined && !!document.querySelector(".version")'))
        check('dialog open on home: update waits, then applies when it closes', banner and reloaded)
        # 7. same version number, only the content changed (here: donate.js without addresses) -> it still updates
        page.click('#seed-back') if page.is_visible('#seed-back') else None
        same = tempfile.mkdtemp(prefix='mqr-same-')
        subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'build.py'), '--out', same, '--donate-none'], check=True, capture_output=True)
        state['dir'] = NEW
        page.goto(base)
        wait(page, lambda: page.evaluate('() => !!navigator.serviceWorker.controller'))
        page.reload()
        had_link = page.is_visible('#support-link')
        page.evaluate('() => { window.__mark = 7; }')
        state['dir'] = same
        page.evaluate('() => navigator.serviceWorker.getRegistration().then((r) => r.update())')
        changed = wait(page, lambda: page.evaluate('() => window.__mark === undefined && !!document.querySelector(".version")'))
        check('same version, new content: installed copy updates by itself',
              changed and version(page) == new_ver and had_link != page.is_visible('#support-link'), f'support link {had_link} -> {page.is_visible("#support-link")}')
        check('no page errors', not errors, '; '.join(errors[:3]))
        browser.close()
    httpd.shutdown()
    print('\nOK' if not failed else f'\n{failed} FAILED')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
