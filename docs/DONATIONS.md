# Supporting MnemoniQR

MnemoniQR is free, open source and has no ads, accounts or tracking. Donations pay for security audits and new features, and keep it free for everyone.

- [Donation address](#donation-address)
- [How to donate safely](#how-to-donate-safely)
- [How the address is protected](#how-the-address-is-protected)
- [What the app shows, and when](#what-the-app-shows-and-when)
- [For maintainers](#for-maintainers)

## Donation address

Donations are accepted in **Bitcoin only**, on-chain:

```
bc1qqg7ttja7th9r02549wvdwz3wspcvlv3gu95kz0
```

In the app: tap the orange **Bitcoin button** in the footer. The sheet shows the address, its QR code and a *Copy address* button.

## How to donate safely

- Copy the address from the app or from the release's `HASHES.txt`, not from a message or a website you do not trust.
- **After pasting, compare the first and last four characters** (highlighted in the app). Some malware replaces addresses in the clipboard.
- Send bitcoin on the Bitcoin network only. Other coins or tokens sent to this address are lost.
- Send a small amount first if you are unsure.
- Donations are public on the blockchain. Use an address not linked to your identity if that matters to you (see [PRIVACY.md](PRIVACY.md#donations)).

## How the address is protected

A swapped address steals donations, so the address is treated like code:

- It is defined in one file only, [`src/js/donate.js`](../src/js/donate.js).
- The build refuses a malformed address (Bech32/Bech32m or Base58Check checksums; testnet addresses are refused) and any entry that is not exactly one Bitcoin address.
- The file is loaded under Subresource Integrity and covered by the version fingerprint, and every release lists the address in `HASHES.txt`. The address cannot change without changing the fingerprint.
- The app generates the QR code locally and never fetches anything.

## What the app shows, and when

Support never interrupts:

- the Bitcoin button in the footer;
- one quiet line on the home screen after your first verified backup in a session, and after each real recovery, once the phrase has been wiped (never during a flow, never in practice mode);
- a mention in *How it protects you*.

The app cannot know whether anyone donated, and stores nothing about it. A build without a donation address shows none of this.

## For maintainers

**Changing the address.** Edit `src/js/donate.js`, run `python3 tools/build.py`, check the address printed by the build and in `HASHES.txt`, and deploy `dist/`. Editing `dist/js/donate.js` directly does not work: the browser refuses a file that no longer matches its SRI hash, and the Bitcoin button disappears.

**Testing without the real address:** `python3 tools/build.py --out /tmp/mqr-test --donate-test` uses a public example address. Never deploy such a build (`HASHES.txt` says so).
