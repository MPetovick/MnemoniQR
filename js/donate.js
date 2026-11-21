// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) MPetovick and the MnemoniQR contributors. Commercial licenses: see COMMERCIAL.md
// MnemoniQR v7.0.0 · Donation address (the only place it is defined). Donations are Bitcoin only.
//
// Fill in `address` to offer it; leave it '' to hide the support UI entirely.
//
// tools/build.py refuses to build with a malformed address (Bitcoin Bech32/Bech32m or Base58Check) or any
// network other than Bitcoin, and lists the published address in HASHES.txt. This file is loaded under SRI and is
// covered by the build fingerprint, so the address cannot be swapped without changing it.
//
// Edit THIS file (src/js/donate.js), then run `python3 tools/build.py` and deploy dist/. Editing
// dist/js/donate.js directly does not work: the browser refuses a file that no longer matches its
// SRI hash, and the support button disappears. That refusal is what protects the address.
'use strict';
self.MQR_DONATE = Object.freeze([
    Object.freeze({ id: 'btc', kind: 'btc', address: 'bc1qqg7ttja7th9r02549wvdwz3wspcvlv3gu95kz0' })   // Bitcoin on-chain
]);
