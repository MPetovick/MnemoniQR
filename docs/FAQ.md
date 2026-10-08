# Frequently asked questions

**Basics**
- [Can MnemoniQR see my recovery phrase?](#can-mnemoniqr-see-my-recovery-phrase)
- [Why do I need a password if the QR is already encrypted?](#why-do-i-need-a-password-if-the-qr-is-already-encrypted)
- [How strong must the password be?](#how-strong-must-the-password-be)
- [What is the difference between the password and the BIP39 passphrase?](#what-is-the-difference-between-the-password-and-the-bip39-passphrase)
- [Which wallets does it work with?](#which-wallets-does-it-work-with)
- [Is it free?](#is-it-free)

**Losing things**
- [What if I forget the password?](#what-if-i-forget-the-password)
- [What if the paper is damaged?](#what-if-the-paper-is-damaged)
- [What if MnemoniQR disappears?](#what-if-mnemoniqr-disappears)
- [What if I lose the keyfile?](#what-if-i-lose-the-keyfile)
- [What if I lose a share?](#what-if-i-lose-a-share)

**Security**
- [Is it safe to use on a phone?](#is-it-safe-to-use-on-a-phone)
- [Is it safe against quantum computers?](#is-it-safe-against-quantum-computers)
- [Can someone tell that my QR has a decoy?](#can-someone-tell-that-my-qr-has-a-decoy)
- [Could an update steal my phrase?](#could-an-update-steal-my-phrase)
- [Why not just engrave the words on metal?](#why-not-just-engrave-the-words-on-metal)
- [Are MnemoniQR shares the same as SLIP-39?](#are-mnemoniqr-shares-the-same-as-slip-39)

**The project**
- [Who makes MnemoniQR and how is it funded?](#who-makes-mnemoniqr-and-how-is-it-funded)
- [What is the community goal?](#what-is-the-community-goal)
- [How do I report a security problem?](#how-do-i-report-a-security-problem)
- [What is the license? Can I use MnemoniQR in my product?](#what-is-the-license-can-i-use-mnemoniqr-in-my-product)

---

## Basics

### Can MnemoniQR see my recovery phrase?

No. MnemoniQR has no server and no account. Everything happens in your browser, and the app's security policy (`connect-src 'none'`) makes the browser refuse any connection from the page to a server, so the phrase has no way out even if the code tried. The only requests are for the app's own files and, when installed, checks for updates. You can check it with airplane mode on: the app keeps working. See [PRIVACY.md](PRIVACY.md).

### Why do I need a password if the QR is already encrypted?

The password *is* the encryption. The QR contains the phrase encrypted with a key derived from your password. Without the password, the QR is random-looking data.

### How strong must the password be?

Strong enough that guessing it costs more than the wallet is worth, forever. Anyone who finds the QR can try passwords offline without limit. The app requires at least 12 characters and an estimated 60 bits, and its generator makes much stronger ones: 6 random words (about 76 bits) or 20 random characters (120 bits). With Argon2id at the standard level, each guess costs real memory and time, so a generated password is far out of reach. A password you invent, based on words, names or dates you like, is much weaker than it looks.

### What is the difference between the password and the BIP39 passphrase?

- The **BIP39 passphrase** (or "25th word") belongs to your wallet. It changes which wallet the words open. You only have one if you set it up in your wallet. MnemoniQR can store it inside the backup so that nothing is missing when you restore.
- The **password** belongs to the MnemoniQR backup. It only opens the QR. Your wallet never sees it.

### Which wallets does it work with?

Any wallet that uses a standard BIP39 recovery phrase in English, of 12, 15, 18, 21 or 24 words. That covers most hardware and software wallets. It does not support Electrum's native seeds, SLIP-39 shares, non-English word lists, or raw private keys. The wallet fingerprint shown by the app lets you confirm that the phrase matches your wallet.

### Is it free?

Yes. Free, open source, no ads, no accounts. It is funded by donations: see [DONATIONS.md](DONATIONS.md).

## Losing things

### What if I forget the password?

The backup cannot be opened. There is no reset, no master key and no recovery service, by design: if there were, anyone could use it. That is why the app asks you to write the password on paper and to check it from memory before you finish. If you still have your wallet or the original words, make a new backup with a new password.

### What if the paper is damaged?

QR codes tolerate damage: about 25 % at normal error correction and 30 % at maximum. If the code no longer scans, type the backup text printed under it: it has a checksum, so typos are reported. Print two copies, and use shares if you want protection against losing one place.

### What if MnemoniQR disappears?

Your backups remain recoverable without the website:
- An installed copy of the app keeps working offline.
- Every release ships the single file `mnemoniqr-offline.html` and `recover.py`, a short Python program that decrypts every MnemoniQR format.
- The format is documented byte by byte in [FORMAT.md](FORMAT.md), using only standard algorithms.

Keep a copy of the single file and `recover.py` with your backup materials. See [RECOVERY.md](RECOVERY.md).

### What if I lose the keyfile?

A backup made with a keyfile cannot be opened without that exact file. Keep several copies of it in different places, and remember that editing or re-saving it (even a photo "optimised" by a messaging app or a cloud service) changes its bytes and makes it useless.

### What if I lose a share?

Nothing happens as long as you still have the required number. With "3 QRs, any 2", losing one is fine. Consider making a new set if you lose one, because the margin is gone. Shares from different sets cannot be combined.

## Security

### Is it safe to use on a phone?

Yes, with the same care as for any wallet: an up-to-date phone, no unknown apps, the app installed, airplane mode on. The app uses its own keyboard so the phone's keyboard never sees the words, hides the phrase while you type, tries to cover the screen in the app switcher, and erases a decrypted phrase after 60 seconds or as soon as you leave the app. It cannot protect you from a phone that is already compromised (malware, screen recording).

### Is it safe against quantum computers?

The encryption is AES-256, which quantum computers do not break in any practical sense: the best known quantum attack (Grover's algorithm) would at most halve its strength, leaving 128 bits. The weak point for a quantum attacker, as for a classical one, is the password: each guess still requires Argon2id with its memory cost. A generated password (6 words or 20 characters) keeps a large margin. Your wallet's own cryptography (the signatures that protect funds on the blockchain) is a separate question that MnemoniQR does not change.

### Can someone tell that my QR has a decoy?

No. Every backup has two slots of exactly the same size. Without a decoy, the second slot is filled with random bytes that look the same as an encrypted phrase. Opening one slot reveals nothing about the other.

### Could an update steal my phrase?

The app is open source, every version has a fingerprint computed from all of its code, the build is reproducible, and the security policy blocks network connections. To remove the trust in updates entirely, use a version whose fingerprint you checked against `HASHES.txt`, offline: the single file on an offline computer never updates.

### Why not just engrave the words on metal?

Metal survives fire and water, but anyone who sees it has the funds. MnemoniQR protects against the paper being found, copied or photographed, adds options like shares and a decoy, and can be combined with metal: some people engrave or stamp the backup text instead of the words.

### Are MnemoniQR shares the same as SLIP-39?

No. MnemoniQR splits the encrypted backup with Shamir's secret sharing, and the shares still need the password. SLIP-39 splits the wallet secret itself into word lists and is supported by some hardware wallets. MnemoniQR shares only open in MnemoniQR and `recover.py`.

## The project

### Who makes MnemoniQR and how is it funded?

MnemoniQR is developed as an open-source project ([GitHub](https://github.com/MPetovick/MnemoniQR)). It has no ads, no tracking and no paid features today. Donations pay for security audits and new features: see [DONATIONS.md](DONATIONS.md).

### What is the community goal?

A public funding goal of 210,000 USD: when the donation wallets reach it, multi-seed backups (up to 3 recovery phrases in one encrypted QR) are to ship in an update, free for everyone. Progress is shown in the app and live at <https://mnemoniqr.app/goal>, and every balance can be checked on public block explorers. See [DONATIONS.md](DONATIONS.md#community-goal).

### How do I report a security problem?

Privately, through GitHub's *Report a vulnerability*. See [SECURITY.md](../SECURITY.md).

### What is the license? Can I use MnemoniQR in my product?

MnemoniQR is open source under the GNU AGPL-3.0 (from version 6.9.0; earlier versions were Apache 2.0). Anyone can use it, read it, audit it and build it. You may share it or offer a modified version as a service, as long as you publish the source of your version under the same license and use your own name and logo. To build it into a proprietary product without publishing your source, a commercial license is available: see [COMMERCIAL.md](../COMMERCIAL.md). Your backups are yours: the license covers the software, not what you make with it.
