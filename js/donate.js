// MnemoniQR v6.6.3 · Donation addresses (the only place they are defined).
//
// Fill in `address` for each network you want to offer; leave it '' to hide that network.
// With no address at all, the app shows no support link, line or sheet.
//
// tools/build.py refuses to build with a malformed address (TRON Base58Check, EVM EIP-55, Bitcoin
// Bech32/Base58Check) and lists every published address in HASHES.txt. This file is loaded under SRI
// and is covered by the build fingerprint, so an address cannot be swapped without changing it.
//
// Edit THIS file (src/js/donate.js), then run `python3 tools/build.py` and deploy dist/. Editing
// dist/js/donate.js directly does not work: the browser refuses a file that no longer matches its
// SRI hash, and the support link disappears. That refusal is what protects the addresses.
'use strict';
self.MQR_DONATE = Object.freeze([
    Object.freeze({ id: 'tron', kind: 'tron', address: 'TBJTTime19pbLPAQqMDgQ9jyeAfJrJELQJ' }),   // USDT on TRON (TRC-20)
    Object.freeze({ id: 'evm', kind: 'evm', address: '0x30A24455EB8a41E104EA42CE8A2bcB9FEf679B64' }),   // USDT, USDC or ETH on Ethereum
    Object.freeze({ id: 'btc', kind: 'btc', address: 'bc1qqg7ttja7th9r02549wvdwz3wspcvlv3gu95kz0' })   // Bitcoin on-chain
]);
