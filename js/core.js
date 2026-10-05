// ============================================================
// MnemoniQR v5.1.0 · Core (no DOM). Used by the app and by tests/tests.html.
// ============================================================
'use strict';
(function (G) {
    const enc = new TextEncoder();
    const dec = new TextDecoder('utf-8', { fatal: true });

    const C = Object.freeze({
        MAGIC_V4: 'MQR4:',
        MAGIC_SHARE: 'MQS4:',
        MAGIC_V3: 'MQR3:',
        MAGIC_V2: 'MQRv2:',
        HEADER_LEN: 27,
        SALT_LEN: 16,
        IV_LEN: 12,
        TAG_LEN: 16,
        PAD_BLOCK: 64,
        VALID_WORD_COUNTS: [12, 15, 18, 21, 24],
        PASSPHRASE_MAX: 100,
        NOTE_MAX: 100,
        LEVELS: Object.freeze({
            standard: { m: 65536, t: 3, p: 1 },
            high: { m: 131072, t: 4, p: 1 },
            max: { m: 262144, t: 4, p: 1 }
        }),
        PBKDF2_FALLBACK_ITER: 600000,
        LEGACY_V3_PBKDF2_MIN: 100000,
        LEGACY_V2_ITER: 310000,
        WORDLIST_SHA256: Object.freeze({
            en: 'f18b9a84c83e38e98eceb0102b275e26438af83ab08f080cdb780a2caa9f3a6d',
            es: '27e99ad4328299108663c19eb611310bd3b77260af852169108713019831d07d'
        }),
        LANG_IDS: Object.freeze({ en: 0, es: 1 }),
        FLAG_PRACTICE: 1
    });
    const LANG_BY_ID = ['en', 'es'];
    const KDF = Object.freeze({ ARGON2ID: 1, PBKDF2: 2 });

    // ---------- helpers ----------
    // Zero-fills; skips buffers already transferred to a worker
    const wipe = (...a) => a.forEach((x) => { if (x && x.fill && x.buffer && x.buffer.byteLength) x.fill(0); });
    const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
    const concat = (...arrs) => {
        const out = new Uint8Array(arrs.reduce((s, a) => s + a.length, 0));
        let o = 0;
        for (const a of arrs) { out.set(a, o); o += a.length; }
        return out;
    };
    const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => Uint8Array.from(h.match(/../g) || [], (x) => parseInt(x, 16));
    function b64urlEncode(bytes) {
        let s = '';
        for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function b64urlDecode(str) {
        if (!/^[A-Za-z0-9_-]*$/.test(str)) throw new FormatError('bad_encoding');
        const s = str.replace(/-/g, '+').replace(/_/g, '/');
        const bin = atob(s + '==='.slice((s.length + 3) % 4));
        return Uint8Array.from(bin, (c) => c.charCodeAt(0));
    }
    async function sha256(bytes) { return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)); }
    async function sha256Hex(bytes) { return hex(await sha256(bytes)); }
    function ctEqual(a, b) {
        if (a.length !== b.length) return false;
        let d = 0;
        for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
        return d === 0;
    }

    // Errors carry a code so the UI can translate them
    class MQRError extends Error { constructor(code) { super(code); this.code = code; } }
    class FormatError extends MQRError {}
    class WrongPassword extends MQRError { constructor() { super('wrong_password'); } }

    // ============================================================
    // BIP39
    // ============================================================
    const strip = (w) => w.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    const BIP39 = {
        lists: {},

        async init() {
            const src = G.BIP39_LISTS || {};
            const ok = {};
            for (const lang of Object.keys(C.WORDLIST_SHA256)) {
                const words = src[lang];
                if (!words || words.length !== 2048) { ok[lang] = false; continue; }
                ok[lang] = (await sha256Hex(enc.encode(words.join(' ')))) === C.WORDLIST_SHA256[lang];
                if (!ok[lang]) continue;
                const stripped = words.map(strip);
                // Indices sorted by their accent-free spelling: prefix lookups become two binary searches
                const order = Uint16Array.from(stripped.keys()).sort((a, b) => (stripped[a] < stripped[b] ? -1 : 1));
                this.lists[lang] = { words, stripped, order, index: new Map(stripped.map((w, i) => [w, i])) };
            }
            return ok;
        },

        available(lang) { return !!this.lists[lang]; },

        // [lo, hi) range in `order` of the words starting with prefix t (no caching: typed prefixes are secret)
        range(L, t) {
            const lb = (x) => {
                let lo = 0, hi = L.order.length;
                while (lo < hi) { const mid = (lo + hi) >> 1; if (L.stripped[L.order[mid]] < x) lo = mid + 1; else hi = mid; }
                return lo;
            };
            return [lb(t), lb(t + '{')]; // '{' sorts right after 'z'
        },

        // Exact index, or unique prefix of 4+ letters (guaranteed unique by BIP39)
        resolve(lang, typed) {
            const L = this.lists[lang];
            const t = strip(typed);
            if (!t) return -1;
            if (L.index.has(t)) return L.index.get(t);
            if (t.length < 4) return -1;
            const [lo, hi] = this.range(L, t);
            return hi - lo === 1 ? L.order[lo] : -1;
        },

        candidates(lang, prefix, max = 4) {
            const L = this.lists[lang];
            const t = strip(prefix);
            if (!t) return [];
            const [lo, hi] = this.range(L, t);
            return Array.from(L.order.subarray(lo, Math.min(hi, lo + max)));
        },

        countMatches(lang, prefix) {
            const L = this.lists[lang];
            const [lo, hi] = this.range(L, strip(prefix));
            return hi - lo;
        },

        // Letters that can continue the prefix (smart keyboard)
        nextLetters(lang, prefix) {
            const L = this.lists[lang];
            const t = strip(prefix);
            const [lo, hi] = this.range(L, t);
            const out = new Set();
            for (let k = lo; k < hi; k++) { const w = L.stripped[L.order[k]]; if (w.length > t.length) out.add(w[t.length]); }
            return out;
        },

        // Language in which every word is valid (or null)
        detect(typedWords) {
            for (const lang of Object.keys(this.lists)) {
                if (typedWords.every((w) => this.resolve(lang, w) >= 0)) return lang;
            }
            return null;
        },

        word(lang, i) { return this.lists[lang].words[i].normalize('NFC'); },
        mnemonic(lang, indices) { return indices.map((i) => this.lists[lang].words[i]).join(' '); },

        async toEntropy(indices) {
            if (!C.VALID_WORD_COUNTS.includes(indices.length)) return null;
            let bits = '';
            for (const i of indices) {
                if (!(i >= 0 && i < 2048)) return null;
                bits += i.toString(2).padStart(11, '0');
            }
            const csLen = indices.length / 3;
            const entBits = bits.slice(0, -csLen);
            const expected = bits.slice(-csLen);
            const entropy = new Uint8Array(entBits.length / 8);
            for (let i = 0; i < entropy.length; i++) entropy[i] = parseInt(entBits.slice(i * 8, i * 8 + 8), 2);
            const h = await sha256(entropy);
            const ok = h[0].toString(2).padStart(8, '0').slice(0, csLen) === expected;
            wipe(h);
            if (!ok) { wipe(entropy); return null; }
            return entropy;
        },

        async fromEntropy(entropy) {
            if (![16, 20, 24, 28, 32].includes(entropy.length)) throw new FormatError('bad_content');
            const h = await sha256(entropy);
            let bits = Array.from(entropy, (b) => b.toString(2).padStart(8, '0')).join('');
            bits += h[0].toString(2).padStart(8, '0').slice(0, entropy.length / 4);
            const out = [];
            for (let i = 0; i < bits.length; i += 11) out.push(parseInt(bits.slice(i, i + 11), 2));
            return out;
        },

        async seed(mnemonic, passphrase = '') {
            const pw = enc.encode(mnemonic.normalize('NFKD'));
            const salt = enc.encode(('mnemonic' + passphrase).normalize('NFKD'));
            const base = await crypto.subtle.importKey('raw', pw, 'PBKDF2', false, ['deriveBits']);
            const out = new Uint8Array(await crypto.subtle.deriveBits(
                { name: 'PBKDF2', salt, iterations: 2048, hash: 'SHA-512' }, base, 512));
            wipe(pw, salt);
            return out;
        },

        randomIndices(count = 12) {
            const ent = rand((count * 11 - count / 3) / 8);
            return this.fromEntropy(ent).finally(() => wipe(ent));
        }
    };

    // ============================================================
    // BIP32 wallet master fingerprint
    // ============================================================
    async function masterKey(seed) {
        const k = await crypto.subtle.importKey('raw', enc.encode('Bitcoin seed'), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
        return new Uint8Array(await crypto.subtle.sign('HMAC', k, seed));
    }
    async function fingerprint(mnemonic, passphrase = '') {
        const N = G.nobleMQR;
        if (!N) throw new MQRError('no_secp');
        const seed = await BIP39.seed(mnemonic, passphrase);
        const I = await masterKey(seed);
        const priv = I.slice(0, 32);
        try {
            const pub = N.getPublicKey(priv, true);
            const id = N.ripemd160(await sha256(pub));
            return hex(id.slice(0, 4));
        } finally { wipe(seed, I, priv); }
    }

    // ============================================================
    // Shamir secret sharing over GF(256) (polynomial 0x11b, generator 3)
    // ============================================================
    const GF = (() => {
        const exp = new Uint8Array(510), log = new Uint8Array(256);
        let x = 1;
        for (let i = 0; i < 255; i++) {
            exp[i] = x; log[x] = i;
            x ^= (x << 1) ^ ((x & 0x80) ? 0x11b : 0); // x * 3
            x &= 0xff;
        }
        for (let i = 255; i < 510; i++) exp[i] = exp[i - 255];
        const mul = (a, b) => (a && b ? exp[log[a] + log[b]] : 0);
        const div = (a, b) => { if (!b) throw new Error('div0'); return a ? exp[log[a] + 255 - log[b]] : 0; };
        return { mul, div };
    })();

    const Shamir = {
        split(secret, n, k) {
            if (!(k >= 2 && n >= k && n <= 16)) throw new MQRError('bad_shamir');
            const shares = Array.from({ length: n }, (_, i) => ({ x: i + 1, y: new Uint8Array(secret.length) }));
            const coef = new Uint8Array(k);
            for (let b = 0; b < secret.length; b++) {
                coef[0] = secret[b];
                crypto.getRandomValues(coef.subarray(1));
                for (const s of shares) {
                    let acc = 0; // Horner's method
                    for (let j = k - 1; j >= 0; j--) acc = GF.mul(acc, s.x) ^ coef[j];
                    s.y[b] = acc;
                }
            }
            wipe(coef);
            return shares;
        },
        combine(shares) {
            const len = shares[0].y.length;
            const out = new Uint8Array(len);
            for (let b = 0; b < len; b++) {
                let acc = 0;
                for (let i = 0; i < shares.length; i++) {
                    let num = 1, den = 1;
                    for (let j = 0; j < shares.length; j++) {
                        if (i === j) continue;
                        num = GF.mul(num, shares[j].x);
                        den = GF.mul(den, shares[i].x ^ shares[j].x);
                    }
                    acc ^= GF.mul(shares[i].y[b], GF.div(num, den));
                }
                out[b] = acc;
            }
            return out;
        },
        // Share text: MQS4: + [version][set id 4][k][n][x][data]
        encode(setId, k, n, share) {
            return C.MAGIC_SHARE + b64urlEncode(concat(Uint8Array.of(4), setId, Uint8Array.of(k, n, share.x), share.y));
        },
        decode(text) {
            if (!text.startsWith(C.MAGIC_SHARE)) throw new FormatError('not_mqr');
            const b = b64urlDecode(text.slice(C.MAGIC_SHARE.length));
            if (b.length < 9 + 40 || b[0] !== 4) throw new FormatError('damaged');
            const k = b[5], n = b[6], x = b[7];
            if (!(k >= 2 && n >= k && n <= 16 && x >= 1 && x <= n)) throw new FormatError('damaged');
            return { setId: hex(b.slice(1, 5)), k, n, x, y: b.slice(8), text };
        }
    };

    // ============================================================
    // Key derivation (Argon2id in a worker or on the main thread)
    // ============================================================
    let argonImpl = async (password, salt, m, t, p) => {
        if (!G.hashwasm || typeof G.hashwasm.argon2id !== 'function') throw new MQRError('no_argon');
        return G.hashwasm.argon2id({ password, salt, memorySize: m, iterations: t, parallelism: p, hashLength: 32, outputType: 'binary' });
    };
    function setArgonImpl(fn) { argonImpl = fn; }

    async function deriveKey(password, salt, kdf, p1, p2, p3) {
        let raw;
        if (kdf === KDF.ARGON2ID) raw = await argonImpl(password.slice(), salt, p1, p2, p3);
        else if (kdf === KDF.PBKDF2) {
            const base = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits']);
            raw = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: p1, hash: 'SHA-256' }, base, 256));
        } else throw new FormatError('bad_kdf');
        const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
        wipe(raw);
        return key;
    }
    const pwBytes = (s) => enc.encode(s.normalize('NFKC'));

    // ============================================================
    // v4 plaintext
    // [type][lang][data][passphrase len][passphrase][note len][note][created u32]
    // type 1 = BIP39 entropy, type 2 = free text (invalid checksum)
    // ============================================================
    function packPlaintext({ lang, entropy, rawText, passphrase = '', note = '' }) {
        const pp = enc.encode(passphrase.normalize('NFKD')).slice(0, 255);
        const nt = enc.encode(note).slice(0, 255);
        const created = Math.floor(Date.now() / 1000);
        let body;
        if (entropy) body = concat(Uint8Array.of(1, C.LANG_IDS[lang] || 0, entropy.length), entropy);
        else {
            const t = enc.encode(rawText);
            body = concat(Uint8Array.of(2, C.LANG_IDS[lang] || 0, t.length >> 8, t.length & 255), t);
        }
        const ts = new Uint8Array(4);
        new DataView(ts.buffer).setUint32(0, created, false);
        const out = concat(body, Uint8Array.of(pp.length), pp, Uint8Array.of(nt.length), nt, ts);
        wipe(body, pp);
        return out;
    }
    function padTo(bytes, len) {
        const out = new Uint8Array(len);
        out.set(bytes);
        return out;
    }
    const bucket = (n) => Math.max(C.PAD_BLOCK, Math.ceil(n / C.PAD_BLOCK) * C.PAD_BLOCK);

    async function unpackPlaintext(pt) {
        let o = 0;
        const type = pt[o++];
        const lang = LANG_BY_ID[pt[o++]] || 'en';
        let indices = null, rawText = null;
        if (type === 1) {
            const n = pt[o++];
            const ent = pt.slice(o, o + n); o += n;
            indices = await BIP39.fromEntropy(ent);
            wipe(ent);
        } else if (type === 2) {
            const n = (pt[o] << 8) | pt[o + 1]; o += 2;
            rawText = dec.decode(pt.subarray(o, o + n)); o += n;
        } else throw new FormatError('bad_content');
        const pl = pt[o++];
        const passphrase = dec.decode(pt.subarray(o, o + pl)); o += pl;
        const nl = pt[o++];
        const note = dec.decode(pt.subarray(o, o + nl)); o += nl;
        const created = new DataView(pt.buffer, pt.byteOffset).getUint32(o, false);
        const words = indices ? indices.map((i) => BIP39.word(lang, i)) : rawText.split(' ');
        return { lang, words, indices, passphrase, note, created: created ? new Date(created * 1000) : null };
    }

    // ============================================================
    // v4 format: header + 2 slots of equal size (real and decoy/random)
    // Header: 'MQ' | 4 | flags | kdf | p1 u32 | p2 | p3 | salt16  (27 bytes, used as AAD)
    // Slot:   iv12 | ciphertext(L) | tag16
    // ============================================================
    function buildHeader(flags, kdf, p1, p2, p3, salt) {
        const h = new Uint8Array(C.HEADER_LEN);
        h[0] = 0x4d; h[1] = 0x51; h[2] = 4; h[3] = flags; h[4] = kdf;
        new DataView(h.buffer).setUint32(5, p1, false);
        h[9] = p2; h[10] = p3; h.set(salt, 11);
        return h;
    }
    function parseHeader(h) {
        const dv = new DataView(h.buffer, h.byteOffset, h.length);
        return { flags: h[3], kdf: h[4], p1: dv.getUint32(5, false), p2: h[9], p3: h[10], salt: h.slice(11, 27) };
    }
    function checkParams(kdf, p1, p2, p3) {
        if (kdf === KDF.ARGON2ID && (p1 < 8192 || p1 > 524288 || p2 < 1 || p2 > 16 || p3 < 1 || p3 > 8)) throw new FormatError('bad_params');
        if (kdf === KDF.PBKDF2 && (p1 < C.LEGACY_V3_PBKDF2_MIN || p1 > 5000000)) throw new FormatError('bad_params');
        if (kdf !== KDF.ARGON2ID && kdf !== KDF.PBKDF2) throw new FormatError('bad_kdf');
    }

    async function encryptV4({ real, decoy = null, level = 'standard', practice = false, onKdf }) {
        const salt = rand(C.SALT_LEN);
        const lv = C.LEVELS[level] || C.LEVELS.standard;
        let kdf = KDF.ARGON2ID, p1 = lv.m, p2 = lv.t, p3 = lv.p;
        const pw1 = pwBytes(real.password);
        let key1;
        try { key1 = await deriveKey(pw1, salt, kdf, p1, p2, p3); }
        catch (e) {
            // Fall back to PBKDF2 only when WebAssembly is unavailable; out-of-memory and cancellation are reported
            if (e.code !== 'no_argon') { wipe(pw1); throw e; }
            kdf = KDF.PBKDF2; p1 = C.PBKDF2_FALLBACK_ITER; p2 = 0; p3 = 0;
            key1 = await deriveKey(pw1, salt, kdf, p1, p2, p3);
        }
        if (onKdf) onKdf(1);
        const header = buildHeader(practice ? C.FLAG_PRACTICE : 0, kdf, p1, p2, p3, salt);
        const L = bucket(Math.max(real.plaintext.length, decoy ? decoy.plaintext.length : 0));
        const hashes = {};
        const seal = async (key, pt, name) => {
            const iv = rand(C.IV_LEN);
            const padded = padTo(pt, L);
            hashes[name] = await sha256Hex(padded);
            const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: header, tagLength: 128 }, key, padded));
            wipe(padded);
            return concat(iv, ct);
        };
        const slotReal = await seal(key1, real.plaintext, 'real');
        let slotOther;
        if (decoy) {
            const pw2 = pwBytes(decoy.password);
            if (ctEqual(pw1, pw2)) throw new MQRError('same_password');
            const key2 = await deriveKey(pw2, salt, kdf, p1, p2, p3);
            wipe(pw2);
            if (onKdf) onKdf(2);
            slotOther = await seal(key2, decoy.plaintext, 'decoy');
        } else {
            slotOther = rand(C.IV_LEN + L + C.TAG_LEN); // indistinguishable from an encrypted slot
        }
        wipe(pw1);
        const first = rand(1)[0] & 1; // random slot order
        const blob = concat(header, first ? slotOther : slotReal, first ? slotReal : slotOther);
        return { blob, text: C.MAGIC_V4 + b64urlEncode(blob), kdf, hashes };
    }

    function parseV4(text) {
        if (!text.startsWith(C.MAGIC_V4)) throw new FormatError('not_mqr');
        const blob = b64urlDecode(text.slice(C.MAGIC_V4.length));
        return parseV4Blob(blob);
    }
    function parseV4Blob(blob) {
        if (blob.length < C.HEADER_LEN + 2 * (C.IV_LEN + C.PAD_BLOCK + C.TAG_LEN) || blob[0] !== 0x4d || blob[1] !== 0x51 || blob[2] !== 4) throw new FormatError('damaged');
        const slotLen = (blob.length - C.HEADER_LEN) / 2;
        if (!Number.isInteger(slotLen)) throw new FormatError('damaged');
        const header = blob.slice(0, C.HEADER_LEN);
        return { header, ...parseHeader(header), slots: [blob.slice(C.HEADER_LEN, C.HEADER_LEN + slotLen), blob.slice(C.HEADER_LEN + slotLen)] };
    }

    async function decryptV4(text, password) {
        const P = parseV4(text);
        checkParams(P.kdf, P.p1, P.p2, P.p3);
        const pw = pwBytes(password);
        const key = await deriveKey(pw, P.salt, P.kdf, P.p1, P.p2, P.p3);
        wipe(pw);
        // Always try both slots, so timing does not reveal which one opened
        const tries = await Promise.all(P.slots.map((s) => crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: s.slice(0, C.IV_LEN), additionalData: P.header, tagLength: 128 }, key, s.slice(C.IV_LEN))
            .then((b) => new Uint8Array(b), () => null)));
        const pt = tries.find(Boolean);
        tries.forEach((t) => { if (t && t !== pt) wipe(t); });
        if (!pt) throw new WrongPassword();
        const hash = await sha256Hex(pt);
        const res = await unpackPlaintext(pt);
        wipe(pt);
        return { ...res, hash, format: 4, kdf: P.kdf, practice: !!(P.flags & C.FLAG_PRACTICE) };
    }

    // ---------- v3 compatibility ----------
    async function decryptV3(text, password) {
        const blob = b64urlDecode(text.slice(C.MAGIC_V3.length));
        const hl = 10 + 16 + 12;
        if (blob.length < hl + 16 || blob[0] !== 0x4d || blob[1] !== 0x51 || blob[2] !== 3) throw new FormatError('damaged');
        const header = blob.slice(0, hl);
        const dv = new DataView(header.buffer);
        const kdf = header[3], p1 = dv.getUint32(4, false), p2 = header[8], p3 = header[9];
        checkParams(kdf, p1, p2, p3);
        const pw = pwBytes(password);
        const key = await deriveKey(pw, header.slice(10, 26), kdf, p1, p2, p3);
        wipe(pw);
        let pt;
        try { pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: header.slice(26, hl), additionalData: header, tagLength: 128 }, key, blob.slice(hl))); }
        catch { throw new WrongPassword(); }
        const hash = await sha256Hex(pt);
        let o = 0, words;
        const type = pt[o++];
        if (type === 1) { const n = pt[o++]; const e = pt.slice(o, o + n); o += n; words = (await BIP39.fromEntropy(e)).map((i) => BIP39.word('en', i)); wipe(e); }
        else if (type === 2) { const n = (pt[o] << 8) | pt[o + 1]; o += 2; words = dec.decode(pt.subarray(o, o + n)).split(' '); o += n; }
        else throw new FormatError('bad_content');
        const nl = pt[o++];
        const note = dec.decode(pt.subarray(o, o + nl)); o += nl;
        const ts = new DataView(pt.buffer).getUint32(o, false);
        wipe(pt);
        return { lang: 'en', words, indices: type === 1 ? words.map((w) => BIP39.resolve('en', w)) : null, passphrase: '', note, created: ts ? new Date(ts * 1000) : null, hash, format: 3, kdf, practice: false };
    }

    // ---------- v2 compatibility ----------
    async function decryptV2(text, password) {
        let data;
        try { data = Uint8Array.from(atob(text.slice(C.MAGIC_V2.length)), (c) => c.charCodeAt(0)); } catch { throw new FormatError('damaged'); }
        if (data.length < 192) throw new FormatError('damaged');
        const meta = data.slice(0, 128);
        const key = await deriveKey(enc.encode(password), data.slice(128, 160), KDF.PBKDF2, C.LEGACY_V2_ITER);
        let pt;
        try { pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(160, 176), additionalData: meta, tagLength: 128 }, key, data.slice(176))); }
        catch { throw new WrongPassword(); }
        const hash = await sha256Hex(pt);
        const p = JSON.parse(dec.decode(pt));
        wipe(pt);
        const ts = new DataView(meta.buffer).getUint32(2, false);
        const words = String(p.seed || '').trim().split(/\s+/);
        const idx = words.map((w) => BIP39.resolve('en', w));
        return { lang: 'en', words, indices: idx.every((i) => i >= 0) ? idx : null, passphrase: '', note: String(p.userMessage || ''), created: ts ? new Date(ts * 1000) : null, hash, format: 2, kdf: KDF.PBKDF2, practice: false };
    }

    async function decryptAny(text, password) {
        if (text.startsWith(C.MAGIC_V4)) return decryptV4(text, password);
        if (text.startsWith(C.MAGIC_V3)) return decryptV3(text, password);
        if (text.startsWith(C.MAGIC_V2)) return decryptV2(text, password);
        throw new FormatError('not_mqr');
    }

    function kindOf(text) {
        if (typeof text !== 'string') return null;
        if (text.startsWith(C.MAGIC_SHARE)) return 'share';
        if (text.startsWith(C.MAGIC_V4) || text.startsWith(C.MAGIC_V3) || text.startsWith(C.MAGIC_V2)) return 'backup';
        return null;
    }

    // Split a v4 backup into shares
    function splitBackup(blob, n, k) {
        const setId = rand(4);
        const shares = Shamir.split(blob, n, k);
        const texts = shares.map((s) => Shamir.encode(setId, k, n, s));
        shares.forEach((s) => wipe(s.y));
        return { setId: hex(setId), texts };
    }
    function joinShares(decoded) {
        const first = decoded[0];
        const uniq = new Map();
        for (const d of decoded) {
            if (d.setId !== first.setId || d.k !== first.k || d.n !== first.n || d.y.length !== first.y.length) throw new MQRError('mixed_sets');
            uniq.set(d.x, d);
        }
        if (uniq.size < first.k) throw new MQRError('need_more');
        const blob = Shamir.combine([...uniq.values()].slice(0, first.k));
        parseV4Blob(blob); // validates the structure
        return C.MAGIC_V4 + b64urlEncode(blob);
    }

    // Password: heuristic entropy estimate
    function estimateBits(pwd) {
        if (!pwd) return 0;
        let pool = 0;
        if (/[a-z]/.test(pwd)) pool += 26;
        if (/[A-Z]/.test(pwd)) pool += 26;
        if (/[0-9]/.test(pwd)) pool += 10;
        if (/[^\w\s]|_/.test(pwd)) pool += 33;
        if (/\s/.test(pwd)) pool += 1;
        if (/[^\x00-\x7f]/.test(pwd)) pool += 64;
        const chars = Array.from(pwd);
        let bits = chars.length * Math.log2(Math.max(pool, 2));
        const unique = new Set(chars).size;
        if (unique < chars.length / 2) bits *= unique / (chars.length / 2);
        if (/(.)\1{2,}/.test(pwd)) bits -= 10;
        const lower = strip(pwd);
        for (const c of ['password', 'contrasena', 'contrasenya', 'qwerty', 'asdf', '123456', 'abcdef', 'bitcoin', 'wallet', 'cartera', 'mnemoniqr', 'seed', 'semilla', 'admin', 'letmein', 'iloveyou', 'hola', 'hello', 'azerty', 'motdepasse', 'пароль', 'parol']) if (lower.includes(c)) bits -= 20;
        if (/(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef)/.test(lower)) bits -= 10;
        if (/(19|20)\d{2}/.test(pwd)) bits -= 6;
        // Space-separated dictionary words: count per word, not per letter
        const parts = pwd.trim().split(/\s+/);
        if (parts.length >= 2 && parts.every((w) => /^[\p{L}]+$/u.test(w))) bits = Math.min(bits, parts.length * 11);
        return Math.max(0, Math.round(bits));
    }
    function generatePassword(len = 20) {
        const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        const r = rand(len);
        let s = '';
        for (const b of r) s += A[b & 63];
        wipe(r);
        return s;
    }

    G.MQR = Object.freeze({
        C, KDF, BIP39, Shamir, fingerprint, masterKey, setArgonImpl,
        packPlaintext, encryptV4, bucket, decryptAny, splitBackup, joinShares, kindOf, parseV4,
        estimateBits, generatePassword,
        util: { wipe, rand, hex, fromHex, concat, b64urlEncode, b64urlDecode, sha256, sha256Hex, strip, ctEqual },
        errors: { MQRError, FormatError, WrongPassword }
    });
})(self);
