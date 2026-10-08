# Changelog

## 6.4.1 — review fixes

Fixes for a full review of 6.4.0. Details in [docs/SECURITY.md](docs/SECURITY.md).

- **First visit:** no more false "new version installed" banner and reload. The page compares the version announced by the service worker with its own.
- **Frozen tabs are never force-reloaded.** Pages from 6.4.1 on say hello to the service worker, which keeps their ids; only older pages that do not answer are reloaded.
- **Background wipe during encryption:** coming back after more than 2 minutes while the key derivation was running wiped the form under it. The decoy could be sealed with an all-zero keyfile (never openable) and a 2-of-3 split could silently become one QR. The encryption now works on a snapshot, and the wipe waits until it ends.
- **Clipboard:** clearing after *Copy* failed whenever the app was in the background (the usual case). It is retried when the app is visible and focused again, with a message saying whether it worked.
- **Verified Argon2 worker:** the worker that receives the password now comes with the page (`js/kdf-src.js`, under SRI and the build fingerprint) and starts from a `blob:` URL. Before, it was loaded by URL without an integrity check, and a page waiting to update could start the worker of the newer version.
- **Camera:** closing the dialog during the permission prompt, or tapping *Scan* twice, could leave the camera on.
- **On-screen keyboard:** keys that cannot follow are marked `aria-disabled` instead of `disabled`, so focus stays on the key for screen readers and keyboards; Enter on a focused key types it.
- **Secrets wiped on every error path** of encryption and decryption (cancel, out of memory, same password, malformed content).
- **Decryption:** a phrase decrypted while the app went to the background during the wallet-fingerprint step is no longer shown.
- **Password meter:** up to 190 times faster on long repetitive input (300 repeated characters took 10 s, now about 50 ms), with the same scores.
- Tests: new end-to-end checks for each fix; the update test covers the first visit and a frozen tab, starting from 6.3.0 and 6.4.0.

## 6.4.0 — mandatory updates

- **Updates install by themselves.** A new service worker activates as soon as it has downloaded the new version (`skipWaiting`) and takes over every open window. Before, it waited for a tap on an *Update* toast that only appeared on the home screen, so an installed app could stay on an old version indefinitely.
- **Old installs are rescued too.** Pages from v5.x to v6.3 never answer the new worker, so they are reloaded into the new version automatically, the next time the app is opened while online.
- **Never in the middle of a flow.** Pages from v6.4.0 on reload at the first safe moment: on the home screen, with no dialog open and nothing being computed. Mid-flow, a banner says the update will load on the way back home.
- **Checks for updates** on start, every time the app comes back to the foreground, when the connection returns and every 30 minutes; registration with `updateViaCache: 'none'`.
- **HTTP headers:** `/`, `/index.html`, `/sw.js` and `/manifest.json` are served with `Cache-Control: no-cache, max-age=0, must-revalidate`, so no HTTP cache can hide a new version.
- `tests/update_e2e.py`: installs an older build, deploys the current one and checks that it takes over with no user action, that a mid-flow update waits for the home screen, and that a home-screen update applies at once.

## 6.3.0 — production hardening

Audit of 6.2.0. Details in [docs/SECURITY.md](docs/SECURITY.md).

- **Printable at any size:** passphrase and note are limited to 100 bytes for new backups (still read up to 255). Before, the largest backup did not fit a QR at maximum error correction (PDF export failed) and printed cards with 0.3 mm modules.
- **PDF:** long backup text continues on a second page instead of being cut at the bottom of the sheet; cards are refused when a code would be too dense to print.
- **Passphrase typed twice**, with a warning for leading or trailing spaces.
- **Diceware generator** no longer produces passwords that the phrase-reuse rule rejects (about 1 in 100 did, e.g. "thankful" with "thank" in the phrase).
- **Cancel really cancels:** Escape or Cancel during decryption stops the key derivation; before, the dialog closed and the phrase appeared anyway. A phrase decrypted while the app is in the background is never put on screen.
- **Race conditions:** a stale checksum result can no longer re-enable *Continue* for an incomplete phrase; the speed calibration can no longer take over the Cancel button.
- **Strict decoding:** decrypted fields are bounds-checked in the app and in `recover.py`; v2/v3 parsing errors end as readable errors.
- **Shares:** a combination that fails is cleared so the user can start again; the decoy-identical-to-real check happens as soon as the decoy is entered.
- **Sharper on-screen QR** (whole device pixels per module).
- `tests/test_recover.py` (fuzzing of the recovery tool), 38 in-browser tests, new end-to-end checks; CI runs all of them.

## 6.2.0

- **Typed recovery:** a new *Type the backup text* option accepts the text printed under the QR (any case, spaces ignored, several shares at once). The PDF prints it in groups of four.
- **New text format `MQR5`/`MQS5`:** base32 with a CRC-32. QR codes use alphanumeric mode (about 20 % fewer modules) and a typo is reported as a typo. `MQR4`/`MQS4` are still read; versions before 6.2.0 cannot read `MQR5`.
- **Standalone recovery tool** `tools/recover.py` (Python) for every format, with shares, keyfiles, decoys and the wallet fingerprint. Shipped as `recover.py` in every release.
- **Keyfile** as an optional second factor (header flag bit 1).
- **Passwords:** diceware generator (6 EFF words without BIP39 words, about 76 bits), pattern-based strength meter with explanations, and a rule against reusing phrase words or the passphrase.
- **Fuzzing** of every parser and of hundreds of mutated backups; it found two error paths that escaped as raw browser exceptions (now `FormatError`).
- **End-to-end tests** for Chromium, Firefox and WebKit, and a GitHub Actions workflow that also checks the build is reproducible.

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

## 6.0.0

- **Breaking:** English only. The interface languages (Spanish, Catalan, French, Russian) and the Spanish BIP39 word list are removed.
- Backups written with the Spanish word list in 4.0–5.1.0 are detected and refused with an explanation instead of being shown as English words, which would be a different wallet. Open them with 5.1.0 and re-encrypt.
- Smaller app: no Cyrillic or extended-Latin font files, no language selectors, no language preference stored.
- 22 in-browser tests, including the refusal of Spanish-list backups.

## 5.1.0 — production release

- Audit fixes: broken PDF export, unexpected reload on first visit, updates applied mid-flow, lost install prompt, service worker shell over-matching, recovery allowed with failed word-list integrity, global debug hook, practice decoy race, PDF punctuation, stylesheet missing from the build fingerprint, over-broad cache cleanup. Details in [docs/SECURITY.md](docs/SECURITY.md).
- Binary-search BIP39 lookups with no caching of typed prefixes.
- Links to the README and the source code in the footer and in *How it protects you*, with the Apache 2.0 notice.
- Build pre-flight checks, deterministic output, `--no-tests`, `X-Frame-Options`.
- All code comments, documentation and the test suite in English. 25 in-browser tests.

## 5.0.0

- New "Paper" interface, install bottom sheet (native prompt or iOS steps), dark theme, self-hosted fonts.
- Interface in English, Spanish, Catalan, French and Russian.

## 4.0.0

- Built-in keyboard, Argon2id in a cancellable worker with three levels, Trusted Types, SRI and build fingerprint.
- Shamir shares, decoy wallet, BIP39 passphrase, BIP32 wallet fingerprint, practice mode, printable templates, single-file offline build, Spanish word list, test suite.

## 3.0.0

- Security rewrite: canonical BIP39 list, Argon2id, no third-party resources, encrypted metadata, strict CSP, working offline mode.
