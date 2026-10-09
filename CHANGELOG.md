# Changelog

## 6.9.0 — license: GNU AGPL-3.0 and commercial licenses

- **MnemoniQR is now licensed under the GNU Affero General Public License v3.0** (AGPL-3.0-only), and also offered under commercial licenses ([COMMERCIAL.md](COMMERCIAL.md)). It stays open source: anyone can use, read, audit, build and share it. Whoever distributes it, or offers a modified version as a website or service, must publish the source of their version under the same license; building it into a proprietary product requires a commercial license. Versions up to and including 6.8.0 remain available under Apache 2.0 as published.
- Contributors sign a [Contributor License Agreement](CLA.md) once, by commenting on their pull request (`.github/workflows/cla.yml`).
- Every project file carries an `SPDX-License-Identifier: AGPL-3.0-only` header. [NOTICE](NOTICE) states the licenses, where the source of each version is, the name-and-logo policy and the third-party components.
- *How it protects you* names the new license and links to the source code.
- No change to encryption, formats or behaviour: every backup opens as before.

## 6.8.0 — community goal

- **Community goal: unlock multi-seed backups for everyone, 210,000 USD.** A thin progress bar in the footer ("Unlock multi-seed for everyone · Support it", with the percentage), and a progress ring with the total and the date in the Support sheet.
- **Every balance can be checked.** Each network in the sheet shows the balance of its address (by coin, ≈ USD) and links to its block explorers: mempool.space; Etherscan, BscScan and Basescan for the same EVM address; Tronscan; Tonviewer. The count is the current balance of each address, and the wallets are not moved until the goal is reached, so anyone can add the balances up. Links open in a new tab, with no opener and no referrer; the sheet says that an explorer sees your IP address.
- **The app still connects to nothing.** It shows a snapshot built into the version (`src/js/goal.js`), loaded under SRI, covered by the fingerprint and stated in `HASHES.txt`. The build refuses a snapshot whose totals do not add up or whose networks do not match `donate.js`; the app hides one that does not either and keeps the plain support link.
- **Live page at mnemoniqr.app/goal**, a Vercel function shipped in `dist/api/`: it reads public explorers (mempool.space, public JSON-RPC for Ethereum/BSC/Base, TronGrid, Toncenter) and CoinGecko, with no key, cached 10 minutes. Plain HTML with no script and a hash-pinned stylesheet; the same figures as JSON at `/api/goal`. A wallet that cannot be read is left out of the total and named, never counted as zero. `vercel.json` keeps the app's headers off `/goal` and `/api/`.
- `tools/goal.py` refreshes the snapshot with the same code as the page (or from the deployed `/api/goal`) and refuses an incomplete reading.
- mnemoniqr.app is the reference address everywhere (README, GitHub sponsor button, README of the shares ZIP).
- Tall sheets scroll instead of going off the top of small screens.
- **Documentation for users**, all linked from the README: a [user guide](docs/USER_GUIDE.md) (every step and option, storing the backup, troubleshooting), [recovery without the app and instructions for heirs](docs/RECOVERY.md) with a letter template, an [FAQ](docs/FAQ.md), a [privacy](docs/PRIVACY.md) page listing everything stored or sent, and a [donations](docs/DONATIONS.md) page. [SECURITY.md](SECURITY.md) is now the vulnerability policy; the security design and review history moved to [docs/AUDIT.md](docs/AUDIT.md), with a cryptography summary and a fuller threat model. [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) cover building, testing, deploying and releasing. [FORMAT.md](docs/FORMAT.md) describes decryption step by step. `LICENSE` is the plain Apache 2.0 text again; the disclaimer, the name-and-logo note and third-party attributions are in [NOTICE](NOTICE).
- Tests: `tests/goal_e2e.py` (app), `tests/test_goal.py` (tool, build checks, routes and headers), `tests/goal_api_test.js` (function, with recorded answers). All run in CI.

## 6.7.0 — GRAM

- **Support sheet: GRAM (formerly Toncoin) on the TON network**, after TRON. The build checks TON addresses: 48 base64url characters, mainnet bounceable or non-bounceable flag, workchain, CRC-16. Testnet addresses are refused.
- The sheet accepts base64url addresses (`_` and `-`).
- Reopening the sheet focuses the tab of the network shown, not always the first one.
- TRON text: "Lowest fees" removed (not accurate for USDT on TRON).
- Tests: GRAM tab, mistyped and testnet TON addresses. The forced-update test server no longer answers 304 by file date, which made CI fail when the previous release was built after `dist/`.

## 6.6.5

- Support sheet, ETH card: *BSC* and *Base* shown in a second colour next to *Ethereum mainnet*. The same address works on the three networks.
- TRON card: USDT, BTT or TRX.

## 6.6.4

- Support sheet: networks in the order BTC, ETH, TRON, with short tab labels. Each card's description says what is appreciated: Bitcoin on-chain; USDT, USDC or ETH on Ethereum; USDT, USDC or TRX on TRON.

## 6.6.3

- **Donation addresses:** USDT on TRON, USDT/USDC/ETH on Ethereum and Bitcoin, checked by the build (Base58Check, EIP-55, Bech32) and listed in `HASHES.txt`.
- **Every build updates installed copies.** The build stamps a content id of every precached file into the cache name, the version the service worker announces and `<html data-build>`. Changing only an address or a line of markup now reaches installed copies too, even if the version number was not raised. Before, the service worker stayed byte-identical and nothing updated. Tested in `tests/update_e2e.py`.
- `src/js/donate.js` explains where to edit. Editing `dist/js/donate.js` directly makes the browser refuse the file (SRI), which hides the support link by design.
- A toast identical to one already on screen is not stacked again.

## 6.6.2 — production review

- **ZIP is a separate, confirmed choice.** With shares, *PNG* again saves the share on screen. *All shares in one ZIP* asks first: a file that holds every share is only as safe as the password (on iPhone, downloads often sync to iCloud). Use it to move the shares to different places, then delete it.
- **No trace of a real backup on the device.** The once-only support line after the first verified backup is now remembered in memory for the session, not in `localStorage`. The flag stored by 6.5.x is deleted on start. Before, it told anyone holding the device that a real backup had been made there, which worked against the decoy.
- **Exports report errors** instead of leaving a dead button, and ignore a second tap while one is running.
- The PDF is still produced, without the shield, if the logo image cannot be prepared (for example, a privacy extension that blocks canvas reads).
- Dead code from the removed in-QR logo deleted; docs updated (README: ZIP, privacy).

## 6.6.1 — PDF logo and ZIP

- **PDF:** the MnemoniQR shield beside the title on every page.
- **ZIP for shares:** with more than one QR, the download button becomes *ZIP*. It holds one labelled PNG per share and a README with how many are needed and how to recover. Entries are stored with a fixed 1980 date, so the archive does not reveal when the backup was made. The app reads the PNGs back (tested), and so does `recover.py` from their text.
- **QR codes stay plain.** A logo inside the QR was tried in a 6.6.0 build and removed before release. The codes keep the error correction of 6.5.1: level Q by default, H as an option when printing.
- `tests/brand_e2e.py` reads the PNG, the ZIP and the printed PDF (rasterized at 100 and 150 dpi) with ZXing, a decoder independent from the app.

## 6.5.1 — support after a recovery

- After every real recovery, the quiet support line appears on the home screen: *Wallet recovered. If MnemoniQR helped, it stays free and ad-free thanks to people like you. Support it*. It is the moment the app has just proved useful.
- Never while the phrase is on screen. The line appears once it has been wiped and the user is back home, whether by *Done*, the timer or leaving the app.
- Never after a practice recovery, a backup check or when no donation address is configured. The × hides it.
- The once-only line after the first verified backup is unchanged.


## 6.1.0

- **Never truncate user data.** Passphrases and notes longer than 255 bytes are refused with an explanation. Before, a long passphrase was silently shortened (a different wallet) and a long note with accents or emoji could be cut mid-character, leaving a backup that could not be decoded.
- **Decoy must differ from the real phrase.** Otherwise the decoy password would open the real wallet.
- **Lockout survives closing the dialog.** After repeated wrong passwords, reopening the recovery dialog keeps the waiting time.
- **Back/forward cache:** a page restored after being hidden returns to the home screen instead of showing a wiped step.
- **Huge images** (over 40 megapixels) are refused before decoding.
- **Stricter CSP:** the page may not make any network request (`connect-src 'none'`), images only from the app itself, no media sources.
- Expected user errors are no longer logged as console errors.
- Smaller package: removed unused icons, the PNG copy of the logo, dead language-detection code and the PDF translation shim.
- 23 in-browser tests.

## 5.1.0 — production release

- Audit fixes: broken PDF export, unexpected reload on first visit, updates applied mid-flow, lost install prompt, service worker shell over-matching, recovery allowed with failed word-list integrity, global debug hook, practice decoy race, PDF punctuation, stylesheet missing from the build fingerprint, over-broad cache cleanup. Details in [docs/AUDIT.md](docs/AUDIT.md).
- Binary-search BIP39 lookups with no caching of typed prefixes.
- Links to the README and the source code in the footer and in *How it protects you*, with the Apache 2.0 notice.
- Build pre-flight checks, deterministic output, `--no-tests`, `X-Frame-Options`.
- All code comments, documentation and the test suite in English. 25 in-browser tests.

## 5.0.0

- New "Paper" interface, install bottom sheet (native prompt or iOS steps), dark theme, self-hosted fonts.

## 4.0.0

- Built-in keyboard, Argon2id in a cancellable worker with three levels, Trusted Types, SRI and build fingerprint.
- Shamir shares, decoy wallet, BIP39 passphrase, BIP32 wallet fingerprint, practice mode, printable templates, single-file offline build, Spanish word list, test suite.

## 3.0.0

- Security rewrite: canonical BIP39 list, Argon2id, no third-party resources, encrypted metadata, strict CSP, working offline mode.
