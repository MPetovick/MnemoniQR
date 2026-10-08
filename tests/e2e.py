#!/usr/bin/env python3
"""
MnemoniQR end-to-end tests (Playwright for Python).

    pip install playwright argon2-cffi cryptography
    python -m playwright install chromium firefox webkit
    python tools/build.py
    python tests/e2e.py --browser all          # or chromium | firefox | webkit

Serves dist/ on a local port and checks, in each browser:
  1. the in-browser unit suite (dist/tests/tests.html) passes;
  2. a full backup: built-in keyboard, passphrase, decoy, keyfile, 2-of-3 shares, diceware password,
     the rule against reusing phrase words, verification and the PDF;
  3. recovery in the app by typing the printed share text, with the keyfile;
  4. recovery of the same printed text with tools/recover.py (no app involved);
  5. the install sheet and the offline single file.
Exit code 0 only if every check passes in every requested browser.
"""
import argparse
import functools
import http.server
import json
import os
import re
import subprocess
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
REAL = 'legal winner thank year wave sausage worth useful legal winner thank yellow'
DECOY = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong'
KEYFILE = os.path.join(DIST, 'MQR_logo.webp')
FAKE_INSTALL = ("() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => { window.__prompted = true; };"
                " e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); }")


class Checks:
    def __init__(self, browser):
        self.browser, self.failed = browser, 0

    def __call__(self, name, ok, detail=''):
        print(f"  [{'ok' if ok else 'FAIL'}] {name}" + (f' · {detail}' if detail else ''))
        self.failed += 0 if ok else 1


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def wait_until(page, js, timeout=120000):
    """Poll a function expression. (wait_for_function evaluates strings, which the app's CSP forbids.)"""
    for _ in range(timeout // 250):
        if page.evaluate(js):
            return True
        page.wait_for_timeout(250)
    raise TimeoutError(js)


def serve():
    handler = functools.partial(QuietHandler, directory=DIST)
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f'http://127.0.0.1:{httpd.server_address[1]}'


def type_phrase(page, phrase):
    for w in phrase.split():
        page.keyboard.type(w[:4])
        page.keyboard.press('Space')


def pdf_codes(path):
    """Extract the backup text printed in our uncompressed PDF (it may continue on a second page)."""
    data = open(path, 'rb').read().decode('latin-1')
    text = ' '.join(re.findall(r'/F2 [\d.]+ Tf [\d.]+ g [\d.]+ [\d.]+ Td \((.*?)\) Tj', data))
    starts = [m.start() for m in re.finditer(r'MQ[RS]5:', text)]
    return [text[a:b].strip() for a, b in zip(starts, starts[1:] + [len(text)])]


def pdf_pages(path):
    return len(re.findall(rb'/Type /Page\b', open(path, 'rb').read()))


def run(pw, name, base):
    c = Checks(name)
    print(f'\n== {name} ==')
    browser = getattr(pw, name).launch(**({'args': ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']} if name == 'chromium' else {}))
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True, reduced_motion='reduce')
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)

    # 1. unit suite
    page.goto(base + '/tests/tests.html')
    results = None
    for _ in range(480):
        results = page.evaluate('() => self.__TEST_RESULTS || null')
        if results:
            break
        page.wait_for_timeout(500)
    failed = [r['name'] for r in (results or {}).get('results', []) if not r['ok']]
    c('unit suite', bool(results) and not failed, f"{len(results['results'])} tests" if results and not failed else ', '.join(failed) or 'timeout')

    # 2. full backup
    page.goto(base + '/index.html')
    page.wait_for_timeout(800)
    page.evaluate(FAKE_INSTALL)
    page.wait_for_timeout(2600)
    c('install sheet appears', page.is_visible('#install-sheet'))
    page.click('#install-later')

    page.click('#encrypt-btn-main')
    for k in 'lega':
        page.click(f'.key[data-key={k}]')
    page.click('.key[data-key=next]')
    type_phrase(page, ' '.join(REAL.split()[1:]))
    page.wait_for_timeout(300)
    c('checksum and fingerprint', 'valid' in page.inner_text('#seed-status') and 'b8688df1' in page.inner_text('#seed-fp'))
    page.click('#seed-next')
    page.check('#pp-enable')
    page.fill('#pp-input', 'My pass 25')
    page.fill('#pp-confirm', 'My pass 52')
    page.click('#options-next')
    c('mistyped passphrase is refused', page.is_visible('#step-options') and not page.is_visible('#step-seed'))
    page.fill('#pp-confirm', 'My pass 25')
    page.check('#decoy-enable')
    page.check('#kf-enable')
    page.set_input_files('#kf-file', KEYFILE)
    page.wait_for_timeout(300)
    c('keyfile chosen', page.is_visible('#kf-info'))
    page.select_option('#split-select', '2-3')
    page.click('#options-next')
    type_phrase(page, DECOY)
    page.wait_for_timeout(300)
    page.click('#seed-next')

    page.fill('#password-input', 'my-legal-password-XYZ-2026')
    page.fill('#password-confirm', 'my-legal-password-XYZ-2026')
    page.wait_for_timeout(200)
    c('password reusing a phrase word is refused', page.is_disabled('#password-next') and page.is_visible('#strength-warn'))
    page.click('#gen-words')
    real_pw = page.input_value('#password-input')
    c('diceware password', len(real_pw.split('-')) == 6, real_pw)
    page.fill('#decoy-input', 'decoy-pass')
    page.fill('#decoy-confirm', 'decoy-pass')
    page.wait_for_timeout(200)
    page.click('#password-next')
    page.wait_for_selector('#step-result:not([hidden])', timeout=120000)
    qr_box = page.evaluate("() => { const c = document.getElementById('qr-canvas'); return [c.width, c.getBoundingClientRect().width]; }")
    c('on-screen QR is sharp and fits the screen', qr_box[0] >= qr_box[1] and qr_box[1] <= 390, f'{qr_box[0]} px drawn, {qr_box[1]:.0f} px shown')

    page.click('#qr-verify')
    page.wait_for_selector('#password-modal:not([hidden])')
    c('verification asks for the keyfile', page.is_visible('#kf-need'))
    page.set_input_files('#kf-file', KEYFILE)
    page.fill('#decrypt-password', real_pw)
    page.click('#decrypt-confirm')
    wait_until(page, "() => document.querySelector('#qr-caption').classList.contains('ok')")
    c('backup verified', True)

    page.click('#qr-print')
    with page.expect_download() as d:
        page.click('#print-go')
    pdf = os.path.join(tempfile.mkdtemp(), 'backup.pdf')
    d.value.save_as(pdf)
    codes = pdf_codes(pdf)
    c('PDF holds 3 typeable shares', len(codes) == 3 and all(x.startswith('MQS5:') for x in codes))
    page.click('#qr-done')

    # 3. recovery in the app by typing two printed shares
    page.click('#recover-btn')
    page.click('#src-type')
    page.fill('#type-input', codes[2].lower() + '\n\n' + codes[0])
    page.click('#type-use')
    page.wait_for_selector('#qr-ready:not([hidden])', timeout=10000)
    c('typed shares accepted, keyfile requested', page.is_visible('#kf-need'))
    page.set_input_files('#kf-file', KEYFILE)
    page.fill('#decrypt-password', real_pw)
    page.click('#decrypt-confirm')
    page.wait_for_selector('#step-decrypted:not([hidden])', timeout=120000)
    words = page.evaluate("() => [...document.querySelectorAll('#seed-grid .seed-word span:last-child')].map(e => e.textContent).join(' ')")
    c('recovered phrase and fingerprint', words == REAL and '1c720d0d' in page.inner_text('#decrypted-fp'))
    page.click('#decrypted-done')

    # cancelling during key derivation never reveals the phrase
    page.click('#recover-btn')
    page.click('#src-type')
    page.fill('#type-input', codes[0] + ' ' + codes[1])
    page.click('#type-use')
    page.set_input_files('#kf-file', KEYFILE)
    page.fill('#decrypt-password', real_pw)
    page.click('#decrypt-confirm')
    page.wait_for_timeout(50)
    page.keyboard.press('Escape')
    page.wait_for_timeout(3000)
    c('Escape during decryption cancels it', not page.is_visible('#step-decrypted') and page.is_visible('#password-modal'))
    page.click('#decrypt-cancel')

    # 4. the same printed text with the standalone script
    proc = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'recover.py'), '--password-stdin', '--json', '--keyfile', KEYFILE],
                          input=real_pw + '\n' + codes[1] + '\n' + codes[2], capture_output=True, text=True)
    try:
        out = json.loads(proc.stdout)
        ok = ' '.join(out['words']) == REAL and out['passphrase'] == 'My pass 25' and out['fingerprint'] == '1c720d0d'
    except Exception:
        ok = False
    c('tools/recover.py recovers the printed shares', ok, proc.stderr.strip())
    proc = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'recover.py'), '--password-stdin', '--json', '--keyfile', KEYFILE],
                          input='decoy-pass\n' + codes[0] + '\n' + codes[1], capture_output=True, text=True)
    c('tools/recover.py opens the decoy with the decoy password', proc.returncode == 0 and json.loads(proc.stdout)['words'][0] == 'zoo')

    # largest allowed backup: 24 words, 100-byte passphrase and note
    big_pp, big_note = 'P' * 99 + '!', 'N' * 100
    page.click('#practice-btn')
    page.click('#practice-start')
    page.select_option('#seed-count', '24')
    page.click('#word-grid li:nth-child(13) .cell')
    for w in ('abandon ' * 10 + 'abandon art').split():
        page.keyboard.type(w[:4])
        page.keyboard.press('Space')
    page.wait_for_timeout(300)
    # practice phrases are shown in clear, so the cells hold the full words
    big_words = page.evaluate("() => [...document.querySelectorAll('#word-grid .cell-w')].map(e => e.textContent).join(' ')")
    page.click('#seed-next')
    if page.is_visible('#seed-next'):
        page.on('dialog', lambda d: d.accept())
        page.click('#seed-next')
    page.fill('#message-input', big_note)
    page.check('#pp-enable')
    page.fill('#pp-input', big_pp)
    page.fill('#pp-confirm', big_pp)
    page.click('#options-next')
    page.click('#gen-chars')
    big_pw = page.input_value('#password-input')
    page.click('#password-next')
    page.wait_for_selector('#step-result:not([hidden])', timeout=120000)
    page.click('#qr-print')
    page.check('input[name=tpl][value=cards]')
    page.click('#print-go')
    page.wait_for_timeout(300)
    c('cards refused for a dense backup', page.is_visible('#print-modal'))
    page.check('input[name=tpl][value=sheet]')
    page.check('input[name=ecc][value=H]')
    with page.expect_download() as d:
        page.click('#print-go')
    big_pdf = os.path.join(tempfile.mkdtemp(), 'big.pdf')
    d.value.save_as(big_pdf)
    big_codes = pdf_codes(big_pdf)
    proc = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'recover.py'), '--password-stdin', '--json'],
                          input=big_pw + '\n' + ' '.join(big_codes), capture_output=True, text=True)
    try:
        out = json.loads(proc.stdout)
        ok = ' '.join(out['words']) == big_words and out['passphrase'] == big_pp and out['note'] == big_note
    except Exception:
        ok = False
    c('large backup: PDF paginates the text and recover.py reads it', ok and pdf_pages(big_pdf) == 2, f'{pdf_pages(big_pdf)} pages {proc.stderr.strip()} {len(big_codes[0]) if big_codes else 0} characters')
    page.on('dialog', lambda d: d.accept())
    page.click('#qr-done')

    if name == 'chromium':
        page.click('#recover-btn')
        page.click('#src-scan')
        page.wait_for_timeout(1500)
        c('camera works under the CSP', page.evaluate("() => document.getElementById('scanner-video').videoWidth > 0"))
        page.click('#decrypt-cancel')

    # 5. single offline file
    single = ctx.new_page()
    single.on('pageerror', lambda e: errors.append(str(e)))
    single.goto('file://' + os.path.join(DIST, 'mnemoniqr-offline.html'))
    single.wait_for_timeout(800)
    single.click('#practice-btn')
    single.click('#practice-start')
    single.click('#seed-next')
    single.click('#options-next')
    single.click('#gen-chars')
    single.click('#password-next')
    single.wait_for_selector('#step-result:not([hidden])', timeout=120000)
    c('offline single file encrypts', single.inner_text('#qr-badge') == 'Practice')

    c('no console or page errors', not errors, '; '.join(errors[:3]))
    browser.close()
    return c.failed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--browser', default='chromium', choices=['chromium', 'firefox', 'webkit', 'all'])
    args = ap.parse_args()
    if not os.path.exists(os.path.join(DIST, 'index.html')):
        sys.exit('Run python tools/build.py first.')
    httpd, base = serve()
    names = ['chromium', 'firefox', 'webkit'] if args.browser == 'all' else [args.browser]
    failed = 0
    with sync_playwright() as pw:
        for name in names:
            failed += run(pw, name, base)
    httpd.shutdown()
    print(f"\n{'All checks passed' if not failed else f'{failed} check(s) failed'} ({', '.join(names)})")
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
