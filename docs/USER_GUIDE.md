# MnemoniQR user guide

Everything you need to make an encrypted paper backup of a wallet recovery phrase, keep it safe for years, and get your wallet back from it. If you only read one section, read [Before you start](#before-you-start) and [Storing the backup](#storing-the-backup).

- [What MnemoniQR does](#what-mnemoniqr-does)
- [Before you start](#before-you-start)
- [Getting the app](#getting-the-app)
- [Making a backup](#making-a-backup)
  - [1. Enter the recovery phrase](#1-enter-the-recovery-phrase)
  - [2. Options](#2-options)
  - [3. Password and protection level](#3-password-and-protection-level)
  - [4. Check, then print](#4-check-then-print)
- [Choosing the options](#choosing-the-options)
- [Storing the backup](#storing-the-backup)
- [Recovering your wallet](#recovering-your-wallet)
- [Practice mode](#practice-mode)
- [Checking that your copy of the app is genuine](#checking-that-your-copy-of-the-app-is-genuine)
- [Updates](#updates)
- [Troubleshooting](#troubleshooting)

Related documents: [Recovery without the app and instructions for your heirs](RECOVERY.md) · [FAQ](FAQ.md) · [Privacy](PRIVACY.md) · [How the security works](AUDIT.md)

---

## What MnemoniQR does

Your wallet's recovery phrase (12 to 24 words, also called seed or mnemonic) is the wallet: whoever has the words has the funds. Writing the words on paper is simple but dangerous, because anyone who sees the paper can empty the wallet.

MnemoniQR encrypts the phrase with a password and prints it as a QR code. Someone who finds the paper sees a code that is useless without the password. You keep the password somewhere else. To recover, you scan the QR, type the password and get the words back.

Everything happens on your device. The app sends nothing anywhere: its security policy blocks the page from connecting to any server, and it works with airplane mode on.

MnemoniQR works with any wallet that uses a standard **BIP39 English** recovery phrase of 12, 15, 18, 21 or 24 words: hardware wallets (Ledger, Trezor, Coldcard, BitBox, Keystone…), software wallets (Sparrow, Electrum in BIP39 mode, MetaMask, Trust Wallet, Exodus…) and most others. It does not handle Electrum's own seed format, SLIP-39 (Shamir) word shares or private keys.

## Before you start

**Prepare the device.**
- Use a device you trust, with no unknown apps or browser extensions. Ideally a phone or computer that is up to date and not shared.
- Install the app first (see below), then **turn on airplane mode** before typing the phrase. The app shows *You are online* or *Offline* on the home screen.
- For the highest level of care, use the single-file version on a computer that never goes online (see [Getting the app](#getting-the-app)).
- Make sure nobody can see the screen, and that no camera points at it.

**Have ready:**
- Your recovery phrase, and your BIP39 passphrase if your wallet uses one.
- A printer, or paper and a pen to write the backup text by hand.
- Paper and a pen to write down the password.

**Understand the one rule.** The QR protects the phrase only as well as the password does. Whoever finds the QR can try passwords offline, forever, as fast as their hardware allows. A short or reused password can be guessed. Use the generator (6 words or 20 characters) unless you know what you are doing.

## Getting the app

| Option | When to use it | How |
|---|---|---|
| **Installed app (recommended)** | Phones, tablets and computers | Open <https://mnemoniqr.app> and choose *Install app* in the footer. On iPhone and iPad: Share → *Add to Home Screen*. Once installed it works offline. |
| **In the browser** | A quick look, or practice | Open <https://mnemoniqr.app>. It works the same, but browser extensions can see the page: install it or use a private window without extensions for real backups. |
| **Single file** | Computers that never go online | Download `mnemoniqr-offline.html` from a release on GitHub, check its fingerprint (below), copy it to the offline computer and open it in a browser. Nothing else is needed. |

## Making a backup

On the home screen, choose **Encrypt a seed**. The progress bar at the top shows the steps: *Phrase*, *Options*, *Password*, and *Decoy* before the password if you add a decoy wallet.

### 1. Enter the recovery phrase

1. Choose the number of words.
2. Type each word with the app's own keyboard. Your system keyboard never sees the words, so it cannot learn, sync or log them. On a computer you can also use the physical keyboard.
3. The first four letters are enough: BIP39 words are unique by their first four letters, and the app completes them. Letters that cannot lead to a valid word are disabled, and suggestions appear as you type.
4. Typed words are masked. When the last word is in, the app checks the BIP39 checksum and shows **BIP39 checksum valid** and the **wallet fingerprint** (8 characters, for example `73c5da0a`).

**Compare the fingerprint with your wallet.** Most wallets show it as the "master fingerprint" or "root fingerprint" (Sparrow, Electrum, Coldcard, Keystone, BitBox and others). If it matches, the words are right and in the right order. This first fingerprint is computed **without** the BIP39 passphrase: if your wallet uses one, compare instead the fingerprint shown on the result screen, after encryption, which includes it.

If the checksum is invalid, a word is misspelled or out of place. Check it against your original. You can save a phrase whose checksum does not validate, but the app asks first: it is almost always a mistake.

Pasting is possible but discouraged: the clipboard can be read by other apps and synced by some keyboards. The *Paste* button asks for confirmation first; with either the button or the keyboard shortcut, the app tries to clear the clipboard right after.

### 2. Options

All options are optional. They are explained in detail in [Choosing the options](#choosing-the-options).

- **Encrypted note**: a short label such as "main wallet", stored inside the encryption. Up to 100 bytes. Never write the password here.
- **BIP39 passphrase** (the "25th word"): if your wallet uses one, tick the option and type it twice. It is stored encrypted with the phrase. Case and spaces matter. Up to 100 bytes (accented letters take more than one); a longer one is refused, never shortened.
- **Decoy wallet**: a second phrase that opens with a second password. If you tick it, a *Decoy* step asks for the decoy phrase. The decoy holds only the phrase (no passphrase, no note).
- **Keyfile**: a file that must be present, besides the password, to open the backup (any non-empty file up to 100 MB).
- **Format**: a single QR, or the backup split into shares (3 QRs where any 2 work, 5 where any 3 work, or a custom split up to 16).

### 3. Password and protection level

**Generate a password** with *6 words* (about 76 bits) or *20 characters* (120 bits), or type your own. The app requires 12 characters or more and an estimated strength of at least 60 bits, and refuses a password that contains a word of your recovery phrase or your passphrase (those are the first guesses of anyone holding the QR). The meter explains what makes a password weak: common passwords, dictionary words, names, keyboard patterns, sequences, repeats, dates.

**Write the password on paper now**, before continuing. There is no way to recover a forgotten password.

**Choose the protection level.** It sets how much memory and time Argon2id uses to turn the password into a key, which is also what an attacker must pay for every guess.

| Level | Argon2id | Use it when |
|---|---|---|
| Standard | 64 MiB, 3 passes | Default. Fine with a generated password. |
| High | 128 MiB, 4 passes | A little more margin. |
| Maximum | 256 MiB, 4 passes | Most resistance. An old phone may be slow or lack the memory to open it. |

The time shown next to each level is how long this device takes. **Recovery will take a similar time**, and longer on a slower device. If you may need to recover on an old phone, do not choose Maximum. On devices that report 2 GB of memory or less, Maximum is not offered.

Tap **Generate QR**. The work runs in the background and can be cancelled.

### 4. Check, then print

The result screen shows the QR (or the shares), the wallet fingerprint and whether the backup is verified.

1. **Check I can recover it.** The app reads the QR back from its pixels and asks for the password from memory, without showing the phrase. If you added a decoy, check both passwords. Do not skip this: it is the proof that the backup works.
2. **Export.**
   - **PDF**: an A4 sheet with instructions, or cut-out cards (10 per page, with the number of copies of each QR you choose). Choose the damage resistance: normal tolerates about 25 % damage, maximum about 30 % with a denser code. For several copies of the A4 sheet, print the PDF more than once.
   - **PNG**: the image of the QR on screen (one share at a time).
   - **All shares in one ZIP**: only to move shares to different places in one go. The app asks first, because one file holding every share is only as safe as the password.
   - **Share**: sends the image to another app. Avoid it: images sent to apps usually end up in the cloud.
3. **Print**, then delete the PDF or images from the device and from its downloads, recycle bin and cloud backups.
4. Tap **Finish and clear the screen**.

Every printout includes the **backup text** under the QR: the same content as letters and digits in groups of four. If the QR is ever damaged, it can be typed back in.

## Choosing the options

**Should I add a note?** A note helps you know which wallet a QR belongs to, without revealing anything to others (it is encrypted). Keep it vague: "savings", "2026 Ledger".

**Do I need a BIP39 passphrase?** Only if your wallet already uses one. MnemoniQR does not add a passphrase to your wallet: it stores the one you already have, so that the backup holds everything needed to restore the wallet. A passphrase is part of the wallet itself: a different passphrase (even one letter or a space) opens a different, empty wallet.

**Decoy wallet.** If someone could force you to decrypt the backup, a decoy gives them something to find. Create a second wallet with a small amount of funds, and enter its phrase as the decoy. With the decoy password the same QR opens the decoy phrase; with the real password it opens the real one. Every QR has two slots of the same size, filled with random bytes when there is no decoy, so nobody can tell from the QR whether a decoy exists. The decoy password needs 8 characters or more and must differ from the real one.

**Keyfile.** Any file you choose (a photo, a PDF) becomes a second factor: the backup opens only with the password **and** that exact file. Useful if you worry that the password could be found or guessed. The risks:
- The file must stay identical, byte for byte. A photo that is edited, re-saved, compressed by a messaging app or "optimised" by a cloud service no longer works.
- Lose every copy of the file and the backup is lost. Keep several copies, away from the QR.
- The file itself is never stored in the backup. The app shows a short fingerprint of the file to help you recognise it later.

**Shares (Shamir).** The backup is split into several QRs, and any minimum number of them (plus the password) rebuild it. Fewer shares than required reveal nothing at all, not even a part of the phrase. Use shares to remove the single point of failure of one paper:
- *3 QRs, any 2*: keep them in three places. Losing one place, or one place being found, is not a problem.
- *5 QRs, any 3*: for more places or more people.
- Shares from different backups cannot be mixed: each set has its own id, printed on every share.

MnemoniQR shares are not SLIP-39: they open in MnemoniQR and `recover.py` only.

## Storing the backup

The goal is that no single place, and no single person, has everything.

| What | Where | Why |
|---|---|---|
| The QR (or each share) | One or more safe places: a safe, a safe-deposit box, a trusted relative's home | Whoever finds it still needs the password |
| The password | A different place from the QR, on paper. Or memorised, plus a copy on paper elsewhere | QR + password = funds |
| The keyfile, if any | Several copies, away from the QR (USB drives, a printed copy is not enough: it must be the file) | Without it the backup cannot be opened |

Practical advice:
- **Paper**: print on good paper with a laser printer if you can (inkjet ink can run with water). Keep it dry, flat and away from sunlight. A plastic sleeve or lamination helps. Print two copies of each QR.
- **No digital copies** of the QR: no photos, no cloud, no email to yourself. Each copy is a place where someone can start guessing the password.
- **Label it** so you or your heirs know what it is, without saying more than needed. The PDF already says what the code is and how to recover it.
- **Check it once a year**: scan it with *Recover from a QR* or in [Practice mode](#practice-mode) to make sure the paper is still readable and you still remember how it works.
- **Plan for your heirs**: see [Instructions for your heirs](RECOVERY.md#instructions-for-your-heirs).

## Recovering your wallet

1. Open MnemoniQR (preferably installed, in airplane mode) and choose **Recover from a QR**.
2. Give it the backup, in any of these ways:
   - **Scan** the QR with the camera.
   - **Upload image** of the QR, or drop the image on the home screen (up to 10 MB and 40 megapixels).
   - **Type the backup text** printed under the QR, if the code is damaged. Letter case, spaces and line breaks do not matter. A typo is reported as a typo, not as a wrong password.
   - With shares: scan, upload or type them **one after another**, in any order, until the required number is reached.
3. If the backup needs a keyfile, choose it.
4. Type the password and tap **Decrypt**.
5. The phrase appears hidden: tap the grid to show it. The note, the creation date, the passphrase and the wallet fingerprint are shown too. Compare the fingerprint with the one you noted.
6. Enter the words in your wallet. Then tap **Erase and exit**. The phrase is erased after 60 seconds anyway, and immediately if you leave the app.

From the third wrong password on, the app makes you wait before the next attempt (2 seconds, then 4, 8, 16, up to 30). If the backup opens a different phrase than you expected, you may have typed the decoy password.

If the app is not available, the backup can be recovered with a short Python program: see [Recovering without the app](RECOVERY.md).

## Practice mode

**Practice a recovery** on the home screen creates a backup of a random test seed and lets you recover it, exactly as in an emergency. Do it once before trusting a real backup, and again from time to time. Practice backups are marked *Practice* on screen and on paper. Never send funds to a practice seed.

## Checking that your copy of the app is genuine

Every version has a **fingerprint** (16 characters in four groups, for example `5AC9 1686 4638 BBFA`). It is computed from every script and stylesheet the app runs, so any change to the code changes it.

1. In the app, open **How it protects you** and read *Fingerprint of this version*.
2. Compare it with `HASHES.txt` in the release on GitHub. The single-file version has its own fingerprint, listed in the same file.
3. For full assurance, anyone can rebuild the app from source and get the same fingerprint (see [DEVELOPMENT.md](DEVELOPMENT.md)).

The donation addresses shown in the app are part of the same fingerprint and listed in `HASHES.txt`. The version number is shown at the bottom of the home screen.

## Updates

An installed app updates by itself the next time it is opened online. The new version downloads in the background and loads when you are back on the home screen, never in the middle of a backup or a recovery. A banner says when an update is waiting.

Backups do not expire: new versions read every earlier format. A backup made with a newer version may need an updated app to open, and the app says so. The single-file version never updates by itself: download the new file from the release.

## Troubleshooting

| Problem | What to do |
|---|---|
| *Not a BIP39 word* | Check the spelling. Only the English BIP39 word list is supported. |
| *Invalid checksum* | A word is wrong or out of order. Compare with the original, word by word. |
| *Not enough memory for this level* | Choose a lower protection level, or close other apps. |
| *This browser blocks WebAssembly* | The app falls back to PBKDF2 (weaker) and says so. Prefer another browser, or the installed app, for real backups. |
| The camera does not open | Allow camera access for the site, or upload a photo of the QR instead. |
| *No QR found* in an image | Crop the photo around the QR, make it sharper, or type the backup text. |
| *The backup text contains a typo* | Check it group by group against the paper. `0` and `1` are read as `O` and `I`. |
| *Wrong password* | Check the keyboard layout, Caps Lock and spaces. If the backup has a keyfile, make sure it is the original file. |
| *That share belongs to another set* | You mixed shares of two backups. Use shares with the same set id, printed on each share. |
| *This backup was made with a newer version* | Update the app (open it online), or use the latest `recover.py`. |
| *Old backup (vN)* | It opens normally. Re-encrypt the phrase with the current version for the best protection. |
| *Spanish BIP39 word list* | Backups made with the Spanish list in versions 4.0 to 5.1.0 must be opened with MnemoniQR 5.1.0 and re-encrypted. |

Still stuck? Open an issue on GitHub, **without** posting your QR, its text, your password or your phrase.
