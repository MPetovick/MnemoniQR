#!/usr/bin/env python3
"""
MnemoniQR · PDF logo and ZIP test (Chromium, Playwright).

Creates real backups in the app (single, the largest allowed, and 3-of-5 shares), then reads what the user
would keep with a decoder independent from the app (ZXing-C++, as used by many phone scanners):
  - the QR codes stay plain (no logo inside); the PDF carries the shield beside the title on every page;
  - the PNG, the ZIP of shares (CRC checked, README present, no timestamp) and the printed PDF rasterized at
    100 and 150 dpi (a poor print or photo); each code must decode to exactly the text printed under it;
  - the PNGs from the ZIP are uploaded back into the app's own recovery, and the shares recover with recover.py;
  - OpenCV's reader is reported for information only (it fails on large codes, logo or not).

Usage: python3 tests/brand_e2e.py   (needs: pip install playwright zxing-cpp opencv-python-headless pypdfium2)
"""
import functools
import http.server
import io
import json
import os
import subprocess
import sys
import tempfile
import threading
import zipfile

import cv2
import numpy as np
import pypdfium2
import zxingcpp
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
sys.path.insert(0, os.path.join(ROOT, 'tests'))
from e2e import pdf_codes  # noqa: E402


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def zx(img):
    return [r.text for r in zxingcpp.read_barcodes(img) if r.format == zxingcpp.BarcodeFormat.QRCode]


def cvread(img):
    try:
        ok, texts, _, _ = cv2.QRCodeDetector().detectAndDecodeMulti(img)
        return [t for t in (texts if ok else []) if t]
    except cv2.error:
        return []


def gray(png_bytes):
    return cv2.imdecode(np.frombuffer(png_bytes, np.uint8), cv2.IMREAD_GRAYSCALE)


def main():
    failed = 0

    def check(name, ok, detail=''):
        nonlocal failed
        print(f"  [{'ok' if ok else 'FAIL'}] {name}" + (f' · {detail}' if detail else ''))
        failed += 0 if ok else 1

    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=DIST))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{httpd.server_address[1]}'
    tmp = os.environ.get('MQR_KEEP') or tempfile.mkdtemp(prefix='mqr-brand-')
    os.makedirs(tmp, exist_ok=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True, service_workers='block')
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('dialog', lambda d: d.accept())
        page.goto(base + '/index.html')
        page.wait_for_timeout(600)
        if page.is_visible('#install-sheet'):
            page.click('#install-later')

        def save(selector, name):
            with page.expect_download() as d:
                page.click(selector)
            path = os.path.join(tmp, name)
            d.value.save_as(path)
            return path

        def practice(words=12, note='', pp='', split=None):
            page.click('#practice-btn')
            page.click('#practice-start')
            if words == 24:
                page.select_option('#seed-count', '24')
                page.click('#word-grid li:nth-child(13) .cell')
                for w in ('abandon ' * 10 + 'abandon art').split():
                    page.keyboard.type(w[:4])
                    page.keyboard.press('Space')
                page.wait_for_timeout(300)
            page.click('#seed-next')
            if page.is_visible('#seed-next'):
                page.click('#seed-next')
            if note:
                page.fill('#message-input', note)
            if pp:
                page.check('#pp-enable')
                page.fill('#pp-input', pp)
                page.fill('#pp-confirm', pp)
            if split:
                page.select_option('#split-select', split)
            page.click('#options-next')
            page.click('#gen-chars')
            password = page.input_value('#password-input')
            page.click('#password-next')
            page.wait_for_selector('#step-result:not([hidden])', timeout=120000)
            return password

        def pdf(name, ecc='Q'):
            page.click('#qr-print')
            page.check('input[name=tpl][value=sheet]')
            page.check(f'input[name=ecc][value={ecc}]')
            return save('#print-go', name)

        def pdf_pages_gray(path, dpi=150):
            doc = pypdfium2.PdfDocument(path)
            out = []
            for i in range(len(doc)):
                pil = doc[i].render(scale=dpi / 72).to_pil().convert('L')
                out.append(np.array(pil))
            return out

        info = []

        # 1. single backup: screen, PNG, PDF
        practice(12)
        check('screen QR is plain (no logo in the centre)', page.evaluate('''() => {
            const c = document.getElementById('qr-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            for (let i = 0; i < d.length; i += 4) if (d[i] > 40 && d[i] < 200) return false;   // only black and white
            return true;
        }'''))
        png = open(save('#qr-download', 'single.png'), 'rb').read()
        img = gray(png)
        p1 = pdf('single.pdf')
        code = pdf_codes(p1)[0].replace(' ', '')   # printed in groups of four
        check('PNG: ZXing reads the exact text', zx(img) == [code], f'{len(code)} chars')
        info.append(f'OpenCV, single PNG: {code in cvread(img)}')
        for dpi in (100, 150):
            check(f'printed PDF at {dpi} dpi: ZXing reads the exact text', code in zx(pdf_pages_gray(p1, dpi)[0]))
        raw = open(p1, 'rb').read()
        check('PDF: the shield beside the title, not in the QR', b'/Subtype /Image' in raw and raw.count(b'/Sh Do') == len(pypdfium2.PdfDocument(p1)))
        n = zxingcpp.read_barcodes(img)[0].symbology_identifier and None
        version = int(next(r for r in zxingcpp.read_barcodes(img)).version) if hasattr(zxingcpp.read_barcodes(img)[0], 'version') else None
        page.click('#qr-done')

        # 2. the largest allowed backup, PDF at Q and H
        big_pp, big_note = 'P' * 99 + '!', 'N' * 100
        practice(24, note=big_note, pp=big_pp)
        big_png = gray(open(save('#qr-download', 'big.png'), 'rb').read())
        for ecc in ('Q', 'H'):
            pth = pdf(f'big-{ecc}.pdf', ecc)
            bcode = pdf_codes(pth)[0].replace(' ', '')
            shields = open(pth, 'rb').read().count(b'/Sh Do')
            npages = len(pypdfium2.PdfDocument(pth))   # every page header carries the shield; the QR only at H
            check(f'largest backup, PDF at {ecc}: the shield in every page header only', shields == npages, f'{shields} draws, {npages} pages')
            for dpi in (100, 150):
                check(f'largest backup, PDF at {ecc}, {dpi} dpi: ZXing reads it', bcode in zx(pdf_pages_gray(pth, dpi)[0]), f'{len(bcode)} chars')
        check('largest backup PNG: ZXing reads it', zx(big_png) == [bcode])
        info.append(f'OpenCV, largest PNG: {bcode in cvread(big_png)}')
        page.click('#qr-done')

        # 3. 3-of-5 shares: ZIP
        spw = practice(12, note='Shares test', split='3-5')
        check('shares: the download button says ZIP', page.inner_text('#qr-download-t') == 'ZIP')
        zpath = save('#qr-download', 'shares.zip')
        with zipfile.ZipFile(zpath) as zf:
            names = zf.namelist()
            bad = zf.testzip()
            pngs = [zf.read(x) for x in names if x.endswith('.png')]
            readme = zf.read('README.txt').decode() if 'README.txt' in names else ''
            dates = {i.date_time for i in zf.infolist()}
        check('ZIP: 5 PNG + README, CRCs valid, no timestamp', len(pngs) == 5 and bad is None and dates == {(1980, 1, 1, 0, 0, 0)}, ', '.join(names))
        check('ZIP README explains 3 of 5', '5 shares' in readme and 'Any 3' in readme)
        share_texts = []
        for b in pngs:
            z = zx(gray(b))
            share_texts.append(z[0] if len(z) == 1 else None)
        check('every share PNG reads with ZXing', all(share_texts) and len(set(share_texts)) == 5)
        info.append(f'OpenCV, share PNGs: {sum(1 for b in pngs if cvread(gray(b)))}/5')
        proc = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'recover.py'), '--password-stdin', '--json'],
                              input=spw + '\n' + '\n'.join(x for x in share_texts[1:4] if x), capture_output=True, text=True)
        try:
            ok = json.loads(proc.stdout)['note'] == 'Shares test'
        except Exception:
            ok = False
        check('3 shares from the ZIP recover with recover.py', ok, proc.stderr.strip())
        sp = pdf('shares.pdf')
        read = set()
        for g in pdf_pages_gray(sp, 100):
            read |= set(zx(g))
        check('shares PDF at 100 dpi: all 5 printed codes read', read == set(share_texts))
        page.click('#qr-done')
        # the app's own reader takes the PNGs from the ZIP back (Recover → upload images)
        files = []
        for k, b in enumerate(pngs[:3]):
            pth = os.path.join(tmp, f'up{k}.png')
            open(pth, 'wb').write(b)
            files.append(pth)
        page.click('#recover-btn')
        page.set_input_files('#qr-file', files)
        page.wait_for_selector('#qr-ready:not([hidden])', timeout=20000)
        page.fill('#decrypt-password', spw)
        page.click('#decrypt-confirm')
        page.wait_for_selector('#step-decrypted:not([hidden])', timeout=120000)
        check('the app reads 3 share PNGs from the ZIP and recovers', page.is_visible('#step-decrypted'))
        page.click('#decrypted-done')

        for line in info:
            print('    info ·', line)
        check('no page errors', not errors, '; '.join(errors[:3]))
        browser.close()
    httpd.shutdown()
    print('\nOK' if not failed else f'\n{failed} FAILED')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
