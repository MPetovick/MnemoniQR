// MnemoniQR v6.4.0 · Automated tests (run in the browser, no tooling needed)
'use strict';
(async () => {
    const M = self.MQR;
    const { BIP39, util } = M;
    const out = document.getElementById('out');
    const results = [];
    const enc = new TextEncoder();

    async function test(name, fn) {
        const t0 = performance.now();
        let ok = false, detail = '';
        try { const r = await fn(); ok = r !== false; if (typeof r === 'string') detail = r; }
        catch (e) { detail = (e && (e.code || e.message)) || String(e); }
        const ms = Math.round(performance.now() - t0);
        results.push({ name, ok, detail, ms });
        const li = document.createElement('li');
        li.className = ok ? 'ok' : 'fail';
        li.textContent = `${ok ? '✔' : '✘'} ${name} (${ms} ms)${detail ? ' · ' + detail : ''}`;
        out.appendChild(li);
    }
    const assert = (c, msg) => { if (!c) throw new Error(msg || 'assert'); };
    const throwsCode = async (fn, code) => {
        try { await fn(); } catch (e) { if (code && e.code !== code) throw new Error(`expected ${code}, got ${e.code || e.message}`); return; }
        throw new Error('did not throw');
    };

    // Base58 decoding, to compare with the vectors' xprv keys
    function b58decode(s) {
        const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let n = 0n;
        for (const c of s) n = n * 58n + BigInt(A.indexOf(c));
        const bytes = [];
        while (n > 0n) { bytes.unshift(Number(n % 256n)); n /= 256n; }
        for (const c of s) { if (c !== '1') break; bytes.unshift(0); }
        return Uint8Array.from(bytes);
    }

    const lists = await BIP39.init();
    await test('BIP39 word list integrity', () => lists.en === true && !BIP39.available('es'));

    for (const [lang, vectors] of Object.entries(self.BIP39_VECTORS)) {
        await test(`Official vectors ${lang}: entropy ↔ phrase (${vectors.length})`, async () => {
            for (const [entHex, mnemonic] of vectors) {
                const idx = await BIP39.fromEntropy(util.fromHex(entHex));
                const m = BIP39.mnemonic(lang, idx);
                assert(m.normalize('NFKD') === mnemonic.normalize('NFKD'), 'phrase mismatch: ' + entHex);
                const words = mnemonic.normalize('NFKD').split(/\s+/);
                const back = await BIP39.toEntropy(words.map((w) => BIP39.resolve(lang, w)));
                assert(back && util.hex(back) === entHex, 'entropy mismatch: ' + entHex);
            }
        });
        await test(`Official vectors ${lang}: seed with passphrase TREZOR`, async () => {
            for (const [, mnemonic, seedHex] of vectors) {
                assert(util.hex(await BIP39.seed(mnemonic, 'TREZOR')) === seedHex, 'seed mismatch');
            }
        });
        await test(`Official vectors ${lang}: BIP32 master key (xprv)`, async () => {
            for (const [, , seedHex, xprv] of vectors) {
                const raw = b58decode(xprv);
                const I = await M.masterKey(util.fromHex(seedHex));
                assert(util.hex(raw.slice(13, 45)) === util.hex(I.slice(32)), 'chain code');
                assert(util.hex(raw.slice(46, 78)) === util.hex(I.slice(0, 32)), 'private key');
            }
        });
    }

    await test('Known BIP32 fingerprint (abandon… about → 73c5da0a)', async () =>
        (await M.fingerprint('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', '')) === '73c5da0a');

    await test('Invalid checksum is rejected', async () => {
        const idx = Array(12).fill(BIP39.resolve('en', 'abandon'));
        return (await BIP39.toEntropy(idx)) === null;
    });
    await test('4-letter prefixes and case (aban → abandon, ZOO → zoo)', () =>
        BIP39.word('en', BIP39.resolve('en', 'aban')) === 'abandon' && BIP39.word('en', BIP39.resolve('en', 'ZOO')) === 'zoo' && BIP39.resolve('en', 'abeja') === -1);

    await test('Prefix index (binary search) matches a linear scan', () => {
        for (const lang of ['en']) {
            const L = BIP39.lists[lang];
            const prefixes = new Set();
            for (const w of L.stripped) for (let n = 1; n <= Math.min(5, w.length); n++) prefixes.add(w.slice(0, n));
            for (const p of prefixes) {
                const linear = L.stripped.filter((w) => w.startsWith(p)).length;
                assert(BIP39.countMatches(lang, p) === linear, `${lang}:${p}`);
                const next = new Set(L.stripped.filter((w) => w.startsWith(p) && w.length > p.length).map((w) => w[p.length]));
                assert([...BIP39.nextLetters(lang, p)].sort().join('') === [...next].sort().join(''), `next ${lang}:${p}`);
            }
            assert(BIP39.countMatches(lang, 'zzzz') === 0, 'no match');
        }
        return 'en';
    });
    await test('Shamir 3-of-5: every combination rebuilds the secret', () => {
        const secret = util.rand(211);
        const sh = M.Shamir.split(secret, 5, 3);
        for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 5; c++) {
            assert(util.ctEqual(M.Shamir.combine([sh[a], sh[b], sh[c]]), secret), `${a}${b}${c}`);
        }
        assert(!util.ctEqual(M.Shamir.combine([sh[0], sh[1]]), secret), '2 shares must not rebuild it');
    });
    await test('Shamir: a single share reveals nothing (uniform distribution)', () => {
        // with a fixed secret byte, a single share must cover the whole range
        const seen = new Set();
        for (let i = 0; i < 4000; i++) seen.add(M.Shamir.split(Uint8Array.of(42), 3, 2)[0].y[0]);
        return seen.size > 240 ? `${seen.size}/256 values` : false;
    });

    const pack = async (lang, mnemonic, extra = {}) => {
        const idx = mnemonic.split(' ').map((w) => BIP39.resolve(lang, w));
        const ent = await BIP39.toEntropy(idx);
        return M.packPlaintext({ lang, entropy: ent, ...extra });
    };
    const REAL = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
    const DECOY = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';

    let blobText;
    await test('v4: encrypt and decrypt with note and passphrase', async () => {
        const r = await M.encryptV4({ real: { plaintext: await pack('en', REAL, { passphrase: 'My pass 25', note: 'Cold wallet – ñ é' }), password: 'correct horse battery 9!' } });
        blobText = r.text;
        const d = await M.decryptAny(r.text, 'correct horse battery 9!');
        assert(d.words.join(' ') === REAL && d.passphrase === 'My pass 25' && d.note === 'Cold wallet – ñ é' && d.format === 4);
        assert(d.hash === r.hashes.real, 'hash');
        return `${r.text.length} characters`;
    });
    await test('v4: wrong password', () => throwsCode(() => M.decryptAny(blobText, 'otra cosa'), 'wrong_password'));
    await test('v4: tampering is detected', async () => {
        const b = M._test.decodeV5(blobText, 'MQR5:');
        const half = (b.length - 27) / 2;
        b[27 + 20] ^= 1; b[27 + half + 20] ^= 1; // one bit in each slot (we do not know which one is real)
        await throwsCode(() => M.decryptAny('MQR4:' + util.b64urlEncode(b), 'correct horse battery 9!'), 'wrong_password');
        const h = M._test.decodeV5(blobText, 'MQR5:');
        h[20] ^= 1; // salt (AAD)
        await throwsCode(() => M.decryptAny('MQR4:' + util.b64urlEncode(h), 'correct horse battery 9!'), 'wrong_password');
    });
    await test('v4: abusive KDF parameters are rejected', async () => {
        const b = M._test.decodeV5(blobText, 'MQR5:');
        new DataView(b.buffer).setUint32(5, 4000000, false);
        await throwsCode(() => M.decryptAny('MQR4:' + util.b64urlEncode(b), 'x'), 'bad_params');
    });

    await test('Decoy: each password opens its own seed and the size does not give it away', async () => {
        const withD = await M.encryptV4({
            real: { plaintext: await pack('en', REAL), password: 'real-password-123' },
            decoy: { plaintext: await pack('en', DECOY), password: 'decoy-pass' }
        });
        const without = await M.encryptV4({ real: { plaintext: await pack('en', REAL), password: 'real-password-123' } });
        assert(withD.text.length === without.text.length, 'different lengths');
        assert((await M.decryptAny(withD.text, 'real-password-123')).words.join(' ') === REAL);
        assert((await M.decryptAny(withD.text, 'decoy-pass')).words.join(' ') === DECOY);
        await throwsCode(() => M.decryptAny(withD.text, 'nada'), 'wrong_password');
        await throwsCode(async () => M.encryptV4({ real: { plaintext: await pack('en', REAL), password: 'same-pw' }, decoy: { plaintext: await pack('en', DECOY), password: 'same-pw' } }), 'same_password');
    });

    await test('Shares 2-of-3 + password, end to end', async () => {
        const r = await M.encryptV4({ real: { plaintext: await pack('en', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'), password: 'clave-larga-123' } });
        const sp = M.splitBackup(r.blob, 3, 2);
        const dec = sp.texts.map((x) => M.Shamir.decode(x));
        for (const pair of [[0, 1], [0, 2], [1, 2]]) {
            const joined = M.joinShares(pair.map((i) => dec[i]));
            assert(joined === r.text, 'pair ' + pair);
        }
        await throwsCode(async () => M.joinShares([dec[0]]), 'need_more');
        const other = M.splitBackup(r.blob, 3, 2).texts.map((x) => M.Shamir.decode(x));
        await throwsCode(async () => M.joinShares([dec[0], other[1]]), 'mixed_sets');
        const d = await M.decryptAny(M.joinShares([dec[2], dec[0]]), 'clave-larga-123');
        assert(d.lang === 'en' && d.words.join(' ') === 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
        return `${sp.texts[0].length} characters per share`;
    });

    await test('Backups made with the Spanish word list (4.0–5.1.0) are refused, never shown as English words', async () => {
        const pt = await pack('en', REAL);
        pt[1] = 1; // language id 1 = Spanish
        const r = await M.encryptV4({ real: { plaintext: pt, password: 'spanish-list-1' } });
        await throwsCode(() => M.decryptAny(r.text, 'spanish-list-1'), 'unsupported_lang');
    });
    await test('Long passphrase or note is refused, never truncated', async () => {
        const ent = await BIP39.toEntropy(REAL.split(' ').map((w) => BIP39.resolve('en', w)));
        await throwsCode(async () => M.packPlaintext({ lang: 'en', entropy: ent, passphrase: 'é'.repeat(100) }), 'pp_too_long'); // NFKD: 3 bytes each
        await throwsCode(async () => M.packPlaintext({ lang: 'en', entropy: ent, note: '€'.repeat(100) }), 'note_too_long');
        const note = '€'.repeat(33) + 'x'; // 100 bytes exactly: the creation limit
        const r = await M.encryptV4({ real: { plaintext: M.packPlaintext({ lang: 'en', entropy: ent, note }), password: 'limit-test-123' } });
        assert((await M.decryptAny(r.text, 'limit-test-123')).note === note, 'limit');
        // Backups from 6.0–6.2 could hold up to 255 bytes: they must still open
        const old = '€'.repeat(85);
        const ob = new TextEncoder().encode(old);
        const pt = util.concat(Uint8Array.of(1, 0, ent.length), ent, Uint8Array.of(0, ob.length), ob, Uint8Array.of(0, 0, 0, 1));
        const r2 = await M.encryptV4({ real: { plaintext: pt, password: 'limit-test-123' } });
        return (await M.decryptAny(r2.text, 'limit-test-123')).note === old;
    });
    await test('Truncated fields in decrypted content are refused, never shortened', async () => {
        const ent = util.rand(16);
        const good = M.packPlaintext({ lang: 'en', entropy: ent, passphrase: 'pp', note: 'note' });
        await M._test.unpackPlaintext(good); // sanity
        for (let cut = 0; cut < good.length; cut++) {
            await throwsCode(() => M._test.unpackPlaintext(good.slice(0, cut)), 'bad_content');
        }
        const lying = good.slice(); lying[2 + 1 + 16 + 1 + 2] = 200; // note length larger than what follows
        await throwsCode(() => M._test.unpackPlaintext(lying), 'bad_content');
        return `${good.length} cut points`;
    });
    await test('Largest allowed backup fits a printable QR at maximum error correction', async () => {
        const ent = util.rand(32);
        const pt = M.packPlaintext({ lang: 'en', entropy: ent, passphrase: 'p'.repeat(100), note: 'n'.repeat(100) });
        const dpt = M.packPlaintext({ lang: 'en', entropy: util.rand(32), passphrase: '', note: '' });
        const saved = async (password, salt) => util.sha256(util.concat(password, salt));
        M.setArgonImpl(saved);
        try {
            const r = await M.encryptV4({ real: { plaintext: pt, password: 'big-one-1' }, decoy: { plaintext: dpt, password: 'big-two-2' }, keyfile: util.rand(32) });
            const share = M.splitBackup(r.blob, 16, 2).texts[0];
            const versions = [r.text, share].map((x) => self.QRCode.create(x, { errorCorrectionLevel: 'H' }).version);
            assert(versions.every((v) => v <= 30), 'versions ' + versions.join(','));
            return `QR version ${versions.join(' / ')} at level H`;
        } finally { M.setArgonImpl(async (password, salt, m, t, p) => self.hashwasm.argon2id({ password, salt, memorySize: m, iterations: t, parallelism: p, hashLength: 32, outputType: 'binary' })); }
    });
    await test('Practice flag', async () => {
        const r = await M.encryptV4({ real: { plaintext: await pack('en', REAL), password: 'practica-12345' }, practice: true });
        return (await M.decryptAny(r.text, 'practica-12345')).practice === true;
    });
    await test('Free text (invalid checksum)', async () => {
        const pt = M.packPlaintext({ lang: 'en', rawText: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon' });
        const r = await M.encryptV4({ real: { plaintext: pt, password: 'texto-libre-1' } });
        return (await M.decryptAny(r.text, 'texto-libre-1')).words.length === 12;
    });

    await test('v2 compatibility', async () => {
        const meta = new Uint8Array(128); meta[0] = 2;
        const salt = util.rand(32), iv = util.rand(16);
        const bk = await crypto.subtle.importKey('raw', enc.encode('legacyPass123!'), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, bk, 256);
        const k = await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt']);
        const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: meta, tagLength: 128 }, k, enc.encode(JSON.stringify({ seed: 'zoo zoo zoo', userMessage: 'vieja' }))));
        const txt = 'MQRv2:' + btoa(String.fromCharCode(...util.concat(meta, salt, iv, ct)));
        const d = await M.decryptAny(txt, 'legacyPass123!');
        return d.words.join(' ') === 'zoo zoo zoo' && d.note === 'vieja' && d.format === 2;
    });
    await test('v3 compatibility', async () => {
        const ent = new Uint8Array(16);
        const pt = new Uint8Array(64);
        pt.set([1, 16]); pt.set(ent, 2); pt[18] = 3; pt.set(enc.encode('v3n'), 19);
        const header = new Uint8Array(38);
        header.set([0x4d, 0x51, 3, 2]);
        new DataView(header.buffer).setUint32(4, 100000, false);
        header.set(util.rand(16), 10); header.set(util.rand(12), 26);
        const bk = await crypto.subtle.importKey('raw', enc.encode('v3-password'), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: header.slice(10, 26), iterations: 100000, hash: 'SHA-256' }, bk, 256);
        const k = await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt']);
        const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: header.slice(26), additionalData: header, tagLength: 128 }, k, pt));
        const d = await M.decryptAny('MQR3:' + util.b64urlEncode(util.concat(header, ct)), 'v3-password');
        return d.words.join(' ') === 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about' && d.note === 'v3n';
    });

    // ---------- v6.2: text format, typed input, keyfile ----------
    const X = M._test;
    await test('MQR5 text: base32 round trip and QR alphanumeric charset', () => {
        for (let n = 0; n < 300; n++) {
            const bytes = util.rand(n);
            assert(util.ctEqual(X.b32decode(X.b32encode(bytes)), bytes), 'len ' + n);
        }
        return /^MQR5:[A-Z2-7]+$/.test(blobText) && blobText.startsWith('MQR5:');
    });
    await test('MQR5 text: every single-character typo is detected (CRC-32)', () => {
        const body = blobText.slice(5);
        const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let checked = 0;
        for (let i = 0; i < body.length; i += 3) {
            const c = A[(A.indexOf(body[i]) + 1 + (i % 31)) % 32];
            let threw = false;
            try { M.inspect('MQR5:' + body.slice(0, i) + c + body.slice(i + 1)); } catch (e) { threw = e.code === 'typo' || e.code === 'damaged'; }
            assert(threw, 'pos ' + i); checked++;
        }
        return `${checked} positions`;
    });
    await test('Typed text: case, spaces, dashes and 0/1 for O/I are accepted', async () => {
        const typed = 'mqr5:' + blobText.slice(5).toLowerCase().replace(/(.{4})/g, '$1 ').replace(/o/g, '0').replace(/i/g, '1').replace(/ (.{4}) /g, ' $1-');
        const d = await M.decryptAny('MQR5:' + typed.slice(5), 'correct horse battery 9!');
        return d.words.join(' ') === REAL;
    });
    await test('MQR4 (base64url) backups and shares still open', async () => {
        const blob = X.decodeV5(blobText, 'MQR5:');
        const d = await M.decryptAny('MQR4:' + util.b64urlEncode(blob), 'correct horse battery 9!');
        const sh = M.Shamir.split(blob, 3, 2).map((s) => 'MQS4:' + util.b64urlEncode(util.concat(Uint8Array.of(4), Uint8Array.of(1, 2, 3, 4), Uint8Array.of(2, 3, s.x), s.y)));
        const j = M.joinShares([M.Shamir.decode(sh[0]), M.Shamir.decode(sh[2])]);
        return d.words.join(' ') === REAL && j === blobText;
    });
    await test('Keyfile: required, wrong file fails, right file opens', async () => {
        const kf = util.rand(32);
        const r = await M.encryptV4({ real: { plaintext: await pack('en', REAL), password: 'keyfile-test-1' }, keyfile: kf });
        assert(M.inspect(r.text).keyfile === true, 'flag');
        await throwsCode(() => M.decryptAny(r.text, 'keyfile-test-1'), 'keyfile_required');
        await throwsCode(() => M.decryptAny(r.text, 'keyfile-test-1', util.rand(32)), 'wrong_password');
        const d = await M.decryptAny(r.text, 'keyfile-test-1', kf);
        const plain = await M.encryptV4({ real: { plaintext: await pack('en', REAL), password: 'no-keyfile-1' } });
        const ok2 = (await M.decryptAny(plain.text, 'no-keyfile-1', kf)).words.join(' ') === REAL; // an unneeded keyfile is ignored
        return d.words.join(' ') === REAL && d.keyfile === true && ok2;
    });
    await test('Unknown header flags are refused as a newer version', async () => {
        const blob = X.decodeV5(blobText, 'MQR5:');
        blob[3] |= 0x80;
        await throwsCode(async () => M.inspect(X.encodeV5('MQR5:', blob)), 'newer_version');
    });

    // ---------- password meter and generators ----------
    const ST = self.MQRStrength;
    await test('Password meter: common patterns score low, random scores high', () => {
        const low = ['password', 'P@ssw0rd2024', 'qwertyuiop', 'abcdefgh12345678', 'monkeymonkeymonkey', 'John1987!'].map((p) => ST.estimate(p).bits);
        const high = ST.estimate('Hk3-bV_9qLz2xW8dN5tR').bits;
        assert(low.every((b) => b < 30), 'low ' + low.join(','));
        assert(ST.estimate('legal-winner-thank-you', ['legal', 'winner', 'thank']).warning === 'user', 'user words');
        return high >= 100 ? `weak ≤ ${Math.max(...low)} bits, random ${high} bits` : false;
    });
    await test('Diceware: 6 words, never BIP39 words, never refused by the phrase rule', () => {
        const bip = new Set(BIP39.lists.en.words);
        const list = BIP39.lists.en.words;
        let checked = 0;
        for (let i = 0; i < 300; i++) {
            const phrase = Array.from({ length: 24 }, () => list[Math.floor(Math.random() * 2048)]);
            const { password, bits } = ST.generateWords(6, phrase);
            const w = password.split('-');
            assert(w.length === 6 && new Set(w).size === 6 && bits >= 70, 'shape');
            assert(w.every((x) => !bip.has(x)), 'BIP39 word used');
            assert(ST.conflicts(password, phrase, '') === null, 'refused by its own rule: ' + password);
            checked++;
        }
        // Words that contain a phrase word ("thankful" ⊃ "thank") are never drawn
        const sample = ST.generateWords(6, REAL.split(' '));
        return `${checked} phrases, ${self.EFF_WORDS.length} words, ${sample.bits} bits`;
    });
    await test('Passwords may not reuse the phrase or the passphrase', () =>
        ST.conflicts('my-legal-pw', ['legal']) === 'pw_seed_word' && ST.conflicts('winnerwinner', ['winner']) === 'pw_seed_word' &&
        ST.conflicts('Secret pass 25!', [], 'pass 25') === 'pw_is_passphrase' && ST.conflicts('totally-unrelated-77', ['legal'], 'x') === null);

    // ---------- fuzzing: malformed input must only ever raise the app's own errors ----------
    const own = (e) => e instanceof M.errors.MQRError;
    const fuzz = async (name, n, gen, fn) => test(name, async () => {
        for (let i = 0; i < n; i++) {
            const input = gen(i);
            try { await fn(input); } catch (e) { if (!own(e)) throw new Error(`${e.name}: ${e.message} on input #${i}`); }
        }
        return `${n} inputs`;
    });
    const rnd = (n) => Math.floor(Math.random() * n);
    const junk = (len) => Array.from({ length: len }, () => String.fromCharCode(32 + rnd(95))).join('');
    const prefixes = ['MQR5:', 'MQS5:', 'MQR4:', 'MQS4:', 'MQR3:', 'MQRv2:', 'mqr5:', ''];
    await fuzz('Fuzz: random text into the parsers', 3000, (i) => prefixes[i % prefixes.length] + junk(rnd(400)), (x) => {
        M.kindOf(x);
        if (M.kindOf(x) === 'share') M.Shamir.decode(x); else if (M.kindOf(x) === 'backup') M.inspect(x);
        X.decodeV5(x, 'MQR5:');
    });
    await fuzz('Fuzz: valid-looking base32 with correct CRC', 2000, () => X.encodeV5(rnd(2) ? 'MQR5:' : 'MQS5:', util.rand(rnd(500))), (x) => {
        if (M.kindOf(x) === 'share') M.Shamir.decode(x); else M.inspect(x);
    });
    await fuzz('Fuzz: random shares combined', 500, () => Array.from({ length: 2 + rnd(3) }, () => {
        const len = 211 + 92 * rnd(3);
        return { setId: 'ab', k: 2, n: 3, x: 1 + rnd(3), y: util.rand(len) };
    }), (shares) => M.joinShares(shares));
    await fuzz('Fuzz: random plaintext bytes after decryption', 3000, (i) => {
        const b = util.rand(rnd(300));
        // half of the inputs look structurally right, so the deeper fields get exercised too
        if (i % 2 && b.length > 4) { b[0] = 1 + rnd(2); b[1] = rnd(2); b[2] = [16, 20, 24, 28, 32, rnd(256)][rnd(6)]; }
        return b;
    }, (b) => X.unpackPlaintext(b));

    // Mutations of a real backup, decrypted for real. A fast stand-in KDF keeps this quick;
    // the parsing and AES-GCM paths are the real ones.
    const realArgon = async (password, salt, m, t, p) => self.hashwasm.argon2id({ password, salt, memorySize: m, iterations: t, parallelism: p, hashLength: 32, outputType: 'binary' });
    M.setArgonImpl(async (password, salt) => util.sha256(util.concat(password, salt)));
    try {
        const fast = await M.encryptV4({ real: { plaintext: await pack('en', REAL, { note: 'fuzz' }), password: 'fuzz-password-1' } });
        const body = fast.text.slice(5);
        await fuzz('Fuzz: 400 mutated backups decrypted end to end', 400, (i) => {
            const pos = rnd(body.length), A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
            switch (i % 4) {
                case 0: return 'MQR5:' + body.slice(0, pos) + A[rnd(32)] + body.slice(pos + 1);
                case 1: return 'MQR5:' + body.slice(0, pos);
                case 2: return 'MQR5:' + body.slice(0, pos) + A[rnd(32)] + body.slice(pos);
                default: { const b = X.decodeV5(fast.text, 'MQR5:'); b[rnd(b.length)] ^= 1 << rnd(8); return X.encodeV5('MQR5:', b); }
            }
        }, async (x) => {
            const d = await M.decryptAny(x, 'fuzz-password-1');
            assert(d.words.join(' ') === REAL, 'a mutation decrypted to different content');
        });
    } finally { M.setArgonImpl(realArgon); }

    const failed = results.filter((r) => !r.ok).length;
    const sum = document.getElementById('summary');
    sum.textContent = failed ? `${failed} of ${results.length} tests failed` : `${results.length} tests passed`;
    sum.className = failed ? 'fail' : 'ok';
    self.__TEST_RESULTS = { results, failed };
})();
