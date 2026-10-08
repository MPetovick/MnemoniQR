# Contributing to MnemoniQR

Thank you for helping. MnemoniQR protects people's savings, so every change is held to a high standard of care. This page explains how to contribute and what reviewers look for.

## Ways to help

- **Report a bug** in a GitHub issue: what you did, what you expected, what happened, the version (shown at the bottom of the home screen) and the browser. Never post a real recovery phrase, password, QR or backup text. Use [Practice mode](docs/USER_GUIDE.md#practice-mode).
- **Report a vulnerability** privately: see [SECURITY.md](SECURITY.md).
- **Improve the documentation**: unclear steps, missing answers, typos.
- **Review the code and the cryptography**: [docs/AUDIT.md](docs/AUDIT.md) and [docs/FORMAT.md](docs/FORMAT.md) are good places to start.
- **Send a pull request** for an issue that has been discussed first, for anything larger than a small fix.
- **Support the project**: see [docs/DONATIONS.md](docs/DONATIONS.md).

## Development setup

```bash
git clone https://github.com/MPetovick/MnemoniQR.git
cd MnemoniQR
python3 tools/build.py                       # writes dist/
cd dist && python3 -m http.server 8000       # open http://localhost:8000
```

Edit files in `src/`, never in `dist/` (the build regenerates it, and SRI rejects edited files). See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the full build, tests and structure.

## Rules every change must keep

1. **No network from the app**: no third-party requests, analytics, CDNs, fonts or images. `connect-src 'none'` stays.
2. **No secret at rest**: phrases, passphrases, passwords, notes and keyfiles live in memory only, and nothing stored may reveal that a backup or a recovery happened.
3. **No new runtime dependency** without a strong reason, discussed first. Vendored code is pinned and listed.
4. **Every backup ever written stays readable**, by the app and by `tools/recover.py` (the Spanish word list of 4.0–5.1.0 is the one documented exception). Format changes need a new version byte, an update of [docs/FORMAT.md](docs/FORMAT.md) and of `recover.py`, and tests.
5. **No `innerHTML` with dynamic data**; Trusted Types stays enforced.
6. **Accessible**: keyboard navigation, labels, focus management, contrast in light and dark themes.
7. **UI text in `src/js/i18n.js`**, in plain, short English.

## Before opening a pull request

- [ ] `python3 tools/build.py` succeeds, and a second build gives the same `dist/HASHES.txt`.
- [ ] `dist/tests/tests.html` passes.
- [ ] `python3 tests/e2e.py` passes (and the other tests your change touches, listed in [DEVELOPMENT.md](docs/DEVELOPMENT.md#testing)).
- [ ] New behaviour has a test.
- [ ] `CHANGELOG.md` has a line for user-visible changes; `docs/AUDIT.md` for security-relevant ones.
- [ ] Documentation updated where behaviour changed.
- [ ] New files have the license header; the CLA is signed.

Keep pull requests focused: one change per pull request is easier to review and safer to merge.

## License of contributions and the CLA

MnemoniQR is licensed under the [GNU AGPL-3.0](LICENSE) and is also offered under [commercial licenses](COMMERCIAL.md). To make that possible, every contributor signs the **[Contributor License Agreement](CLA.md)** once:

1. Open your pull request.
2. A bot comments with a link to the CLA. Read it, then reply on the pull request with:
   `I have read the CLA Document and I hereby sign the CLA`
3. The bot records the signature, and the check turns green. Comment `recheck` if it does not.

You keep the copyright of your work. The CLA gives the project the right to distribute it under the AGPL-3.0 and under commercial licenses, and commits the project to keep every accepted contribution available as open source.

New source files start with:

```
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) MPetovick and the MnemoniQR contributors. Commercial licenses: see COMMERCIAL.md
```

(`#` in Python, `/* */` in CSS, `<!-- -->` in HTML). Code copied from elsewhere must have a compatible license, be named in the pull request, and keep its notices.
