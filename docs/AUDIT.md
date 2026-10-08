# Security design and audit history

How MnemoniQR protects a backup, what it does not protect against, and every security review since v5.1.0, newest first. To report a vulnerability, see [SECURITY.md](../SECURITY.md). For the exact byte layout, see [FORMAT.md](FORMAT.md).

## Cryptography at a glance

| Part | Choice |
|---|---|
| Key derivation | Argon2id: Standard 64 MiB × 3 passes, High 128 MiB × 4, Maximum 256 MiB × 4, parallelism 1, random 16-byte salt. PBKDF2-HMAC-SHA256 with 600,000 iterations only if the browser blocks WebAssembly (the app says so). Parameters are stored in the header and bounded before use. |
| Password input | `NFKC(password)` as UTF-8; with a keyfile, `SHA-256(keyfile) ‖ NFKC(password)` |
| Encryption | AES-256-GCM, random 12-byte IV per slot; the 27-byte header is authenticated as additional data |
| Slots | Two slots of identical length in random order: real phrase, and decoy phrase or random bytes |
| Plaintext | BIP39 entropy (not the words), passphrase (NFKD), note, creation time; zero-padded to a multiple of 64 bytes |
| Shares | Shamir's secret sharing over GF(2⁸) of the whole encrypted block, 2 ≤ k ≤ n ≤ 16 |
| Text and QR | Base32 with CRC-32 (`MQR5:` / `MQS5:`), QR alphanumeric mode |
| Randomness | `crypto.getRandomValues` (Web Crypto) |
| Wallet fingerprint | BIP32 master key fingerprint (HMAC-SHA512, secp256k1, HASH160), as wallets display it |

**Quantum computers.** AES-256 keeps about 128 bits of security against Grover's algorithm, the best known quantum attack on symmetric ciphers. Argon2id and SHA-256 are not broken by known quantum algorithms. As against classical attackers, the password is what matters: a generated password keeps a wide margin. MnemoniQR does not change the cryptography of the wallets themselves.

## Threat model

| Threat | Mitigation |
|---|---|
| Printed QR found or photographed | Argon2id (64–256 MiB) + AES-256-GCM; strong password required (≥ 12 characters, ≥ 60 estimated bits), generator of 76 or 120 bits; the password may not reuse a word of the phrase or the passphrase |
| One share found | Shamir shares reveal no information below the threshold |
| Coercion | Decoy password; both slots always exist and always have the same size |
| Tampered QR | GCM authentication over header and ciphertext; KDF parameters bounded before use |
| Typos when typing the backup text | CRC-32 reports a typo before any key derivation |
| Network or third-party compromise | No external resources; CSP `default-src 'none'` and `connect-src 'none'` |
| Script injection | No `innerHTML` with dynamic data; Trusted Types enforced with a single allow-listed policy |
| System keyboard logging or sync | Built-in keyboard for the recovery phrase |
| Clipboard snooping | The *Paste* button and *Copy* ask first; the clipboard is cleared right after a paste, and 30 s after a copy or when returning to the app |
| Screen exposure | Masked entry, blurred results; a decrypted phrase is wiped after 60 s or as soon as the app is backgrounded, a phrase being typed after 2 minutes in the background; privacy screen for the app switcher (best effort) |
| Traces on the device | Nothing secret is stored; nothing stored reveals that a backup or a recovery was made |
| Swapped or modified build | SRI on every script (the Argon2 worker included) and stylesheet, published fingerprints, deterministic build |
| Swapped donation address | Addresses in one file under SRI and the fingerprint, checksummed by the build, listed in `HASHES.txt`, first and last characters highlighted |
| Losing the website | Installed copy works offline; single-file version; `recover.py`; documented format |

**Out of scope:** a compromised operating system or browser, weak or reused passwords, and memory forensics (JavaScript strings cannot be reliably wiped).

## v6.8.0: community goal

The goal shows money, so it is built like the addresses: nothing in the app can be changed from outside.

- **The app still makes no connection.** The figures are a snapshot built into the version (`src/js/goal.js`), loaded under SRI, covered by the fingerprint and stated in `HASHES.txt`. The CSP keeps `connect-src 'none'`. The build refuses a snapshot whose totals do not add up or whose networks are not those of `donate.js`; the app hides one that fails the same checks and keeps the plain support link.
- **Verifiable without trusting MnemoniQR.** The count is the current balance of each published address, and the wallets are not moved until the goal is reached: anyone can open the addresses on independent explorers and add them up. Explorer links are built from the verified address only, open in a new tab with `noopener noreferrer`; the sheet says that the explorer sees the visitor's IP address. Nothing is opened without a tap.
- **The live page (`/goal`, `/api/goal`) is separate from the app.** It is a server function: it reads public explorers and CoinGecko from the server, never from the visitor's browser, and its answer is cached 10 minutes. The page is plain HTML with no script, a stylesheet pinned by hash, `default-src 'none'` and `frame-ancestors 'none'`; every value is escaped. `vercel.json` keeps the app's headers off these two paths (they send their own), the service worker never caches them and never reloads them when it updates the app, so the app's policy is not weakened and they cannot reach the app's cache.
- **Never a false total.** A wallet that cannot be fully read (an unreachable explorer, an RPC error, an empty `eth_call` answer, a missing price for a coin it holds) is left out and named on the page, never counted as zero. `tools/goal.py` refuses to write a snapshot from an incomplete reading or for other addresses.
- Only listed coins and tokens count (contract addresses in `web/api/goal.js`, decimals read on-chain); look-alike tokens sent to the addresses are ignored.

## v6.6.2 review

| Severity | Finding | Fix |
|---|---|---|
| Medium | The download button saved every share in one ZIP: on iPhone, downloads often sync to iCloud, putting a complete set in one account | PNG saves one share again; the ZIP is a separate button with a confirmation |
| Medium | `localStorage` kept a flag set only after a verified real backup, revealing to anyone holding the device that a backup was made (and contradicting the README) | Session memory only; the old flag is deleted on start |
| Low | PNG/ZIP export errors were silent; a double tap exported twice | Errors shown; one export at a time |
| Low | A canvas-read failure while preparing the PDF logo blocked the whole PDF | The PDF is printed without the shield |

## v6.6.1: QR codes stay plain

A logo inside the QR uses part of its error correction, and a backup may have to be read decades later. Tested in a 6.6.0 build, it was removed before release: the codes are plain again, with the same error correction as 6.5.1. The shield appears only in the PDF header, outside the code. Printed PDFs are checked with an independent decoder (ZXing) at 100 and 150 dpi.

## v6.5.0: donation addresses

Donation addresses are a target: a swapped address steals donations, and clipboard malware swaps addresses after copying.

- Defined only in `src/js/donate.js`, loaded under SRI: changing an address changes the build fingerprint. Every release lists them in `HASHES.txt`.
- The build refuses a malformed address (checksums for Bitcoin, Ethereum in its EIP-55 mixed-case form, TRON and TON; TON testnet addresses are refused), and any entry not written in the checked shape, so a typo cannot be published.
- The app shows the network for every address, generates the QR locally and highlights the first and last four characters to compare after pasting.
- No network access and no tracking: the support screens never appear during a flow or with a phrase on screen. (Since 6.8.0 they show the balance of each address, from a snapshot built into the version.)

## v6.4.1 review

| Severity | Finding | Fix |
|---|---|---|
| High | Background wipe (over 2 minutes away) during encryption zeroed the keyfile hash in place and reset the options: the decoy could be sealed with an all-zero keyfile, a split could become a single QR | Encryption works on a snapshot; the wipe waits for it to end (end-to-end test) |
| High | Clipboard clearing after *Copy* failed while the app was in the background, which is when it runs | Retried on return and focus, with feedback |
| High | The Argon2 worker, which receives the password, was loaded by URL without integrity and was not covered by the build fingerprint | Bundled into `js/kdf-src.js` under SRI / CSP hashes, started from a `blob:` URL |
| Medium | First visit showed a false update banner and reloaded | Version comparison |
| Medium | A page frozen in the background could not acknowledge an update and was force-reloaded, losing its state | Modern pages register with the service worker and are never navigated |
| Medium | Camera left on after closing the dialog during the permission prompt, or after a double tap | Start token; late streams are stopped |
| Medium | On-screen keyboard lost focus after each key (disabled buttons); Enter on a key accepted the word | `aria-disabled`; Enter presses the focused key |
| Low | KDF inputs and decrypted plaintext not wiped on some error paths | `finally` blocks |
| Low | Phrase shown if the app went to the background during the fingerprint step | Checked again just before display |
| Low | A deferred-update page could start the newer version's worker | Worker source is part of the page |
| Low | Password meter took seconds on long repetitive input | Primitive repeat units only, scored once |

Known and unchanged: old `MQRv2` backups show a wallet fingerprint even when the BIP39 checksum fails (`recover.py` warns instead).

## v6.4.0: mandatory updates

| Severity | Finding | Fix |
|---|---|---|
| High | An installed app could stay on an old version forever: the new service worker waited for a tap on a toast shown only on the home screen, and the cached shell was served first | The worker activates on install and reloads pages that do not acknowledge it (all versions before 6.4.0); newer pages reload at the first safe moment |
| Medium | Browsers or CDNs could cache `index.html` and `manifest.json` | `no-cache, must-revalidate` on the files that decide the version; worker registered with `updateViaCache: 'none'` |

Security fixes therefore reach every installed copy the next time it is opened online. The offline single file (`mnemoniqr-offline.html`) never updates itself: check its fingerprint against the release.

## v6.3.0 audit

| Severity | Finding | Fix |
|---|---|---|
| High | The largest allowed backup (24 words, 255-byte passphrase and note, decoy) did not fit a QR at maximum error correction, so PDF export failed; at normal correction, cards printed 0.3 mm modules | Creation limits of 100 bytes (QR version ≤ 29 at level H, tested); cards refused below 1.4 pt modules |
| High | Long backup text ran off the bottom of the A4 sheet, cutting the typed-recovery fallback | Text continues on a second page; end-to-end test reads a 2-page PDF back with `recover.py` |
| High | Escape or Cancel during decryption closed the dialog but the phrase was still shown when the key derivation finished | Cancel stops the derivation; a phrase decrypted while hidden is never displayed |
| Medium | The BIP39 passphrase was entered once in a masked field: a typo silently produced a backup of a different wallet | Typed twice; leading/trailing spaces confirmed |
| Medium | About 1 % of generated diceware passwords were rejected by the phrase-reuse rule (a list word containing a phrase word) | The generator skips such words; tested on 300 random phrases |
| Medium | A stale asynchronous checksum result could re-enable *Continue* after the phrase had been edited | Only the latest status update applies |
| Medium | The speed calibration could clear the Cancel handler of a real key derivation | Background runs never own the Cancel button |
| Medium | Decrypted fields were read without bounds checks (a short field would silently shorten a value) in the app and in `recover.py`; v2 JSON errors escaped as raw exceptions | Bounds-checked readers; tests cut every field |
| Low | After a failed share combination the bad share stayed in the set, blocking recovery | The set is cleared with an explanation |
| Low | A password copy was left unwiped after a successful worker run; a Spanish word remained in PNG file names | Fixed |
| Low | The on-screen QR was drawn at 300 device pixels regardless of screen density | Whole device pixels per module |

Reviewed without changes: header authentication, slot handling, KDF parameter bounds, Shamir arithmetic, keyfile mixing, CSP and Trusted Types, service worker scope and update flow, wipe-on-background.

## v6.2.0 additions

| Area | Change |
|---|---|
| Keyfile | Optional second factor. `SHA-256(file)` is prepended to the password before Argon2id; the flag is visible in the header so recovery can ask for the file, and the file is never stored. |
| Passwords | Pattern-based strength estimate; the phrase words and the passphrase are forbidden inside the password; diceware generator that never uses BIP39 words. |
| Text format | `MQR5`/`MQS5`: base32 + CRC-32 so typed text is checked before key derivation. Unknown header flags are refused. |
| Robustness | Fuzzing found that a malformed base64 length and malformed decrypted content could raise raw browser exceptions; both now end as `FormatError`. |
| Longevity | `tools/recover.py` recovers every format without the app. |
| Assurance | End-to-end tests in Chromium, Firefox and WebKit, and CI that checks reproducibility. |

## v6.1.0 audit

| Severity | Finding | Fix |
|---|---|---|
| High | A passphrase longer than 255 bytes was silently truncated, so the backup described a different wallet | Refused with an explanation; covered by a test |
| High | A note longer than 255 bytes could be cut in the middle of a multi-byte character, making the backup undecodable | Refused; a 255-byte note round-trips in the tests |
| High | A decoy phrase identical to the real phrase was accepted, so the decoy password opened the real wallet | Refused before encryption |
| Medium | Closing and reopening the recovery dialog reset the wrong-password waiting time | The lockout is restored on reopen |
| Medium | A page restored from the back/forward cache showed a step whose data had been wiped | Returns to the home screen |
| Low | Images of any pixel size were decoded, which can exhaust memory | Over 40 megapixels refused |
| Low | CSP allowed same-origin `fetch`, `data:`/`blob:` images and media | `connect-src 'none'`, `img-src 'self'`, no `media-src` |
| Low | Expected errors (wrong password, refused decoy) were logged as console errors | Only unexpected errors are logged |

## v5.1.0 audit

### Fixed

| Severity | Finding | Fix |
|---|---|---|
| High | PDF export failed with a script error since v5 (a refactor renamed an internal drawing helper) | Fixed; PDF generation now covered by the end-to-end test, including accented text |
| High | The page reloaded on the very first visit, when the service worker took control, which could erase a phrase being typed | Reload only after the user accepts an update |
| High | An available update could be applied in the middle of a flow, reloading and losing the user's input | Updates are offered only on the home screen |
| Medium | The install prompt event could fire before start-up finished and be lost | Captured as soon as the script runs |
| Medium | The service worker answered every navigation with the app shell, making other pages (e.g. tests) unreachable once installed | Only the app's own URL is served from the cache |
| Medium | If the BIP39 word lists failed the integrity check, recovery was still allowed and could show wrong words | Encrypting, recovering and practising are all disabled |
| Medium | A global test hook exposed the decrypted words to any script on the page | Removed |
| Medium | In practice mode with a decoy, the random decoy phrase was generated after its step had rendered | Awaited before rendering |
| Low | Typographic punctuation (’ “ ” – …) printed as `?` in PDFs | Mapped to the WinAnsi encoding |
| Low | The build fingerprint ignored the stylesheet, which can hide or alter warnings | Included, order-independent |
| Low | The service worker deleted every cache on the origin, not just its own | Only `mnemoniqr-*` caches are removed |
| Low | Untranslated text flashed while word lists were hashed at start-up | Translations applied first |
| Low | iPhone instructions assumed Safari | Generic "Share" wording (iOS 16.4+ browsers can install too) |

### Optimised

- BIP39 prefix lookups (smart keyboard, suggestions, validation) use binary search over a sorted index instead of scanning 2,048 words on every keystroke. Results are deliberately not cached, because typed prefixes are part of the secret. A test checks the index against a linear scan for every prefix.
- The build now refuses to run if a word list does not match its pinned hash or if a file referenced by the page or the service worker is missing, writes deterministic output, and can omit the test page (`--no-tests`).

### Reviewed without changes

Key derivation and fallback rules, slot handling and timing, Shamir arithmetic and share validation, padding, KDF parameter bounds, Trusted Types policy, clipboard handling, focus management in dialogs, and the wipe-on-background behaviour.

## Reporting a vulnerability

See [SECURITY.md](../SECURITY.md).
