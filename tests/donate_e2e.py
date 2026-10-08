#!/usr/bin/env python3
"""
MnemoniQR · support (donation) UI test (Chromium, Playwright).

  1. a build with no address configured shows no support UI at all;
  2. a test build (`tools/build.py --donate-test`, public example addresses) shows the footer link,
     the sheet with one tab per network, a QR that decodes to the exact address, grouped text with
     the first and last groups highlighted, and a working Copy button;
  3. the quiet line on the home screen appears once, after the first verified real backup only
     (never after a practice backup) and never again on that device;
  4. a malformed address makes the build fail.

Usage: python3 tests/donate_e2e.py   (run python3 tools/build.py first)
"""
import functools
import http.server
import os
import subprocess
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import build  # noqa: E402
sys.path.insert(0, os.path.join(ROOT, 'tests'))
from e2e import pdf_codes  # noqa: E402

REAL = 'legal winner thank year wave sausage worth useful legal winner thank yellow'


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(directory):
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=directory))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f'http://127.0.0.1:{httpd.server_address[1]}'


def main():
    failed = 0

    def check(name, ok, detail=''):
        nonlocal failed
        print(f"  [{'ok' if ok else 'FAIL'}] {name}" + (f' · {detail}' if detail else ''))
        failed += 0 if ok else 1

    # 4. malformed addresses never build
    for kind, bad in (('evm', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD'), ('tron', 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwc'),
                      ('btc', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5')):
        try:
            build.donations(f"{{ id: 'x', kind: '{kind}', address: '{bad}' }}")
            check(f'build refuses a mistyped {kind} address', False)
        except SystemExit:
            check(f'build refuses a mistyped {kind} address', True)

    test_dist = tempfile.mkdtemp(prefix='mqr-donate-')
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'build.py'), '--out', test_dist, '--donate-test'], check=True, capture_output=True)
    none_dist = tempfile.mkdtemp(prefix='mqr-nodonate-')
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'build.py'), '--out', none_dist, '--donate-none'], check=True, capture_output=True)
    plain, plain_url = serve(none_dist)
    real, real_url = serve(os.path.join(ROOT, 'dist'))
    test, base = serve(test_dist)
    A = build.TEST_ADDRESSES

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        errors = []

        # 1. no addresses: nothing shown
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(plain_url + '/index.html')
        page.wait_for_timeout(600)
        check('no address configured: no support link', not page.is_visible('#support-link') and page.is_hidden('#support-about'))
        ctx.close()

        # the shipped build: whatever networks it has, the sheet opens with focus inside it
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(real_url + '/index.html')
        page.wait_for_timeout(600)
        if page.is_visible('#support-link'):
            page.click('#support-link')
            page.wait_for_timeout(300)
            check('shipped build: focus moves into the support sheet',
                  page.evaluate("() => document.getElementById('support-sheet').contains(document.activeElement)"))
        ctx.close()

        # 2. test build
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=base)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('dialog', lambda d: d.accept())
        page.goto(base + '/index.html')
        page.evaluate("() => localStorage.setItem('mqr-support', '{\"nudged\":true}')")   # left by 6.5.x
        page.reload()
        page.wait_for_timeout(600)
        check('the 6.5.x flag is deleted on start', page.evaluate("() => localStorage.getItem('mqr-support')") is None)
        check('addresses ship under SRI', page.evaluate("() => !!document.querySelector('script[src=\"js/donate.js\"][integrity]')"))
        check('footer link shown', page.is_visible('#support-link'))
        check('nothing shown before any backup', page.is_hidden('#support-nudge'))
        page.click('#support-link')
        page.wait_for_selector('#support-sheet:not([hidden])')
        tabs = page.evaluate("() => [...document.querySelectorAll('#support-tabs [role=tab]')].map((b) => b.textContent)")
        check('one tab per network', len(tabs) == 3, ' / '.join(tabs))

        def shown():
            return page.evaluate('''() => {
                const c = document.getElementById('support-qr');
                const img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
                const q = self.jsQR(img.data, img.width, img.height);
                const spans = [...document.querySelectorAll('#support-addr span')];
                return { qr: q && q.data, text: spans.map((s) => s.textContent).join(''),
                         hl: spans.filter((s) => s.classList.contains('hl')).length, first: spans[0].classList.contains('hl'),
                         last: spans[spans.length - 1].classList.contains('hl'), chip: document.getElementById('support-chip').textContent };
            }''')
        page.wait_for_timeout(300)
        s = shown()
        check('TRON: QR decodes to the exact address', s['qr'] == A['tron'] and s['text'] == A['tron'], str(s['qr']))
        check('TRON: first and last groups highlighted, network chip', s['first'] and s['last'] and s['hl'] == 2 and 'TRC-20' in s['chip'])
        page.click('#support-copy')
        page.wait_for_timeout(200)
        check('Copy puts the exact address in the clipboard', page.evaluate('() => navigator.clipboard.readText()') == A['tron'])
        page.focus('#support-tabs [aria-selected=true]')
        page.keyboard.press('ArrowRight')
        page.wait_for_timeout(300)
        s = shown()
        check('arrow keys switch network (Ethereum)', s['qr'] == A['evm'] and s['text'] == A['evm'])
        page.click('#support-tabs [data-id=btc]')
        page.wait_for_timeout(300)
        s = shown()
        check('Bitcoin tab', s['qr'] == A['btc'] and s['text'] == A['btc'])
        page.keyboard.press('Escape')
        check('Escape closes the sheet', page.is_hidden('#support-sheet'))
        page.click('#about-btn')
        check('"How it protects you" mentions support', page.is_visible('#support-about'))
        page.click('#support-about-go')
        check('…and opens the sheet', page.is_visible('#support-sheet') and page.is_hidden('#about-modal'))
        page.click('#support-done')

        # 3. the quiet line: not after practice, once after a verified real backup
        page.click('#practice-btn')
        page.click('#practice-start')
        page.click('#seed-next')
        page.click('#options-next')
        page.click('#gen-chars')
        page.click('#password-next')
        page.wait_for_selector('#step-result:not([hidden])', timeout=120000)
        page.click('#qr-done')
        check('practice backup: no line', page.is_hidden('#support-nudge'))

        def print_code():
            page.click('#qr-print')
            with page.expect_download() as d:
                page.click('#print-go')
            path = os.path.join(tempfile.mkdtemp(), 'b.pdf')
            d.value.save_as(path)
            return pdf_codes(path)[0]

        def recover(code, password):
            page.click('#recover-btn')
            page.click('#src-type')
            page.fill('#type-input', code)
            page.click('#type-use')
            page.fill('#decrypt-password', password)
            page.click('#decrypt-confirm')
            page.wait_for_selector('#step-decrypted:not([hidden])', timeout=120000)

        def real_backup(verify, keep=False):
            page.click('#encrypt-btn-main')
            for w in REAL.split():
                page.keyboard.type(w[:4])
                page.keyboard.press('Space')
            page.wait_for_timeout(300)
            page.click('#seed-next')
            page.click('#options-next')
            page.click('#gen-words')
            pw_ = page.input_value('#password-input')
            page.click('#password-next')
            page.wait_for_selector('#step-result:not([hidden])', timeout=120000)
            if verify:
                page.click('#qr-verify')
                page.fill('#decrypt-password', pw_)
                page.click('#decrypt-confirm')
                page.wait_for_selector('#qr-caption.ok', timeout=120000)
            code = print_code() if keep else None
            page.click('#qr-done')
            return code, pw_

        real_backup(False)
        check('unverified backup: no line', page.is_hidden('#support-nudge'))
        real_backup(True)
        check('first verified backup: one quiet line', page.is_visible('#support-nudge'))
        check('nothing stored that reveals a backup was made', page.evaluate("() => Object.keys(localStorage).filter((k) => k !== 'mqr-install')") == [])
        check('…no dialog, nothing blocks the home screen', page.is_hidden('#support-sheet') and page.evaluate('() => !document.querySelector(".modal:not([hidden])")'))
        page.click('#support-nudge-x')
        check('…dismissed with ×', page.is_hidden('#support-nudge'))
        code, pw_ = real_backup(True, keep=True)
        check('never shown twice', page.is_hidden('#support-nudge'))

        # after every real recovery: the line comes back once the phrase is wiped and the user is home
        for n in (1, 2):
            recover(code, pw_)
            check(f'recovery {n}: nothing while the phrase is on screen', page.is_hidden('#home') and page.is_hidden('#support-nudge'))
            page.click('#decrypted-done')
            check(f'recovery {n}: line on the home screen', page.is_visible('#support-nudge') and page.is_visible('#nudge-recovered') and page.is_hidden('#nudge-backup'),
                  page.inner_text('#support-nudge').strip()[:60])
            page.click('#support-nudge-x')
        # also when the phrase is wiped because the app went to the background
        recover(code, pw_)
        page.evaluate('''() => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            document.dispatchEvent(new Event('visibilitychange'));
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
            document.dispatchEvent(new Event('visibilitychange'));
            delete document.hidden;
        }''')
        check('recovery: line also after the background wipe', page.is_visible('#home') and page.is_visible('#nudge-recovered'))
        page.click('#support-nudge-go')
        check('recovery line opens the support sheet', page.is_visible('#support-sheet'))
        page.click('#support-done')

        # practice recoveries never show it
        page.click('#practice-btn')
        page.click('#practice-start')
        page.click('#seed-next')
        page.click('#options-next')
        page.click('#gen-chars')
        ppw = page.input_value('#password-input')
        page.click('#password-next')
        page.wait_for_selector('#step-result:not([hidden])', timeout=120000)
        pcode = print_code()
        page.click('#qr-done')
        page.click('#support-nudge-x') if page.is_visible('#support-nudge') else None
        recover(pcode, ppw)
        page.click('#decrypted-done')
        check('practice recovery: no line', page.is_hidden('#support-nudge'))
        page.click('#encrypt-btn-main')
        check('support link not reachable during a flow', not page.is_visible('#support-link'))

        check('no page errors', not errors, '; '.join(errors[:3]))
        browser.close()
    plain.shutdown()
    real.shutdown()
    test.shutdown()
    print('\nOK' if not failed else f'\n{failed} FAILED')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
