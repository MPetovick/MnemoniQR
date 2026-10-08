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

        # 1. old version installed
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
        check('only the new cache is left', page.evaluate("() => caches.keys()") == ['mnemoniqr-' + new_ver])

        # 3. next update while the user is typing a phrase: no reload, banner, reload once home
        nxt = tempfile.mkdtemp()
        shutil.copytree(NEW, nxt, dirs_exist_ok=True)
        sw = os.path.join(nxt, 'sw.js')
        src = open(sw).read()
        with open(sw, 'w') as f:
            f.write(src.replace(f"'mnemoniqr-{new_ver}'", f"'mnemoniqr-{new_ver}-next'"))
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
        with open(sw2, 'w') as f:
            f.write(src.replace(f"'mnemoniqr-{new_ver}'", f"'mnemoniqr-{new_ver}-next2'"))
        page.evaluate('() => { window.__mark = 2; }')
        state['dir'] = nxt2
        page.evaluate('() => navigator.serviceWorker.getRegistration().then((r) => r.update())')
        ok = wait(page, lambda: page.evaluate('() => window.__mark === undefined && !!document.querySelector(".version")'))
        check('on home: reloads by itself, no banner', ok and not page.is_visible('#update-banner'))
        check('no page errors', not errors, '; '.join(errors[:3]))
        browser.close()
    httpd.shutdown()
    print('\nOK' if not failed else f'\n{failed} FAILED')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
