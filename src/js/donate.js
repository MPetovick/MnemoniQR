// MnemoniQR v6.6.2 · Donation addresses (the only place they are defined).
//
// Fill in `address` for each network you want to offer; leave it '' to hide that network.
// With no address at all, the app shows no support link, line or sheet.
//
// tools/build.py refuses to build with a malformed address (TRON Base58Check, EVM EIP-55, Bitcoin
// Bech32/Base58Check) and lists every published address in HASHES.txt. This file is loaded under SRI
// and is covered by the build fingerprint, so an address cannot be swapped without changing it.
'use strict';
self.MQR_DONATE = Object.freeze([
    Object.freeze({ id: 'tron', kind: 'tron', address: 'TBJTTime19pbLPAQqMDgQ9jyeAfJrJELQJ' }),   // USDT on TRON (TRC-20)
    Object.freeze({ id: 'evm', kind: 'evm', address: '' }),     // USDT, USDC or ETH on Ethereum
    Object.freeze({ id: 'btc', kind: 'btc', address: '' })      // Bitcoin on-chain
]);
