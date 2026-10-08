#!/usr/bin/env python3
"""
MnemoniQR · Community goal: the snapshot tool (tools/goal.py), the checks of tools/build.py and what the build
ships for the campaign page (api/goal.js, goal-config.json, vercel.json routes and headers). No network, no browser.

Usage: python3 tests/test_goal.py   (needs Node 18+ for the recorded answers)
"""
import copy
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import build  # noqa: E402

failed = 0


def check(name, ok, detail=''):
    global failed
    print(f"  [{'ok' if ok else 'FAIL'}] {name}" + (f' · {detail}' if detail else ''))
    failed += 0 if ok else 1


def refused(fn):
    try:
        fn()
        return False
    except SystemExit:
        return True


def goal_py(*args):
    return subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'goal.py'), *args], capture_output=True, text=True)


def recorded_answer(addresses, broken=None):
    """What /api/goal answers for the recorded explorer replies of tests/goal_fixtures.js, for these addresses."""
    js = f"""
const {{ collect }} = require({json.dumps(os.path.join(ROOT, 'web', 'api', 'goal.js'))});
const {{ fakeFetch }} = require({json.dumps(os.path.join(ROOT, 'tests', 'goal_fixtures.js'))});
const over = {json.dumps(broken)} ? {{ [{json.dumps(broken)}]: (u, o, r) => r({{}}, 503) }} : {{}};
collect({json.dumps({'target_usd': 210000, 'start': '2026-10-08', 'addresses': addresses})}, fakeFetch(over))
  .then((r) => process.stdout.write(JSON.stringify(r)));
"""
    return json.loads(subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True).stdout)


def main():
    src_text = build.read(os.path.join(ROOT, 'src', 'js', 'goal.js'))
    src_goal = build.parse_goal(src_text)
    donate = build.donations(build.read(os.path.join(ROOT, 'src', 'js', 'donate.js')))
    addresses = {kind: addr for _, kind, addr in donate if addr}
    kinds = list(addresses)

    print('Snapshot format and checks (tools/build.py)')
    check('src/js/goal.js is valid and matches the donation networks', build.check_goal(src_goal, kinds) >= 0)
    check('the file is written exactly as the tool writes it', build.with_goal(src_text, src_goal) == src_text)
    check('target is 210,000 USD', src_goal['target_usd'] == 210000)
    check('the test balances add up to $10,319.52', build.check_goal(build.GOAL_TEST, kinds) == 10319.52)

    def broken(mutate):
        g = copy.deepcopy(build.GOAL_TEST)
        mutate(g)
        return lambda: build.check_goal(g, kinds)
    cases = {
        'a network total that is not the sum of its coins': lambda g: g['wallets']['btc'].update(usd=3001),
        'a coin with no amount but a value': lambda g: g['wallets']['ton']['assets'][0].update(usd=5),
        'an amount written as a number': lambda g: g['wallets']['btc']['assets'][0].update(amount=0.05),
        'an amount in exponent form': lambda g: g['wallets']['btc']['assets'][0].update(amount='5e-2'),
        'a negative value': lambda g: g['wallets']['btc']['assets'][0].update(usd=-1),
        'a lower-case symbol': lambda g: g['wallets']['btc']['assets'][0].update(sym='btc'),
        'a network missing from the snapshot': lambda g: g['wallets'].pop('ton'),
        'a network without a donation address': lambda g: g['wallets'].update(xrp={'usd': 0, 'assets': []}),
        'a snapshot dated before the start': lambda g: g.update(as_of='2026-08-01'),
        'an impossible date': lambda g: g.update(as_of='2026-02-30'),
        'a zero target': lambda g: g.update(target_usd=0),
        'a target written as text': lambda g: g.update(target_usd='21000'),
        'an extra key': lambda g: g.update(note='x'),
        'no assets': lambda g: g['wallets']['btc'].update(assets=[]),
    }
    for name, mutate in cases.items():
        check(f'build refuses {name}', refused(broken(mutate)))
    check('build refuses a file without the markers', refused(lambda: build.parse_goal("self.MQR_GOAL = {};")))
    check('build refuses invalid JSON', refused(lambda: build.parse_goal('/* GOAL */ {target_usd: 1} /* END */')))

    print('\nSnapshot tool (tools/goal.py)')
    tmp = tempfile.mkdtemp(prefix='mqr-goal-')
    out = os.path.join(tmp, 'goal.js')
    build.write(out, src_text)
    answer = recorded_answer(addresses)
    ans = os.path.join(tmp, 'answer.json')
    json.dump(answer, open(ans, 'w'))
    r = goal_py('--file', ans, '--path', out)
    check('a complete reading is written', r.returncode == 0 and os.path.exists(out), r.stderr.strip()[-200:])
    if os.path.exists(out):
        text = build.read(out)
        g = build.parse_goal(text)
        check('…adds up to the recorded balances ($10,319.52)', build.check_goal(g, kinds) == 10319.52)
        check('…keeps the target, the start and the comments', g['target_usd'] == src_goal['target_usd'] and g['start'] == src_goal['start']
              and text.split('/* GOAL */')[0] == src_text.split('/* GOAL */')[0])
        check('…dated with the day of the reading', g['as_of'] == answer['as_of'][:10])
        check('…networks in the order of donate.js', list(g['wallets']) == kinds)
        check('…one coin per line', all(re.search(r'\{"sym": "[A-Z]+", "chain": "[a-z]+", "amount": "[\d.]+", "usd": [\d.]+\}', ln)
                                        for ln in text.splitlines() if '"sym"' in ln))
        before = build.read(out)
        r = goal_py('--target', '25000', '--path', out)
        g2 = build.parse_goal(build.read(out))
        check('--target alone changes only the target', r.returncode == 0 and g2['target_usd'] == 25000 and g2['wallets'] == build.parse_goal(before)['wallets'])
        check('--target refuses nan', goal_py('--target', 'nan', '--path', out).returncode != 0)
    os.makedirs(os.path.join(tmp, 'x'), exist_ok=True)
    for name, data in (('an incomplete reading', recorded_answer(addresses, broken='toncenter.com')),
                       ('a reading for other addresses', recorded_answer({**addresses, 'btc': build.TEST_ADDRESSES['btc']})),
                       ('a reading that misses a network', {**answer, 'wallets': {k: v for k, v in answer['wallets'].items() if k != 'ton'}}),
                       ('something that is not an /api/goal answer', [1, 2, 3])):
        bad = os.path.join(tmp, 'x', 'bad.json')
        json.dump(data, open(bad, 'w'))
        out2 = os.path.join(tmp, 'x', 'goal.js')
        build.write(out2, src_text)
        r = goal_py('--file', bad, '--path', out2)
        check(f'refuses {name}, changes nothing', r.returncode != 0 and build.read(out2) == src_text, r.stderr.strip().splitlines()[-1][:90] if r.stderr.strip() else '')
    check('--show prints the snapshot', goal_py('--show').returncode == 0)
    check('--from-url accepts https only', goal_py('--from-url', 'http://mnemoniqr.app/api/goal', '--path', out).returncode != 0)

    print('\nWhat the build ships for mnemoniqr.app/goal')
    dist = os.path.join(ROOT, 'dist')
    api = os.path.join(dist, 'api', 'goal.js')
    check('dist/api/goal.js is web/api/goal.js', os.path.exists(api) and build.read(api, 'rb') == build.read(os.path.join(ROOT, 'web', 'api', 'goal.js'), 'rb'))
    cfg = json.load(open(os.path.join(dist, 'api', 'goal-config.json')))
    check('goal-config.json: the addresses of donate.js and the target of goal.js',
          cfg == {'target_usd': src_goal['target_usd'], 'start': src_goal['start'], 'addresses': addresses})
    vercel = json.load(open(os.path.join(dist, 'vercel.json')))
    check('/goal is served by the function', {'source': '/goal', 'destination': '/api/goal?view=html'} in vercel['rewrites'])
    app_rule = vercel['headers'][0]
    pattern = re.compile('^' + app_rule['source'].replace('/(', '/(?:', 1) + '$')
    applies = {p: bool(pattern.match(p)) for p in ('/', '/index.html', '/sw.js', '/js/app.js', '/tests/tests.html', '/goals.png', '/goal/x.css',
                                                   '/goal', '/goal/', '/api/goal')}
    check("the app's CSP and cross-origin headers apply to the app only, not to /goal or /api",
          all(applies[p] for p in ('/', '/index.html', '/sw.js', '/js/app.js', '/tests/tests.html', '/goals.png', '/goal/x.css'))
          and not any(applies[p] for p in ('/goal', '/goal/', '/api/goal')), str(applies))
    check("the app's CSP still blocks every connection", "connect-src 'none'" in json.dumps(app_rule))
    api_rule = next((r for r in vercel['headers'] if r['source'] == '/api/(.*)'), None)
    check('/api/ keeps nosniff, HSTS, no referrer and no framing', api_rule is not None and
          {h['key'] for h in api_rule['headers']} == {'X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options', 'Strict-Transport-Security'})
    sw_src = build.read(os.path.join(ROOT, 'src', 'sw.js'))
    check('the service worker only reloads app windows when it updates (never /goal)', '.filter(isApp)' in sw_src)
    hashes = build.read(os.path.join(dist, 'HASHES.txt'))
    check('HASHES.txt states the snapshot', re.search(r'Community goal: \$[\d,.]+ of \$210,000 \(\S+%\), balances as of \d{4}-\d{2}-\d{2}', hashes) is not None)
    sw = build.read(os.path.join(dist, 'sw.js'))
    check('the service worker precaches goal.js and never touches /goal or /api', "'js/goal.js'" in sw and '/api' not in sw and "'goal" not in sw)
    html = build.read(os.path.join(dist, 'index.html'))
    check('goal.js is loaded under SRI, before app.js', re.search(r'<script src="js/goal\.js" integrity="sha384-[^"]+" defer></script>\s*<script src="js/kdf-src', html) is not None)

    print(f"\n{'All goal checks passed' if not failed else f'{failed} FAILED'}")
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
