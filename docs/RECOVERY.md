# Recovery without the app, and instructions for your heirs

A backup is only as good as your ability to open it in ten or twenty years, possibly without this website, possibly by someone else. This document covers both.

- [Ways to recover](#ways-to-recover)
- [Recovering with recover.py](#recovering-with-recoverpy)
- [Recovering from the format specification](#recovering-from-the-format-specification)
- [Instructions for your heirs](#instructions-for-your-heirs)
- [Letter template](#letter-template)

## Ways to recover

| Situation | Use |
|---|---|
| Normal case | The app: *Recover from a QR* ([user guide](USER_GUIDE.md#recovering-your-wallet)) |
| The website is down | An installed copy of the app (it works offline), or the single file `mnemoniqr-offline.html` from any release |
| No MnemoniQR at all | `recover.py`, a short Python program shipped with every release and kept in the repository |
| No MnemoniQR code at all | The current format is documented byte by byte in [FORMAT.md](FORMAT.md): a programmer can write a decoder with standard libraries |

Keep a copy of `mnemoniqr-offline.html` and `recover.py` with your backup materials (on a USB drive, for example). They contain no secret.

## Recovering with recover.py

**1. Prepare an offline computer** with Python 3.8 or later. Install the two libraries it needs while online, then disconnect:

```bash
pip install argon2-cffi cryptography
```

(On a computer that must never go online, download the two packages as wheel files elsewhere and install them with `pip install --no-index <files>`.)

**2. Get the backup text.** Either type the text printed under the QR (letter case, spaces and line breaks do not matter), or read the QR with any QR reader that works offline and save its text. The text starts with `MQR5:` for a backup and `MQS5:` for a share. `recover.py` reads text, not images.

**3. Run it** and type the password when asked (it is not shown):

```bash
python3 recover.py                         # paste the text (or several shares), then Ctrl-D (Ctrl-Z, Enter on Windows)
python3 recover.py backup.txt              # or read it from a file
python3 recover.py share1.txt share3.txt   # shares, in any order, any k of them
python3 recover.py --keyfile photo.jpg backup.txt
```

It prints the words, numbered, and, when present, the passphrase, the note and the wallet fingerprint (`--json` also gives the creation date). Practice backups are labelled as such. If the decoy password is typed, it prints the decoy phrase.

Other options: `--json` prints the result as JSON, `--no-fingerprint` skips the fingerprint, `--password-stdin` reads the password from the first line of standard input (for scripts), `--version`.

**4. Restore the wallet** with the words (and passphrase, if any) in your wallet software or device. Compare the fingerprint. Then close the terminal and clear its history and scrollback.

## Recovering from the format specification

If neither the app nor `recover.py` can be run, [FORMAT.md](FORMAT.md) describes the current backup format completely (the legacy `MQR3` and `MQRv2` formats are implemented in `recover.py`): the text encoding, the header, the key derivation (Argon2id or PBKDF2 with the parameters stored in the header), AES-256-GCM, the two slots, the plaintext layout and the Shamir shares. Every building block is a published standard available in common cryptographic libraries.

## Instructions for your heirs

If something happens to you, someone you trust must be able to find the backup, understand what it is and open it, and nobody else should. Some principles:

- **Decide who gets what.** The person who inherits needs, at the right time: the QR (or enough shares), the password, the keyfile if there is one, and these instructions. They should not all be in one place before then.
- **Split the pieces.** For example: the QR in your home safe, the password in a sealed envelope with your lawyer or notary or in a safe-deposit box, the instructions with your will. With shares, give one share each to people who do not know each other well, and keep the rest.
- **Write instructions in plain words**, without any secret in them (template below). Say what the QR is, where the other pieces are, and that the person should take their time and ask someone technical they trust.
- **Warn about scams.** Nobody legitimate will ever ask for the recovery words. Wallet "support", "recovery services" or messages asking for the phrase are thieves.
- **Practise together** if you can: show the person how practice mode works, so the real thing is not the first time.
- **Review it** when your wallets, passwords or wishes change.

## Letter template

Copy, adapt and print. Do **not** write the password or the recovery words in the letter.

```
To: ____________________                Date: ____________

This envelope explains how to access my cryptocurrency wallet(s).

1. What it is
   - Wallet: ____________________ (for example: Ledger, Sparrow, Trust Wallet)
   - Coins: ____________________
   - The wallet's recovery phrase is encrypted in a paper QR code made with
     MnemoniQR (https://mnemoniqr.app).

2. Where the pieces are
   - The QR code (or ___ of the ___ shares): ____________________
   - The password: ____________________
   - The keyfile (only if needed): ____________________
   - A copy of the app and of recover.py: ____________________

3. How to open it
   - On a phone or computer you trust, open https://mnemoniqr.app (or the
     copy of the app), choose "Recover from a QR", scan the code (or the
     shares, one after another) and type the password.
   - If the QR is damaged, type the text printed under it.
   - Without the app: follow docs/RECOVERY.md in
     https://github.com/MPetovick/MnemoniQR (recover.py).
   - The app shows 12 to 24 words. Enter them in the wallet named above
     (with the passphrase, if one is shown). The wallet fingerprint
     should be: ________

4. Be careful
   - Take your time. Ask ____________________ for help if needed.
   - Never give the words, the password or the QR to anyone who asks for
     them, whatever they claim to be. Real support never asks.
   - Once the funds are moved to a wallet of your own, destroy the paper.
```
