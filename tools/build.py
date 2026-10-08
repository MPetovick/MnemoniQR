#!/usr/bin/env python3
"""
MnemoniQR v6.8.0 · Reproducible build (Python 3 standard library only).

    python3 tools/build.py [--no-tests] [--out DIR] [--donate-test | --donate-none] [--goal-test]

    --out DIR       build into DIR instead of dist/ (an empty folder or a previous build)
    --donate-test   public example donation addresses, for the tests only: never deploy
    --donate-none   no donation address, for the tests only
    --goal-test     made-up goal balances, for the tests only: never deploy

Writes dist/ with:
  - the PWA, with a strict CSP, Trusted Types and Subresource Integrity on every script and stylesheet;
  - mnemoniqr-offline.html: the whole app in one file, for devices that never go online;
  - HASHES.txt: SHA-256 of every file plus the build fingerprints the app displays;
  - _headers (Netlify / Cloudflare Pages) and vercel.json with the HTTP security headers;
  - api/goal.js + api/goal-config.json: the live community goal at /goal and /api/goal (Vercel function).

The same sources always produce byte-identical output, so anyone can rebuild a release
and compare its HASHES.txt with the published one.
"""
import base64
import hashlib
import json
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import addresses  # noqa: E402  (tools/addresses.py)

VERSION = '6.8.0'
NO_CACHE = ['/', '/index.html', '/sw.js', '/manifest.json']
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')

TT = "require-trusted-types-for 'script'; trusted-types mqr"
# The page itself never fetches anything: connect-src is 'none' (the service worker has its own context)
CSP_MULTI = ("default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; font-src 'self'; "
             "img-src 'self'; connect-src 'none'; worker-src 'self' blob:; manifest-src 'self'; "
             "base-uri 'none'; form-action 'none'; " + TT)
CSP_TESTS = ("default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self'; "
             "connect-src 'self'; base-uri 'none'; form-action 'none'")


def read(path, mode='r'):
    with open(path, mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f:
        return f.read()


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    binary = isinstance(data, bytes)
    with open(path, 'wb' if binary else 'w', **({} if binary else {'encoding': 'utf-8', 'newline': '\n'})) as f:
        f.write(data)


def b64hash(data, alg):
    return base64.b64encode(hashlib.new(alg, data if isinstance(data, bytes) else data.encode()).digest()).decode()


def fingerprint(tokens):
    """Same algorithm as buildFingerprint() in js/app.js: SHA-256 of the sorted script and stylesheet hashes, first 64 bits."""
    h = hashlib.sha256('\n'.join(sorted(tokens)).encode()).hexdigest()[:16].upper()
    return ' '.join(h[i:i + 4] for i in range(0, 16, 4))


GENERATED = {'js/kdf-src.js'}
OVERRIDES = {}   # path -> content replacing the source file in this build (donation test build)

# Public example addresses from the specifications (EIP-55, BIP-173) and the TRON zero address.
# Used only by `--donate-test` builds for the tests: never deploy such a build.
TEST_ADDRESSES = {
    'tron': 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
    'evm': '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    'btc': 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    'ton': 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ',
}
DONATE_RE = re.compile(r"\{ id: '([a-z0-9-]+)', kind: '([a-z]+)', address: '([^']*)' \}")   # noqa


def donations(text):
    """[(id, kind, address)] from js/donate.js; refuses a malformed address."""
    rows = DONATE_RE.findall(text)
    # Every entry must have the exact shape, so that none escapes the checks below
    if not rows or len(rows) != len(re.findall(r'\baddress\s*:', text)):
        sys.exit("js/donate.js: keep every entry exactly as { id: '…', kind: '…', address: '…' } (single quotes)")
    for did, kind, addr in rows:
        if addr:
            reason = addresses.check(kind, addr)
            if reason:
                sys.exit(f'js/donate.js: "{did}" address {addr!r}: {reason}')
    return rows


def donate_none_source():
    text = read(os.path.join(SRC, 'js', 'donate.js'))
    return DONATE_RE.sub(lambda m: f"{{ id: '{m.group(1)}', kind: '{m.group(2)}', address: '' }}", text)


def donate_test_source():
    text = read(os.path.join(SRC, 'js', 'donate.js'))
    return DONATE_RE.sub(lambda m: f"{{ id: '{m.group(1)}', kind: '{m.group(2)}', address: '{TEST_ADDRESSES[m.group(2)]}' }}", text)


# ---------- community goal (js/goal.js) ----------
GOAL_RE = re.compile(r'/\* GOAL \*/ (\{.*\}) /\* END \*/', re.S)
GOAL_KEYS = {'target_usd', 'start', 'as_of', 'wallets'}
# Made-up balances for `--goal-test` builds (UI tests only): about 49% of the goal
GOAL_TEST = {
    'target_usd': 21000, 'start': '2026-09-01', 'as_of': '2026-10-01',
    'wallets': {
        'btc': {'usd': 3000.0, 'assets': [{'sym': 'BTC', 'chain': 'bitcoin', 'amount': '0.05', 'usd': 3000.0}]},
        'evm': {'usd': 5519.52, 'assets': [
            {'sym': 'ETH', 'chain': 'ethereum', 'amount': '1.2', 'usd': 2899.02},
            {'sym': 'USDT', 'chain': 'ethereum', 'amount': '0', 'usd': 0},
            {'sym': 'USDT', 'chain': 'bsc', 'amount': '2500', 'usd': 2500.0},
            {'sym': 'USDC', 'chain': 'base', 'amount': '120.5', 'usd': 120.5}]},
        'tron': {'usd': 1800.0, 'assets': [
            {'sym': 'TRX', 'chain': 'tron', 'amount': '1000', 'usd': 300.0},
            {'sym': 'USDT', 'chain': 'tron', 'amount': '1500', 'usd': 1500.0},
            {'sym': 'BTT', 'chain': 'tron', 'amount': '0', 'usd': 0}]},
        'ton': {'usd': 0, 'assets': [{'sym': 'GRAM', 'chain': 'ton', 'amount': '0', 'usd': 0}]},
    },
}


def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and x not in (float('inf'), float('-inf'))


def _date(s):
    import datetime
    if not isinstance(s, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', s):
        return None
    try:
        return datetime.date.fromisoformat(s)
    except ValueError:
        return None


def check_goal(g, kinds):
    """Validates a goal snapshot; kinds = networks with a donation address (None: do not compare).
    Returns the total in USD. Every number must add up, so the footer, the ring and each network agree."""
    def fail(msg):
        sys.exit(f'js/goal.js: {msg}')
    if not isinstance(g, dict) or set(g) != GOAL_KEYS:
        fail('keep exactly the keys target_usd, start, as_of, wallets')
    if not _num(g['target_usd']) or not 0 < g['target_usd'] <= 1e9:
        fail('target_usd must be a positive number of dollars')
    start, as_of = _date(g['start']), _date(g['as_of'])
    if not start or not as_of:
        fail('start and as_of must be dates written YYYY-MM-DD')
    if as_of < start:
        fail('as_of is before start')
    w = g['wallets']
    if not isinstance(w, dict) or not w:
        fail('wallets must list at least one network')
    if kinds is not None and set(w) != set(kinds):
        fail(f'networks {sorted(w)} do not match the donation addresses in donate.js {sorted(kinds)}: run python3 tools/goal.py')
    total = 0.0
    for kind, wallet in w.items():
        if kind not in ('btc', 'evm', 'tron', 'ton'):
            fail(f'unknown network "{kind}"')
        if not isinstance(wallet, dict) or set(wallet) != {'usd', 'assets'} or not _num(wallet['usd']) or wallet['usd'] < 0:
            fail(f'"{kind}": needs usd (a number of dollars) and assets')
        assets = wallet['assets']
        if not isinstance(assets, list) or not 1 <= len(assets) <= 20:
            fail(f'"{kind}": assets must list 1 to 20 entries')
        s = 0.0
        for a in assets:
            if not isinstance(a, dict) or set(a) != {'sym', 'chain', 'amount', 'usd'}:
                fail(f'"{kind}": every asset needs sym, chain, amount and usd')
            if not isinstance(a['sym'], str) or not re.fullmatch(r'[A-Z]{2,6}', a['sym']) \
                    or not isinstance(a['chain'], str) or not re.fullmatch(r'[a-z]{2,12}', a['chain']):
                fail(f'"{kind}": malformed asset {a!r}')
            if not isinstance(a['amount'], str) or not re.fullmatch(r'\d{1,30}(\.\d{1,36})?', a['amount']):
                fail(f'"{kind}": amount must be a decimal number written as a string, not {a["amount"]!r}')
            if not _num(a['usd']) or a['usd'] < 0 or (float(a['amount']) == 0 and a['usd'] != 0):
                fail(f'"{kind}": malformed usd value in {a!r}')
            s += a['usd']
        if abs(round(s, 2) - wallet['usd']) > 0.011:
            fail(f'"{kind}": usd {wallet["usd"]} is not the sum of its assets ({round(s, 2)})')
        total += wallet['usd']
    return round(total, 2)


def parse_goal(text):
    m = GOAL_RE.search(text)
    if not m:
        sys.exit('js/goal.js: the snapshot must stay between /* GOAL */ and /* END */')
    try:
        return json.loads(m.group(1))
    except ValueError as e:
        sys.exit(f'js/goal.js: not valid JSON ({e})')


def format_goal(g):
    """The snapshot as written in js/goal.js: one asset per line, so a diff shows exactly what changed."""
    asset = lambda a: json.dumps(a, separators=(', ', ': '))   # noqa: E731
    lines = ['{', f'  "target_usd": {json.dumps(g["target_usd"])},', f'  "start": {json.dumps(g["start"])},',
             f'  "as_of": {json.dumps(g["as_of"])},', '  "wallets": {']
    kinds = list(g['wallets'])
    for i, k in enumerate(kinds):
        w = g['wallets'][k]
        lines += [f'    {json.dumps(k)}: {{', f'      "usd": {json.dumps(w["usd"])},', '      "assets": [']
        lines += [f'        {asset(a)}' + (',' if j < len(w['assets']) - 1 else '') for j, a in enumerate(w['assets'])]
        lines += ['      ]', '    }' + (',' if i < len(kinds) - 1 else '')]
    lines += ['  }', '}']
    return '\n'.join(lines)


def with_goal(text, g):
    """js/goal.js with its snapshot replaced (the comments above it are kept)."""
    if not GOAL_RE.search(text):
        sys.exit('js/goal.js: the snapshot must stay between /* GOAL */ and /* END */')
    return GOAL_RE.sub(lambda _: '/* GOAL */ ' + format_goal(g) + ' /* END */', text, count=1)


def usd(v):
    return f'${v:,.2f}'.replace('.00', '')


def kdf_bundle():
    """The Argon2 worker (hash-wasm + kdf-worker.js) as a string, loaded with the page under SRI / CSP hashes.
    The page starts the worker from a blob: URL, so the worker is covered by the build fingerprint and always
    matches the page that started it, even after a newer version has replaced the cache."""
    src = read(os.path.join(SRC, 'vendor', 'argon2.min.js')) + '\n' + read(os.path.join(SRC, 'kdf-worker.js'))
    return '// Generated by tools/build.py from vendor/argon2.min.js and kdf-worker.js. Do not edit.\n' \
           'self.MQR_KDF_SRC = ' + json.dumps(src) + ';\n'


def source(path):
    if path in OVERRIDES:
        return OVERRIDES[path]
    return kdf_bundle() if path in GENERATED else read(os.path.join(SRC, path))


def check_sources():
    """Fail early on mistakes that would otherwise only show up in the browser."""
    core = read(os.path.join(SRC, 'js', 'core.js'))
    lists = read(os.path.join(SRC, 'js', 'wordlists.js'))
    for lang, digest in re.findall(r"(en): '([0-9a-f]{64})'", core):
        words = re.search(lang + r':Object\.freeze\("([^"]+)"', lists).group(1)
        if hashlib.sha256(words.encode()).hexdigest() != digest:
            sys.exit(f'Word list "{lang}" does not match the hash pinned in core.js')
    html = read(os.path.join(SRC, 'index.html'))
    for ref in re.findall(r'(?:src|href)="((?:js|vendor|fonts|assets)/[^"]+|[\w.-]+\.(?:css|webp|png|json))"', html):
        if ref not in GENERATED and not os.path.exists(os.path.join(SRC, ref)):
            sys.exit(f'index.html references a missing file: {ref}')
    sw = read(os.path.join(SRC, 'sw.js'))
    app = read(os.path.join(SRC, 'js', 'app.js'))
    for name, pat, text in (('sw.js VERSION', r"const VERSION = '([\d.]+)'", sw), ('sw.js CACHE', r"const CACHE = 'mnemoniqr-v([\d.]+)'", sw),
                            ('app.js APP_VERSION', r"const APP_VERSION = '([\d.]+)'", app), ('index.html footer', r'class="version">v([\d.]+)<', html)):
        m = re.search(pat, text)
        if not m or m.group(1) != VERSION:
            sys.exit(f'{name} is not {VERSION}')
    for ref in re.findall(r"'((?:js|vendor|fonts|assets)/[^']+|[\w.-]+\.(?:html|css|js|json|webp|png))'", sw):
        if ref not in GENERATED and not os.path.exists(os.path.join(SRC, ref)):
            sys.exit(f'sw.js precaches a missing file: {ref}')


def build_multi(with_tests):
    html = read(os.path.join(SRC, 'index.html')).replace('__CSP__', CSP_MULTI)
    tokens = []

    def add_sri(tag, attr, path):
        data = source(path).encode() if (path in GENERATED or path in OVERRIDES) else read(os.path.join(SRC, path), 'rb')
        sri = 'sha384-' + b64hash(data, 'sha384')
        tokens.append(sri)
        return f'{attr}="{path}" integrity="{sri}"'

    html = re.sub(r'<script src="([^"]+)"', lambda m: '<script ' + add_sri('script', 'src', m.group(1)), html)
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)"', lambda m: '<link rel="stylesheet" ' + add_sri('style', 'href', m.group(1)), html)
    write(os.path.join(DIST, 'index.html'), html)
    if with_tests:
        write(os.path.join(DIST, 'tests', 'tests.html'), read(os.path.join(SRC, 'tests', 'tests.html')).replace('__CSP__', CSP_TESTS))
    return fingerprint(tokens)


def escape_inline(js):
    return js.replace('</script', '<\\/script').replace('<!--', '<\\!--')


def build_single():
    html = read(os.path.join(SRC, 'index.html'))
    html = html.replace('<html lang="en">', '<html lang="en" data-single>')
    for pattern in (r'\s*<link rel="manifest"[^>]*>', r'\s*<link rel="apple-touch-icon"[^>]*>', r'\s*<meta name="apple-mobile-web-app[^>]*>'):
        html = re.sub(pattern, '', html)
    favicon = base64.b64encode(read(os.path.join(SRC, 'favicon.png'), 'rb')).decode()
    html = html.replace('href="favicon.png"', f'href="data:image/png;base64,{favicon}"')
    logo = base64.b64encode(read(os.path.join(SRC, 'MQR_logo.webp'), 'rb')).decode()
    html = html.replace('src="MQR_logo.webp"', f'src="data:image/webp;base64,{logo}"')
    shield = base64.b64encode(read(os.path.join(SRC, 'assets', 'shield.png'), 'rb')).decode()
    html = html.replace('src="assets/shield.png"', f'src="data:image/png;base64,{shield}"')

    css = read(os.path.join(SRC, 'styles.css'))
    # Fonts become data: URIs so the single file depends on nothing else
    css = re.sub(r'url\(fonts/([^)]+\.woff2)\)',
                 lambda m: 'url(data:font/woff2;base64,' + base64.b64encode(read(os.path.join(SRC, 'fonts', m.group(1)), 'rb')).decode() + ')', css)
    style_hash = "'sha256-" + b64hash(css, 'sha256') + "'"
    html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>' + css + '</style>')

    script_hashes = []

    def inline(m):
        code = escape_inline(source(m.group(1)))
        script_hashes.append("'sha256-" + b64hash(code, 'sha256') + "'")
        return '<script>' + code + '</script>'

    html = re.sub(r'<script src="([^"]+)" defer></script>', inline, html)

    csp = ("default-src 'none'; script-src " + ' '.join(script_hashes) + " 'wasm-unsafe-eval'; style-src " + style_hash +
           "; font-src data:; img-src data:; connect-src 'none'; worker-src blob:; "
           "base-uri 'none'; form-action 'none'; " + TT)
    html = html.replace('__CSP__', csp)
    write(os.path.join(DIST, 'mnemoniqr-offline.html'), html)
    return fingerprint(re.findall(r"'(sha(?:256|384)-[^']+)'", csp))


def headers():
    hdr = {
        'Content-Security-Policy': CSP_MULTI + "; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    }
    tests_csp = CSP_TESTS + "; frame-ancestors 'none'"
    lines = ['# Netlify / Cloudflare Pages. frame-ancestors and Permissions-Policy only work as HTTP headers.', '/*']
    lines += [f'  {k}: {v}' for k, v in hdr.items()]
    # The files that decide which version runs are always revalidated, so an update is seen at once
    for path in NO_CACHE:
        lines += [path, '  Cache-Control: no-cache, max-age=0, must-revalidate']
    lines += ['/tests/*', '  Content-Security-Policy: ' + tests_csp, '']
    write(os.path.join(DIST, '_headers'), '\n'.join(lines))
    # The campaign page (/goal) and its data (/api/goal) are answered by the function, which sends its own
    # CSP and headers: the app's policy (no connection, require-corp...) is not applied to them
    vercel = {
        'rewrites': [{'source': '/goal', 'destination': '/api/goal?view=html'}, {'source': '/goal/', 'destination': '/api/goal?view=html'}],
        'headers': [
            {'source': '/((?!api/|goal/?$).*)', 'headers': [{'key': k, 'value': v} for k, v in hdr.items()]},
            {'source': '/api/(.*)', 'headers': [{'key': k, 'value': hdr[k]} for k in
                                                ('X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options', 'Strict-Transport-Security')]},
            *[{'source': path, 'headers': [{'key': 'Cache-Control', 'value': 'no-cache, max-age=0, must-revalidate'}]} for path in NO_CACHE],
            {'source': '/tests/(.*)', 'headers': [{'key': 'Content-Security-Policy', 'value': tests_csp}]},
        ]}
    write(os.path.join(DIST, 'vercel.json'), json.dumps(vercel, indent=2) + '\n')


def stamp_build():
    """Content id of every file the service worker precaches. It goes into the cache name and the version the
    worker announces (sw.js) and into <html data-build> (index.html), so ANY change (an address in donate.js, a
    line of markup) makes installed copies update, even if the version number was not raised."""
    sw_path, idx_path = os.path.join(DIST, 'sw.js'), os.path.join(DIST, 'index.html')
    sw = read(sw_path)
    refs = sorted(set(re.findall(r"'((?:js|vendor|fonts|assets)/[^']+|[\w.-]+\.(?:html|css|js|json|webp|png))'", sw)) | {'index.html'})
    h = hashlib.sha256()
    for ref in refs:
        h.update(ref.encode() + b'\0' + read(os.path.join(DIST, ref), 'rb') + b'\0')
    build = f'{VERSION}+{h.hexdigest()[:10]}'
    sw2 = re.sub(r"const CACHE = 'mnemoniqr-v[\d.]+';", f"const CACHE = 'mnemoniqr-v{build}';", sw)
    sw2 = re.sub(r"const VERSION = '[\d.]+';", f"const VERSION = '{build}';", sw2)
    if sw2.count(build) != 2:
        sys.exit('sw.js: CACHE or VERSION not found')
    write(sw_path, sw2)
    idx = read(idx_path)
    if idx.count('<html lang="en">') != 1:
        sys.exit('index.html: <html lang="en"> not found')
    write(idx_path, idx.replace('<html lang="en">', f'<html lang="en" data-build="{build}">'))
    return build


def main():
    global DIST
    with_tests = '--no-tests' not in sys.argv
    if '--out' in sys.argv:
        i = sys.argv.index('--out') + 1
        if i >= len(sys.argv) or sys.argv[i].startswith('--'):
            sys.exit('--out needs a folder')
        DIST = os.path.abspath(sys.argv[i])
        # The folder is deleted and rebuilt: never the project, its sources or a folder that is not a build
        inside = os.path.commonpath([DIST, ROOT]) == ROOT
        if DIST in (ROOT, os.path.dirname(ROOT)) or ROOT.startswith(DIST + os.sep) or (inside and not os.path.basename(DIST).startswith('dist')):
            sys.exit(f'--out {DIST}: refusing to overwrite this folder')
        if os.path.isdir(DIST) and os.listdir(DIST) and not os.path.exists(os.path.join(DIST, 'HASHES.txt')):
            sys.exit(f'--out {DIST}: not empty and not a previous build')
    test_donations = '--donate-test' in sys.argv
    if test_donations:
        OVERRIDES['js/donate.js'] = donate_test_source()
    elif '--donate-none' in sys.argv:   # tests: a build without any address
        OVERRIDES['js/donate.js'] = donate_none_source()
    if '--goal-test' in sys.argv:
        OVERRIDES['js/goal.js'] = with_goal(read(os.path.join(SRC, 'js', 'goal.js')), GOAL_TEST)
    check_sources()
    donate = donations(source('js/donate.js'))
    published_kinds = [kind for _, kind, addr in donate if addr]
    if len(set(published_kinds)) != len(published_kinds):
        sys.exit('js/donate.js: one address per network (kind)')
    goal = parse_goal(source('js/goal.js'))
    raised = check_goal(goal, published_kinds or None)
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    ignore = ['index.html', 'tests.html'] + ([] if with_tests else ['tests'])
    shutil.copytree(SRC, DIST, ignore=shutil.ignore_patterns(*ignore))
    # The standalone recovery script ships with every release
    shutil.copy2(os.path.join(ROOT, 'tools', 'recover.py'), os.path.join(DIST, 'recover.py'))
    for path in GENERATED | set(OVERRIDES):
        write(os.path.join(DIST, path), source(path))
    if published_kinds:
        # The live goal (Vercel function): same addresses and target as this build
        write(os.path.join(DIST, 'api', 'goal.js'), read(os.path.join(ROOT, 'web', 'api', 'goal.js'), 'rb'))
        config = {'target_usd': goal['target_usd'], 'start': goal['start'], 'addresses': {kind: addr for _, kind, addr in donate if addr}}
        write(os.path.join(DIST, 'api', 'goal-config.json'), json.dumps(config, indent=2) + '\n')
    fp_multi = build_multi(with_tests)
    build_id = stamp_build()
    fp_single = build_single()
    headers()
    files = []
    for base, _, names in os.walk(DIST):
        for name in names:
            path = os.path.join(base, name)
            files.append((os.path.relpath(path, DIST).replace(os.sep, '/'), hashlib.sha256(read(path, 'rb')).hexdigest()))
    files.sort()
    out = [f'MnemoniQR v{VERSION} · Release fingerprints', '',
           f'PWA (index.html):                  {fp_multi}',
           f'Single file (mnemoniqr-offline.html): {fp_single}',
           f'Build id (installed copies update when it changes): {build_id}',
           '', 'These must match "Fingerprint of this version" in the app (How it protects you).', '',
           ]
    published = [(did, kind, addr) for did, kind, addr in donate if addr]
    if test_donations:
        out += ['TEST BUILD: donation addresses are public example addresses. Do not deploy.', '']
    out += ['Donation addresses (also shown in the app, under the same fingerprint):']
    out += [f'  {did:6} {kind:5} {addr}' for did, kind, addr in published] or ['  none: the app shows no support link']
    if published:
        pct = raised / goal['target_usd'] * 100
        out += ['', f"Community goal: {usd(raised)} of {usd(goal['target_usd'])} ({'<1' if 0 < pct < 1 else int(min(pct, 100))}%), "
                    f"balances as of {goal['as_of']} (live: https://mnemoniqr.app/goal)"]
        if '--goal-test' in sys.argv:
            out += ['TEST BUILD: the goal balances are made up. Do not deploy.']
    out += ['', 'SHA-256 of every file:']
    out += [f'{digest}  {rel}' for rel, digest in files]
    write(os.path.join(DIST, 'HASHES.txt'), '\n'.join(out) + '\n')
    print(f'{os.path.relpath(DIST, ROOT) if DIST.startswith(ROOT) else DIST}/ ready (v{VERSION})' + (' · TEST donation addresses, do not deploy' if test_donations else ''))
    print('Donation addresses:     ', ', '.join(f'{d} {a}' for d, _, a in published) or 'none (support UI hidden)')
    print('Community goal:         ', f"{usd(raised)} of {usd(goal['target_usd'])} as of {goal['as_of']}" if published else 'hidden (no address)')
    print('Build id:               ', build_id)
    print('PWA fingerprint:        ', fp_multi)
    print('Single-file fingerprint:', fp_single)


if __name__ == '__main__':
    main()
