# MnemoniQR

**Encrypt your BIP39 recovery phrase into one or more QR codes — entirely on your device.**

MnemoniQR turns a wallet recovery phrase into an encrypted QR code you can print and store on paper. Someone who finds the paper sees a code that is useless without your password. Encryption, decryption, QR generation and scanning all happen locally in your browser. The app loads nothing from third parties, works offline once installed, and is also available as a single HTML file for computers that never go online.

- **App:** <https://mnemoniqr.app>
- **Community goal:** <https://mnemoniqr.app/goal>
- **Source code:** <https://github.com/MPetovick/MnemoniQR>
- **License:** [GNU AGPL-3.0](LICENSE) · [commercial license](COMMERCIAL.md) · [NOTICE](NOTICE)

> MnemoniQR protects a backup, it does not replace good habits. Use a long, unique password, store it separately from the QR, and practise a recovery before you rely on it.

---

## Documentation

| I want to… | Read |
|---|---|
| Make my first backup, step by step | [User guide](docs/USER_GUIDE.md) |
| Know which options to use (passphrase, decoy, keyfile, shares) | [User guide · Choosing the options](docs/USER_GUIDE.md#choosing-the-options) |
| Store the backup and the password safely | [User guide · Storing the backup](docs/USER_GUIDE.md#storing-the-backup) |
| Recover without the app, or leave instructions to my heirs | [Recovery](docs/RECOVERY.md) |
| Find a quick answer | [FAQ](docs/FAQ.md) |
| Know what the app stores and sends | [Privacy](docs/PRIVACY.md) |
| Understand the security and the cryptography | [Security design and audit history](docs/AUDIT.md) |
| Read the byte layout of a backup | [Format](docs/FORMAT.md) |
| Donate, or follow the community goal | [Donations](docs/DONATIONS.md) |
| Report a vulnerability | [Security policy](SECURITY.md) |
| Build, test, deploy or contribute | [Development](docs/DEVELOPMENT.md) · [Contributing](CONTRIBUTING.md) · [CLA](CLA.md) |
| Use MnemoniQR in a product or service | [License](#license) · [Commercial license](COMMERCIAL.md) |
| See what changed | [Changelog](CHANGELOG.md) |

## Quick start

1. Open <https://mnemoniqr.app> and install it (*Install app* in the footer; on iPhone: Share → *Add to Home Screen*). Turn on airplane mode.
2. Try **Practice a recovery** once, with a test seed.
3. **Encrypt a seed**: type your phrase with the built-in keyboard, check the wallet fingerprint, choose options, generate a password and **write it on paper**.
4. **Check I can recover it**, then print the PDF. Keep the QR and the password in different places.
5. To get your wallet back: **Recover from a QR**, scan, type the password.

The [user guide](docs/USER_GUIDE.md) explains every step.

## Features

**Encryption**
- Argon2id key derivation (64, 128 or 256 MiB, with the time it takes on your device shown before you choose) and AES-256-GCM authenticated encryption.
- Falls back to PBKDF2-SHA256 with 600,000 iterations only when the browser blocks WebAssembly, and says so.
- The QR hides its content: the note, date, BIP39 passphrase and number of words are all encrypted and padded. Only what is needed to decrypt is visible (the protection level, and whether a keyfile is required).
- **Optional keyfile** as a second factor: any file (a photo, a document) whose SHA-256 is mixed into the key derivation. The file itself is never stored.

**Passwords**
- Generate 6 diceware words (EFF list, about 76 bits, never a BIP39 word) or 20 random characters (120 bits).
- A pattern-based strength meter in the spirit of zxcvbn spots common passwords, dictionary words, names, keyboard runs, sequences, repeats and dates, and says why a password is weak.
- A password may not contain a word of the recovery phrase or the BIP39 passphrase: those are the first guesses of anyone holding the QR.

**Entry without leaks**
- A built-in keyboard for the recovery phrase, so the system keyboard never sees the words (no learning, syncing or logging).
- The keyboard disables impossible letters, suggests words and accepts 4-letter prefixes, as BIP39 allows. A physical keyboard also works on desktop.
- Words are masked while you type, and the BIP39 checksum is validated before anything is encrypted (a phrase that fails is saved only if you confirm).

**Backups that survive real life**
- **Shamir shares:** split a backup into 2-of-3, 3-of-5 or any k-of-n up to 16. Fewer shares than required reveal nothing; the password is still needed after combining.
- **Decoy wallet:** a second password opens a different phrase. Every QR has two equally sized slots, so nobody can tell whether a decoy exists.
- **BIP39 passphrase** (the "25th word") stored encrypted alongside the phrase. It is typed twice, because a mistyped passphrase is a different wallet. Passphrase and note are limited to 100 bytes each, so even the largest backup stays a printable QR.
- **Wallet fingerprint** (BIP32 master fingerprint) shown when you encrypt and decrypt, so you can check the backup matches your wallet in Sparrow, Electrum, Coldcard and others.
- **Verification:** after encrypting, MnemoniQR re-reads the QR from its pixels and asks for the password from memory, without showing the phrase.
- **Printing:** vector PDF as an A4 sheet with the MnemoniQR shield and instructions, or as cut-out cards (10 per page), with normal or maximum error correction. Shares can also be saved as PNG one by one or all in one ZIP (with a README, no timestamp). Long backup text continues on a second page instead of running off the sheet, and cards are refused when a code would be too dense to print legibly.
- **Typed recovery:** the text printed under each QR can be typed back into the app if the QR is damaged. It is base32 in groups of four (any case, spaces ignored, `0`/`1` read as `O`/`I`) with a CRC-32, so a typo is reported as a typo instead of "wrong password".
- **Compact QR codes:** the `MQR5` text uses the QR alphanumeric mode, about 20 % fewer modules than before, so codes print larger and scan more easily.
- **Practice mode** with a random test seed. Practice QRs are marked as such.

**App**
- Installable PWA with an install sheet (native prompt on Android and desktop, step-by-step instructions on iPhone and iPad).
- English interface and the English BIP39 word list; light and dark themes; accessible dialogs and keyboard navigation.
- A decrypted phrase is erased after 60 seconds and as soon as you leave the app; a phrase being typed is erased if the app stays in the background for more than 2 minutes; everything is erased when the page is closed.

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
- Network exposure: the Content Security Policy forbids the page from sending data anywhere (`connect-src 'none'`), and the app loads no third-party code, fonts or images. The only requests are for its own files and, when installed, update checks.

**What it cannot protect against**
- A weak or reused password. Whoever has the QR can guess offline without limit. Use the generator: 6 words (about 76 bits) or 20 characters (120 bits).
- A compromised device or browser (malware, malicious extensions, screen recording). Use a clean device in airplane mode, or the single-file version on an offline computer.
- Browser memory: JavaScript cannot guarantee that every copy of the phrase is wiped. Close the tab when you finish.
- Losing the password, the keyfile, or enough shares. There is no recovery service. A keyfile must stay byte-for-byte identical: an edited or re-saved copy will not work.

The threat model, the cryptography and every past review are in [docs/AUDIT.md](docs/AUDIT.md). To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Recovering without the app

Backups do not depend on this website. An installed copy keeps working offline, every release ships the single file `mnemoniqr-offline.html`, and `recover.py` (in every release and in `tools/`) decrypts every MnemoniQR format, in a short Python program:

```bash
pip install argon2-cffi cryptography
python3 recover.py                        # paste the text of the QR (or several shares), then Ctrl-D
```

See [docs/RECOVERY.md](docs/RECOVERY.md), which also covers instructions for your heirs.

## Verifying your copy

Every release has a **fingerprint**, shown in *How it protects you* in the app and published in `HASHES.txt`. It covers every script and the stylesheet (and the Argon2 worker that receives the password), so any change to the code changes it. The build is reproducible: anyone can rebuild a release and get the same `HASHES.txt`. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Compatibility

- **Wallets:** any wallet with a standard BIP39 English recovery phrase of 12 to 24 words. Not Electrum native seeds, SLIP-39 or private keys.
- **Older backups:** MnemoniQR reads every format it ever wrote: `MQR5`/`MQS5` (6.2.0 and later), `MQR4`/`MQS4` (4.0–6.1), `MQR3` and `MQRv2`. Old backups open normally and the app recommends re-encrypting them for Argon2id. Versions before 6.2.0 cannot read `MQR5`.
- **Word list:** English only. Backups made with the Spanish list in 4.0–5.1.0 are refused with a clear message (the same entropy as English words would be a different wallet): open them with MnemoniQR 5.1.0 and re-encrypt.

## Support the project

MnemoniQR is free, open source and has no ads, accounts or tracking. Donations pay for security audits and new features. The current community goal is **210,000 USD to unlock multi-seed backups for everyone** (up to 3 recovery phrases in one QR), and every balance can be checked on public block explorers. Addresses, how to donate safely and how the goal is counted: [docs/DONATIONS.md](docs/DONATIONS.md).

## Contributing

Issues and pull requests are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). Contributors sign the [Contributor License Agreement](CLA.md) once. Report vulnerabilities privately: see [SECURITY.md](SECURITY.md).

## License

MnemoniQR is free software: you can redistribute it and modify it under the terms of the **[GNU Affero General Public License, version 3](LICENSE)** (AGPL-3.0-only).

- **Using it** (as a person or in a company) has no conditions.
- **Sharing it**, modified or not, or **offering a modified version as a website or service**, requires making the complete source of your version available under the same license.
- **Building it into a proprietary product** without publishing your source requires a **[commercial license](COMMERCIAL.md)**.
- The name "MnemoniQR" and the logo are not licensed for use by others: forks must use their own.

Versions up to and including 6.8.0 were published under the Apache License 2.0 and remain available under it as published. Third-party components keep their own licenses (below and in [NOTICE](NOTICE)).

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

Copyright (c) MPetovick and the MnemoniQR contributors. MnemoniQR is provided "as is", without warranty of any kind. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
