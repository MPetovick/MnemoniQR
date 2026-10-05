// MnemoniQR v4 · Pruebas automáticas (se ejecutan en el navegador, sin herramientas)
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
        try { await fn(); } catch (e) { if (code && e.code !== code) throw new Error(`esperaba ${code}, obtuvo ${e.code || e.message}`); return; }
        throw new Error('no lanzó error');
    };

    // Base58Check para comparar con los xprv de los vectores
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
    await test('Integridad de listas BIP39 (en, es)', () => lists.en && lists.es);

    for (const [lang, vectors] of Object.entries(self.BIP39_VECTORS)) {
        await test(`Vectores oficiales ${lang}: entropía ↔ frase (${vectors.length})`, async () => {
            for (const [entHex, mnemonic] of vectors) {
                const idx = await BIP39.fromEntropy(util.fromHex(entHex));
                const m = BIP39.mnemonic(lang, idx);
                assert(m.normalize('NFKD') === mnemonic.normalize('NFKD'), 'frase distinta: ' + entHex);
                const words = mnemonic.normalize('NFKD').split(/\s+/);
                const back = await BIP39.toEntropy(words.map((w) => BIP39.resolve(lang, w)));
                assert(back && util.hex(back) === entHex, 'entropía distinta: ' + entHex);
            }
        });
        await test(`Vectores oficiales ${lang}: semilla con passphrase TREZOR`, async () => {
            for (const [, mnemonic, seedHex] of vectors) {
                assert(util.hex(await BIP39.seed(mnemonic, 'TREZOR')) === seedHex, 'semilla distinta');
            }
        });
        await test(`Vectores oficiales ${lang}: clave maestra BIP32 (xprv)`, async () => {
            for (const [, , seedHex, xprv] of vectors) {
                const raw = b58decode(xprv);
                const I = await M.masterKey(util.fromHex(seedHex));
                assert(util.hex(raw.slice(13, 45)) === util.hex(I.slice(32)), 'chain code');
                assert(util.hex(raw.slice(46, 78)) === util.hex(I.slice(0, 32)), 'clave privada');
            }
        });
    }

    await test('Huella BIP32 conocida (abandon… about → 73c5da0a)', async () =>
        (await M.fingerprint('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', '')) === '73c5da0a');

    await test('Checksum incorrecto se rechaza', async () => {
        const idx = Array(12).fill(BIP39.resolve('en', 'abandon'));
        return (await BIP39.toEntropy(idx)) === null;
    });
    await test('Prefijo de 4 letras y tildes (aban → abandon, abac → ábaco)', () =>
        BIP39.word('en', BIP39.resolve('en', 'aban')) === 'abandon' && BIP39.word('es', BIP39.resolve('es', 'abac')).normalize('NFC') === 'ábaco');
    await test('Detección de idioma', () => BIP39.detect(['abeja', 'abrazo', 'cuerda']) === 'es' && BIP39.detect(['zoo', 'wrong']) === 'en');

    await test('Shamir 3 de 5: todas las combinaciones reconstruyen', () => {
        const secret = util.rand(211);
        const sh = M.Shamir.split(secret, 5, 3);
        for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 5; c++) {
            assert(util.ctEqual(M.Shamir.combine([sh[a], sh[b], sh[c]]), secret), `${a}${b}${c}`);
        }
        assert(!util.ctEqual(M.Shamir.combine([sh[0], sh[1]]), secret), 'con 2 no debería');
    });
    await test('Shamir: un fragmento no aporta información (distribución uniforme)', () => {
        // con un byte secreto fijo, el valor de un fragmento debe cubrir todo el rango
        const seen = new Set();
        for (let i = 0; i < 4000; i++) seen.add(M.Shamir.split(Uint8Array.of(42), 3, 2)[0].y[0]);
        return seen.size > 240 ? `${seen.size}/256 valores` : false;
    });

    const pack = async (lang, mnemonic, extra = {}) => {
        const idx = mnemonic.split(' ').map((w) => BIP39.resolve(lang, w));
        const ent = await BIP39.toEntropy(idx);
        return M.packPlaintext({ lang, entropy: ent, ...extra });
    };
    const REAL = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
    const DECOY = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';

    let blobText;
    await test('v4: cifrar y descifrar con nota y passphrase', async () => {
        const r = await M.encryptV4({ real: { plaintext: await pack('en', REAL, { passphrase: 'Mi pass 25', note: 'Fría ñ' }), password: 'correct horse battery 9!' } });
        blobText = r.text;
        const d = await M.decryptAny(r.text, 'correct horse battery 9!');
        assert(d.words.join(' ') === REAL && d.passphrase === 'Mi pass 25' && d.note === 'Fría ñ' && d.format === 4);
        assert(d.hash === r.hashes.real, 'hash');
        return `${r.text.length} caracteres`;
    });
    await test('v4: contraseña incorrecta', () => throwsCode(() => M.decryptAny(blobText, 'otra cosa'), 'wrong_password'));
    await test('v4: manipulación detectada', async () => {
        const b = util.b64urlDecode(blobText.slice(5));
        const half = (b.length - 27) / 2;
        b[27 + 20] ^= 1; b[27 + half + 20] ^= 1; // un bit en cada hueco (no se sabe cuál es el real)
        await throwsCode(() => M.decryptAny('MQR4:' + util.b64urlEncode(b), 'correct horse battery 9!'), 'wrong_password');
        const h = util.b64urlDecode(blobText.slice(5));
        h[20] ^= 1; // sal (AAD)
        await throwsCode(() => M.decryptAny('MQR4:' + util.b64urlEncode(h), 'correct horse battery 9!'), 'wrong_password');
    });
    await test('v4: parámetros abusivos rechazados', async () => {
        const b = util.b64urlDecode(blobText.slice(5));
        new DataView(b.buffer).setUint32(5, 4000000, false);
        await throwsCode(() => M.decryptAny('MQR4:' + util.b64urlEncode(b), 'x'), 'bad_params');
    });

    await test('Señuelo: cada contraseña abre su semilla y el tamaño no lo delata', async () => {
        const withD = await M.encryptV4({
            real: { plaintext: await pack('en', REAL), password: 'real-password-123' },
            decoy: { plaintext: await pack('en', DECOY), password: 'decoy-pass' }
        });
        const without = await M.encryptV4({ real: { plaintext: await pack('en', REAL), password: 'real-password-123' } });
        assert(withD.text.length === without.text.length, 'longitudes distintas');
        assert((await M.decryptAny(withD.text, 'real-password-123')).words.join(' ') === REAL);
        assert((await M.decryptAny(withD.text, 'decoy-pass')).words.join(' ') === DECOY);
        await throwsCode(() => M.decryptAny(withD.text, 'nada'), 'wrong_password');
        await throwsCode(async () => M.encryptV4({ real: { plaintext: await pack('en', REAL), password: 'mismo' }, decoy: { plaintext: await pack('en', DECOY), password: 'mismo' } }), 'same_password');
    });

    await test('Fragmentos 2 de 3 + contraseña de extremo a extremo', async () => {
        const r = await M.encryptV4({ real: { plaintext: await pack('es', 'ábaco ábaco ábaco ábaco ábaco ábaco ábaco ábaco ábaco ábaco ábaco abierto'), password: 'clave-larga-123' } });
        const sp = M.splitBackup(r.blob, 3, 2);
        const dec = sp.texts.map((x) => M.Shamir.decode(x));
        for (const pair of [[0, 1], [0, 2], [1, 2]]) {
            const joined = M.joinShares(pair.map((i) => dec[i]));
            assert(joined === r.text, 'par ' + pair);
        }
        await throwsCode(async () => M.joinShares([dec[0]]), 'need_more');
        const other = M.splitBackup(r.blob, 3, 2).texts.map((x) => M.Shamir.decode(x));
        await throwsCode(async () => M.joinShares([dec[0], other[1]]), 'mixed_sets');
        const d = await M.decryptAny(M.joinShares([dec[2], dec[0]]), 'clave-larga-123');
        assert(d.lang === 'es' && d.words[0].normalize('NFC') === 'ábaco');
        return `${sp.texts[0].length} caracteres por fragmento`;
    });

    await test('Marca de práctica', async () => {
        const r = await M.encryptV4({ real: { plaintext: await pack('en', REAL), password: 'practica-12345' }, practice: true });
        return (await M.decryptAny(r.text, 'practica-12345')).practice === true;
    });
    await test('Texto libre (checksum no válido)', async () => {
        const pt = M.packPlaintext({ lang: 'en', rawText: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon' });
        const r = await M.encryptV4({ real: { plaintext: pt, password: 'texto-libre-1' } });
        return (await M.decryptAny(r.text, 'texto-libre-1')).words.length === 12;
    });

    await test('Compatibilidad v2', async () => {
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
    await test('Compatibilidad v3', async () => {
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

    await test('Estimador de contraseñas', () => {
        const g = M.estimateBits(M.generatePassword());
        const w = M.estimateBits('Password1234!');
        const d = M.estimateBits('caballo grapa bateria');
        return g >= 110 && w < 60 && d < 60 ? `generada ${g}, débil ${w}, palabras ${d}` : false;
    });

    const failed = results.filter((r) => !r.ok).length;
    const sum = document.getElementById('summary');
    sum.textContent = failed ? `${failed} de ${results.length} pruebas fallan` : `${results.length} pruebas superadas`;
    sum.className = failed ? 'fail' : 'ok';
    self.__TEST_RESULTS = { results, failed };
})();
