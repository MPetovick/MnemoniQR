// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) MPetovick and the MnemoniQR contributors. Commercial licenses: see COMMERCIAL.md
// MnemoniQR · Community goal, live: https://mnemoniqr.app/goal (page) and https://mnemoniqr.app/api/goal (JSON)
//
// A Vercel serverless function shipped with the app as dist/api/goal.js. tools/build.py writes goal-config.json
// next to it from src/js/donate.js and src/js/goal.js, so the addresses and the target are those of the
// verified build. The app itself never calls it (its CSP blocks every connection): only this page does.
//
//   GET /api/goal             JSON, public (CORS *): balance of every address, its USD value and the total
//   GET /api/goal?view=html   the campaign page, served at /goal: plain HTML, no script, its own strict CSP
//
// Counting rule (the same as the snapshot in the app): the current balance of each public address, listed
// coins and tokens only, valued at current CoinGecko prices. The wallets are not moved until the goal is
// reached, so anyone can check every balance on a block explorer and add them up.
//
// Sources, all public and keyless (the optional variables raise rate limits or swap a provider):
//   Bitcoin   mempool.space                      MEMPOOL_URL
//   EVM       public JSON-RPC (publicnode.com)   ETH_RPC_URL, BSC_RPC_URL, BASE_RPC_URL
//   TRON      TronGrid                           TRONGRID_URL, TRONGRID_API_KEY
//   TON       Toncenter                          TONCENTER_URL, TONCENTER_API_KEY
//   Prices    CoinGecko                          COINGECKO_API_KEY (demo key)
// Responses are cached by the CDN for 10 minutes, so the providers see a few requests an hour at most.
'use strict';
const crypto = require('crypto');

const TIMEOUT = 8000;
const env = (k, d) => (typeof process !== 'undefined' && process.env && process.env[k]) || d;

// Only these coins and tokens count. Anything else sent to the addresses is ignored.
// [symbol, contract, decimals]: decimals as published by each token contract (BSC's bridged stablecoins use 18)
const EVM_CHAINS = [
    { chain: 'ethereum', native: 'ETH', rpc: () => env('ETH_RPC_URL', 'https://ethereum-rpc.publicnode.com'),
      tokens: [['USDT', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6], ['USDC', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6]] },
    { chain: 'bsc', native: 'BNB', rpc: () => env('BSC_RPC_URL', 'https://bsc-rpc.publicnode.com'),
      tokens: [['USDT', '0x55d398326f99059fF775485246999027B3197955', 18], ['USDC', '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 18]] },
    { chain: 'base', native: 'ETH', rpc: () => env('BASE_RPC_URL', 'https://base-rpc.publicnode.com'),
      tokens: [['USDC', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 6], ['USDT', '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', 6]] }
];
const TRON_TOKENS = [['USDT', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 6], ['BTT', 'TAFjULxiVgT4qWk6UZwjqwZXTSaGaqnVp4', 18]];
const STABLE = { USDT: 1, USDC: 1 };   // used only when the price source does not answer
const PRICE_IDS = { BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', TRX: 'tron', BTT: 'bittorrent',
                    GRAM: 'the-open-network', USDT: 'tether', USDC: 'usd-coin' };

const NETWORKS = {
    btc: { name: 'Bitcoin', explorers: [['mempool.space', 'https://mempool.space/address/']] },
    evm: { name: 'Ethereum · BSC · Base', explorers: [['Etherscan', 'https://etherscan.io/address/'], ['BscScan', 'https://bscscan.com/address/'], ['Basescan', 'https://basescan.org/address/']] },
    tron: { name: 'TRON', explorers: [['Tronscan', 'https://tronscan.org/#/address/']] },
    ton: { name: 'GRAM (TON)', explorers: [['Tonviewer', 'https://tonviewer.com/']] }
};
const CHAIN_NAMES = { ethereum: 'Ethereum', bsc: 'BSC', base: 'Base' };

// ---------- amounts ----------
// Integer base units -> exact decimal string ("1234500" with 6 decimals -> "1.2345")
function units(raw, decimals) {
    const v = BigInt(raw);
    if (v < 0n) throw new Error('negative balance');
    const s = v.toString().padStart(decimals + 1, '0');
    const int = s.slice(0, s.length - decimals);
    const frac = s.slice(s.length - decimals).replace(/0+$/, '');
    return frac ? `${int}.${frac}` : int;
}
const cents = (x) => Math.round(x * 100) / 100;

// ---------- providers ----------
async function getJSON(f, url, headers = {}) {
    const r = await f(url, { headers: { accept: 'application/json', ...headers }, signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) throw new Error(`${new URL(url).host}: HTTP ${r.status}`);
    return r.json();
}

async function rpc(f, url, method, params) {
    const r = await f(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) throw new Error(`${new URL(url).host}: HTTP ${r.status}`);
    const j = await r.json();
    // '0x' alone is what a call to an address without code returns: never read it as zero
    if (!j || j.error || typeof j.result !== 'string' || !/^0x[0-9a-f]+$/i.test(j.result)) throw new Error(`${new URL(url).host}: ${method} failed`);
    return BigInt(j.result);
}

async function btc(f, address) {
    const j = await getJSON(f, `${env('MEMPOOL_URL', 'https://mempool.space')}/api/address/${address}`);
    const c = j && j.chain_stats;   // confirmed only
    if (!c) throw new Error('mempool.space: unexpected answer');
    return [{ sym: 'BTC', chain: 'bitcoin', amount: units(BigInt(c.funded_txo_sum) - BigInt(c.spent_txo_sum), 8) }];
}

async function evm(f, address) {
    const word = address.slice(2).toLowerCase().padStart(64, '0');
    const per = await Promise.all(EVM_CHAINS.map(async (c) => {
        const url = c.rpc();
        const native = rpc(f, url, 'eth_getBalance', [address, 'latest']);
        const tokens = c.tokens.map(async ([sym, contract, dec]) => ({ sym, chain: c.chain,
            amount: units(await rpc(f, url, 'eth_call', [{ to: contract, data: '0x70a08231' + word }, 'latest']), dec) }));   // balanceOf(address)
        // One Promise.all for everything: a second failure must never be left as an unhandled rejection
        const [bal, toks] = await Promise.all([native, Promise.all(tokens)]);
        return [{ sym: c.native, chain: c.chain, amount: units(bal, 18) }, ...toks];
    }));
    return per.flat();
}

async function tron(f, address) {
    const key = env('TRONGRID_API_KEY');
    const j = await getJSON(f, `${env('TRONGRID_URL', 'https://api.trongrid.io')}/v1/accounts/${address}`, key ? { 'TRON-PRO-API-KEY': key } : {});
    if (!j || j.success === false || !Array.isArray(j.data)) throw new Error('TronGrid: unexpected answer');
    const acct = j.data[0] || {};   // an address that never received anything is not on chain yet: zero
    const trc20 = Object.assign({}, ...(Array.isArray(acct.trc20) ? acct.trc20 : []));
    return [{ sym: 'TRX', chain: 'tron', amount: units(BigInt(acct.balance || 0), 6) },
        ...TRON_TOKENS.map(([sym, contract, dec]) => ({ sym, chain: 'tron', amount: units(BigInt(trc20[contract] || '0'), dec) }))];
}

async function ton(f, address) {
    const key = env('TONCENTER_API_KEY');
    const j = await getJSON(f, `${env('TONCENTER_URL', 'https://toncenter.com')}/api/v2/getAddressBalance?address=${encodeURIComponent(address)}`,
        key ? { 'X-API-Key': key } : {});
    if (!j || j.ok !== true || !/^\d+$/.test(String(j.result))) throw new Error('Toncenter: unexpected answer');
    return [{ sym: 'GRAM', chain: 'ton', amount: units(BigInt(j.result), 9) }];
}

async function prices(f) {
    // Never throws: without prices, stablecoins still count at $1 and empty wallets at $0
    const key = env('COINGECKO_API_KEY');
    const ids = [...new Set(Object.values(PRICE_IDS))].join(',');
    let j = null;
    try {
        j = await getJSON(f, `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, key ? { 'x-cg-demo-api-key': key } : {});
    } catch { /* see below */ }
    const out = { ...STABLE };
    for (const [sym, id] of Object.entries(PRICE_IDS)) {
        const p = j && j[id] && j[id].usd;
        if (typeof p === 'number' && Number.isFinite(p) && p > 0) out[sym] = p;
    }
    return out;
}

const READERS = { btc, evm, tron, ton };

// Every wallet is read in full or not at all: a half-read wallet would understate the total without saying so
async function collect(config, f = fetch) {
    const entries = Object.entries(config.addresses || {}).filter(([k, a]) => a && READERS[k]);
    const [px, ...reads] = await Promise.allSettled([prices(f), ...entries.map(([k, a]) => READERS[k](f, a))]);
    const price = px.status === 'fulfilled' ? px.value : {};
    const wallets = {};
    entries.forEach(([kind, address], i) => {
        const w = { address, ok: false, usd: null, assets: [] };
        try {
            if (reads[i].status !== 'fulfilled') throw reads[i].reason;
            w.assets = reads[i].value.map((a) => {
                if (/^0(\.0*)?$/.test(a.amount)) return { ...a, usd: 0 };
                if (!(a.sym in price)) throw new Error(`CoinGecko: no price for ${a.sym}`);
                return { ...a, usd: cents(Number(a.amount) * price[a.sym]) };
            });
            w.usd = cents(w.assets.reduce((s, a) => s + a.usd, 0));
            w.ok = true;
        } catch (e) {
            w.assets = [];
            w.error = String((e && e.message) || e).slice(0, 160);
        }
        wallets[kind] = w;
    });
    const ok = Object.values(wallets).filter((w) => w.ok);
    return {
        target_usd: config.target_usd, start: config.start, as_of: new Date().toISOString(),
        raised_usd: cents(ok.reduce((s, w) => s + w.usd, 0)),
        complete: ok.length === entries.length,
        rule: 'Current balance of each address (listed coins and tokens only) at current CoinGecko prices. The wallets are not moved until the goal is reached.',
        prices: price, wallets
    };
}

// ---------- page ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const usdFmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: v >= 100 || v === 0 ? 0 : 2, maximumFractionDigits: v >= 100 || v === 0 ? 0 : 2 }).format(v);
const amountFmt = (s) => {
    const n = Number(s);
    if (n === 0) return '0';
    return new Intl.NumberFormat('en-US', n >= 1 ? { maximumFractionDigits: n >= 1000 ? 0 : 4 } : { maximumSignificantDigits: 6 }).format(n);
};
function pctOf(raised, target) {
    const p = target > 0 ? (raised / target) * 100 : 0;
    return { width: Math.min(100, Math.max(0, p)), label: raised > 0 && p < 1 ? '<1%' : `${Math.floor(Math.min(100, p))}%` };
}

const FONTS = [['Atkinson Hyperlegible', 400, 'atkinson-hyperlegible-latin-400-normal'], ['Atkinson Hyperlegible', 700, 'atkinson-hyperlegible-latin-700-normal'],
    ['JetBrains Mono', 400, 'jetbrains-mono-latin-400-normal'], ['JetBrains Mono', 500, 'jetbrains-mono-latin-500-normal']];
const CSS = FONTS.map(([fam, w, file]) => `@font-face{font-family:'${fam}';font-weight:${w};font-display:swap;src:url(/fonts/${file}.woff2) format('woff2')}`).join('') + `
:root{--ground:#E9EDE8;--paper:#FFFFFF;--ink:#1F2A33;--ink-2:#34424E;--muted:#4F5B63;--line:#C9D1CA;--line-soft:#E1E6E1;--accent:#23605F;--accent-ink:#174645;--accent-soft:#DCEBE8;--warn:#8A5D00;--warn-soft:#F3EAD6;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--ground:#141A1D;--paper:#1D2529;--ink:#E7ECEA;--ink-2:#C9D2CF;--muted:#A9B5B0;--line:#34413F;--line-soft:#2A3436;--accent:#79C2BB;--accent-ink:#A8DCD6;--accent-soft:#1F3634;--warn:#E1B456;--warn-soft:#3A2F17}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Atkinson Hyperlegible',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.5;background:var(--ground);color:var(--ink)}
main{max-width:560px;margin:0 auto;padding:16px 16px 40px;display:flex;flex-direction:column;gap:16px}
a{color:var(--accent)}a:hover{color:var(--accent-ink)}
header{display:flex;align-items:center;gap:10px;min-height:48px}
header img{border-radius:8px}header span{font-weight:700;font-size:18px;flex:1}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:12px;background:var(--ink);color:var(--paper);font-weight:700;text-decoration:none}
.btn:hover{color:var(--paper);opacity:.92}
.btn-s{min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;display:inline-flex;align-items:center}
section{background:var(--paper);border:1px solid var(--line-soft);border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:12px}
.eyebrow{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
h1{font-size:26px;line-height:1.2}h2{font-size:19px;line-height:1.25}
.sum{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.sum strong{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:30px}
.sum .of{color:var(--muted)}.sum .pct{margin-left:auto;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:500;color:var(--accent-ink)}
.bar{display:block;width:100%;height:10px}.bar .track{fill:var(--accent-soft)}.bar .fill{fill:var(--accent)}
.meta,.note{font-size:14px;color:var(--muted)}
.warn{font-size:14px;color:var(--warn);background:var(--warn-soft);border-radius:10px;padding:10px 12px}
ul{list-style:none;display:flex;flex-direction:column}
li{display:flex;flex-direction:column;gap:4px;padding:12px 0;border-bottom:1px solid var(--line-soft)}
li:first-child{padding-top:0}
.row{display:flex;justify-content:space-between;gap:8px}
.usd{font-family:'JetBrains Mono',ui-monospace,monospace}
.addr{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;word-break:break-all;color:var(--ink-2);user-select:all}
.assets{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;color:var(--muted)}
.links{display:flex;flex-wrap:wrap;gap:0 16px}.links a{font-size:14px;font-weight:700;min-height:36px;display:inline-flex;align-items:center}
.na{color:var(--warn);font-size:14px}
footer{font-size:13px;color:var(--muted);text-align:center}
`;
const CSP = `default-src 'none'; style-src 'sha256-${crypto.createHash('sha256').update(CSS).digest('base64')}'; font-src 'self'; img-src 'self'; ` +
    "base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

function assetLine(assets, byChain) {
    const nonzero = assets.filter((a) => !/^0(\.0*)?$/.test(a.amount));
    if (!nonzero.length) return `0 ${assets[0] ? assets[0].sym : ''}`.trim();
    return nonzero.map((a) => `${amountFmt(a.amount)} ${a.sym}${byChain ? ` (${CHAIN_NAMES[a.chain] || a.chain})` : ''}`).join(' · ');
}

function render(r) {
    const p = pctOf(r.raised_usd, r.target_usd);
    const when = new Date(r.as_of);
    const updated = `${when.toISOString().slice(11, 16)} UTC, ${new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(when)}`;
    const missing = Object.entries(r.wallets).filter(([, w]) => !w.ok).map(([k]) => NETWORKS[k].name);
    const rows = Object.entries(r.wallets).map(([kind, w]) => {
        const n = NETWORKS[kind];
        const links = n.explorers.map(([name, base]) =>
            `<a href="${esc(base + encodeURIComponent(w.address))}" target="_blank" rel="noopener noreferrer" aria-label="Check on ${esc(name)} (opens in a new tab)">${esc(name)} ↗</a>`).join('');
        return `<li><div class="row"><strong>${esc(n.name)}</strong><strong class="usd">${w.ok ? esc(usdFmt(w.usd)) : '—'}</strong></div>
<code class="addr">${esc(w.address)}</code>
${w.ok ? `<span class="assets">${esc(assetLine(w.assets, kind === 'evm'))}</span>` : '<span class="na">Could not be read just now</span>'}
<span class="links">${links}</span></li>`;
    }).join('\n');
    const reached = r.raised_usd >= r.target_usd;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Community goal · MnemoniQR</title>
<meta name="description" content="Unlock multi-seed backups for everyone: ${esc(usdFmt(r.raised_usd))} of ${esc(usdFmt(r.target_usd))} raised. Every balance can be checked on a block explorer.">
<link rel="icon" href="/favicon.png">
<style>${CSS}</style>
</head>
<body>
<main>
<header><img src="/MQR_logo.webp" alt="" width="32" height="32"><span>MnemoniQR</span><a class="btn-s" href="/">Open the app</a></header>
<section aria-labelledby="h-goal">
<span class="eyebrow">Community goal</span>
<h1 id="h-goal">${reached ? 'Goal reached: multi-seed backups are coming for everyone' : 'Unlock multi-seed backups for everyone'}</h1>
<p class="sum"><strong>${esc(usdFmt(r.raised_usd))}</strong> <span class="of">of ${esc(usdFmt(r.target_usd))}</span> <span class="pct">${esc(p.label)}</span></p>
<svg class="bar" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="${esc(p.label)} of the goal"><rect class="track" width="100" height="10" rx="5"/><rect class="fill" width="${p.width.toFixed(2)}" height="10" rx="5"/></svg>
<p class="meta">Updated ${esc(updated)} · <a href="/api/goal">raw data (JSON)</a></p>
${missing.length ? `<p class="warn">${esc(missing.join(', '))}: could not be read just now (an explorer or the price source did not answer), so the total leaves it out. It is read again within a few minutes.</p>` : ''}
</section>
<section aria-labelledby="h-what">
<h2 id="h-what">What it unlocks</h2>
<p>Up to 3 recovery phrases in one encrypted QR code, each with its own label. When the goal is reached it ships in an update, free for everyone. Recovering a backup is always free.</p>
</section>
<section aria-labelledby="h-wallets">
<h2 id="h-wallets">Balance of each address</h2>
<ul>
${rows}
</ul>
<p class="note">How it is counted: the current balance of each address, valued at current market prices (CoinGecko). Only BTC, ETH, BNB, USDT, USDC, TRX, BTT and GRAM count. The wallets are not moved until the goal is reached, so anyone can open each explorer and add the balances up. Explorers are outside sites: they see your IP address.</p>
</section>
<section aria-labelledby="h-donate">
<h2 id="h-donate">Donate</h2>
<p>In the app, choose <strong>Support it</strong>: every network has its QR code and a copy button, and the addresses are part of the verified build listed in HASHES.txt. They are the same as above.</p>
<a class="btn" href="/">Open MnemoniQR</a>
</section>
<footer>MnemoniQR · free, open source, no ads · <a href="https://github.com/MPetovick/MnemoniQR">Source code</a></footer>
</main>
</body>
</html>
`;
}

// ---------- handler ----------
// Kept by a warm instance between calls: a URL with an extra query string misses the CDN cache, but still
// never sends more than one round of requests to the providers per period
const MEMO = { at: 0, result: null };
const MEMO_MS = { complete: 300000, partial: 60000 };
const COMMON = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload'
};

async function handler(req, res, deps = {}) {
    const send = (status, type, body, extra = {}) => {
        res.statusCode = status;
        for (const [k, v] of Object.entries({ ...COMMON, 'Content-Type': type, ...extra })) res.setHeader(k, v);
        res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        send(405, 'text/plain; charset=utf-8', 'Method not allowed', { Allow: 'GET, HEAD', 'Content-Security-Policy': "default-src 'none'" });
        return;
    }
    const html = new URL(req.url || '/', 'https://mnemoniqr.app').searchParams.get('view') === 'html';
    let result;
    try {
        const memo = !deps.config && MEMO.result && Date.now() - MEMO.at < MEMO_MS[MEMO.result.complete ? 'complete' : 'partial'];
        if (memo) result = MEMO.result;
        else {
            const config = deps.config || require('./goal-config.json');
            result = await collect(config, deps.fetch || fetch);
            if (!deps.config) Object.assign(MEMO, { at: Date.now(), result });
        }
    } catch (e) {
        send(500, 'text/plain; charset=utf-8', 'The goal could not be computed.', { 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'" });
        return;
    }
    // A complete answer is kept 10 minutes by the CDN; an incomplete one is retried after a minute
    const cache = result.complete ? 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600' : 'public, max-age=30, s-maxage=60';
    if (html) send(200, 'text/html; charset=utf-8', render(result), { 'Cache-Control': cache, 'Content-Security-Policy': CSP });
    else send(200, 'application/json; charset=utf-8', JSON.stringify(result, null, 2), { 'Cache-Control': cache,
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'Access-Control-Allow-Origin': '*' });
}

module.exports = handler;
module.exports.collect = collect;
module.exports.render = render;
module.exports.units = units;
module.exports.CSS = CSS;
module.exports.CSP = CSP;
