# Security notes

This document records the design decisions behind MnemoniQR and the findings of the audit that produced v5.1.0. Version 6.x keeps the same design with the English word list only; a backup tagged with any other list is refused, never decoded into different words.

## Threat model

| Threat | Mitigation |
|---|---|
| Printed QR found or photographed | Argon2id (64–256 MiB) + AES-256-GCM; strong password required (≥ 12 characters, ≥ 60 estimated bits) |
| One share found | Shamir shares reveal no information below the threshold |
| Coercion | Decoy password; both slots always exist and always have the same size |
| Tampered QR | GCM authentication over header and ciphertext; KDF parameters bounded before use |
| Network or third-party compromise | No external resources; CSP `default-src 'none'` and `connect-src 'none'` |
| Script injection | No `innerHTML` with dynamic data; Trusted Types enforced with a single allow-listed policy |
| System keyboard logging or sync | Built-in keyboard for the recovery phrase |
| Screen exposure | Masked entry, blurred results, wipe after 60 s or when the app is backgrounded, privacy screen for the app switcher |
| Swapped or modified build | SRI on every script and stylesheet, published fingerprints, deterministic build |

**Out of scope:** a compromised operating system or browser, weak or reused passwords, and memory forensics (JavaScript strings cannot be reliably wiped).

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

Please report vulnerabilities privately through GitHub (*Security* → *Report a vulnerability*) instead of opening a public issue.
