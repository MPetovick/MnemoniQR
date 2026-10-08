# MnemoniQR

**Encrypt your BIP39 recovery phrase into one or more QR codes — entirely on your device.**

MnemoniQR turns a wallet recovery phrase into an encrypted QR code you can print and store on paper. Encryption, decryption, QR generation and scanning all happen locally in your browser. The app loads nothing from third parties, works offline once installed, and is also available as a single HTML file for computers that never go online.

- Live app: <https://mnemoniqr.vercel.app>
- Source code: <https://github.com/MPetovick/MnemoniQR>
- License: [Apache 2.0](LICENSE)

> MnemoniQR protects a backup, it does not replace good habits. Use a long, unique password, store it separately from the QR, and practise a recovery before you rely on it.

---

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Security model](#security-model)
- [Using MnemoniQR](#using-mnemoniqr)
- [Recovering without the app](#recovering-without-the-app)
- [Verifying your copy](#verifying-your-copy)
- [Building, testing and deploying](#building-testing-and-deploying)
- [Project structure](#project-structure)
- [Word list](#word-list)
- [Privacy](#privacy)
- [Compatibility with older backups](#compatibility-with-older-backups)
- [Contributing and reporting vulnerabilities](#contributing-and-reporting-vulnerabilities)
- [Support the project](#support-the-project)
- [Third-party components](#third-party-components)

## Features

**Encryption**
- Argon2id key derivation (64, 128 or 256 MiB, with the time it takes on your device shown before you choose) and AES-256-GCM authenticated encryption.
- Falls back to PBKDF2-SHA256 with 600,000 iterations only when the browser blocks WebAssembly, and says so.
- The QR reveals nothing: the note, date, BIP39 passphrase and number of words are all encrypted and padded.
- **Optional keyfile** as a second factor: any file (a photo, a document) whose SHA-256 is mixed into the key derivation. The file itself is never stored.

**Passwords**
- Generate 6 diceware words (EFF list, about 76 bits, never a BIP39 word) or 20 random characters (120 bits).
- A pattern-based strength meter in the spirit of zxcvbn spots common passwords, dictionary words, names, keyboard runs, sequences, repeats and dates, and says why a password is weak.
- A password may not contain a word of the recovery phrase or the BIP39 passphrase: those are the first guesses of anyone holding the QR.

**Entry without leaks**
- A built-in keyboard for the recovery phrase, so the system keyboard never sees the words (no learning, syncing or logging).
- The keyboard disables impossible letters, suggests words and accepts 4-letter prefixes, as BIP39 allows. A physical keyboard also works on desktop.
- Words are masked while you type, and BIP39 checksums are validated before anything is encrypted.

**Backups that survive real life**
- **Shamir shares:** split a backup into 2-of-3, 3-of-5 or any k-of-n up to 16. Fewer shares than required reveal nothing; the password is still needed after combining.
- **Decoy wallet:** a second password opens a different phrase. Every QR has two equally sized slots, so nobody can tell whether a decoy exists.
- **BIP39 passphrase** (the "25th word") stored encrypted alongside the phrase. It is typed twice, because a mistyped passphrase is a different wallet. Passphrase and note are limited to 100 bytes each, so even the largest backup stays a printable QR.
- **Wallet fingerprint** (BIP32 master fingerprint) shown when you encrypt and decrypt, so you can check the backup matches your wallet in Sparrow, Electrum, Coldcard and others.
- **Verification:** after encrypting, MnemoniQR re-reads the QR from its pixels and asks for the password from memory, without showing the phrase.
- **Printing:** vector PDF as an A4 sheet with instructions or as cut-out cards (10 per page), with normal or maximum error correction. Long backup text continues on a second page instead of running off the sheet, and cards are refused when a code would be too dense to print legibly.
- **Typed recovery:** the text printed under each QR can be typed back into the app if the QR is damaged. It is base32 in groups of four (any case, spaces ignored, `0`/`1` read as `O`/`I`) with a CRC-32, so a typo is reported as a typo instead of "wrong password".
- **Compact QR codes:** the `MQR5` text uses the QR alphanumeric mode, about 20 % fewer modules than before, so codes print larger and scan more easily.
- **Practice mode** with a random test seed. Practice QRs are marked as such.

**App**
- Installable PWA with an install sheet (native prompt on Android and desktop, step-by-step instructions on iPhone and iPad).
- English interface and the English BIP39 word list; light and dark themes; accessible dialogs and keyboard navigation.
- Seeds are erased from the screen after 60 seconds, when you leave the app, and when the page is closed.

## How it works

```
recovery phrase ──► BIP39 entropy (16–32 bytes) + passphrase + note
                       │ padded to a multiple of 64 bytes
password ──► Argon2id (random 16-byte salt) ──► AES-256-GCM key
                       │
            header (27 bytes, authenticated) + 2 slots (real + decoy or random)
                       │
keyfile (optional) ──► SHA-256, prepended to the password before Argon2id
                       │
              MQR5:<base32 + CRC-32>  ──► QR code (alphanumeric mode)
                       │ optional
              Shamir split over GF(256) ──► MQS5:<base32 + CRC-32> shares
```

The full byte layout is documented in [docs/FORMAT.md](docs/FORMAT.md).

## Security model

**What MnemoniQR protects against**
- Someone finding your printed QR: without the password they face Argon2id, which makes large-scale guessing on GPUs expensive.
- Someone finding one share: a single Shamir share carries no information at all.
- Someone forcing you to decrypt: the decoy password opens a decoy wallet, and the QR does not reveal that a decoy exists. The app refuses a decoy phrase identical to the real one.
- A modified QR: AES-GCM authentication rejects any change, including to the header and KDF parameters.
- Network exposure: the Content Security Policy forbids the page from making any network request at all (`connect-src 'none'`) and the app loads no third-party code, fonts or images.

**What it cannot protect against**
- A weak or reused password. Whoever has the QR can guess offline without limit. Use the generator: 6 words (about 76 bits) or 20 characters (120 bits).
- A compromised device or browser (malware, malicious extensions, screen recording). Use a clean device in airplane mode, or the single-file version on an offline computer.
- Browser memory: JavaScript cannot guarantee that every copy of the phrase is wiped. Close the tab when you finish.
- Losing the password, the keyfile, or enough shares. There is no recovery service. A keyfile must stay byte-for-byte identical: an edited or re-saved copy will not work.

A full list of what was reviewed and changed is in [docs/SECURITY.md](docs/SECURITY.md).

## Using MnemoniQR

1. **Encrypt a seed.** Enter the phrase with the built-in keyboard. The app checks the BIP39 checksum and shows the wallet fingerprint.
2. **Options.** Add an encrypted note, your BIP39 passphrase, a decoy wallet, a keyfile, or split the backup into shares.
3. **Password.** Generate 6 words or 20 characters, or choose your own (the meter explains what is weak), then pick a protection level.
4. **Verify, then print.** Tap *Check I can recover it*, then export a PDF or PNG. Store the password and each share in different places.
5. **Recover.** Tap *Recover from a QR*, then scan, upload or type the QR text (or enough shares, in any order), add the keyfile if the backup has one, and enter the password.

Before trusting a backup, run through *Practice a recovery* once.

## Recovering without the app

`tools/recover.py` (also shipped as `recover.py` in every release) decrypts any MnemoniQR backup without the app, so a backup stays recoverable even if this website disappears. It reads every format ever written (`MQR5`/`MQS5`, `MQR4`/`MQS4`, `MQR3`, `MQRv2`), combines shares, supports keyfiles and decoys, and prints the wallet fingerprint.

```bash
pip install argon2-cffi cryptography
python3 recover.py                        # paste the text of the QR (or several shares), then Ctrl-D
python3 recover.py --keyfile photo.jpg backup.txt
```

Get the text by scanning the QR with any offline QR reader, or type the text printed under it. Run it on an offline computer. The format it implements is documented in [docs/FORMAT.md](docs/FORMAT.md).

## Verifying your copy

Every release has a **build fingerprint**, shown in *How it protects you* inside the app and published in `HASHES.txt`. It is derived from the Subresource Integrity hashes of every script and the stylesheet (or the CSP hashes in the single-file version), including the Argon2 worker that receives the password, so any change to the code changes the fingerprint.

To check a release:

1. Compare the fingerprint in the app with `HASHES.txt` in the repository release.
2. For full assurance, rebuild from source (below): the build is deterministic, so your `dist/HASHES.txt` must match the published one byte for byte.

## Building, testing and deploying

Requirements: Python 3.8+ (standard library only). No Node.js or npm is needed to build.

```bash
python3 tools/build.py            # writes dist/
python3 tools/build.py --no-tests # same, without the test page
```

The build checks that the BIP39 word lists match the hashes pinned in `src/js/core.js` and that every file referenced by `index.html` and the service worker exists, then writes:

| Output | Purpose |
|---|---|
| `dist/` | The PWA, with a strict CSP, Trusted Types and SRI |
| `dist/mnemoniqr-offline.html` | Everything in one file, for offline computers (open it directly, no server needed) |
| `dist/HASHES.txt` | SHA-256 of every file and the build fingerprints |
| `dist/vercel.json`, `dist/_headers` | HTTP security headers for Vercel, Netlify or Cloudflare Pages |
| `dist/recover.py` | Standalone recovery tool |
| `dist/tests/tests.html` | In-browser test suite |

**Unit tests.** Serve `dist/` (for example `cd dist && python3 -m http.server`) and open `/tests/tests.html`. It runs 39 tests in the browser: the official BIP39 vectors, the known fingerprint `73c5da0a`, the prefix index, Shamir, encryption, tampering, decoys, shares, keyfiles, the MQR5 text format (every single-character typo is caught), typed input, MQR4/v3/v2 compatibility, the password meter and generators, fuzzing of every parser with thousands of malformed inputs and hundreds of mutated backups, a check that decrypted fields are never silently shortened, a check that the largest allowed backup fits a QR at maximum error correction, and a speed check of the password meter on long repetitive input.

**Recovery-tool tests.** `python3 tests/test_recover.py` fuzzes every parser in `tools/recover.py`: it must only ever fail with a readable error, never a traceback.

**End-to-end tests.** `tests/e2e.py` drives the real app in Chromium, Firefox and WebKit: a full backup with keyboard entry, passphrase (including a mistyped confirmation), decoy, keyfile, shares and a diceware password; cancelling during decryption; the largest allowed backup printed on two pages and read back by `tools/recover.py`; verification; the PDF; recovery by typing the printed text; recovery of the same text with `tools/recover.py`; the install sheet; and the offline single file. `tests/update_e2e.py OLD_DIST` checks that an installed older version updates by itself, never in the middle of a flow; `tests/donate_e2e.py` checks the support screens (QR decodes to the exact address, copy, once-only line) and that a mistyped address never builds.

```bash
pip install playwright argon2-cffi cryptography && python -m playwright install
python3 tools/build.py && python3 tests/e2e.py --browser all
```

**Continuous integration.** `.github/workflows/ci.yml` builds, checks that the build is reproducible, runs the recovery-tool tests and runs the end-to-end tests in all three browsers on every push.

**Deploying.** Publish the contents of `dist/`. Keep the provided headers: `frame-ancestors`, `Permissions-Policy`, HSTS and the cross-origin policies only work as HTTP headers. The site must be served over HTTPS for the service worker, camera and installation to work. `index.html`, `sw.js` and `manifest.json` must not be cached (the provided headers do this), otherwise installed copies see new versions late.

**Updates.** Installed copies update by themselves the next time they are opened online: the new version is downloaded in the background and the app reloads as soon as it is on the home screen, never in the middle of a backup or a recovery.

## Project structure

```
src/
  index.html          markup (CSP placeholder filled at build time)
  styles.css          design system, light and dark themes
  sw.js               service worker: precaches the app, serves only its own files, installs updates by itself
  kdf-worker.js       Argon2id in a Web Worker (cancellable); the build bundles it with hash-wasm into
                      js/kdf-src.js, loaded with the page under SRI and started from a blob: URL
  manifest.json       PWA manifest
  js/core.js          crypto, BIP39, Shamir, fingerprint, formats (no DOM)
  js/strength.js      password meter, diceware generator, phrase-reuse rules
  js/dicts.js         ranked frequency lists for the meter (from zxcvbn)
  js/eff-words.js     EFF diceware list without BIP39 words
  js/app.js           user interface
  js/i18n.js          all UI strings (English)
  js/donate.js        donation addresses (the only place they are defined)
  js/wordlists.js     canonical BIP39 English word list
  vendor/             qrcode, jsQR, hash-wasm (Argon2), noble-secp256k1 + RIPEMD-160
  fonts/              Atkinson Hyperlegible and JetBrains Mono (OFL)
  tests/              in-browser test suite and official BIP39 vectors
tools/build.py        deterministic build
tools/recover.py      standalone recovery tool (Python)
tests/e2e.py          end-to-end tests (Chromium, Firefox, WebKit)
tests/test_recover.py robustness tests for the recovery tool
.github/workflows/    continuous integration
docs/FORMAT.md        backup and share formats
docs/SECURITY.md      audit notes and threat model
```

## Word list

MnemoniQR uses the English BIP39 word list, the one used by virtually every wallet. Words can be typed in upper or lower case, and any word can be entered by its first four letters.

Versions 4.0 to 5.1.0 also accepted the Spanish word list. Backups made that way are recognised and refused with a clear message rather than decoded: the same entropy shown as English words would be a different wallet. Open them with MnemoniQR 5.1.0 and re-encrypt the phrase.

## Privacy

- No analytics, no network requests, no third-party code, fonts or images.
- Recovery phrases, passwords and passphrases are never written to storage.
- The only thing kept in `localStorage` is whether you dismissed the install prompt.
- Copying a phrase asks for confirmation and clears the clipboard after 30 seconds when the browser allows it.

## Compatibility with older backups

MnemoniQR reads every earlier format: `MQR4:` and `MQS4:` (4.0–6.1), `MQR3:` (v3) and `MQRv2:` (v2). Since 6.2.0 it writes `MQR5:` and `MQS5:`, which versions before 6.2.0 cannot read: keep using 6.2.0 or later (or `recover.py`) for new backups. Backups made with older versions open normally, and the app recommends re-encrypting them with the current version for Argon2id protection. The only exception is backups written with the Spanish word list in 4.0–5.1.0 (see [Word list](#word-list)).

## Contributing and reporting vulnerabilities

Issues and pull requests are welcome. Please keep the project's constraints: no third-party requests, no new runtime dependencies without a strong reason, and every change covered by `tests/tests.html` or the end-to-end flow.

Please report security vulnerabilities privately (GitHub → *Security* → *Report a vulnerability*) rather than in a public issue.

## Support the project

MnemoniQR is free, open source and has no ads, accounts or tracking. Donations pay for security audits and new features.

The donation addresses live in one file, [`src/js/donate.js`](src/js/donate.js), and nowhere else:

- `tools/build.py` refuses to build if an address is malformed (TRON Base58Check, Ethereum EIP-55 checksum, Bitcoin Bech32/Bech32m or Base58Check).
- The file is loaded under Subresource Integrity, so the addresses are covered by the build fingerprint, and every release lists them in `HASHES.txt`. An address cannot be swapped without changing the fingerprint.
- Always copy an address from the app or from the release's `HASHES.txt`, and check its first and last four characters after pasting.

In the app, support never interrupts: a line in the footer, one quiet line on the home screen after your first verified backup (shown once per device, never during a flow or in practice mode), and a mention in *How it protects you*. The app cannot know whether anyone donated. With no address configured, none of this is shown.

To test the support screens without real addresses: `python3 tools/build.py --out /tmp/mqr-test --donate-test` (public example addresses; never deploy such a build).

## Third-party components

| Component | Version | License |
|---|---|---|
| [qrcode](https://github.com/soldair/node-qrcode) | 1.5.4 | MIT |
| [jsQR](https://github.com/cozmo/jsQR) | 1.4.0 | Apache 2.0 |
| [hash-wasm](https://github.com/Daninet/hash-wasm) (Argon2id) | 4.12.0 | MIT |
| [@noble/secp256k1](https://github.com/paulmillr/noble-secp256k1) | 2.2.3 | MIT |
| [@noble/hashes](https://github.com/paulmillr/noble-hashes) (RIPEMD-160) | 1.7.1 | MIT |
| BIP39 English word list via [@scure/bip39](https://github.com/paulmillr/scure-bip39) | 1.5.4 | MIT |
| Password frequency lists from [zxcvbn](https://github.com/dropbox/zxcvbn) | 4.4.2 | MIT |
| [EFF large diceware word list](https://www.eff.org/dice) | — | CC BY 3.0 |
| [argon2-cffi](https://github.com/hynek/argon2-cffi), [cryptography](https://github.com/pyca/cryptography) (recover.py only) | — | MIT / Apache 2.0 |
| [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) | — | SIL OFL 1.1 |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | — | SIL OFL 1.1 |

---

MnemoniQR is provided "as is", without warranty of any kind. See [LICENSE](LICENSE).
