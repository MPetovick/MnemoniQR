// ============================================================
// MnemoniQR v3.0
// Cifrado local de frases BIP39 en QR. Sin red, sin terceros.
// ============================================================
'use strict';

const CONFIG = Object.freeze({
    MAGIC_V3: 'MQR3:',
    MAGIC_V2: 'MQRv2:',
    // Argon2id: 64 MiB, 3 pasadas, 1 hilo (perfil "moderado" de RFC 9106 adaptado a móvil)
    ARGON2: { memoryKiB: 65536, iterations: 3, parallelism: 1 },
    PBKDF2_FALLBACK_ITER: 600000,      // OWASP 2023 para PBKDF2-SHA256
    LEGACY_PBKDF2_ITER: 310000,        // formato v2
    SALT_LEN: 16,
    IV_LEN: 12,                        // tamaño de nonce estándar de AES-GCM
    PAD_BLOCK: 64,                     // relleno: oculta nº de palabras y longitud de nota
    NOTE_MAX: 100,
    MIN_PASSWORD_LENGTH: 12,
    MIN_PASSWORD_BITS: 60,
    AUTO_HIDE_SECONDS: 60,
    CLIPBOARD_CLEAR_SECONDS: 30,
    BACKGROUND_WIPE_SECONDS: 120,
    VALID_WORD_COUNTS: [12, 15, 18, 21, 24],
    WORDLIST_SHA256: 'f18b9a84c83e38e98eceb0102b275e26438af83ab08f080cdb780a2caa9f3a6d',
    MAX_IMAGE_BYTES: 10 * 1024 * 1024
});

// ============ UTILIDADES ============
const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
const wipe = (...arrs) => arrs.forEach((a) => { if (a && a.fill) a.fill(0); });

function b64urlEncode(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
    const s = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s + '==='.slice((s.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}
async function sha256Hex(bytes) {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('');
}
function constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}

// ============ ESTADO ============
const STATE = {
    step: 'home',
    message: '',
    encryptedData: '',     // texto del QR (cifrado, no sensible por sí mismo)
    verifyHash: '',        // SHA-256 del texto plano, para "Comprobar backup"
    verified: false,
    decryptedWords: [],
    modalMode: 'decrypt',  // 'decrypt' | 'verify'
    attempts: 0,
    lockUntil: 0,
    timer: null,
    timerRemaining: 0,
    clipboardTimer: null,
    scanner: { active: false, stream: null, raf: null, frame: 0, detector: null, canvas: null },
    hiddenAt: 0,
    busy: false,
    wordlistOk: false,
    rawSeedAllowed: false
};

// ============ BIP39 ============
const BIP39 = {
    get words() { return self.BIP39_WORDS || []; },
    index: null,

    async verifyWordlist() {
        const list = this.words;
        if (list.length !== 2048) return false;
        const hex = await sha256Hex(enc.encode(list.join(' ')));
        if (hex !== CONFIG.WORDLIST_SHA256) return false;
        this.index = new Map(list.map((w, i) => [w, i]));
        return true;
    },

    normalize(text) {
        return text.normalize('NFKD').toLowerCase().trim().split(/\s+/).filter(Boolean);
    },

    // BIP39 garantiza que los 4 primeros caracteres identifican la palabra
    resolve(word) {
        if (this.index.has(word)) return word;
        if (word.length >= 4) {
            const m = this.words.filter((w) => w.startsWith(word));
            if (m.length === 1) return m[0];
        }
        return null;
    },

    suggest(prefix, max = 5) {
        if (prefix.length < 2) return [];
        const out = [];
        for (const w of this.words) {
            if (w.startsWith(prefix)) { out.push(w); if (out.length >= max) break; }
        }
        return out;
    },

    // Devuelve la entropía (16–32 bytes) o null si el checksum no cuadra
    async toEntropy(words) {
        if (!CONFIG.VALID_WORD_COUNTS.includes(words.length)) return null;
        let bits = '';
        for (const w of words) {
            const i = this.index.get(w);
            if (i === undefined) return null;
            bits += i.toString(2).padStart(11, '0');
        }
        const csLen = words.length / 3;
        const entBits = bits.slice(0, bits.length - csLen);
        const entropy = new Uint8Array(entBits.length / 8);
        for (let i = 0; i < entropy.length; i++) entropy[i] = parseInt(entBits.slice(i * 8, i * 8 + 8), 2);
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', entropy));
        const cs = hash[0].toString(2).padStart(8, '0').slice(0, csLen);
        const expected = bits.slice(-csLen);
        bits = '';
        if (cs !== expected) { wipe(entropy); return null; }
        return entropy;
    },

    async fromEntropy(entropy) {
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', entropy));
        const csLen = (entropy.length * 8) / 32;
        let bits = Array.from(entropy, (b) => b.toString(2).padStart(8, '0')).join('');
        bits += hash[0].toString(2).padStart(8, '0').slice(0, csLen);
        const words = [];
        for (let i = 0; i < bits.length; i += 11) words.push(this.words[parseInt(bits.slice(i, i + 11), 2)]);
        return words;
    }
};

// ============ CRIPTOGRAFÍA ============
const KDF = { ARGON2ID: 1, PBKDF2: 2 };

const Crypto = {
    argonAvailable() {
        return typeof self.hashwasm === 'object' && typeof self.hashwasm.argon2id === 'function';
    },

    async deriveKey(password, salt, kdf, p1, p2, p3) {
        let raw;
        if (kdf === KDF.ARGON2ID) {
            if (!this.argonAvailable()) throw new Error('Argon2id no está disponible en este navegador');
            raw = await self.hashwasm.argon2id({
                password, salt, memorySize: p1, iterations: p2, parallelism: p3,
                hashLength: 32, outputType: 'binary'
            });
        } else if (kdf === KDF.PBKDF2) {
            const base = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits']);
            raw = new Uint8Array(await crypto.subtle.deriveBits(
                { name: 'PBKDF2', salt, iterations: p1, hash: 'SHA-256' }, base, 256));
        } else {
            throw new Error('Método de derivación desconocido');
        }
        // Clave no extraíble: no queda accesible para ningún script tras importarla
        const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
        wipe(raw);
        return key;
    },

    // Texto plano v3: [tipo][datos][len nota][nota][creado u32] + relleno a bloques de 64
    packPlaintext({ entropy, rawSeed, note }) {
        const noteBytes = enc.encode(note || '').slice(0, 255);
        const created = Math.floor(Date.now() / 1000);
        let body;
        if (entropy) {
            body = new Uint8Array(2 + entropy.length);
            body[0] = 1; body[1] = entropy.length; body.set(entropy, 2);
        } else {
            const t = enc.encode(rawSeed);
            body = new Uint8Array(3 + t.length);
            body[0] = 2; body[1] = t.length >> 8; body[2] = t.length & 255; body.set(t, 3);
        }
        const len = body.length + 1 + noteBytes.length + 4;
        const padded = Math.max(CONFIG.PAD_BLOCK, Math.ceil(len / CONFIG.PAD_BLOCK) * CONFIG.PAD_BLOCK);
        const out = new Uint8Array(padded);
        let o = 0;
        out.set(body, o); o += body.length;
        out[o++] = noteBytes.length; out.set(noteBytes, o); o += noteBytes.length;
        new DataView(out.buffer).setUint32(o, created, false);
        wipe(body);
        return out;
    },

    async unpackPlaintext(pt) {
        let o = 0;
        const type = pt[o++];
        let words;
        if (type === 1) {
            const n = pt[o++];
            if (![16, 20, 24, 28, 32].includes(n)) throw new Error('Contenido no válido');
            const entropy = pt.slice(o, o + n); o += n;
            words = await BIP39.fromEntropy(entropy);
            wipe(entropy);
        } else if (type === 2) {
            const n = (pt[o] << 8) | pt[o + 1]; o += 2;
            words = dec.decode(pt.subarray(o, o + n)).split(' '); o += n;
        } else {
            throw new Error('Contenido no válido');
        }
        const nl = pt[o++];
        const note = dec.decode(pt.subarray(o, o + nl)); o += nl;
        const created = new DataView(pt.buffer, pt.byteOffset).getUint32(o, false);
        return { words, note, created: created ? new Date(created * 1000) : null };
    },

    async encrypt(plaintext, passwordStr) {
        const password = enc.encode(passwordStr.normalize('NFKC'));
        const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LEN));
        const iv = crypto.getRandomValues(new Uint8Array(CONFIG.IV_LEN));
        let kdf = KDF.ARGON2ID, p1 = CONFIG.ARGON2.memoryKiB, p2 = CONFIG.ARGON2.iterations, p3 = CONFIG.ARGON2.parallelism;
        let key;
        try {
            key = await this.deriveKey(password, salt, kdf, p1, p2, p3);
        } catch (e) {
            console.warn('Argon2id no disponible, usando PBKDF2:', e.message);
            kdf = KDF.PBKDF2; p1 = CONFIG.PBKDF2_FALLBACK_ITER; p2 = 0; p3 = 0;
            key = await this.deriveKey(password, salt, kdf, p1, p2, p3);
        }
        wipe(password);
        // Cabecera (autenticada como AAD): 'MQ' | ver | kdf | p1 u32 | p2 | p3 | salt | iv
        const header = new Uint8Array(10 + CONFIG.SALT_LEN + CONFIG.IV_LEN);
        const dv = new DataView(header.buffer);
        header[0] = 0x4d; header[1] = 0x51; header[2] = 3; header[3] = kdf;
        dv.setUint32(4, p1, false); header[8] = p2; header[9] = p3;
        header.set(salt, 10); header.set(iv, 10 + CONFIG.SALT_LEN);
        const ct = new Uint8Array(await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, additionalData: header, tagLength: 128 }, key, plaintext));
        const blob = new Uint8Array(header.length + ct.length);
        blob.set(header, 0); blob.set(ct, header.length);
        return { text: CONFIG.MAGIC_V3 + b64urlEncode(blob), kdf };
    },

    async decrypt(text, passwordStr) {
        if (text.startsWith(CONFIG.MAGIC_V3)) return this._decryptV3(text, passwordStr);
        if (text.startsWith(CONFIG.MAGIC_V2)) return this._decryptV2(text, passwordStr);
        throw new UserError('Este QR no es un backup de MnemoniQR');
    },

    async _decryptV3(text, passwordStr) {
        let blob;
        try { blob = b64urlDecode(text.slice(CONFIG.MAGIC_V3.length)); } catch { throw new UserError('El QR está dañado'); }
        const hl = 10 + CONFIG.SALT_LEN + CONFIG.IV_LEN;
        if (blob.length < hl + 16 || blob[0] !== 0x4d || blob[1] !== 0x51 || blob[2] !== 3) throw new UserError('El QR está dañado o es de otra versión');
        const header = blob.slice(0, hl);
        const dv = new DataView(header.buffer);
        const kdf = header[3], p1 = dv.getUint32(4, false), p2 = header[8], p3 = header[9];
        // Límites para que un QR malicioso no bloquee el dispositivo
        if (kdf === KDF.ARGON2ID && (p1 > 1048576 || p2 > 20 || p3 > 8 || p1 < 8192)) throw new UserError('Parámetros del QR fuera de rango');
        if (kdf === KDF.PBKDF2 && (p1 > 5000000 || p1 < 100000)) throw new UserError('Parámetros del QR fuera de rango');
        const salt = header.slice(10, 10 + CONFIG.SALT_LEN);
        const iv = header.slice(10 + CONFIG.SALT_LEN, hl);
        const password = enc.encode(passwordStr.normalize('NFKC'));
        const key = await this.deriveKey(password, salt, kdf, p1, p2, p3);
        wipe(password);
        let pt;
        try {
            pt = new Uint8Array(await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv, additionalData: header, tagLength: 128 }, key, blob.slice(hl)));
        } catch (e) {
            if (e.name === 'OperationError') throw new WrongPassword();
            throw e;
        }
        const hash = await sha256Hex(pt);
        const result = await this.unpackPlaintext(pt);
        wipe(pt);
        return { ...result, hash, format: 3, kdf };
    },

    // Compatibilidad con backups de la v2 (PBKDF2 310k, IV de 16 bytes, cabecera de 128 bytes)
    async _decryptV2(text, passwordStr) {
        let data;
        try { data = Uint8Array.from(atob(text.slice(CONFIG.MAGIC_V2.length)), (c) => c.charCodeAt(0)); }
        catch { throw new UserError('El QR está dañado'); }
        if (data.length < 128 + 32 + 16 + 16) throw new UserError('El QR está dañado');
        const meta = data.slice(0, 128), salt = data.slice(128, 160), iv = data.slice(160, 176), ct = data.slice(176);
        const key = await this.deriveKey(enc.encode(passwordStr), salt, KDF.PBKDF2, CONFIG.LEGACY_PBKDF2_ITER);
        let pt;
        try {
            pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: meta, tagLength: 128 }, key, ct));
        } catch (e) {
            if (e.name === 'OperationError') throw new WrongPassword();
            throw e;
        }
        const hash = await sha256Hex(pt);
        const payload = JSON.parse(dec.decode(pt));
        wipe(pt);
        const ts = new DataView(meta.buffer).getUint32(2, false);
        return {
            words: String(payload.seed || '').trim().split(/\s+/),
            note: String(payload.userMessage || ''),
            created: ts ? new Date(ts * 1000) : null,
            hash, format: 2, kdf: KDF.PBKDF2
        };
    }
};

class UserError extends Error {}
class WrongPassword extends UserError { constructor() { super('Contraseña incorrecta'); } }

// ============ CONTRASEÑA ============
const Password = {
    estimateBits(pwd) {
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
        // Penalizaciones por patrones previsibles
        const unique = new Set(chars).size;
        if (unique < chars.length / 2) bits *= unique / (chars.length / 2);
        if (/(.)\1{2,}/.test(pwd)) bits -= 10;
        const lower = pwd.toLowerCase();
        const common = ['password', 'contraseña', 'contrasena', 'qwerty', 'asdf', '123456', 'abcdef', 'bitcoin', 'wallet', 'cartera', 'mnemoniqr', 'seed', 'semilla', 'admin', 'letmein'];
        for (const c of common) if (lower.includes(c)) bits -= 20;
        if (/(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef)/.test(lower)) bits -= 10;
        if (/(19|20)\d{2}/.test(pwd)) bits -= 6;
        return Math.max(0, Math.round(bits));
    },

    // 64 símbolos exactos → byte & 63 sin sesgo de módulo. 20 caracteres = 120 bits.
    generate(len = 20) {
        const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        const r = crypto.getRandomValues(new Uint8Array(len));
        let s = '';
        for (const b of r) s += A[b & 63];
        wipe(r);
        return s;
    }
};

// ============ QR ============
const QR = {
    lib() {
        if (!self.QRCode || typeof self.QRCode.toCanvas !== 'function') {
            throw new Error('El generador de QR no se ha cargado. Recarga la app.');
        }
        return self.QRCode;
    },

    opts(width) {
        return { width, margin: 4, errorCorrectionLevel: 'Q', color: { dark: '#000000', light: '#ffffff' } };
    },

    render(canvas, text, width = 300) {
        return this.lib().toCanvas(canvas, text, this.opts(width));
    },

    matrix(text) {
        return this.lib().create(text, { errorCorrectionLevel: 'Q' }).modules;
    },

    decodeImageData(imageData) {
        if (typeof self.jsQR !== 'function') throw new Error('El lector de QR no se ha cargado');
        const r = self.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
        return r ? r.data : null;
    },

    async decodeSource(source, w, h) {
        // Prueba varias escalas: las fotos grandes fallan a tamaño completo y las pequeñas al reducirlas
        for (const max of [1200, 800, 1800, 500]) {
            const s = Math.min(1, max / Math.max(w, h));
            const cw = Math.round(w * s), ch = Math.round(h * s);
            const c = document.createElement('canvas');
            c.width = cw; c.height = ch;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(source, 0, 0, cw, ch);
            const data = this.decodeImageData(ctx.getImageData(0, 0, cw, ch));
            ctx.clearRect(0, 0, cw, ch);
            if (data) return data;
        }
        return null;
    }
};

// ============ PDF (vectorial, sin dependencias) ============
const PDF = {
    // Cadena literal PDF en WinAnsi (cubre tildes y ñ)
    lit(s) {
        let out = '(';
        for (const ch of s) {
            const c = ch.charCodeAt(0);
            if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
            else if (c >= 32 && c < 127) out += ch;
            else if (c >= 160 && c < 256) out += '\\' + c.toString(8).padStart(3, '0');
            else out += '?';
        }
        return out + ')';
    },

    build(qrText) {
        const W = 595.28, H = 841.89;
        const m = QR.matrix(qrText);
        const size = m.size, qrPt = 300, cell = qrPt / size;
        const x0 = (W - qrPt) / 2, y0 = H - 140 - qrPt;
        let c = 'q 0 g\n';
        // Agrupa módulos contiguos por fila para un PDF ligero
        for (let r = 0; r < size; r++) {
            let start = -1;
            for (let col = 0; col <= size; col++) {
                const on = col < size && m.data[r * size + col];
                if (on && start < 0) start = col;
                if (!on && start >= 0) {
                    c += `${(x0 + start * cell).toFixed(3)} ${(y0 + (size - 1 - r) * cell).toFixed(3)} ${((col - start) * cell).toFixed(3)} ${cell.toFixed(3)} re\n`;
                    start = -1;
                }
            }
        }
        c += 'f Q\n';
        const text = (font, sz, x, y, s, gray = 0) => `BT /${font} ${sz} Tf ${gray} g ${x.toFixed(2)} ${y.toFixed(2)} Td ${this.lit(s)} Tj ET\n`;
        const center = (font, sz, y, s, gray) => {
            const approx = s.length * sz * (font === 'F2' ? 0.6 : 0.5);
            return text(font, sz, (W - approx) / 2, y, s, gray);
        };
        c += text('F1', 22, 60, H - 80, 'MnemoniQR');
        c += text('F1', 11, 60, H - 100, 'Backup cifrado de frase de recuperación', 0.35);
        c += center('F1', 9, y0 - 22, 'Argon2id + AES-256-GCM  |  Formato MQR3', 0.35);
        let y = y0 - 70;
        const lines = [
            'Para recuperarlo: abre MnemoniQR, pulsa Escanear e introduce la contraseña.',
            'Guarda la contraseña en un lugar distinto de este papel.',
            'Sin la contraseña, este código no puede descifrarse.'
        ];
        for (const l of lines) { c += text('F1', 10, 60, y, l, 0.15); y -= 16; }
        y -= 14;
        c += text('F1', 10, 60, y, 'Etiqueta: ____________________________________________', 0.15);
        y -= 34;
        c += text('F1', 9, 60, y, 'Texto de respaldo (por si el QR se daña, se puede teclear):', 0.35);
        y -= 14;
        for (let i = 0; i < qrText.length; i += 64) {
            c += text('F2', 8.5, 60, y, qrText.slice(i, i + 64), 0.1);
            y -= 12;
        }
        const objs = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
            `<< /Length ${c.length} >>\nstream\n${c}endstream`
        ];
        let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
        const offs = [];
        objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
        const xref = pdf.length;
        pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
        offs.forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
        pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
        const bytes = new Uint8Array(pdf.length);
        for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 255;
        return new Blob([bytes], { type: 'application/pdf' });
    }
};

// ============ DOM ============
const DOM = {};
function bindDOM() {
    [
        'home', 'net-pill', 'net-text', 'encrypt-btn-main', 'scan-btn', 'upload-btn', 'qr-file', 'about-btn', 'install-slot',
        'step-seed', 'step-message', 'step-password', 'step-qr', 'step-decrypted',
        'seed-input', 'seed-mask', 'word-counter', 'bip39-status', 'suggestions', 'seed-next',
        'message-input', 'char-counter', 'message-next',
        'password-input', 'password-confirm', 'show-password', 'password-generate', 'password-next',
        'strength-fill', 'strength-label', 'strength-bits',
        'qr-canvas', 'qr-caption', 'qr-badge', 'qr-verify', 'qr-download', 'qr-pdf', 'qr-share', 'qr-done',
        'seed-grid', 'decrypted-count', 'decrypted-meta', 'decrypted-reveal', 'decrypted-copy', 'decrypted-done',
        'timer-fill', 'timer-label',
        'password-modal', 'decrypt-sub', 'scanner', 'scanner-video', 'scanner-status', 'qr-ready',
        'decrypt-password', 'decrypt-show-password', 'decrypt-status', 'decrypt-cancel', 'decrypt-confirm',
        'about-modal', 'about-close', 'about-got-it',
        'toast-container', 'spinner-overlay', 'spinner-message'
    ].forEach((id) => { DOM[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = $(id); });
    DOM.decryptSection = document.querySelector('.decrypt-section');
    DOM.reqs = document.querySelectorAll('.requirements li');
}

// ============ UI ============
function showToast(message, type = 'info', { duration, onClick } = {}) {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = message; // nunca innerHTML: evita inyección desde errores o QR
    if (onClick) { t.classList.add('clickable'); t.addEventListener('click', () => { onClick(); dismiss(); }); }
    else t.addEventListener('click', () => dismiss());
    DOM.toastContainer.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    const dismiss = () => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); };
    setTimeout(dismiss, duration || (type === 'error' ? 7000 : 4000));
}
window.showToast = showToast;

function spinner(show, msg = 'Procesando…') {
    DOM.spinnerOverlay.hidden = !show;
    DOM.spinnerMessage.textContent = msg;
}

const STEPS = ['seed', 'message', 'password', 'qr', 'decrypted'];
function goTo(step) {
    STEPS.forEach((s) => { DOM['step' + s[0].toUpperCase() + s.slice(1)].hidden = s !== step; });
    DOM.home.hidden = step !== 'home';
    STATE.step = step;
    window.scrollTo(0, 0);
}

let lastFocus = null;
function openModal(el) {
    lastFocus = document.activeElement;
    el.hidden = false;
    const f = el.querySelector('input, button');
    if (f) setTimeout(() => f.focus(), 50);
}
function closeModal(el) {
    el.hidden = true;
    if (el === DOM.passwordModal) resetDecryptModal();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
}

// ============ RED / PRIVACIDAD ============
function updateNetPill() {
    const online = navigator.onLine;
    DOM.netPill.classList.toggle('online', online);
    DOM.netPill.classList.toggle('offline', !online);
    DOM.netText.textContent = online
        ? 'Conectado: activa el modo avión antes de escribir la semilla'
        : 'Sin conexión: modo más seguro';
}

function clearSensitiveInputs() {
    [DOM.seedInput, DOM.messageInput, DOM.passwordInput, DOM.passwordConfirm, DOM.decryptPassword].forEach((i) => { if (i) i.value = ''; });
    STATE.message = '';
    STATE.rawSeedAllowed = false;
}

function wipeDecrypted() {
    stopTimer();
    STATE.decryptedWords.fill('');
    STATE.decryptedWords = [];
    DOM.seedGrid.replaceChildren();
    DOM.decryptedMeta.replaceChildren();
    DOM.seedGrid.classList.add('blurred');
}

function wipeQR() {
    STATE.encryptedData = '';
    STATE.verifyHash = '';
    STATE.verified = false;
    const ctx = DOM.qrCanvas.getContext('2d');
    ctx.clearRect(0, 0, DOM.qrCanvas.width, DOM.qrCanvas.height);
}

function onVisibility() {
    const shield = $('privacy-shield');
    if (document.hidden) {
        shield.classList.add('on'); // cubre la vista previa del selector de apps
        STATE.hiddenAt = Date.now();
        stopScanner();
        if (STATE.step === 'decrypted') { wipeDecrypted(); goTo('home'); }
    } else {
        shield.classList.remove('on');
        const away = (Date.now() - STATE.hiddenAt) / 1000;
        if (STATE.hiddenAt && away > CONFIG.BACKGROUND_WIPE_SECONDS && ['seed', 'message', 'password'].includes(STATE.step)) {
            clearSensitiveInputs();
            goTo('home');
            showToast('Datos borrados por inactividad', 'warning');
        }
        if (STATE.hiddenAt && STATE.step === 'home' && away > 0.5 && DOM.seedGrid.childElementCount === 0 && STATE._wasDecrypted) {
            showToast('Semilla borrada al salir de la app', 'info');
        }
        STATE._wasDecrypted = false;
        STATE.hiddenAt = 0;
    }
}

// ============ PASO 1: SEMILLA ============
function currentToken() {
    const v = DOM.seedInput.value, pos = DOM.seedInput.selectionStart;
    const before = v.slice(0, pos), after = v.slice(pos);
    const start = before.search(/\S*$/);
    const endRel = after.search(/\s|$/);
    return { start, end: pos + endRel, text: v.slice(start, pos + endRel).toLowerCase() };
}

async function updateSeedUI() {
    const words = BIP39.normalize(DOM.seedInput.value);
    const n = words.length;
    DOM.wordCounter.textContent = `${n} ${n === 1 ? 'palabra' : 'palabras'}`;
    const resolved = words.map((w) => BIP39.resolve(w));
    // La última palabra aún se está escribiendo: no la marques como error si es un prefijo válido
    const typing = n && !/\s$/.test(DOM.seedInput.value) && !resolved[n - 1] && BIP39.suggest(words[n - 1], 1).length > 0;
    const bad = words.filter((_, i) => !resolved[i] && !(typing && i === n - 1));
    const status = DOM.bip39Status;
    status.className = 'status';
    STATE.rawSeedAllowed = false;
    DOM.seedNext.disabled = true;

    if (n === 0) { status.textContent = ''; }
    else if (bad.length) {
        status.textContent = `${bad.length} palabra${bad.length > 1 ? 's' : ''} no válida${bad.length > 1 ? 's' : ''}`;
        status.classList.add('bad');
    } else if (typing || !CONFIG.VALID_WORD_COUNTS.includes(n)) {
        status.textContent = 'Palabras válidas, número incompleto';
    } else {
        const ent = await BIP39.toEntropy(resolved);
        if (ent) {
            wipe(ent);
            status.textContent = 'Checksum BIP39 correcto';
            status.classList.add('good');
            DOM.seedNext.disabled = false;
        } else {
            status.textContent = 'Checksum incorrecto: revisa el orden o alguna palabra';
            status.classList.add('bad');
            DOM.seedNext.disabled = false;
            STATE.rawSeedAllowed = true;
        }
    }
    renderSuggestions();
}

function renderSuggestions() {
    const tok = currentToken();
    const list = DOM.suggestions;
    list.replaceChildren();
    if (!tok.text || BIP39.index.has(tok.text)) { list.hidden = true; return; }
    const matches = BIP39.suggest(tok.text);
    if (!matches.length) { list.hidden = true; return; }
    for (const w of matches) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'suggestion';
        b.setAttribute('role', 'option');
        b.textContent = w;
        b.addEventListener('mousedown', (e) => e.preventDefault()); // no robar el foco
        b.addEventListener('click', () => applySuggestion(w));
        list.appendChild(b);
    }
    list.hidden = false;
}

function applySuggestion(word) {
    const tok = currentToken();
    const v = DOM.seedInput.value;
    const rest = v.slice(tok.end).replace(/^\s*/, '');
    const nv = v.slice(0, tok.start) + word + ' ' + rest;
    DOM.seedInput.value = nv;
    const caret = tok.start + word.length + 1;
    DOM.seedInput.setSelectionRange(caret, caret);
    DOM.seedInput.focus();
    updateSeedUI();
}

async function seedContinue() {
    if (STATE.rawSeedAllowed) {
        const ok = confirm('El checksum BIP39 no cuadra. Lo más probable es que haya una palabra mal escrita o fuera de orden.\n\n¿Guardar la frase tal cual, sin validar?');
        if (!ok) return;
    }
    goTo('message');
    DOM.messageInput.focus();
}

// ============ PASO 3: CONTRASEÑA ============
function updatePasswordUI() {
    const p = DOM.passwordInput.value, c = DOM.passwordConfirm.value;
    const bits = Password.estimateBits(p);
    const checks = {
        length: Array.from(p).length >= CONFIG.MIN_PASSWORD_LENGTH,
        entropy: bits >= CONFIG.MIN_PASSWORD_BITS,
        match: p.length > 0 && p === c
    };
    DOM.reqs.forEach((li) => li.classList.toggle('met', !!checks[li.dataset.req]));
    const pct = Math.min(100, Math.round((bits / 100) * 100));
    const level = bits >= 90 ? ['Muy fuerte', 'great'] : bits >= 70 ? ['Fuerte', 'good'] : bits >= 50 ? ['Mejorable', 'fair'] : ['Débil', 'weak'];
    DOM.strengthFill.style.width = p ? `${Math.max(pct, 6)}%` : '0';
    DOM.strengthFill.dataset.level = level[1];
    DOM.strengthLabel.textContent = p ? level[0] : 'Escribe una contraseña';
    DOM.strengthBits.textContent = p ? `≈ ${bits} bits` : '';
    DOM.passwordNext.disabled = !(checks.length && checks.entropy && checks.match);
}

async function startEncryption() {
    if (STATE.busy) return;
    const words = BIP39.normalize(DOM.seedInput.value).map((w) => BIP39.resolve(w));
    if (words.some((w) => !w) || !CONFIG.VALID_WORD_COUNTS.includes(words.length)) {
        showToast('Revisa la frase de recuperación', 'error'); goTo('seed'); return;
    }
    const pwd = DOM.passwordInput.value;
    if (pwd !== DOM.passwordConfirm.value) { showToast('Las contraseñas no coinciden', 'error'); return; }

    STATE.busy = true;
    spinner(true, 'Reforzando la contraseña (Argon2id)…');
    await nextPaint();
    let entropy = null, plaintext = null;
    try {
        entropy = await BIP39.toEntropy(words);
        if (!entropy && !STATE.rawSeedAllowed) throw new UserError('Checksum incorrecto');
        plaintext = Crypto.packPlaintext({ entropy, rawSeed: entropy ? null : words.join(' '), note: STATE.message });
        STATE.verifyHash = await sha256Hex(plaintext);
        const { text, kdf } = await Crypto.encrypt(plaintext, pwd);
        STATE.encryptedData = text;
        STATE.verified = false;
        spinner(true, 'Generando QR…');
        await QR.render(DOM.qrCanvas, text, 300);
        DOM.qrBadge.textContent = kdf === KDF.ARGON2ID ? 'Argon2id + AES-256-GCM' : 'PBKDF2 + AES-256-GCM';
        if (kdf !== KDF.ARGON2ID) showToast('Este navegador bloquea WebAssembly: se usó PBKDF2 (600 000 iteraciones)', 'warning', { duration: 7000 });
        setCaption(false);
        clearSensitiveInputs();
        goTo('qr');
        showToast('Semilla cifrada', 'success');
    } catch (e) {
        console.error(e);
        showToast(e instanceof UserError ? e.message : 'No se pudo cifrar: ' + e.message, 'error');
    } finally {
        wipe(entropy, plaintext);
        words.fill('');
        spinner(false);
        STATE.busy = false;
    }
}

function setCaption(ok) {
    DOM.qrCaption.textContent = ok ? 'Verificado: el QR se lee y la contraseña funciona' : 'Sin verificar';
    DOM.qrCaption.classList.toggle('ok', ok);
}

// ============ ACCIONES DEL QR ============
async function verifyBackup() {
    // Relee el QR desde los píxeles reales del lienzo, no desde memoria
    let read = null;
    try {
        const c = document.createElement('canvas');
        await QR.render(c, STATE.encryptedData, 600);
        read = await QR.decodeSource(DOM.qrCanvas, DOM.qrCanvas.width, DOM.qrCanvas.height)
            || await QR.decodeSource(c, c.width, c.height);
    } catch (e) { console.error(e); }
    if (read !== STATE.encryptedData) { showToast('El QR generado no se pudo leer. Vuelve a generarlo.', 'error'); return; }
    STATE.modalMode = 'verify';
    DOM.decryptSub.textContent = 'Escribe la contraseña de memoria para comprobar que la recuerdas. La semilla no se mostrará.';
    DOM.decryptConfirm.textContent = 'Comprobar';
    DOM.qrReady.hidden = false;
    openModal(DOM.passwordModal);
}

function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function hiResPNG() {
    const c = document.createElement('canvas');
    await QR.render(c, STATE.encryptedData, 1024);
    return new Promise((r) => c.toBlob(r, 'image/png'));
}

async function downloadPNG() {
    if (!STATE.encryptedData) return;
    downloadBlob(await hiResPNG(), 'mnemoniqr-backup.png');
    showToast('PNG descargado. Revisa que tu galería no lo suba a la nube.', 'success', { duration: 6000 });
}

function downloadPDF() {
    if (!STATE.encryptedData) return;
    try {
        downloadBlob(PDF.build(STATE.encryptedData), 'mnemoniqr-backup.pdf');
        showToast('PDF descargado. Imprímelo y bórralo del dispositivo.', 'success', { duration: 6000 });
    } catch (e) { showToast('No se pudo crear el PDF: ' + e.message, 'error'); }
}

async function shareQR() {
    if (!STATE.encryptedData) return;
    const ok = confirm('Compartir envía la imagen a otra app y probablemente a la nube.\n\nEl QR está cifrado, pero quien lo obtenga puede intentar adivinar tu contraseña sin límite. ¿Continuar?');
    if (!ok) return;
    const blob = await hiResPNG();
    const file = new File([blob], 'mnemoniqr-backup.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Backup MnemoniQR' }); }
        catch (e) { if (e.name !== 'AbortError') showToast('No se pudo compartir', 'warning'); }
    } else {
        downloadBlob(blob, 'mnemoniqr-backup.png');
        showToast('Este dispositivo no permite compartir: se ha descargado', 'info');
    }
}

// ============ ESCÁNER ============
async function startScanner() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('La cámara no está disponible en este navegador', 'error'); return;
    }
    const sc = STATE.scanner;
    try {
        sc.stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
        });
    } catch (e) {
        showToast(e.name === 'NotAllowedError' ? 'Permiso de cámara denegado' : 'No se pudo abrir la cámara', 'error');
        return;
    }
    DOM.scanner.hidden = false;
    DOM.scannerVideo.srcObject = sc.stream;
    try { await DOM.scannerVideo.play(); } catch { /* autoplay */ }
    sc.active = true; sc.frame = 0;
    if ('BarcodeDetector' in window) {
        try { sc.detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch { sc.detector = null; }
    }
    sc.canvas = document.createElement('canvas');
    DOM.scannerStatus.textContent = 'Buscando QR…';
    scanLoop();
}

async function scanLoop() {
    const sc = STATE.scanner, v = DOM.scannerVideo;
    if (!sc.active) return;
    sc.frame++;
    if (v.readyState >= v.HAVE_ENOUGH_DATA && sc.frame % 3 === 0) {
        let data = null;
        try {
            if (sc.detector) {
                const r = await sc.detector.detect(v);
                if (r.length) data = r[0].rawValue;
            } else {
                const s = Math.min(1, 800 / v.videoWidth);
                const w = Math.round(v.videoWidth * s), h = Math.round(v.videoHeight * s);
                sc.canvas.width = w; sc.canvas.height = h;
                const ctx = sc.canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(v, 0, 0, w, h);
                data = QR.decodeImageData(ctx.getImageData(0, 0, w, h));
            }
        } catch { /* sigue escaneando */ }
        if (data) {
            if (data.startsWith(CONFIG.MAGIC_V3) || data.startsWith(CONFIG.MAGIC_V2)) {
                STATE.encryptedData = data;
                stopScanner();
                DOM.qrReady.hidden = false;
                if (navigator.vibrate) navigator.vibrate(60);
                DOM.decryptPassword.focus();
                return;
            }
            DOM.scannerStatus.textContent = 'Ese QR no es de MnemoniQR';
        }
    }
    sc.raf = requestAnimationFrame(scanLoop);
}

function stopScanner() {
    const sc = STATE.scanner;
    sc.active = false;
    if (sc.raf) cancelAnimationFrame(sc.raf);
    if (sc.stream) sc.stream.getTracks().forEach((t) => t.stop());
    sc.stream = null; sc.raf = null;
    if (sc.canvas) { sc.canvas.width = sc.canvas.height = 0; }
    if (DOM.scannerVideo) DOM.scannerVideo.srcObject = null;
    if (DOM.scanner) DOM.scanner.hidden = true;
}

// ============ IMAGEN ============
async function processFile(file) {
    if (!file || !/^image\//.test(file.type)) { showToast('Elige una imagen', 'error'); return; }
    if (file.size > CONFIG.MAX_IMAGE_BYTES) { showToast('La imagen supera 10 MB', 'error'); return; }
    spinner(true, 'Leyendo QR…');
    await nextPaint();
    try {
        const bmp = await createImageBitmap(file);
        const data = await QR.decodeSource(bmp, bmp.width, bmp.height);
        bmp.close && bmp.close();
        if (!data) throw new UserError('No se encontró ningún QR en la imagen');
        if (!data.startsWith(CONFIG.MAGIC_V3) && !data.startsWith(CONFIG.MAGIC_V2)) throw new UserError('Ese QR no es un backup de MnemoniQR');
        openDecrypt();
        STATE.encryptedData = data;
        DOM.qrReady.hidden = false;
    } catch (e) {
        showToast(e instanceof UserError ? e.message : 'No se pudo leer la imagen', 'error');
    } finally {
        spinner(false);
        DOM.qrFile.value = '';
    }
}

// ============ DESCIFRADO ============
function openDecrypt() {
    STATE.modalMode = 'decrypt';
    resetDecryptModal();
    DOM.decryptSub.textContent = 'Escanea el QR y escribe su contraseña.';
    DOM.decryptConfirm.textContent = 'Descifrar';
    openModal(DOM.passwordModal);
}

function resetDecryptModal() {
    stopScanner();
    DOM.decryptPassword.value = '';
    DOM.decryptPassword.type = 'password';
    DOM.decryptShowPassword.checked = false;
    DOM.decryptStatus.hidden = true;
    DOM.qrReady.hidden = true;
    if (STATE.modalMode === 'decrypt') STATE.encryptedData = '';
}

function setDecryptStatus(msg, kind = 'error') {
    DOM.decryptStatus.textContent = msg;
    DOM.decryptStatus.className = `decrypt-status ${kind}`;
    DOM.decryptStatus.hidden = false;
}

async function lockCountdown() {
    while (Date.now() < STATE.lockUntil) {
        const s = Math.ceil((STATE.lockUntil - Date.now()) / 1000);
        DOM.decryptConfirm.disabled = true;
        DOM.decryptConfirm.textContent = `Espera ${s}s`;
        await sleep(250);
    }
    DOM.decryptConfirm.disabled = false;
    DOM.decryptConfirm.textContent = STATE.modalMode === 'verify' ? 'Comprobar' : 'Descifrar';
}

async function decryptQR() {
    if (STATE.busy || Date.now() < STATE.lockUntil) return;
    const pwd = DOM.decryptPassword.value;
    if (!STATE.encryptedData) { setDecryptStatus('Primero escanea o sube un QR'); return; }
    if (!pwd) { setDecryptStatus('Escribe la contraseña'); return; }
    STATE.busy = true;
    stopScanner();
    spinner(true, 'Descifrando…');
    await nextPaint();
    try {
        const res = await Crypto.decrypt(STATE.encryptedData, pwd);
        STATE.attempts = 0;
        if (STATE.modalMode === 'verify') {
            res.words.fill('');
            if (!constantTimeEqual(res.hash, STATE.verifyHash)) throw new UserError('El contenido no coincide con lo cifrado');
            STATE.verified = true;
            setCaption(true);
            DOM.passwordModal.hidden = true;
            DOM.decryptPassword.value = '';
            showToast('Backup verificado', 'success');
        } else {
            STATE.encryptedData = '';
            closeModal(DOM.passwordModal);
            showDecrypted(res);
            if (res.format === 2) showToast('Backup antiguo (v2): te recomendamos volver a cifrarlo con la v3', 'info', { duration: 7000 });
        }
    } catch (e) {
        if (e instanceof WrongPassword) {
            STATE.attempts++;
            setDecryptStatus(`Contraseña incorrecta (intento ${STATE.attempts})`);
            // Retardo creciente: frena intentos en esta app (no protege frente a ataques offline)
            if (STATE.attempts >= 3) {
                STATE.lockUntil = Date.now() + Math.min(30, 2 ** (STATE.attempts - 2)) * 1000;
                lockCountdown();
            }
            DOM.decryptPassword.select();
        } else {
            console.error(e);
            setDecryptStatus(e instanceof UserError ? e.message : 'No se pudo descifrar: ' + e.message);
        }
    } finally {
        spinner(false);
        STATE.busy = false;
    }
}

function showDecrypted(res) {
    wipeDecrypted();
    STATE.decryptedWords = res.words.slice();
    res.words.fill('');
    const frag = document.createDocumentFragment();
    STATE.decryptedWords.forEach((w, i) => {
        const d = document.createElement('div');
        d.className = 'seed-word'; d.setAttribute('role', 'listitem');
        const n = document.createElement('span'); n.className = 'word-index'; n.textContent = i + 1;
        const t = document.createElement('span'); t.textContent = w;
        d.append(n, t); frag.appendChild(d);
    });
    DOM.seedGrid.appendChild(frag);
    DOM.decryptedCount.textContent = `${STATE.decryptedWords.length} palabras`;
    if (res.note) {
        const p = document.createElement('p'); p.textContent = `Nota: ${res.note}`; DOM.decryptedMeta.appendChild(p);
    }
    if (res.created) {
        const p = document.createElement('p');
        p.textContent = `Creado: ${res.created.toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' })}`;
        DOM.decryptedMeta.appendChild(p);
    }
    setReveal(false);
    STATE._wasDecrypted = true;
    goTo('decrypted');
    startTimer();
}

function setReveal(on) {
    DOM.seedGrid.classList.toggle('blurred', !on);
    DOM.decryptedReveal.querySelector('span').textContent = on ? 'Ocultar' : 'Mostrar';
    DOM.decryptedReveal.querySelector('use').setAttribute('href', on ? '#i-eye-off' : '#i-eye');
}

function startTimer() {
    stopTimer();
    STATE.timerRemaining = CONFIG.AUTO_HIDE_SECONDS;
    const tick = () => {
        DOM.timerFill.style.width = `${(STATE.timerRemaining / CONFIG.AUTO_HIDE_SECONDS) * 100}%`;
        DOM.timerLabel.textContent = `Se borra en ${STATE.timerRemaining} s`;
    };
    tick();
    STATE.timer = setInterval(() => {
        STATE.timerRemaining--;
        tick();
        if (STATE.timerRemaining <= 0) { wipeDecrypted(); goTo('home'); showToast('Semilla borrada por seguridad', 'info'); }
    }, 1000);
}
function stopTimer() { if (STATE.timer) clearInterval(STATE.timer); STATE.timer = null; }

async function copySeed() {
    const ok = confirm('El portapapeles lo pueden leer otras apps y algunos teclados lo sincronizan con la nube.\n\nSe vaciará en 30 segundos. ¿Copiar igualmente?');
    if (!ok) return;
    try {
        await navigator.clipboard.writeText(STATE.decryptedWords.join(' '));
        showToast('Copiado. Se vaciará en 30 s', 'warning');
        clearTimeout(STATE.clipboardTimer);
        STATE.clipboardTimer = setTimeout(async () => {
            try { await navigator.clipboard.writeText(''); } catch { /* sin foco: no se puede */ }
        }, CONFIG.CLIPBOARD_CLEAR_SECONDS * 1000);
    } catch {
        showToast('El navegador no permite copiar. Anótala a mano.', 'error');
    }
}

// ============ PWA ============
function setupPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then((reg) => {
            reg.addEventListener('updatefound', () => {
                const nw = reg.installing;
                nw && nw.addEventListener('statechange', () => {
                    if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                        showToast('Hay una versión nueva. Toca para actualizar.', 'info', {
                            duration: 15000, onClick: () => nw.postMessage({ type: 'SKIP_WAITING' })
                        });
                    }
                });
            });
        }).catch((e) => console.warn('SW:', e.message));
        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    }
    let deferred = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); deferred = e;
        if ($('install-btn')) return;
        const b = document.createElement('button');
        b.type = 'button'; b.id = 'install-btn'; b.className = 'btn-text'; b.textContent = 'Instalar app';
        b.addEventListener('click', async () => {
            if (!deferred) return;
            deferred.prompt();
            await deferred.userChoice;
            deferred = null; b.remove();
        });
        DOM.installSlot.appendChild(b);
    });
    window.addEventListener('appinstalled', () => { const b = $('install-btn'); if (b) b.remove(); });
}

// ============ EVENTOS ============
function hasUnsavedInput() {
    return DOM.seedInput.value.trim() || DOM.messageInput.value.trim() || DOM.passwordInput.value;
}

function init() {
    bindDOM();
    setupPWA();
    updateNetPill();
    window.addEventListener('online', updateNetPill);
    window.addEventListener('offline', updateNetPill);
    DOM.netPill.addEventListener('click', () => showToast(navigator.onLine
        ? 'La app no envía nada, pero sin conexión eliminas cualquier riesgo de extensiones o webs abiertas. Instálala, activa el modo avión y vuelve.'
        : 'Bien: sin conexión nada puede salir del dispositivo.', 'info', { duration: 8000 }));

    BIP39.verifyWordlist().then((ok) => {
        STATE.wordlistOk = ok;
        if (!ok) {
            DOM.encryptBtnMain.disabled = true;
            showToast('La lista BIP39 no supera la verificación de integridad. No uses esta copia de la app.', 'error', { duration: 20000 });
        }
    });

    // Cifrar
    DOM.encryptBtnMain.addEventListener('click', () => {
        if (!STATE.wordlistOk) return;
        clearSensitiveInputs();
        DOM.seedInput.classList.toggle('masked', DOM.seedMask.checked);
        goTo('seed');
        updateSeedUI();
        DOM.seedInput.focus();
    });
    DOM.seedInput.addEventListener('input', updateSeedUI);
    DOM.seedInput.addEventListener('click', renderSuggestions);
    DOM.seedInput.addEventListener('keyup', (e) => { if (e.key.startsWith('Arrow')) renderSuggestions(); });
    DOM.seedInput.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !DOM.suggestions.hidden) {
            const first = DOM.suggestions.querySelector('button');
            if (first) { e.preventDefault(); applySuggestion(first.textContent); }
        }
        if (e.key === 'Enter') { e.preventDefault(); if (!DOM.seedNext.disabled) seedContinue(); }
    });
    DOM.seedMask.addEventListener('change', () => DOM.seedInput.classList.toggle('masked', DOM.seedMask.checked));
    DOM.seedNext.addEventListener('click', seedContinue);

    DOM.messageInput.addEventListener('input', () => {
        DOM.charCounter.textContent = `${DOM.messageInput.value.length}/${CONFIG.NOTE_MAX}`;
    });
    const toPassword = () => {
        STATE.message = DOM.messageInput.value.trim().slice(0, CONFIG.NOTE_MAX);
        goTo('password'); updatePasswordUI(); DOM.passwordInput.focus();
    };
    DOM.messageNext.addEventListener('click', toPassword);
    DOM.messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') toPassword(); });

    [DOM.passwordInput, DOM.passwordConfirm].forEach((i) => {
        i.addEventListener('input', updatePasswordUI);
        i.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !DOM.passwordNext.disabled) startEncryption(); });
    });
    DOM.showPassword.addEventListener('change', () => {
        const t = DOM.showPassword.checked ? 'text' : 'password';
        DOM.passwordInput.type = t; DOM.passwordConfirm.type = t;
    });
    DOM.passwordGenerate.addEventListener('click', () => {
        const p = Password.generate();
        DOM.passwordInput.value = p; DOM.passwordConfirm.value = p;
        DOM.showPassword.checked = true;
        DOM.passwordInput.type = DOM.passwordConfirm.type = 'text';
        updatePasswordUI();
        showToast('Apunta esta contraseña en papel antes de continuar', 'warning', { duration: 7000 });
    });
    DOM.passwordNext.addEventListener('click', startEncryption);

    // QR
    DOM.qrVerify.addEventListener('click', verifyBackup);
    DOM.qrDownload.addEventListener('click', downloadPNG);
    DOM.qrPdf.addEventListener('click', downloadPDF);
    DOM.qrShare.addEventListener('click', shareQR);
    DOM.qrDone.addEventListener('click', () => {
        if (!STATE.verified && !confirm('Aún no has comprobado que puedes recuperar este backup. ¿Salir igualmente?')) return;
        wipeQR(); goTo('home');
    });

    // Descifrar
    DOM.scanBtn.addEventListener('click', () => { openDecrypt(); startScanner(); });
    DOM.uploadBtn.addEventListener('click', () => DOM.qrFile.click());
    DOM.qrFile.addEventListener('change', (e) => { if (e.target.files[0]) processFile(e.target.files[0]); });
    DOM.decryptSection.addEventListener('dragover', (e) => { e.preventDefault(); DOM.decryptSection.classList.add('dragover'); });
    DOM.decryptSection.addEventListener('dragleave', () => DOM.decryptSection.classList.remove('dragover'));
    DOM.decryptSection.addEventListener('drop', (e) => {
        e.preventDefault(); DOM.decryptSection.classList.remove('dragover');
        if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    });
    DOM.decryptShowPassword.addEventListener('change', () => { DOM.decryptPassword.type = DOM.decryptShowPassword.checked ? 'text' : 'password'; });
    DOM.decryptConfirm.addEventListener('click', decryptQR);
    DOM.decryptPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); decryptQR(); } });
    DOM.decryptCancel.addEventListener('click', () => {
        const verifying = STATE.modalMode === 'verify';
        closeModal(DOM.passwordModal);
        STATE.modalMode = 'decrypt';
        if (verifying) DOM.qrReady.hidden = true;
    });

    // Semilla descifrada
    DOM.seedGrid.addEventListener('click', () => setReveal(DOM.seedGrid.classList.contains('blurred')));
    DOM.decryptedReveal.addEventListener('click', () => setReveal(DOM.seedGrid.classList.contains('blurred')));
    DOM.decryptedCopy.addEventListener('click', copySeed);
    DOM.decryptedDone.addEventListener('click', () => { wipeDecrypted(); goTo('home'); });

    // Acerca de
    DOM.aboutBtn.addEventListener('click', () => openModal(DOM.aboutModal));
    DOM.aboutClose.addEventListener('click', () => closeModal(DOM.aboutModal));
    DOM.aboutGotIt.addEventListener('click', () => closeModal(DOM.aboutModal));

    // Volver
    document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => {
        const target = b.dataset.back;
        if (target === 'home') {
            if (hasUnsavedInput() && !confirm('Se borrará lo que has escrito. ¿Volver al inicio?')) return;
            clearSensitiveInputs();
        }
        goTo(target);
    }));

    // Cerrar modales con Escape o tocando fuera
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!DOM.passwordModal.hidden) DOM.decryptCancel.click();
        else if (!DOM.aboutModal.hidden) closeModal(DOM.aboutModal);
    });
    [DOM.passwordModal, DOM.aboutModal].forEach((m) => m.addEventListener('click', (e) => {
        if (e.target !== m) return;
        if (m === DOM.passwordModal) DOM.decryptCancel.click(); else closeModal(m);
    }));

    // Privacidad al salir de la app
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', () => { wipeDecrypted(); wipeQR(); clearSensitiveInputs(); stopScanner(); });

    // Accesos directos del manifest (?action=encrypt|scan)
    const action = new URLSearchParams(location.search).get('action');
    if (action) history.replaceState(null, '', location.pathname);
    if (action === 'encrypt') setTimeout(() => DOM.encryptBtnMain.click(), 300);
    if (action === 'scan') setTimeout(() => DOM.scanBtn.click(), 300);
}

document.addEventListener('DOMContentLoaded', init);
