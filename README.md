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
- [Verifying your copy](#verifying-your-copy)
- [Building, testing and deploying](#building-testing-and-deploying)
- [Project structure](#project-structure)
- [Languages](#languages)
- [Privacy](#privacy)
- [Compatibility with older backups](#compatibility-with-older-backups)
- [Contributing and reporting vulnerabilities](#contributing-and-reporting-vulnerabilities)
- [Third-party components](#third-party-components)

## Features

**Encryption**
- Argon2id key derivation (64, 128 or 256 MiB, with the time it takes on your device shown before you choose) and AES-256-GCM authenticated encryption.
- Falls back to PBKDF2-SHA256 with 600,000 iterations only when the browser blocks WebAssembly, and says so.
- The QR reveals nothing: the note, date, BIP39 passphrase and number of words are all encrypted and padded.

**Entry without leaks**
- A built-in keyboard for the recovery phrase, so the system keyboard never sees the words (no learning, syncing or logging).
- The keyboard disables impossible letters, suggests words and accepts 4-letter prefixes, as BIP39 allows. A physical keyboard also works on desktop.
- Words are masked while you type, and BIP39 checksums are validated before anything is encrypted.

**Backups that survive real life**
- **Shamir shares:** split a backup into 2-of-3, 3-of-5 or any k-of-n up to 16. Fewer shares than required reveal nothing; the password is still needed after combining.
- **Decoy wallet:** a second password opens a different phrase. Every QR has two equally sized slots, so nobody can tell whether a decoy exists.
- **BIP39 passphrase** (the "25th word") stored encrypted alongside the phrase.
- **Wallet fingerprint** (BIP32 master fingerprint) shown when you encrypt and decrypt, so you can check the backup matches your wallet in Sparrow, Electrum, Coldcard and others.
- **Verification:** after encrypting, MnemoniQR re-reads the QR from its pixels and asks for the password from memory, without showing the phrase.
- **Printing:** vector PDF as an A4 sheet with instructions or as cut-out cards (10 per page), with normal or maximum error correction, plus a typed backup text in case the QR is damaged.
- **Practice mode** with a random test seed. Practice QRs are marked as such.

**App**
- Installable PWA with an install sheet (native prompt on Android and desktop, step-by-step instructions on iPhone and iPad).
- Interface in English, Spanish, Catalan, French and Russian; light and dark themes; accessible dialogs and keyboard navigation.
- Seeds are erased from the screen after 60 seconds, when you leave the app, and when the page is closed.

## How it works

```
recovery phrase ──► BIP39 entropy (16–32 bytes) + passphrase + note
                       │ padded to a multiple of 64 bytes
password ──► Argon2id (random 16-byte salt) ──► AES-256-GCM key
                       │
            header (27 bytes, authenticated) + 2 slots (real + decoy or random)
                       │
                    MQR4:<base64url>  ──► QR code
                       │ optional
              Shamir split over GF(256) ──► MQS4:<base64url> shares
```

The full byte layout is documented in [docs/FORMAT.md](docs/FORMAT.md).

## Security model

**What MnemoniQR protects against**
- Someone finding your printed QR: without the password they face Argon2id, which makes large-scale guessing on GPUs expensive.
- Someone finding one share: a single Shamir share carries no information at all.
- Someone forcing you to decrypt: the decoy password opens a decoy wallet, and the QR does not reveal that a decoy exists.
- A modified QR: AES-GCM authentication rejects any change, including to the header and KDF parameters.
- Network exposure: the Content Security Policy blocks every outside connection and the app loads no third-party code, fonts or images.

**What it cannot protect against**
- A weak or reused password. Whoever has the QR can guess offline without limit. The dice button generates a password of about 120 bits.
- A compromised device or browser (malware, malicious extensions, screen recording). Use a clean device in airplane mode, or the single-file version on an offline computer.
- Browser memory: JavaScript cannot guarantee that every copy of the phrase is wiped. Close the tab when you finish.
- Losing the password, or enough shares. There is no recovery service.

A full list of what was reviewed and changed is in [docs/SECURITY.md](docs/SECURITY.md).

## Using MnemoniQR

1. **Encrypt a seed.** Enter the phrase with the built-in keyboard and choose its language (English or Spanish word list). The app checks the BIP39 checksum and shows the wallet fingerprint.
2. **Options.** Add an encrypted note, your BIP39 passphrase, a decoy wallet, or split the backup into shares.
3. **Password.** Pick or generate a strong password and a protection level.
4. **Verify, then print.** Tap *Check I can recover it*, then export a PDF or PNG. Store the password and each share in different places.
5. **Recover.** Tap *Recover from a QR*, scan or upload the QR (or enough shares in any order) and enter the password.

Before trusting a backup, run through *Practice a recovery* once.

## Verifying your copy

Every release has a **build fingerprint**, shown in *How it protects you* inside the app and published in `HASHES.txt`. It is derived from the Subresource Integrity hashes of every script and the stylesheet (or the CSP hashes in the single-file version), so any change to the code changes the fingerprint.

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
| `dist/tests/tests.html` | In-browser test suite |

**Tests.** Serve `dist/` (for example `cd dist && python3 -m http.server`) and open `/tests/tests.html`. It runs 25 tests in the browser: the official BIP39 vectors in English and Spanish (entropy, seed with passphrase, BIP32 master key), the known fingerprint `73c5da0a`, the prefix index, Shamir combinations and uniformity, v4 encryption, tampering, abusive parameters, decoys, shares end to end, and v2/v3 compatibility.

**Deploying.** Publish the contents of `dist/`. Keep the provided headers: `frame-ancestors`, `Permissions-Policy`, HSTS and the cross-origin policies only work as HTTP headers. The site must be served over HTTPS for the service worker, camera and installation to work.

## Project structure

```
src/
  index.html          markup (CSP placeholder filled at build time)
  styles.css          design system, light and dark themes
  sw.js               service worker: precaches the app, serves only its own files
  kdf-worker.js       Argon2id in a Web Worker (cancellable)
  manifest.json       PWA manifest
  js/core.js          crypto, BIP39, Shamir, fingerprint, formats (no DOM)
  js/app.js           user interface
  js/i18n.js          UI strings for es, ca, en, fr, ru
  js/wordlists.js     canonical BIP39 word lists (English, Spanish)
  vendor/             qrcode, jsQR, hash-wasm (Argon2), noble-secp256k1 + RIPEMD-160
  fonts/              Atkinson Hyperlegible and JetBrains Mono (OFL)
  tests/              in-browser test suite and official BIP39 vectors
tools/build.py        deterministic build
docs/FORMAT.md        backup and share formats
docs/SECURITY.md      audit notes and threat model
```

## Languages

The interface is available in English, Spanish, Catalan, French and Russian, and follows your browser language by default.

**The interface language never changes your BIP39 words.** The word list (English or Spanish) is chosen separately when you enter the phrase and is stored inside the encrypted backup, so a phrase always decrypts in the language it was written in.

With the Russian interface, PDFs are generated in English because the standard PDF fonts have no Cyrillic glyphs. Everything on screen and in PNG exports is in Russian.

## Privacy

- No analytics, no network requests, no third-party code, fonts or images.
- Recovery phrases, passwords and passphrases are never written to storage.
- Only two non-sensitive preferences are kept in `localStorage`: the interface language and whether you dismissed the install prompt.
- Copying a phrase asks for confirmation and clears the clipboard after 30 seconds when the browser allows it.

## Compatibility with older backups

MnemoniQR reads every earlier format: `MQR4:` and `MQS4:` (v4 and later), `MQR3:` (v3) and `MQRv2:` (v2). Backups made with older versions open normally, and the app recommends re-encrypting them with the current version for Argon2id protection.

## Contributing and reporting vulnerabilities

Issues and pull requests are welcome. Please keep the project's constraints: no third-party requests, no new runtime dependencies without a strong reason, and every change covered by `tests/tests.html` or the end-to-end flow.

Please report security vulnerabilities privately (GitHub → *Security* → *Report a vulnerability*) rather than in a public issue.

## Third-party components

| Component | Version | License |
|---|---|---|
| [qrcode](https://github.com/soldair/node-qrcode) | 1.5.4 | MIT |
| [jsQR](https://github.com/cozmo/jsQR) | 1.4.0 | Apache 2.0 |
| [hash-wasm](https://github.com/Daninet/hash-wasm) (Argon2id) | 4.12.0 | MIT |
| [@noble/secp256k1](https://github.com/paulmillr/noble-secp256k1) | 2.2.3 | MIT |
| [@noble/hashes](https://github.com/paulmillr/noble-hashes) (RIPEMD-160) | 1.7.1 | MIT |
| BIP39 word lists via [@scure/bip39](https://github.com/paulmillr/scure-bip39) | 1.5.4 | MIT |
| [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) | — | SIL OFL 1.1 |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | — | SIL OFL 1.1 |

---

MnemoniQR is provided "as is", without warranty of any kind. See [LICENSE](LICENSE).
