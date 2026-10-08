# MnemoniQR backup formats

The byte layout of every backup MnemoniQR writes and reads, complete enough to write an independent decoder. `tools/recover.py` is the reference implementation. Multi-byte integers are big-endian.

- [Text encodings](#text-encodings)
- [Backup block](#backup-block): header, key derivation, slots, plaintext
- [Share](#share)
- [Legacy formats](#legacy-formats-read-only)
- [Decrypting, step by step](#decrypting-step-by-step)

## Text encodings

| Prefix | Content | Encoding | Written by |
|---|---|---|---|
| `MQR5:` | backup block | base32 (RFC 4648 alphabet, no padding) of `block ‖ CRC-32(block)` | 6.2.0 and later |
| `MQS5:` | share | base32 of `share ‖ CRC-32(share)` | 6.2.0 and later |
| `MQR4:` / `MQS4:` | same blocks | unpadded base64url | 4.0–6.1.x (still read) |

The `MQR5`/`MQS5` text uses only `A–Z`, `2–7` and `:`, so QR codes are encoded in alphanumeric mode (about 20 % fewer modules than base64 in byte mode). Readers accept any letter case, ignore whitespace and dashes, and read `0` as `O` and `1` as `I`. The CRC-32 (IEEE, big-endian) detects typos before any key derivation; integrity against tampering is still provided by AES-GCM.

## Backup block

### Header (27 bytes, authenticated as AES-GCM additional data in both slots)

| Offset | Size | Field |
|---|---|---|
| 0 | 2 | Magic `MQ` (0x4D 0x51) |
| 2 | 1 | Format version = 4 |
| 3 | 1 | Flags: bit 0 = practice backup, bit 1 = keyfile required. Unknown bits are refused as "newer version". |
| 4 | 1 | KDF: 1 = Argon2id, 2 = PBKDF2-HMAC-SHA256 |
| 5 | 4 | p1: memory in KiB (Argon2id) or iterations (PBKDF2) |
| 9 | 1 | p2: passes (Argon2id), 0 for PBKDF2 |
| 10 | 1 | p3: parallelism (Argon2id), 0 for PBKDF2 |
| 11 | 16 | Salt |

Accepted ranges when decrypting (anything else is rejected before deriving a key): Argon2id memory 8–512 MiB, passes 1–16, parallelism 1–8; PBKDF2 100,000–5,000,000 iterations.

### Key derivation input

`NFKC(password)` as UTF-8. If flag bit 1 is set, the input is `SHA-256(keyfile bytes) ‖ NFKC(password)` (the 32-byte prefix has a fixed length, so the concatenation is unambiguous).

### Slots

Two slots of identical length follow the header, in random order:

```
iv (12) | ciphertext (L) | GCM tag (16)
```

One slot holds the real phrase. The other holds the decoy phrase (encrypted with the decoy password under the same salt and KDF parameters) or random bytes of the same length. Decryption derives the key once and always tries both slots.

### Plaintext (before padding)

```
type (1) | lang (1) | data | passphrase length (1) | passphrase | note length (1) | note | created (u32, Unix seconds)
```

- `type 1` — `data` = entropy length (1) + BIP39 entropy (16, 20, 24, 28 or 32 bytes).
- `type 2` — `data` = text length (u16) + UTF-8 text. Used only when the user explicitly saves a phrase whose checksum does not validate.
- `lang` — 0 = English word list. Value 1 (Spanish) was written by 4.0–5.1.0; current versions refuse it with `unsupported_lang` instead of showing different words.
- The passphrase is NFKD-normalised (as BIP39 requires); the encryption password is NFKC-normalised.
- New backups limit the passphrase and the note to 100 bytes each (UTF-8, after normalisation), so the largest backup still fits a QR at maximum error correction (version 29). Longer values are refused, never truncated. Readers accept up to 255 bytes, as written by 6.0–6.2.
- Every length field is bounds-checked when reading: a field that would run past the end of the plaintext is an error, never a shorter value.

Both plaintexts are zero-padded to the same length `L`, the smallest multiple of 64 bytes (minimum 64) that fits the longer one. This hides the number of words and the length of the note and passphrase.

## Share

```
version = 4 (1) | set id (4) | k (1) | n (1) | x (1) | y (len = backup block)
```

The complete backup block (the bytes inside an `MQR5:` or `MQR4:` text) is split byte by byte with Shamir's secret sharing over GF(2⁸) (reduction polynomial 0x11B, generator 3), with fresh random coefficients for every byte. Any `k` distinct shares of the same set rebuild the block, which still needs the password. Constraints: 2 ≤ k ≤ n ≤ 16. Shares are not SLIP-39 compatible.

## Legacy formats (read-only)

| Prefix | Version | KDF | Notes |
|---|---|---|---|
| `MQR3:` | v3 | Argon2id or PBKDF2 | 38-byte header, single slot, English word list |
| `MQRv2:` | v2 | PBKDF2-SHA256, 310,000 iterations | 128-byte cleartext metadata, JSON payload |

MnemoniQR decrypts both and suggests re-encrypting them in the current format.

## Decrypting, step by step

1. Strip the prefix and decode the text: for `MQR5:`/`MQS5:`, uppercase, remove whitespace and dashes, map `0`→`O` and `1`→`I`, base32-decode, and check the trailing CRC-32 of the rest; for `MQR4:`/`MQS4:`, base64url-decode.
2. For shares: group by set id, check that `k` and `n` agree, take any `k` distinct `x`, and rebuild every byte by Lagrange interpolation at 0 over GF(2⁸).
3. Parse the header and check the magic, the version, unknown flag bits and the KDF parameter ranges.
4. Derive the 32-byte key from the key derivation input with Argon2id version 0x13 (`m` = p1 KiB, `t` = p2, `p` = p3, salt) or PBKDF2-HMAC-SHA256 (p1 iterations, salt).
5. Split the rest into two slots of equal length. For each: AES-256-GCM decrypt with its IV, the header as additional data, and the tag. The slot whose tag verifies is the one this password opens; if neither verifies, the password (or keyfile) is wrong.
6. Parse the plaintext, ignoring the zero padding, and turn the entropy into words with the English BIP39 list.

## Reference implementation

`tools/recover.py` implements every format in this document, the legacy ones included, in about 480 lines of Python (argon2-cffi and cryptography are its only dependencies) and is tested against backups produced by the app.
