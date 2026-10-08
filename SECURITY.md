# Security policy

MnemoniQR protects wallet recovery phrases, so security reports are the most valuable contribution there is. Thank you for taking the time.

## Reporting a vulnerability

**Report privately**, through GitHub: *Security* → *Report a vulnerability* on [the repository](https://github.com/MPetovick/MnemoniQR/security/advisories/new). Please do not open a public issue, discussion or pull request for a vulnerability until it is fixed.

Include, as far as you can:
- what an attacker can do, and what they need (physical access to a QR, a malicious website, a modified build…);
- the version (shown at the bottom of the home screen) or the fingerprint (*How it protects you*), and the browser or `recover.py` setup;
- steps to reproduce, or a proof of concept;
- any suggested fix.

**Never include a real recovery phrase, password or backup** that protects funds. Use [Practice mode](docs/USER_GUIDE.md#practice-mode) or the test vectors.

## What happens next

- You get an acknowledgement, and an assessment once the report is reproduced.
- The fix is developed privately and released; installed copies update by themselves (the single-file version must be downloaded again).
- The finding is recorded in [docs/AUDIT.md](docs/AUDIT.md) and in the changelog, crediting you if you wish.
- Please give a reasonable time to fix before any public disclosure, and coordinate the date.

Good-faith research that follows this policy, avoids harm to users and their funds, and does not access other people's data is welcome.

## Supported versions

Only the latest release is supported: installed copies update themselves. Backups made with earlier versions remain readable by the latest app and by `recover.py`, except the Spanish word list of 4.0–5.1.0 (documented).

## In scope

- The app (`src/`), the build (`tools/build.py`) and its integrity guarantees (SRI, fingerprints, reproducibility, Content Security Policy, Trusted Types).
- The backup formats and their implementation in the app and in `tools/recover.py`.
- The service worker and the update mechanism.
- The community goal function (`web/api/goal.js`) and the site configuration (`vercel.json`, `_headers`).
- The donation addresses and how they are shown.

## Out of scope

- A device or browser that is already compromised (malware, malicious extensions, screen recording).
- Weak passwords chosen by users in spite of the meter.
- Memory forensics: JavaScript cannot guarantee that strings are wiped (documented limit).
- Attacks that need the user to install a modified build whose fingerprint does not match `HASHES.txt`.
- Social engineering, physical attacks on people, and denial of service against the hosting provider.
- Third-party block explorers and price services linked or used by the goal page.

## Learn more

- [docs/AUDIT.md](docs/AUDIT.md): threat model, cryptography and every past review.
- [docs/FORMAT.md](docs/FORMAT.md): byte layout of every format.
- [docs/PRIVACY.md](docs/PRIVACY.md): what the app stores and sends.
