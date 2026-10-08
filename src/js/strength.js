// MnemoniQR v6.6.1 · Password strength and generation (no DOM).
// A compact estimator in the spirit of zxcvbn: it finds the patterns an attacker would try first
// (common passwords, dictionary words, names, keyboard runs, sequences, repeats, dates, the user's own
// words) and returns the cheapest way to guess the whole password, in bits.
'use strict';
(function (G) {
    const log2 = Math.log2;
    const MAX_WORD = 24;

    // ---------- dictionaries ----------
    const DICTS = {};
    for (const [name, list] of Object.entries(G.MQR_DICTS || {})) {
        const m = new Map();
        list.split(' ').forEach((w, i) => { if (!m.has(w)) m.set(w, i + 1); });
        DICTS[name] = m;
    }
    const KIND_OF_DICT = { passwords: 'common', english: 'word', names: 'name', surnames: 'name', user: 'user' };

    // Common character substitutions; '1' and '|' are tried as both 'i' and 'l'
    const L33T = { '4': 'a', '@': 'a', '8': 'b', '(': 'c', '{': 'c', '[': 'c', '<': 'c', '3': 'e', '6': 'g', '9': 'g',
        '1': 'i', '!': 'i', '|': 'i', '0': 'o', '$': 's', '5': 's', '+': 't', '7': 't', '%': 'x', '2': 'z' };
    const unleet = (s, alt) => {
        let out = '', subs = 0;
        for (const ch of s) {
            let r = L33T[ch];
            if (alt && (ch === '1' || ch === '|')) r = 'l';
            if (r) { out += r; subs++; } else out += ch;
        }
        return [out, subs];
    };

    // ---------- keyboard adjacency (QWERTY, shifted characters included) ----------
    const ROWS = [['`1234567890-=', '~!@#$%^&*()_+'], ['qwertyuiop[]\\', 'QWERTYUIOP{}|'], ["asdfghjkl;'", 'ASDFGHJKL:"'], ['zxcvbnm,./', 'ZXCVBNM<>?']];
    const KEYPOS = new Map();
    ROWS.forEach(([a, b], r) => { [...a].forEach((ch, c) => KEYPOS.set(ch, [r, c + r * 0.5])); [...b].forEach((ch, c) => KEYPOS.set(ch, [r, c + r * 0.5])); });
    const adjacent = (a, b) => {
        const p = KEYPOS.get(a), q = KEYPOS.get(b);
        if (!p || !q || a.toLowerCase() === b.toLowerCase()) return false;
        return Math.abs(p[0] - q[0]) <= 1 && Math.abs(p[1] - q[1]) <= 1;
    };

    const nCk = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
    function caseBits(word) {
        const up = [...word].filter((c) => c !== c.toLowerCase()).length;
        const low = [...word].filter((c) => c !== c.toUpperCase()).length;
        if (!up) return 0;
        if (!low || /^[A-Z][^A-Z]+$/.test(word) || /^[^A-Z]+[A-Z]$/.test(word)) return 1;
        let v = 0;
        for (let i = 1; i <= Math.min(up, low); i++) v += nCk(up + low, i);
        return log2(v);
    }
    function charsetSize(chars) {
        let n = 0;
        if (chars.some((c) => /[a-z]/.test(c))) n += 26;
        if (chars.some((c) => /[A-Z]/.test(c))) n += 26;
        if (chars.some((c) => /[0-9]/.test(c))) n += 10;
        if (chars.some((c) => /[\x20-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/.test(c))) n += 33;
        if (chars.some((c) => c.codePointAt(0) > 0x7e)) n += 100;
        return Math.max(n, 10);
    }

    // ---------- pattern matching ----------
    function findMatches(chars, userDict) {
        const n = chars.length;
        const lower = chars.map((c) => c.toLowerCase());
        const out = [];
        const dicts = Object.assign({ user: userDict }, DICTS);
        // dictionary words, plain, reversed and with substitutions
        for (let i = 0; i < n; i++) {
            for (let j = i + 3; j <= Math.min(n, i + MAX_WORD); j++) {
                const original = chars.slice(i, j).join('');
                const sub = lower.slice(i, j).join('');
                const variants = [[sub, 0, 0], [[...sub].reverse().join(''), 0, 1]];
                for (const alt of [false, true]) { const [w, s] = unleet(sub, alt); if (s) variants.push([w, s, 0]); }
                for (const [name, dict] of Object.entries(dicts)) {
                    for (const [w, subs, rev] of variants) {
                        const rank = dict.get(w);
                        if (!rank) continue;
                        const bits = log2(rank) + caseBits(original) + (subs ? Math.max(1, subs) : 0) + rev;
                        out.push({ i, j, bits, kind: KIND_OF_DICT[name] });
                    }
                }
            }
        }
        // keyboard runs (4+ adjacent keys)
        for (let i = 0; i < n; i++) {
            let j = i + 1;
            while (j < n && adjacent(chars[j - 1], chars[j])) j++;
            for (let e = i + 4; e <= j; e++) out.push({ i, j: e, bits: log2(94) + (e - i - 1) * 2, kind: 'spatial' });
        }
        // sequences (abc, 135, zyx): constant step of 1 or 2 within one character class
        for (let i = 0; i < n - 2; i++) {
            const d = chars[i + 1].codePointAt(0) - chars[i].codePointAt(0);
            if (!d || Math.abs(d) > 2) continue;
            let j = i + 2;
            while (j < n && chars[j].codePointAt(0) - chars[j - 1].codePointAt(0) === d) j++;
            if (j - i >= 3) {
                const first = chars[i];
                const base = /[a1A0z9Z]/.test(first) ? 2 : /\d/.test(first) ? 10 : 26;
                for (let e = i + 3; e <= j; e++) out.push({ i, j: e, bits: log2(base) + log2(e - i) + (d < 0 ? 1 : 0), kind: 'sequence' });
            }
        }
        // repeats: one character (aaaa) or a repeated block (abcabc)
        // Only primitive units are tried (abab is ab twice, already found with a higher count) and each unit
        // is scored once: this keeps long repetitive input fast (it was cubic, with nested re-scoring).
        const same = (x, y, len) => { for (let k = 0; k < len; k++) if (chars[x + k] !== chars[y + k]) return false; return true; };
        const primitive = (i, unit) => {
            for (let p = 1; p < unit; p++) {
                if (unit % p) continue;
                let periodic = true;
                for (let k = p; k < unit && periodic; k++) periodic = chars[i + k] === chars[i + k - p];
                if (periodic) return false;
            }
            return true;
        };
        const unitCache = new Map();
        for (let i = 0; i < n; i++) {
            for (let unit = 1; unit <= Math.floor((n - i) / 2); unit++) {
                if (!same(i, i + unit, unit) || !primitive(i, unit)) continue;
                let count = 2;
                while (i + (count + 1) * unit <= n && same(i, i + count * unit, unit)) count++;
                if (unit > 1 || count >= 3) {
                    const u = chars.slice(i, i + unit).join('');
                    let unitBits = unitCache.get(u);
                    if (unitBits === undefined) {
                        unitBits = unit === 1 ? log2(charsetSize([u])) : estimateChars([...u], userDict).bits;
                        unitCache.set(u, unitBits);
                    }
                    out.push({ i, j: i + count * unit, bits: unitBits + log2(count), kind: 'repeat' });
                }
            }
        }
        // separators between words: an attacker tries only a handful
        chars.forEach((c, i) => { if (/[\s\-_.,+/]/.test(c)) out.push({ i, j: i + 1, bits: log2(6), kind: 'brute' }); });
        // years and dates
        const text = chars.join('');
        for (const m of text.matchAll(/(?=((?:19|20)\d\d))/g)) out.push({ i: m.index, j: m.index + 4, bits: log2(120), kind: 'date' });
        for (const m of text.matchAll(/(?=(\d{1,2}[-/._ ]?\d{1,2}[-/._ ]?(?:19|20)?\d\d))/g)) {
            if (m[1].length >= 4) out.push({ i: m.index, j: m.index + m[1].length, bits: log2(365 * 120), kind: 'date' });
        }
        return out;
    }

    // Cheapest cover of the password by patterns and brute-force segments (dynamic programming in log2 space).
    // k patterns in sequence also cost log2(k!), the number of ways an attacker orders them.
    function estimateChars(chars, userDict) {
        const n = chars.length;
        if (!n) return { bits: 0, kinds: [] };
        const matches = findMatches(chars, userDict);
        const byEnd = Array.from({ length: n + 1 }, () => []);
        for (const m of matches) byEnd[m.j].push(m);
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j <= n; j++) {
                const seg = chars.slice(i, j);
                byEnd[j].push({ i, j, bits: (j - i) * log2(charsetSize(seg)), kind: 'brute' });
            }
        }
        const K = n + 1;
        const best = Array.from({ length: n + 1 }, () => new Float64Array(K).fill(Infinity));
        const from = Array.from({ length: n + 1 }, () => new Array(K).fill(null));
        best[0][0] = 0;
        for (let j = 1; j <= n; j++) {
            for (const m of byEnd[j]) {
                for (let k = 0; k < K - 1; k++) {
                    const prev = best[m.i][k];
                    if (prev === Infinity) continue;
                    const v = prev + m.bits;
                    if (v < best[j][k + 1]) { best[j][k + 1] = v; from[j][k + 1] = m; }
                }
            }
        }
        let bits = Infinity, bestK = 1, fact = 0;
        for (let k = 1; k < K; k++) {
            fact += log2(k);
            const v = best[n][k] + fact;
            if (v < bits) { bits = v; bestK = k; }
        }
        const kinds = [];
        for (let j = n, k = bestK; j > 0 && k > 0; k--) { const m = from[j][k]; kinds.push({ kind: m.kind, len: m.j - m.i }); j = m.i; }
        return { bits, kinds };
    }

    const CHUNK = 64; // long inputs are scored in chunks so every keystroke stays fast
    function estimate(password, userInputs = []) {
        const chars = Array.from(String(password || '').normalize('NFC'));
        const user = new Map();
        userInputs.filter(Boolean).map((w) => String(w).toLowerCase()).forEach((w, i) => { if (w.length >= 3 && !user.has(w)) user.set(w, i + 1); });
        let bits = 0;
        const kinds = [];
        for (let i = 0; i < chars.length; i += CHUNK) {
            const r = estimateChars(chars.slice(i, i + CHUNK), user);
            bits += r.bits;
            kinds.push(...r.kinds);
        }
        // The warning names the weakest-looking pattern that covers a meaningful part of the password
        const order = ['user', 'common', 'spatial', 'sequence', 'repeat', 'date', 'name', 'word'];
        const found = kinds.filter((k) => k.kind !== 'brute' && k.len >= 3).map((k) => k.kind);
        const warning = order.find((k) => found.includes(k)) || null;
        return { bits: Math.max(0, Math.round(bits)), warning };
    }

    // ---------- generators ----------
    // Uniform integer in [0, n) by rejection sampling (no modulo bias)
    function uniform(n) {
        const limit = Math.floor(0x100000000 / n) * n;
        const buf = new Uint32Array(1);
        do crypto.getRandomValues(buf); while (buf[0] >= limit);
        const v = buf[0] % n;
        buf[0] = 0;
        return v;
    }
    // Diceware: words from the EFF list (BIP39 words already removed). Candidates that would break the
    // phrase-reuse rule (e.g. "thankful" when the phrase has "thank") are skipped, so a generated password
    // is never refused by conflicts(). The bits are computed on the list that remains after exclusion.
    function generateWords(count = 6, phraseWords = []) {
        const list = G.EFF_WORDS || [];
        if (list.length < 1000) throw new Error('word list unavailable');
        const phrase = [...phraseWords].filter(Boolean);
        const usable = phrase.length ? list.filter((w) => !conflicts(w, phrase, '')) : list;
        const words = [];
        while (words.length < count) {
            const w = usable[uniform(usable.length)];
            if (!words.includes(w)) words.push(w);
        }
        let bits = 0;
        for (let i = 0; i < count; i++) bits += log2(usable.length - i);
        return { password: words.join('-'), bits: Math.floor(bits) };
    }

    // Hard rules: the password must not reuse the recovery phrase or the BIP39 passphrase
    function conflicts(password, phraseWords = [], passphrase = '') {
        const pw = String(password || '').toLowerCase();
        const words = new Set(phraseWords.filter(Boolean).map((w) => w.toLowerCase()));
        const tokens = pw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z]+/).filter((t) => t.length >= 3);
        if (tokens.some((t) => words.has(t)) || [...words].some((w) => w.length >= 5 && pw.includes(w))) return 'pw_seed_word';
        const pp = String(passphrase || '').toLowerCase();
        if (pp && (pw === pp || (pp.length >= 4 && pw.includes(pp)))) return 'pw_is_passphrase';
        return null;
    }

    G.MQRStrength = Object.freeze({ estimate, generateWords, conflicts });
})(self);
