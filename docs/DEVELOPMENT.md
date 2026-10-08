# Building, testing, deploying and releasing

- [Requirements](#requirements)
- [Building](#building)
- [Testing](#testing)
- [Deploying](#deploying)
- [Releasing](#releasing)
- [Project structure](#project-structure)
- [Design constraints](#design-constraints)

## Requirements

- **Build:** Python 3.8+ (standard library only). No Node.js or npm is needed to build the app.
- **Tests:** `pip install playwright argon2-cffi cryptography && python -m playwright install`; for the PDF/ZIP test also `pip install zxing-cpp opencv-python-headless pypdfium2`.
- **Community goal:** Node.js 18+ to refresh the snapshot (`tools/goal.py`) and to test the goal function.

## Building

```bash
python3 tools/build.py                 # writes dist/
python3 tools/build.py --no-tests      # same, without the test page
python3 tools/build.py --out DIR       # into another folder (empty, or a previous build)
```

Test-only builds (never deploy them; `HASHES.txt` says so): `--donate-test` (public example donation addresses), `--donate-none` (no address, no support UI), `--goal-test` (made-up goal balances).

The build checks that the BIP39 word list matches the hash pinned in `src/js/core.js`, that every file referenced by `index.html` and the service worker exists, that every version number agrees, that the donation addresses are well formed and that the goal snapshot adds up. Then it writes:

| Output | Purpose |
|---|---|
| `dist/` | The PWA, with a strict CSP, Trusted Types and Subresource Integrity on every script and the stylesheet |
| `dist/mnemoniqr-offline.html` | Everything in one file, for offline computers (open it directly, no server needed) |
| `dist/HASHES.txt` | Build fingerprints, build id, donation addresses, goal snapshot and SHA-256 of every file |
| `dist/vercel.json`, `dist/_headers` | HTTP security headers for Vercel, Netlify or Cloudflare Pages; on Vercel also the `/goal` route |
| `dist/api/goal.js`, `dist/api/goal-config.json` | The live community goal (`/goal` page and `/api/goal` JSON), a Vercel function |
| `dist/recover.py` | Standalone recovery tool |
| `dist/LICENSE.txt`, `dist/NOTICE.txt` | The GNU AGPL-3.0 text and the notices, served with the app |
| `dist/tests/tests.html` | In-browser test suite |

**Reproducible builds.** The same sources always produce byte-identical output. Anyone can rebuild a release and compare `dist/HASHES.txt` with the published one.

**Fingerprints.** The PWA fingerprint is the first 64 bits of the SHA-256 of the sorted SRI hashes of every script and stylesheet (the Argon2 worker included, since it is bundled into `js/kdf-src.js`). The single-file fingerprint is computed the same way from its CSP hashes. The app computes its own fingerprint at run time and shows it in *How it protects you*.

**Build id.** Every build also carries a content id of every precached file, stamped into the service worker's cache name and into `<html data-build>`. Any change, even without raising the version number, makes installed copies update.

## Testing

| Test | What it covers | Run |
|---|---|---|
| `dist/tests/tests.html` | The in-browser unit tests: official BIP39 vectors, the known fingerprint `73c5da0a`, the prefix index, Shamir, encryption, tampering, decoys, shares, keyfiles, the MQR5 text format (every single-character typo is caught), typed input, MQR4/v3/v2 compatibility, the password meter and generators, fuzzing of every parser, field-length checks, the largest backup fitting a QR, meter speed | Serve `dist/` (`cd dist && python3 -m http.server`) and open `/tests/tests.html` |
| `tests/e2e.py` | The real app in Chromium, Firefox and WebKit: a full backup (keyboard entry, passphrase, decoy, keyfile, shares, diceware password), cancelling, the largest backup on two pages read back by `recover.py`, verification, the PDF, typed recovery, the install sheet, the single file | `python3 tests/e2e.py --browser all` |
| `tests/update_e2e.py OLD_DIST` | An installed older version updates by itself, never in the middle of a flow | `python3 tests/update_e2e.py /path/to/old/dist` |
| `tests/brand_e2e.py` | The PNG, the ZIP of shares and the printed PDF (100 and 150 dpi) read by ZXing, a decoder independent from the app | `python3 tests/brand_e2e.py` |
| `tests/donate_e2e.py` | Support screens: QR decodes to the exact address, copy, the once-only line; mistyped addresses never build | `python3 tests/donate_e2e.py` |
| `tests/goal_e2e.py` | Community goal in the app: footer bar, ring, balance and explorer links per network; snapshots that do not add up are not shown | `python3 tests/goal_e2e.py` |
| `tests/test_goal.py` | Goal snapshot tool, build checks, what the build ships for `/goal` (routes, headers) | `python3 tests/test_goal.py` |
| `tests/goal_api_test.js` | Live goal function with recorded answers: sums, unreadable wallets never counted as zero, the page's CSP and escaping | `node --test tests/goal_api_test.js` |
| `tests/test_recover.py` | Fuzzes every parser in `recover.py`: only readable errors, never a traceback | `python3 tests/test_recover.py` |
| `tools/addresses.py` | Self-test of the address checksums | `python3 tools/addresses.py` |

Run `python3 tools/build.py` before the browser tests.

**Continuous integration.** `.github/workflows/ci.yml` builds, checks that the build is reproducible and runs the end-to-end tests in Chromium, Firefox and WebKit on every push. In Chromium it also runs every other test above, and the forced update from the previous release tag. The build is uploaded as an artifact.

## Deploying

Publish the contents of `dist/` at <https://mnemoniqr.app>. On Vercel: a project whose root directory is `dist/`, with no build command.

- **Headers.** Keep the provided `vercel.json` (or `_headers` on Netlify / Cloudflare Pages). `frame-ancestors`, `Permissions-Policy`, HSTS and the cross-origin policies only work as HTTP headers.
- **HTTPS** is required for the service worker, the camera and installation.
- **Caching.** `index.html`, `sw.js` and `manifest.json` must not be cached (the provided headers do this), otherwise installed copies see new versions late.
- **Community goal.** `/goal` needs Vercel, or any host that runs `api/goal.js` as a Node function. `vercel.json` sends `/goal` to the function and keeps the app's headers off `/goal` and `/api/`, which send their own (a page with no script and a hash-pinned stylesheet). It works without any key; in production set free `COINGECKO_API_KEY` (demo) and `TRONGRID_API_KEY` in the Vercel project, because keyless limits are shared by everyone on the same servers. The other optional variables (`MEMPOOL_URL`, `ETH_RPC_URL`, `BSC_RPC_URL`, `BASE_RPC_URL`, `TRONGRID_URL`, `TONCENTER_URL`, `TONCENTER_API_KEY`) are listed at the top of `web/api/goal.js`. On Netlify or Cloudflare Pages the app works the same, only `/goal` is missing.

**Updates reach users by themselves.** Installed copies download a new version in the background the next time they are opened online, and reload as soon as they are on the home screen, never in the middle of a backup or a recovery.

## Releasing

1. Raise the version in `tools/build.py`, `src/sw.js`, `src/js/app.js`, `src/index.html` and the file headers (the build refuses a mismatch).
2. Update `CHANGELOG.md` and, for security-relevant changes, `docs/AUDIT.md`.
3. Refresh the goal snapshot: `python3 tools/goal.py`.
4. `python3 tools/build.py`, then run the tests.
5. Tag the release (`vX.Y.Z`) and attach `HASHES.txt`, `mnemoniqr-offline.html`, `recover.py`, `LICENSE.txt` and `NOTICE.txt`. The tag is the "corresponding source" the AGPL refers to: every deployed version must have one.
6. Deploy `dist/`. Check the fingerprint shown by the live app against `HASHES.txt`.

## Project structure

```
src/
  index.html          markup (CSP placeholder filled at build time)
  styles.css          design system, light and dark themes
  sw.js               service worker: precaches the app, serves only its own files, installs updates by itself
  kdf-worker.js       Argon2id in a Web Worker (cancellable); bundled with hash-wasm into js/kdf-src.js,
                      loaded with the page under SRI and started from a blob: URL
  manifest.json       PWA manifest
  js/core.js          crypto, BIP39, Shamir, fingerprint, formats (no DOM)
  js/strength.js      password meter, diceware generator, phrase-reuse rules
  js/dicts.js         ranked frequency lists for the meter (from zxcvbn)
  js/eff-words.js     EFF diceware list without BIP39 words
  js/app.js           user interface
  js/i18n.js          all UI strings (English)
  js/donate.js        donation addresses (the only place they are defined)
  js/goal.js          community goal snapshot: target and balance of each address (written by tools/goal.py)
  js/wordlists.js     canonical BIP39 English word list
  vendor/             qrcode, jsQR, hash-wasm (Argon2), noble-secp256k1 + RIPEMD-160
  fonts/              Atkinson Hyperlegible and JetBrains Mono (OFL)
  tests/              in-browser test suite and official BIP39 vectors
web/api/goal.js       live community goal for mnemoniqr.app/goal (Vercel function, no script on the page)
tools/build.py        deterministic build
tools/goal.py         refreshes the goal snapshot (uses tools/goal_collect.js)
tools/addresses.py    donation address checksums (Bitcoin, Ethereum EIP-55, TRON, TON)
tools/recover.py      standalone recovery tool (Python)
tests/                end-to-end, update, PDF/ZIP, support, goal and recovery-tool tests
.github/workflows/    continuous integration
docs/                 user guide, recovery, FAQ, privacy, donations, format, security design, this file
```

## Design constraints

Every change must keep these, and is reviewed against them:

- **No network from the app.** No third-party requests, no analytics, `connect-src 'none'`. Everything the app needs ships with it.
- **No secret at rest.** Phrases, passphrases, passwords, notes and keyfiles live in memory only. Nothing stored may reveal that a backup or a recovery happened.
- **No new runtime dependency** without a strong reason. Vendored libraries are pinned and listed in the README.
- **Backwards compatibility.** Every backup ever written must stay readable, by the app and by `recover.py` (the Spanish word list of 4.0–5.1.0 is the one documented exception).
- **Reproducible build** and a fingerprint covering every script.
- **Tested.** Every change is covered by `tests/tests.html` or an end-to-end test.
- **Licensed.** Project files carry the `SPDX-License-Identifier: AGPL-3.0-only` header; contributors sign the [CLA](../CLA.md) (checked by `.github/workflows/cla.yml`); third-party code keeps its own license and is listed in `NOTICE`.
