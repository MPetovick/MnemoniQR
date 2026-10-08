// MnemoniQR v6.8.0 · Community goal: "Unlock multi-seed backups for everyone".
//
// A snapshot of the balance of each donation address, shown in the footer and the Support sheet.
// The app never fetches anything: this file is all it knows. It is loaded under SRI and covered by
// the build fingerprint, like donate.js. The live total is at https://mnemoniqr.app/goal.
//
// Counting rule: the current balance of each public address (whitelisted coins and tokens only),
// valued in USD at that day's prices. The wallets are not moved until the goal is reached, so every
// balance can be checked on a block explorer and the total is simply their sum.
//
// Do not edit by hand. Refresh it before a release, then build:
//     python3 tools/goal.py              (reads the public explorers, needs Node 18+)
//     python3 tools/goal.py --target N   (changes the goal, in USD)
//     python3 tools/build.py
// tools/build.py refuses a snapshot whose numbers do not add up or whose networks do not match donate.js.
'use strict';
self.MQR_GOAL = /* GOAL */ {
  "target_usd": 21000,
  "start": "2026-10-08",
  "as_of": "2026-10-08",
  "wallets": {
    "btc": {
      "usd": 0,
      "assets": [
        {"sym": "BTC", "chain": "bitcoin", "amount": "0", "usd": 0}
      ]
    },
    "evm": {
      "usd": 0,
      "assets": [
        {"sym": "ETH", "chain": "ethereum", "amount": "0", "usd": 0},
        {"sym": "USDT", "chain": "ethereum", "amount": "0", "usd": 0},
        {"sym": "USDC", "chain": "ethereum", "amount": "0", "usd": 0},
        {"sym": "BNB", "chain": "bsc", "amount": "0", "usd": 0},
        {"sym": "USDT", "chain": "bsc", "amount": "0", "usd": 0},
        {"sym": "USDC", "chain": "bsc", "amount": "0", "usd": 0},
        {"sym": "ETH", "chain": "base", "amount": "0", "usd": 0},
        {"sym": "USDC", "chain": "base", "amount": "0", "usd": 0},
        {"sym": "USDT", "chain": "base", "amount": "0", "usd": 0}
      ]
    },
    "tron": {
      "usd": 0,
      "assets": [
        {"sym": "TRX", "chain": "tron", "amount": "0", "usd": 0},
        {"sym": "USDT", "chain": "tron", "amount": "0", "usd": 0},
        {"sym": "BTT", "chain": "tron", "amount": "0", "usd": 0}
      ]
    },
    "ton": {
      "usd": 0,
      "assets": [
        {"sym": "GRAM", "chain": "ton", "amount": "0", "usd": 0}
      ]
    }
  }
} /* END */;
