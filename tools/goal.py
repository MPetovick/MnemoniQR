#!/usr/bin/env python3
"""
MnemoniQR · Refreshes the community goal snapshot in src/js/goal.js. Run tools/build.py afterwards.

    python3 tools/goal.py                     read the balances now from the public explorers, with the same code
                                              as the campaign page (web/api/goal.js); needs Node 18 or later
    python3 tools/goal.py --from-url [URL]    take them from a deployed /api/goal (default https://mnemoniqr.app/api/goal)
    python3 tools/goal.py --file F.json       take them from a saved /api/goal answer
    python3 tools/goal.py --target 21000      change the goal, in USD (alone: the balances are kept)
    python3 tools/goal.py --start 2026-10-08  change the start date (alone: the balances are kept)
    python3 tools/goal.py --show              print the current snapshot and stop
    --path F                                  update F instead of src/js/goal.js (tests)

Refuses an incomplete reading (an explorer that could not be reached: try again later), addresses that are not
those of src/js/donate.js and anything tools/build.py would refuse.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build  # noqa: E402  (tools/build.py)

ROOT = build.ROOT
GOAL = os.path.join(ROOT, 'src', 'js', 'goal.js')
DEFAULT_URL = 'https://mnemoniqr.app/api/goal'


def live(config):
    try:
        p = subprocess.run(['node', os.path.join(ROOT, 'tools', 'goal_collect.js')], input=json.dumps(config),
                           capture_output=True, text=True, timeout=180)
    except FileNotFoundError:
        sys.exit('Node.js 18 or later is needed to read the explorers (or use --from-url once the site is deployed)')
    if p.returncode:
        sys.exit(p.stderr.strip() or 'goal_collect.js failed')
    return json.loads(p.stdout)


def from_url(url):
    if not url.startswith('https://'):
        sys.exit('--from-url needs an https:// address')
    req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'MnemoniQR-goal/1'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def snapshot(result, current, addresses):
    """The answer of /api/goal turned into the snapshot the app shows. Every check fails loudly."""
    if not isinstance(result, dict) or not isinstance(result.get('wallets'), dict):
        sys.exit('not an /api/goal answer')
    wallets = result['wallets']
    bad = [f"{k}: {w.get('error', 'not read')}" for k, w in wallets.items() if not isinstance(w, dict) or not w.get('ok')]
    if bad or result.get('complete') is not True:
        sys.exit('incomplete reading, nothing written (try again in a few minutes):\n  ' + '\n  '.join(bad or ['complete is not true']))
    if set(wallets) != set(addresses):
        sys.exit(f'the reading covers {sorted(wallets)}, but donate.js has addresses for {sorted(addresses)}')
    out = {}
    for kind, addr in addresses.items():   # in the order of donate.js
        w = wallets[kind]
        if w.get('address') != addr:
            sys.exit(f'{kind}: the reading is for {w.get("address")!r}, not for the address in donate.js {addr!r}')
        assets = [{'sym': a.get('sym'), 'chain': a.get('chain'), 'amount': a.get('amount'), 'usd': a.get('usd')} for a in w.get('assets') or []]
        out[kind] = {'usd': w.get('usd'), 'assets': assets}
    as_of = str(result.get('as_of', ''))[:10]
    g = {'target_usd': current['target_usd'], 'start': current['start'], 'as_of': as_of, 'wallets': out}
    return g


def describe(g):
    total = build.check_goal(g, None)
    lines = [f"Goal {build.usd(g['target_usd'])} since {g['start']}: {build.usd(total)} raised "
             f"({total / g['target_usd'] * 100:.1f}%), balances as of {g['as_of']}"]
    for kind, w in g['wallets'].items():
        held = [f"{a['amount']} {a['sym']} ({a['chain']})" for a in w['assets'] if float(a['amount'])]
        lines.append(f"  {kind:5} {build.usd(w['usd']):>12}  {', '.join(held) or 'empty'}")
    return '\n'.join(lines)


def main():
    ap = argparse.ArgumentParser(description='Refresh the community goal snapshot (src/js/goal.js).')
    src = ap.add_mutually_exclusive_group()
    src.add_argument('--from-url', nargs='?', const=DEFAULT_URL, metavar='URL')
    src.add_argument('--file', metavar='F.json')
    src.add_argument('--show', action='store_true')
    ap.add_argument('--target', type=float, metavar='USD')
    ap.add_argument('--start', metavar='YYYY-MM-DD')
    ap.add_argument('--path', metavar='F', help='update this file instead of src/js/goal.js')
    a = ap.parse_args()

    path = os.path.abspath(a.path) if a.path else GOAL
    text = build.read(path)
    current = build.parse_goal(text)
    if a.show:
        print(describe(current))
        return
    addresses = {kind: addr for _, kind, addr in build.donations(build.read(os.path.join(ROOT, 'src', 'js', 'donate.js'))) if addr}
    if not addresses:
        sys.exit('donate.js has no address: there is nothing to count')

    if a.target is not None:
        if not (0 < a.target <= 1e9):   # also refuses nan and inf
            sys.exit('--target must be a positive number of dollars')
        current['target_usd'] = int(a.target) if a.target == int(a.target) else a.target
    if a.start is not None:
        current['start'] = a.start
    settings_only = (a.target is not None or a.start is not None) and not (a.from_url or a.file)
    if settings_only:
        g = current
    else:
        config = {'target_usd': current['target_usd'], 'start': current['start'], 'addresses': addresses}
        if a.file:
            with open(a.file, encoding='utf-8') as f:
                result = json.load(f)
        elif a.from_url:
            result = from_url(a.from_url)
        else:
            result = live(config)
        g = snapshot(result, current, addresses)
    build.check_goal(g, list(addresses))
    build.write(path, build.with_goal(text, g))
    print(describe(g))
    print(f'\nWritten to {os.path.relpath(path, ROOT) if path.startswith(ROOT) else path}. Now run: python3 tools/build.py')


if __name__ == '__main__':
    main()
