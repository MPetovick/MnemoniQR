// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) MPetovick and the MnemoniQR contributors. Commercial licenses: see COMMERCIAL.md
// MnemoniQR · Recorded-style answers of the public explorers and CoinGecko, for tests/goal_api_test.js
// (no network). The balances add up to $10,319.52: the same made-up figures as `tools/build.py --goal-test`.
'use strict';
const CONFIG = {
    target_usd: 21000, start: '2026-10-08',
    addresses: {
        btc: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        evm: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        tron: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
        ton: 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ'
    }
};
const PRICES = { bitcoin: { usd: 60000 }, ethereum: { usd: 2415.85 }, binancecoin: { usd: 600 }, tron: { usd: 0.3 },
                 bittorrent: { usd: 0.0000008 }, 'the-open-network': { usd: 3 }, tether: { usd: 1 }, 'usd-coin': { usd: 1 } };
const hex = (n) => '0x' + BigInt(n).toString(16);
const E18 = 10n ** 18n;

// Token decimals and balances per RPC host and contract (lower case)
const EVM = {
    'ethereum-rpc.publicnode.com': { native: 12n * E18 / 10n, tokens: {
        '0xdac17f958d2ee523a2206206994597c13d831ec7': [6, 0n], '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': [6, 0n] } },
    'bsc-rpc.publicnode.com': { native: 0n, tokens: {
        '0x55d398326f99059ff775485246999027b3197955': [18, 2500n * E18], '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': [18, 0n] } },
    'base-rpc.publicnode.com': { native: 0n, tokens: {
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': [6, 120500000n], '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2': [6, 0n] } }
};

function fakeFetch(overrides = {}) {
    const calls = [];
    const f = async (url, opts = {}) => {
        const u = new URL(url);
        calls.push(u.host);
        const reply = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });
        if (overrides[u.host]) return overrides[u.host](u, opts, reply);
        if (u.host === 'mempool.space') return reply({ chain_stats: { funded_txo_sum: 7000000, spent_txo_sum: 2000000 }, mempool_stats: { funded_txo_sum: 99999999 } });
        if (u.host === 'api.trongrid.io') return reply({ success: true, data: [{ balance: 1000000000, trc20: [{ TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t: '1500000000' }] }] });
        if (u.host === 'toncenter.com') return reply({ ok: true, result: '0' });
        if (u.host === 'api.coingecko.com') return reply(PRICES);
        if (EVM[u.host]) {
            const { method, params } = JSON.parse(opts.body);
            const chain = EVM[u.host];
            if (method === 'eth_getBalance') return reply({ jsonrpc: '2.0', id: 1, result: hex(chain.native) });
            const tok = chain.tokens[params[0].to.toLowerCase()];
            if (!tok) return reply({ jsonrpc: '2.0', id: 1, result: '0x' });
            return reply({ jsonrpc: '2.0', id: 1, result: hex(params[0].data === '0x313ce567' ? tok[0] : tok[1]) });
        }
        throw new Error(`unexpected request to ${u.host}`);
    };
    f.calls = calls;
    return f;
}

module.exports = { CONFIG, PRICES, EVM, fakeFetch };
