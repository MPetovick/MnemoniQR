#!/usr/bin/env python3
"""
MnemoniQR · Community goal in the app (Chromium, Playwright).

  1. test build (`--donate-test --goal-test`, made-up balances, 49%): footer line, thin bar and its accessible
     name; ring, total and date in the Support sheet; the balance of each network with links to its explorers;
  2. the shipped build: the snapshot of src/js/goal.js, 0% draws no arc;
  3. no donation address: no goal anywhere;
  4. a snapshot that does not add up (or misses a network) is not shown, the support link stays;
  5. the goal reached; the single-file version shows the same snapshot; nothing breaks the CSP.

Usage: python3 tests/goal_e2e.py   (run python3 tools/build.py first)
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

    test_dist = tempfile.mkdtemp(prefix='mqr-goal-')
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'build.py'), '--out', test_dist, '--donate-test', '--goal-test'], check=True, capture_output=True)
    none_dist = tempfile.mkdtemp(prefix='mqr-nogoal-')
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'build.py'), '--out', none_dist, '--donate-none'], check=True, capture_output=True)
    _, base = serve(test_dist)
    _, real_url = serve(os.path.join(ROOT, 'dist'))
    _, plain_url = serve(none_dist)
    A = build.TEST_ADDRESSES
    shipped = build.parse_goal(build.read(os.path.join(ROOT, 'src', 'js', 'goal.js')))

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        errors = []

        def open_page(url):
            ctx = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
            page = ctx.new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.goto(url)
            page.wait_for_timeout(600)
            return ctx, page

        # 1. test build
        ctx, page = open_page(base + '/index.html')
        check('footer: the goal line replaces the plain one', page.is_visible('#goal-foot') and page.is_hidden('#support-plain'))
        check('footer: "Unlock multi-seed for everyone · Support it" and 49%',
              'Unlock multi-seed for everyone' in page.inner_text('#goal-foot') and page.inner_text('#goal-foot-pct') == '49%')
        fill = page.evaluate("() => document.getElementById('goal-foot-fill').getBoundingClientRect().width / document.getElementById('goal-foot-bar').getBoundingClientRect().width")
        check('footer: the bar is filled to 49%', abs(fill - 0.4914) < 0.01, f'{fill:.3f}')
        label = page.get_attribute('#support-link', 'aria-label') or ''
        check('footer: accessible name starts with the visible text, gives the figures',
              label.startswith('Unlock multi-seed for everyone · Support it') and '49%' in label and '$21,000' in label and 'Oct 1, 2026' in label, label)
        check('footer: the bar is hidden from screen readers', page.get_attribute('#goal-foot-bar', 'aria-hidden') == 'true')
        page.click('#support-link')
        page.wait_for_selector('#support-sheet:not([hidden])')
        page.wait_for_timeout(300)
        check('sheet: ring, title, total, target', page.is_visible('#goal-box') and page.inner_text('#goal-pct') == '49%'
              and page.inner_text('#goal-raised') == '$10,320' and page.inner_text('#goal-target') == 'of $21,000'
              and page.inner_text('#goal-title') == 'Unlock multi-seed backups for everyone')
        check('sheet: the ring is a progressbar with value and text', page.get_attribute('#goal-ring', 'role') == 'progressbar'
              and page.get_attribute('#goal-ring', 'aria-valuenow') == '49'
              and page.get_attribute('#goal-ring', 'aria-valuetext') == '49% of the goal: $10,320 of $21,000')
        arc = page.evaluate("() => { const a = document.getElementById('goal-arc'); return [a.getAttribute('stroke-dasharray'), a.hasAttribute('hidden')]; }")
        check('sheet: the arc covers 49% of the circle', arc[0] == '123.50 251.33' and not arc[1], str(arc))
        check('sheet: date of the snapshot', page.inner_text('#goal-asof') == 'As of Oct 1, 2026')
        live = page.evaluate("() => { const a = document.querySelector('#goal-box a'); return [a.href, a.target, a.rel]; }")
        check('sheet: "Live total" opens mnemoniqr.app/goal in a new tab, no opener, no referrer',
              live == ['https://mnemoniqr.app/goal', '_blank', 'noopener noreferrer'], str(live))
        check('sheet: the lead gives way to the goal, the note about explorers is shown', page.is_hidden('#support-lead') and page.is_visible('#goal-note'))

        def strip():
            return page.evaluate('''() => ({
                label: document.getElementById('support-bal-l').textContent,
                value: document.getElementById('support-bal-v').textContent,
                links: [...document.querySelectorAll('#support-bal-links a')].map((a) => [a.textContent, a.href, a.target, a.rel, a.getAttribute('aria-label')])
            })''')
        s = strip()
        check('BTC: balance of the address and its value', page.is_visible('#support-bal') and s['label'] == 'Balance of this address' and s['value'] == '0.05 BTC ≈ $3,000', s['value'])
        check('BTC: mempool.space link to this exact address, new tab, no opener',
              s['links'] == [['mempool.space ↗', f"https://mempool.space/address/{A['btc']}", '_blank', 'noopener noreferrer', 'Check on mempool.space (opens a block explorer)']], str(s['links']))
        page.click('#support-tabs [data-id=evm]')
        page.wait_for_timeout(300)
        s = strip()
        check('ETH: balance on the three EVM networks, by coin', s['label'] == 'Balance on Ethereum, BSC and Base' and s['value'] == '1.2 ETH · 2,500 USDT · 120.5 USDC ≈ $5,520', s['value'])
        check('ETH: Etherscan, BscScan and Basescan for the same address',
              [l[1] for l in s['links']] == [f"https://etherscan.io/address/{A['evm']}", f"https://bscscan.com/address/{A['evm']}", f"https://basescan.org/address/{A['evm']}"])
        page.click('#support-tabs [data-id=tron]')
        page.wait_for_timeout(300)
        s = strip()
        check('TRON: TRX and USDT, empty BTT left out, Tronscan', s['value'] == '1,000 TRX · 1,500 USDT ≈ $1,800'
              and [l[1] for l in s['links']] == [f"https://tronscan.org/#/address/{A['tron']}"], s['value'])
        page.click('#support-tabs [data-id=ton]')
        page.wait_for_timeout(300)
        s = strip()
        check('GRAM: an empty address shows 0, Tonviewer', s['value'] == '0 GRAM ≈ $0' and [l[1] for l in s['links']] == [f"https://tonviewer.com/{A['ton']}"], s['value'])
        sizes = page.evaluate("() => { const s = document.querySelector('#support-sheet .sheet'); return [s.scrollHeight, s.clientHeight, getComputedStyle(s).overflowY]; }")
        check('sheet: scrolls when taller than the screen', sizes[0] <= sizes[1] or sizes[2] == 'auto', str(sizes))
        check('no horizontal overflow at 390 px', page.evaluate('() => document.documentElement.scrollWidth') <= 390)

        ctx.close()

        # The app reads its snapshot inside a closure: each case below changes js/goal.js as it loads
        # (the file itself cannot be swapped, SRI would refuse it), then looks at what the page shows
        def with_snapshot(mutation):
            c = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
            c.add_init_script("""(() => {
                let g;
                Object.defineProperty(self, 'MQR_GOAL', { configurable: true, get: () => g,
                    set: (v) => { g = JSON.parse(JSON.stringify(v)); (%s)(g); } });
            })();""" % mutation)
            p = c.new_page()
            p.on('pageerror', lambda e: errors.append(str(e)))
            p.goto(base + '/index.html')
            p.wait_for_timeout(600)
            return c, p

        # 4. a snapshot that does not add up is not shown (the build refuses it too)
        for name, mutation in (('does not add up', '(g) => { g.wallets.btc.usd = 99999; }'),
                               ('misses a network', '(g) => { delete g.wallets.ton; }'),
                               ('has an amount in exponent form', "(g) => { g.wallets.btc.assets[0].amount = '1e3'; }"),
                               ('has a negative value', '(g) => { g.wallets.ton.usd = -5; g.wallets.ton.assets[0].usd = -5; }'),
                               ('has no target', '(g) => { delete g.target_usd; }')):
            c, p = with_snapshot(mutation)
            ok = p.is_visible('#support-link') and p.is_visible('#support-plain') and p.is_hidden('#goal-foot') and p.get_attribute('#support-link', 'aria-label') is None
            p.click('#support-link')
            p.wait_for_timeout(300)
            ok = ok and p.is_hidden('#goal-box') and p.is_visible('#support-lead') and p.is_hidden('#support-bal') and p.is_hidden('#goal-note')
            check(f'a snapshot that {name} is not shown; the plain support link and sheet stay', ok)
            c.close()

        # 5. goal reached, and a goal barely started
        c, p = with_snapshot('(g) => { g.target_usd = 5000; }')
        res = [p.inner_text('#goal-foot-t'), p.inner_text('#goal-foot-pct')]
        p.click('#support-link')
        p.wait_for_timeout(300)
        res += [p.inner_text('#goal-title'), p.inner_text('#goal-pct'), p.get_attribute('#goal-ring', 'aria-valuenow')]
        check('goal reached: thanks, 100%, never more', res == ['Multi-seed unlocked, thank you', '100%', 'Goal reached: multi-seed is coming for everyone', '100%', '100'], str(res))
        c.close()
        c, p = with_snapshot('(g) => { g.target_usd = 5000000; }')
        check('under 1% but not zero: "<1%"', p.inner_text('#goal-foot-pct') == '<1%', p.inner_text('#goal-foot-pct'))
        c.close()

        ctx, page = open_page(base + '/mnemoniqr-offline.html')
        check('single file: the same goal in the footer', page.is_visible('#goal-foot') and page.inner_text('#goal-foot-pct') == '49%')
        page.click('#support-link')
        page.wait_for_timeout(400)
        check('single file: ring and balance', page.inner_text('#goal-pct') == '49%' and page.inner_text('#support-bal-v') == '0.05 BTC ≈ $3,000')
        ctx.close()

        # 2. shipped build
        ctx, page = open_page(real_url + '/index.html')
        if page.is_visible('#support-link'):
            total = build.check_goal(shipped, None)
            pct = total / shipped['target_usd'] * 100
            want = '<1%' if 0 < pct < 1 else f'{int(min(pct, 100))}%'
            check(f'shipped build: footer shows {want} of the snapshot', page.is_visible('#goal-foot') and page.inner_text('#goal-foot-pct') == want)
            page.click('#support-link')
            page.wait_for_timeout(400)
            check('shipped build: target and date of src/js/goal.js',
                  page.inner_text('#goal-target') == f"of {build.usd(shipped['target_usd'])}" and page.is_visible('#goal-asof'))
            if total == 0:
                check('0%: no arc is drawn (a round cap would leave a dot)', page.evaluate("() => document.getElementById('goal-arc').hasAttribute('hidden')"))
        ctx.close()

        # 3. no donation address: no goal
        ctx, page = open_page(plain_url + '/index.html')
        check('no address: no goal and no support link', page.is_hidden('#support-link') and page.is_hidden('#goal-foot') and page.is_hidden('#goal-foot-bar'))
        ctx.close()

        check('no page error and no CSP violation', not errors, '; '.join(errors)[:300])
        browser.close()

    print(f"\n{'All goal UI checks passed' if not failed else f'{failed} FAILED'}")
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
