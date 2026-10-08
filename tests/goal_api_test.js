// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) MPetovick and the MnemoniQR contributors. Commercial licenses: see COMMERCIAL.md
// MnemoniQR · Tests of the live goal function (web/api/goal.js) with recorded-style answers, no network.
//
//   node --test tests/goal_api_test.js
//
// Covers the sums, wallets that cannot be read (never counted as zero), the JSON and HTML answers, the CSP of
// the campaign page (its style hash must match, no script at all) and the escaping of every value.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const goal = require('../web/api/goal.js');

const { CONFIG, fakeFetch } = require('./goal_fixtures.js');

function fakeRes() {
    return { statusCode: 0, headers: {}, body: undefined, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b; } };
}

test('units: exact decimal strings', () => {
    assert.equal(goal.units(0n, 8), '0');
    assert.equal(goal.units(5000000n, 8), '0.05');
    assert.equal(goal.units(1234500n, 6), '1.2345');
    assert.equal(goal.units(10n ** 18n, 18), '1');
    assert.equal(goal.units(1n, 18), '0.000000000000000001');
    assert.equal(goal.units(42n, 0), '42');
    assert.throws(() => goal.units(-1n, 8));
});

test('collect: every wallet read, valued and added up', async () => {
    const r = await goal.collect(CONFIG, fakeFetch());
    assert.equal(r.complete, true);
    assert.equal(r.target_usd, 21000);
    assert.deepEqual(r.wallets.btc.assets, [{ sym: 'BTC', chain: 'bitcoin', amount: '0.05', usd: 3000 }]);   // confirmed only
    assert.equal(r.wallets.evm.usd, 2899.02 + 2500 + 120.5);
    assert.deepEqual(r.wallets.evm.assets.filter((a) => a.amount !== '0').map((a) => [a.sym, a.chain, a.amount]),
        [['ETH', 'ethereum', '1.2'], ['USDT', 'bsc', '2500'], ['USDC', 'base', '120.5']]);
    assert.equal(r.wallets.tron.usd, 1800);
    assert.equal(r.wallets.ton.usd, 0);
    assert.equal(r.raised_usd, 3000 + 5519.52 + 1800);
    assert.equal(r.wallets.evm.address, CONFIG.addresses.evm);
});

test('an address that never received anything counts as zero (TRON account not on chain)', async () => {
    const r = await goal.collect(CONFIG, fakeFetch({ 'api.trongrid.io': (u, o, reply) => reply({ success: true, data: [] }) }));
    assert.equal(r.complete, true);
    assert.equal(r.wallets.tron.usd, 0);
});

test('a wallet that cannot be read is left out and said so, never counted as zero', async () => {
    const r = await goal.collect(CONFIG, fakeFetch({ 'toncenter.com': (u, o, reply) => reply({}, 503) }));
    assert.equal(r.complete, false);
    assert.equal(r.wallets.ton.ok, false);
    assert.equal(r.wallets.ton.usd, null);
    assert.match(r.wallets.ton.error, /503/);
    assert.equal(r.raised_usd, 10319.52);
});

test('an empty eth_call answer ("0x") fails the wallet instead of reading zero', async () => {
    const f = fakeFetch({ 'base-rpc.publicnode.com': (u, o, reply) => reply({ jsonrpc: '2.0', id: 1, result: '0x' }) });
    const r = await goal.collect(CONFIG, f);
    assert.equal(r.wallets.evm.ok, false);
    assert.equal(r.complete, false);
    assert.equal(r.raised_usd, 3000 + 1800);
});

test('an RPC error fails the wallet', async () => {
    const r = await goal.collect(CONFIG, fakeFetch({ 'bsc-rpc.publicnode.com': (u, o, reply) => reply({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'limit' } }) }));
    assert.equal(r.wallets.evm.ok, false);
});

test('no price: stablecoins still count at $1, a wallet holding another coin is left out and named', async () => {
    const r = await goal.collect(CONFIG, fakeFetch({ 'api.coingecko.com': (u, o, reply) => reply({}, 429) }));
    assert.equal(r.wallets.btc.ok, false);
    assert.match(r.wallets.btc.error, /CoinGecko: no price for BTC/);
    assert.equal(r.wallets.evm.ok, false);   // holds ETH
    assert.equal(r.wallets.ton.ok, true);
    assert.equal(r.wallets.ton.usd, 0);
    assert.equal(r.complete, false);
    const stable = await goal.collect({ ...CONFIG, addresses: { evm: CONFIG.addresses.evm } }, fakeFetch({
        'api.coingecko.com': (u, o, reply) => reply({}, 429),
        'ethereum-rpc.publicnode.com': (u, o, reply) => reply({ jsonrpc: '2.0', id: 1, result: JSON.parse(o.body).method === 'eth_getBalance' ? '0x0' : '0x' + (5000000n).toString(16) })
    }));
    assert.equal(stable.wallets.evm.ok, true);
    assert.equal(stable.wallets.evm.usd, 2500 + 120.5 + 5 + 5);   // USDT and USDC on Ethereum at $1
});

test('one round of requests per period, whatever the query string (warm instance)', async () => {
    // the memo is only used with the deployed configuration, so this checks the request count of one call
    const f = fakeFetch();
    await goal.collect(CONFIG, f);
    assert.ok(f.calls.length <= 14, `${f.calls.length} requests`);
});

test('networks without an address are not read', async () => {
    const f = fakeFetch();
    const r = await goal.collect({ ...CONFIG, addresses: { btc: CONFIG.addresses.btc, evm: '' } }, f);
    assert.deepEqual(Object.keys(r.wallets), ['btc']);
    assert.ok(!f.calls.some((h) => h.includes('publicnode') || h.includes('trongrid') || h.includes('toncenter')));
});

test('handler: JSON, public, cached by the CDN, nothing else allowed', async () => {
    const res = fakeRes();
    await goal({ method: 'GET', url: '/api/goal' }, res, { config: CONFIG, fetch: fakeFetch() });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /^application\/json/);
    assert.equal(res.headers['access-control-allow-origin'], '*');
    assert.match(res.headers['cache-control'], /s-maxage=600/);
    assert.match(res.headers['content-security-policy'], /default-src 'none'/);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    const j = JSON.parse(res.body);
    assert.equal(j.raised_usd, 10319.52);
    assert.equal(j.complete, true);
});

test('handler: an incomplete answer is cached for a minute only', async () => {
    const res = fakeRes();
    await goal({ method: 'GET', url: '/api/goal' }, res, { config: CONFIG, fetch: fakeFetch({ 'toncenter.com': (u, o, reply) => reply({}, 500) }) });
    assert.match(res.headers['cache-control'], /s-maxage=60(?!\d)/);
});

test('handler: POST is refused, HEAD has no body', async () => {
    let res = fakeRes();
    await goal({ method: 'POST', url: '/api/goal' }, res, { config: CONFIG, fetch: fakeFetch() });
    assert.equal(res.statusCode, 405);
    res = fakeRes();
    await goal({ method: 'HEAD', url: '/api/goal' }, res, { config: CONFIG, fetch: fakeFetch() });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, undefined);
});

test('handler: a broken configuration answers 500 without details', async () => {
    const res = fakeRes();
    await goal({ method: 'GET', url: '/api/goal' }, res, { config: null, fetch: fakeFetch() });
    assert.equal(res.statusCode, 500);
    assert.equal(res.headers['cache-control'], 'no-store');
});

test('campaign page: no script, CSP style hash matches, links leave safely', async () => {
    const res = fakeRes();
    await goal({ method: 'GET', url: '/api/goal?view=html' }, res, { config: CONFIG, fetch: fakeFetch() });
    const html = res.body;
    const csp = res.headers['content-security-policy'];
    assert.match(res.headers['content-type'], /^text\/html/);
    assert.ok(!/<script/i.test(html), 'no script on the page');
    assert.ok(!/ on[a-z]+=/i.test(html), 'no inline event handler');
    assert.ok(!/style="/i.test(html), 'no style attribute (the CSP would block it)');
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.ok(!/script-src/.test(csp));
    const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
    assert.equal(styles.length, 1);
    const hash = crypto.createHash('sha256').update(styles[0]).digest('base64');
    assert.ok(csp.includes(`'sha256-${hash}'`), 'the style block matches its hash');
    for (const a of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) assert.match(a[0], /rel="noopener noreferrer"/);
    assert.match(html, /\$10,320/);
    assert.match(html, /of \$21,000/);
    assert.match(html, /49%/);
    assert.match(html, /<h1 id="h-goal">Unlock multi-seed backups for everyone<\/h1>/);
    assert.ok(html.includes(`https://etherscan.io/address/${CONFIG.addresses.evm}`));
    assert.ok(html.includes(`https://bscscan.com/address/${CONFIG.addresses.evm}`));
    assert.ok(html.includes(`https://basescan.org/address/${CONFIG.addresses.evm}`));
    assert.ok(html.includes(`https://tronscan.org/#/address/${CONFIG.addresses.tron}`));
    assert.ok(html.includes(`https://tonviewer.com/${CONFIG.addresses.ton}`));
    assert.ok(html.includes(`https://mempool.space/address/${CONFIG.addresses.btc}`));
    assert.match(html, /1\.2 ETH \(Ethereum\) · 2,500 USDT \(BSC\) · 120\.5 USDC \(Base\)/);
});

test('campaign page: says which network is missing from the total', async () => {
    const res = fakeRes();
    await goal({ method: 'GET', url: '/api/goal?view=html' }, res, { config: CONFIG, fetch: fakeFetch({ 'toncenter.com': (u, o, reply) => reply({}, 500) }) });
    assert.match(res.body, /class="warn">GRAM \(TON\): could not be read just now/);
    assert.match(res.body, /Could not be read just now/);
});

test('campaign page: every value is escaped', () => {
    const r = { target_usd: 21000, start: '2026-10-08', as_of: '2026-10-08T10:00:00.000Z', raised_usd: 0, complete: true,
        wallets: { btc: { address: '"><img src=x onerror=alert(1)>', ok: true, usd: 0, assets: [{ sym: '<b>', chain: 'bitcoin', amount: '0', usd: 0 }] } } };
    const html = goal.render(r);
    assert.ok(!html.includes('<img src=x'));
    assert.ok(!html.includes('<b>'));
    assert.ok(html.includes('&quot;&gt;&lt;img'));
});

test('goal reached: the page says so and the bar stops at 100%', () => {
    const r = { target_usd: 100, start: '2026-10-08', as_of: '2026-10-08T10:00:00.000Z', raised_usd: 150, complete: true,
        wallets: { btc: { address: CONFIG.addresses.btc, ok: true, usd: 150, assets: [{ sym: 'BTC', chain: 'bitcoin', amount: '0.0025', usd: 150 }] } } };
    const html = goal.render(r);
    assert.match(html, /Goal reached/);
    assert.match(html, /class="fill" width="100.00"/);
    assert.match(html, />100%</);
});
