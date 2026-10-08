# Privacy

MnemoniQR is built so that nothing about your wallet, your backups or your use of the app leaves your device. This page lists everything the app stores, everything that touches the network, and what third parties can see.

## Summary

- No account, no analytics, no tracking, no cookies, no ads.
- Your recovery phrase, passphrase, password, note and keyfile never leave your device and are never written to storage.
- The app sends no data anywhere: its security policy (`connect-src 'none'`) blocks the page from connecting to any server. The only requests are for the app's own files and update checks.
- The app does not know whether you made a backup, recovered a wallet or donated.

## The app

**Network.** The page loads only its own files from mnemoniqr.app (or from the single file on your disk). It loads no third-party code, fonts or images. The Content Security Policy forbids the page from connecting to any server (`connect-src 'none'`), so even a bug could not send data. Once installed, the app works with airplane mode on.

**Update checks.** The installed app's service worker asks mnemoniqr.app whether a newer version exists: when the app starts, when you come back to it, when the device goes back online, and every 30 minutes while it is open. It is a plain request for the file `sw.js`, like loading any page of the site: it carries nothing about you, your backups or your use of the app. The single-file version makes no such request.

**What is stored on your device**

| Where | What | Why |
|---|---|---|
| `localStorage`, key `mqr-install` | Whether you dismissed the install prompt, and until when | Not to show it again |
| Cache Storage, `mnemoniqr-v…` | The app's own files | To work offline |
| Cache Storage, `mqr-clients` | Random ids of open app windows | So an update never reloads a window in the middle of a flow |

Nothing else. In particular, nothing records that a backup or a recovery was made, and the one-time "Backup done" line is remembered in memory only, for the session.

**What is never stored:** the recovery phrase, the passphrase, the password, the note, the keyfile, the QR and its text. They live in memory while you use them. A decrypted phrase is erased after 60 seconds and as soon as you leave the app; a phrase being typed is erased if the app stays in the background for more than 2 minutes; everything is erased when the page is closed. JavaScript cannot guarantee that every copy in memory is overwritten: close the tab or app when you finish.

**Clipboard.** Copying a phrase, or pasting one with the *Paste* button, asks for confirmation first, because other apps can read the clipboard and some keyboards sync it. After a paste the app tries to clear the clipboard at once; after a copy, after 30 seconds and when you come back to the app.

**Files you export.** PDFs, PNGs and ZIPs are created on the device and saved where you choose. Your device may then back them up to the cloud (photo galleries and download folders often are): the app warns about it. Delete them once printed or moved.

**Camera.** Used only while you scan, only on your device. The stream is stopped as soon as the scan ends or you leave the app.

## The website (mnemoniqr.app)

The site is static and hosted on Vercel. As with any website, the hosting provider receives your IP address and the files your browser requests, and may keep them in its server logs under its own privacy policy. MnemoniQR adds no analytics, no cookies and no third-party scripts, and does not access those logs for tracking.

Responses are sent with strict security headers: no referrer is sent to other sites, the page cannot be framed, and HTTPS is enforced.

## The community goal page (mnemoniqr.app/goal)

The page shows the balance of the public donation addresses. Its figures are computed **on the server**: the server asks public block explorers (mempool.space, public Ethereum, BSC and Base nodes, TronGrid, Toncenter) and CoinGecko for the balances and prices of the donation addresses, and caches the result for up to 10 minutes. Your browser does not contact those services, and they never learn who looks at the page. The page itself has no script.

The app itself never fetches the goal: it shows a snapshot built into each version.

## Links to block explorers

The Support sheet and the goal page link to block explorers so that anyone can check the donation balances. Opening one leaves MnemoniQR: that site sees your IP address and applies its own privacy policy. Links open in a new tab and send no referrer. Nothing is opened unless you tap a link.

## Donations

Donations are public blockchain transactions. Anyone can see, on the blockchain, the address a donation came from, the amount and the time. MnemoniQR does not ask who you are and does not link donations to people. If that matters to you, donate from an address that is not linked to your identity.

## Changes

Any change to what the app stores or sends would be a change to its code: it would change the version fingerprint and be listed in the [changelog](../CHANGELOG.md).
