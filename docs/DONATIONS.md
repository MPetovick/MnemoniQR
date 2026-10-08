# Supporting MnemoniQR

MnemoniQR is free, open source and has no ads, accounts or tracking. Donations pay for security audits and new features, and keep it free for everyone.

- [Donation addresses](#donation-addresses)
- [How to donate safely](#how-to-donate-safely)
- [How the addresses are protected](#how-the-addresses-are-protected)
- [Community goal](#community-goal)
- [What the app shows, and when](#what-the-app-shows-and-when)
- [For maintainers](#for-maintainers)

## Donation addresses

| Network | What is accepted | Address |
|---|---|---|
| Bitcoin | BTC, on-chain | `bc1qqg7ttja7th9r02549wvdwz3wspcvlv3gu95kz0` |
| Ethereum, BSC and Base (same address) | ETH, USDT, USDC on Ethereum; BNB, USDT, USDC on BSC; ETH, USDC, USDT on Base | `0x30A24455EB8a41E104EA42CE8A2bcB9FEf679B64` |
| TRON | TRX, USDT, BTT, on the TRON network only | `TBJTTime19pbLPAQqMDgQ9jyeAfJrJELQJ` |
| TON | GRAM (formerly Toncoin), no memo needed | `UQCus4n5xGEVKqOCZuczwdpHeDelWjVhGYyIvAQKWXiFjj_B` |

In the app: tap **Support it** in the footer. Each network has its QR code and a *Copy address* button.

## How to donate safely

- Copy the address from the app or from the release's `HASHES.txt`, not from a message or a website you do not trust.
- **After pasting, compare the first and last four characters** (highlighted in the app). Some malware replaces addresses in the clipboard.
- Send on the right network. USDT on TRON goes to the TRON address; USDT on Ethereum, BSC or Base goes to the `0x…` address. Tokens sent on a network the address does not cover may be lost.
- Send a small amount first if you are unsure.
- Donations are public on the blockchain. Use an address not linked to your identity if that matters to you (see [PRIVACY.md](PRIVACY.md#donations)).

## How the addresses are protected

A swapped address steals donations, so the addresses are treated like code:

- They are defined in one file only, [`src/js/donate.js`](../src/js/donate.js).
- The build refuses a malformed address: Bitcoin Bech32/Bech32m or Base58Check, Ethereum in its EIP-55 checksummed form, TRON Base58Check, TON with its CRC-16 and mainnet flags (testnet addresses are refused).
- The file is loaded under Subresource Integrity and covered by the version fingerprint, and every release lists the addresses in `HASHES.txt`. An address cannot change without changing the fingerprint.
- The app generates the QR codes locally and never fetches anything.

## Community goal

**210,000 USD to unlock multi-seed backups for everyone**: up to 3 recovery phrases in one encrypted QR. When the goal is reached, the feature is to ship in an update, free for everyone. Recovering a backup stays free.

**How it is counted.** The current balance of each donation address, in the coins and tokens listed above only, valued in USD. The wallets are not moved until the goal is reached, so the total is simply the sum of the balances, and anyone can check every one of them on a block explorer:

| Network | Explorer |
|---|---|
| Bitcoin | [mempool.space](https://mempool.space/address/bc1qqg7ttja7th9r02549wvdwz3wspcvlv3gu95kz0) |
| Ethereum | [Etherscan](https://etherscan.io/address/0x30A24455EB8a41E104EA42CE8A2bcB9FEf679B64) |
| BSC | [BscScan](https://bscscan.com/address/0x30A24455EB8a41E104EA42CE8A2bcB9FEf679B64) |
| Base | [Basescan](https://basescan.org/address/0x30A24455EB8a41E104EA42CE8A2bcB9FEf679B64) |
| TRON | [Tronscan](https://tronscan.org/#/address/TBJTTime19pbLPAQqMDgQ9jyeAfJrJELQJ) |
| TON | [Tonviewer](https://tonviewer.com/UQCus4n5xGEVKqOCZuczwdpHeDelWjVhGYyIvAQKWXiFjj_B) |

Because balances are valued at market prices, the total moves with the prices of BTC, ETH and the other coins. Stablecoins (USDT, USDC) count at their market price, close to one dollar.

**Live:** <https://mnemoniqr.app/goal> shows the total and each balance, recomputed at most every 10 minutes from the explorers and CoinGecko, on the server. The same figures are at <https://mnemoniqr.app/api/goal> as JSON. A network that cannot be read at that moment is left out of the total and named on the page, never counted as zero.

**In the app:** a thin progress bar in the footer and a ring in the Support sheet, and for each network the balance of its address with links to its explorers. The app connects to nothing, so it shows a snapshot built into each version, dated "As of …".

## What the app shows, and when

Support never interrupts:

- a line in the footer (with the goal bar);
- one quiet line on the home screen after your first verified backup in a session, and after each real recovery, once the phrase has been wiped (never during a flow, never in practice mode);
- a mention in *How it protects you*.

The app cannot know whether anyone donated, and stores nothing about it. A build without donation addresses shows none of this.

## For maintainers

**Changing an address.** Edit `src/js/donate.js`, run `python3 tools/build.py`, check the addresses printed by the build and in `HASHES.txt`, and deploy `dist/`. Editing `dist/js/donate.js` directly does not work: the browser refuses a file that no longer matches its SRI hash, and the support link disappears.

**Refreshing the goal snapshot** before each release:

```bash
python3 tools/goal.py                 # reads the explorers now (Node.js 18+), refuses an incomplete reading
python3 tools/goal.py --from-url      # or takes https://mnemoniqr.app/api/goal once deployed
python3 tools/goal.py --target 210000 # change the goal (the balances are kept)
python3 tools/goal.py --show          # print the current snapshot
python3 tools/build.py
```

The build refuses a snapshot whose totals do not add up or whose networks do not match `donate.js`, and the app hides one that fails the same checks. The live page needs the Vercel function described in [DEVELOPMENT.md](DEVELOPMENT.md#deploying).

**Testing without real addresses:** `python3 tools/build.py --out /tmp/mqr-test --donate-test` uses public example addresses; add `--goal-test` for made-up balances. Never deploy such a build (`HASHES.txt` says so).
