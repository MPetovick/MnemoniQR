// ============================================================
// MnemoniQR v6.6.3 · User interface
// ============================================================
'use strict';
(() => {
const M = self.MQR;
const { C, BIP39, util } = M;
const { MQRError, WrongPassword } = M.errors;
const Strength = self.MQRStrength;
const t = (k, v) => self.I18N.t(k, v);
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));

const APP_VERSION = '6.6.3';
// Version + content id stamped by tools/build.py; the service worker announces the same value
const APP_BUILD = document.documentElement.dataset.build || APP_VERSION;
const CFG = Object.freeze({
    AUTO_HIDE: 60, CLIPBOARD_CLEAR: 30, BACKGROUND_WIPE: 120,
    MAX_IMAGE: 10 * 1024 * 1024, MAX_PIXELS: 40e6, MAX_KEYFILE: 100 * 1024 * 1024, MIN_PW: 12, MIN_BITS: 60, MIN_DECOY_PW: 8,
    KEY_ROWS: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
});

// ---------- Install prompt: capture it immediately, it can fire before init() ends ----------
let earlyInstallEvent = null;
const onEarlyInstall = (e) => { e.preventDefault(); earlyInstallEvent = e; };
window.addEventListener('beforeinstallprompt', onEarlyInstall);

// ---------- Trusted Types: the only way to create the worker and service worker URLs ----------
const blobUrls = new Set();
const ttPolicy = self.trustedTypes
    ? self.trustedTypes.createPolicy('mqr', { createScriptURL: (u) => (u === 'kdf-worker.js' || u === 'sw.js' || blobUrls.has(u) ? u : '') })
    : null;

// ============================================================
// STATE
// ============================================================
const newSeed = () => ({ count: 12, lang: 'en', words: Array(24).fill(''), cur: 0, reveal: false });
const S = {
    step: 'home', practice: false, target: 'real',
    seeds: { real: newSeed(), decoy: newSeed() },
    opts: { note: '', ppOn: false, pp: '', decoy: false, n: 1, k: 1, kfOn: false, keyfile: null },
    lastGen: null,             // { password, bits } of the last generated password
    rawAllowed: { real: false, decoy: false },
    result: null,             // { texts, index, kind, setId, k, n, blobText, hashes, fp, verified, practice, kdf }
    modalMode: 'decrypt',
    collect: { backup: null, info: null, keyfile: null, shares: new Map(), setId: null, k: 0, n: 0 },
    attempts: 0, lockUntil: 0,
    timer: null, timerLeft: 0, clipTimer: null,
    scanner: { active: false, starting: null, stream: null, raf: null, frame: 0, detector: null, canvas: null, cooldown: 0 },
    hiddenAt: 0, wasDecrypted: false, recoveredReal: false, busy: false, wipeAfterBusy: false, clipDirty: false,
    decrypted: { words: [], pp: '' },
    cancelKdf: null, calib: null, fpToken: 0, statusToken: 0
};

// ============================================================
// UI HELPERS
// ============================================================
function toast(message, type = 'info', { duration, onClick } = {}) {
    // The same message already on screen is not stacked again (e.g. several quick copies)
    if ([...$('toast-container').children].some((x) => x.textContent === message && x.classList.contains('show'))) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    const dismiss = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); };
    el.addEventListener('click', () => { if (onClick) onClick(); dismiss(); });
    if (onClick) el.classList.add('clickable');
    $('toast-container').appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(dismiss, duration || (type === 'error' ? 7000 : 4000));
}
function spinner(show, msg = '', cancellable = false) {
    $('spinner-overlay').hidden = !show;
    $('spinner-message').textContent = msg || t('processing');
    $('spinner-cancel').hidden = !cancellable;
}
function errText(e) {
    if (e && e.code) {
        const k = 'err_' + e.code;
        const s = t(k);
        if (s !== k) return s;
    }
    return t('err_generic', { msg: (e && e.message) || String(e) });
}
const STEPS = ['seed', 'options', 'password', 'result', 'decrypted'];
function goTo(step) {
    const from = S.step;
    STEPS.forEach((s) => { $('step-' + s).hidden = s !== step; });
    $('home').hidden = step !== 'home';
    S.step = step;
    if (step === 'home') { S.practice = false; Update.maybeShow(); } else Support.hideNudge();
    $('practice-banner').hidden = !(S.practice || (step === 'decrypted' && S.decrypted.practice) || (step === 'result' && S.result && S.result.practice));
    window.scrollTo(0, 0);
    const h = document.querySelector(step === 'home' ? '#encrypt-btn-main' : `#step-${step} h2`);
    if (h && step !== 'home') { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    // Back home after a real recovery (Done, timer or app left): the phrase is already wiped
    if (step === 'home' && from === 'decrypted' && S.recoveredReal) { S.recoveredReal = false; Support.afterRecovery(); }
}

// ---------- modals with a focus trap ----------
let modalStack = [];
function openModal(id) {
    const el = $(id);
    modalStack.push({ el, ret: document.activeElement });
    el.hidden = false;
    if (id === 'password-modal') updateSourceActions();
    // First visible control (a hidden one, such as the tabs of a single-network sheet, cannot take focus)
    setTimeout(() => {
        const f = [...el.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), button:not(.modal-close)')]
            .find((x) => x.offsetParent !== null && !x.disabled);
        if (f) f.focus();
    }, 40);
}
function closeModal(id) {
    const el = $(id);
    el.hidden = true;
    const i = modalStack.findIndex((m) => m.el === el);
    if (i >= 0) { const m = modalStack.splice(i, 1)[0]; if (m.ret && m.ret.focus) m.ret.focus(); }
    if (id === 'password-modal') resetDecryptModal();
    Update.apply();   // a pending update waits for the last dialog to close
}
function trapFocus(e) {
    const top = modalStack[modalStack.length - 1];
    if (!top || e.key !== 'Tab') return;
    const f = [...top.el.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// ============================================================
// ARGON2: cancellable worker, with a main-thread fallback
// ============================================================
// The worker code arrives with the page (js/kdf-src.js, under SRI and the build fingerprint), so it is
// verified and always matches this page. kdf-worker.js by URL is only used when running from src/.
function makeWorker() {
    let url = 'kdf-worker.js';
    if (typeof self.MQR_KDF_SRC === 'string') {
        url = URL.createObjectURL(new Blob([self.MQR_KDF_SRC], { type: 'text/javascript' }));
        blobUrls.add(url);
    }
    return { w: new Worker(ttPolicy ? ttPolicy.createScriptURL(url) : url), url };
}
function classifyArgonError(msg) {
    if (/allocat|out of memory|Memory/i.test(msg)) return 'kdf_memory';
    if (/WebAssembly|wasm|Refused|CompileError/i.test(msg)) return 'no_argon';
    return 'kdf_failed';
}
async function argonMain(password, salt, m, t2, p) {
    if (typeof WebAssembly !== 'object' || !self.hashwasm) throw new MQRError('no_argon');
    try {
        return await self.hashwasm.argon2id({ password, salt, memorySize: m, iterations: t2, parallelism: p, hashLength: 32, outputType: 'binary' });
    } catch (e) { throw new MQRError(classifyArgonError(String(e.message || e))); }
    finally { util.wipe(password); }
}
// `background` runs (calibration) do not take over the Cancel button of a real key derivation
function argonWorker(password, salt, m, t2, p, background = false) {
    return new Promise((resolve, reject) => {
        let wk;
        try { wk = makeWorker(); } catch { argonMain(password, salt, m, t2, p).then(resolve, reject); return; }
        let settled = false;
        const pwCopy = password.slice();
        const cancel = () => { if (settled) return; settled = true; done(); util.wipe(password, pwCopy); reject(new MQRError('cancelled')); };
        const done = () => {
            wk.w.terminate();
            if (wk.url.startsWith('blob:')) { URL.revokeObjectURL(wk.url); blobUrls.delete(wk.url); }
            if (S.cancelKdf === cancel) S.cancelKdf = null;
        };
        if (!background) S.cancelKdf = cancel;
        wk.w.onmessage = (e) => {
            if (settled) return; settled = true; done(); util.wipe(password, pwCopy);
            if (e.data.error) reject(new MQRError(classifyArgonError(e.data.error)));
            else resolve(e.data.hash);
        };
        wk.w.onerror = (ev) => {
            ev.preventDefault();
            if (settled) return; settled = true; done();
            // The worker could not start (e.g. file:// in some browsers): run on the main thread
            argonMain(pwCopy, salt, m, t2, p).then(resolve, reject).finally(() => util.wipe(password));
        };
        wk.w.postMessage({ id: 1, password, salt, m, t: t2, p }, [password.buffer]);
    });
}
M.setArgonImpl(argonWorker);

// Calibration: time Argon2id on this device and extrapolate to each level
async function calibrate() {
    if (S.calib) return S.calib;
    try {
        // Two runs, so worker start-up and WASM compilation cancel out
        const run = async (m) => { const t0 = performance.now(); await argonWorker(util.rand(8), util.rand(16), m, 1, 1, true); return performance.now() - t0; };
        const a = await run(8192), b = await run(32768);
        const per = Math.max((b - a) / 24576, b / 32768 / 3); // ms per KiB·pass
        S.calib = {};
        for (const [k, v] of Object.entries(C.LEVELS)) S.calib[k] = per * v.m * v.t;
    } catch { S.calib = {}; }
    return S.calib;
}
function renderCalib() {
    document.querySelectorAll('[data-level-time]').forEach((el) => {
        const ms = S.calib && S.calib[el.dataset.levelTime];
        el.textContent = ms ? t('approx_seconds', { s: (ms / 1000).toLocaleString('en', { maximumFractionDigits: 1 }) }) : '';
    });
    const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 2;
    const maxInput = document.querySelector('input[name=level][value=max]');
    maxInput.disabled = !!lowMem;
    if (lowMem && maxInput.checked) document.querySelector('input[name=level][value=standard]').checked = true;
}

// ============================================================
// NETWORK AND PRIVACY
// ============================================================
function updateNetPill() {
    const on = navigator.onLine;
    $('net-card').classList.toggle('online', on);
    $('net-card').classList.toggle('offline', !on);
    $('net-title').textContent = on ? t('net_online') : t('net_offline');
    $('net-body').textContent = on ? t('net_online_body') : t('net_offline_body');
}
function clearEntry() {
    S.seeds.real = newSeed(); S.seeds.decoy = newSeed();
    if (S.opts.keyfile) util.wipe(S.opts.keyfile.hash);
    S.opts = { note: '', ppOn: false, pp: '', decoy: false, n: 1, k: 1, kfOn: false, keyfile: null };
    S.lastGen = null;
    $('kf-enable').checked = false; $('kf-box').hidden = true; $('kf-info').hidden = true;
    S.rawAllowed = { real: false, decoy: false };
    ['message-input', 'pp-input', 'pp-confirm', 'password-input', 'password-confirm', 'decoy-input', 'decoy-confirm', 'decrypt-password'].forEach((id) => { $(id).value = ''; });
    $('pp-enable').checked = false; $('pp-box').hidden = true;
    $('decoy-enable').checked = false; $('split-select').value = '1'; $('split-custom').hidden = true;
}
function wipeDecrypted() {
    stopTimer();
    S.decrypted.words.fill('');
    S.decrypted = { words: [], pp: '' };
    $('seed-grid').replaceChildren();
    $('decrypted-meta').replaceChildren();
    $('decrypted-pp').textContent = ''; $('decrypted-pp').hidden = true;
    $('decrypted-fp').textContent = '';
}
function wipeResult() {
    S.result = null;
    const c = $('qr-canvas');
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
}
function onVisibility() {
    const shield = $('privacy-shield');
    if (document.hidden) {
        shield.classList.add('on');
        S.hiddenAt = Date.now();
        stopScanner();
        if (S.step === 'decrypted') { wipeDecrypted(); goTo('home'); }
    } else {
        if (S.clipDirty) clearClipboard(true);
        shield.classList.remove('on');
        const away = (Date.now() - S.hiddenAt) / 1000;
        if (S.hiddenAt && away > CFG.BACKGROUND_WIPE && ['seed', 'options', 'password'].includes(S.step)) {
            // An encryption in progress is never pulled from under its feet: the wipe waits for it to end
            if (S.busy) S.wipeAfterBusy = true;
            else { clearEntry(); goTo('home'); toast(t('wiped_inactive'), 'warning'); }
        } else if (S.wasDecrypted && S.step === 'home') {
            toast(t('wiped_leave'), 'info');
        }
        S.wasDecrypted = false; S.hiddenAt = 0;
    }
}

// ============================================================
// RECOVERY PHRASE ENTRY WITH THE BUILT-IN KEYBOARD
// ============================================================
const seed = () => S.seeds[S.target];
const typedAt = (i) => seed().words[i] || '';
const resolvedAt = (i) => BIP39.resolve(seed().lang, typedAt(i));

function stepPlan() {
    return S.opts.decoy ? ['seed', 'options', 'decoy', 'password'] : ['seed', 'options', 'password'];
}
function renderStepper(current) {
    const plan = stepPlan();
    const labels = { seed: 'step_phrase', options: 'step_options', decoy: 'step_decoy', password: 'step_key' };
    const idx = plan.indexOf(current);
    document.querySelectorAll(`#step-${S.step} [data-stepper]`).forEach((ol) => {
        const items = [];
        plan.forEach((name, i) => {
            if (i) { const sep = document.createElement('li'); sep.className = 'sep'; sep.setAttribute('aria-hidden', 'true'); items.push(sep); }
            const li = document.createElement('li');
            li.className = i < idx ? 'done' : i === idx ? 'current' : '';
            if (i === idx) li.setAttribute('aria-current', 'step');
            const n = document.createElement('span'); n.className = 'n'; n.textContent = i + 1;
            const l = document.createElement('span'); l.className = 'lbl'; l.textContent = t(labels[name]);
            li.append(n, l);
            items.push(li);
        });
        ol.replaceChildren(...items);
    });
}

function openSeedStep(target) {
    S.target = target;
    goTo('seed');
    renderSeedStep();
}

function renderSeedStep() {
    const s = seed();
    $('h-seed').textContent = S.target === 'decoy' ? t('seed_title_decoy') : t('seed_title');
    renderStepper(S.target === 'decoy' ? 'decoy' : 'seed');
    const eye = $('seed-eye');
    eye.setAttribute('aria-pressed', String(s.reveal));
    eye.querySelector('use').setAttribute('href', s.reveal ? '#i-eye-off' : '#i-eye');
    $('seed-eye-text').textContent = s.reveal ? t('hide') : t('show');
    // word-count selector
    const cs = $('seed-count');
    cs.replaceChildren(...C.VALID_WORD_COUNTS.map((n) => {
        const o = document.createElement('option');
        o.value = n; o.textContent = t('n_words', { n }); o.selected = n === s.count;
        return o;
    }));
    renderGrid();
    renderKeyboard();
    updateSeedStatus();
}

function cellText(i) {
    const s = seed(), typed = typedAt(i);
    if (!typed) return '';
    const r = resolvedAt(i);
    const full = r >= 0 ? BIP39.word(s.lang, r) : typed;
    if (s.reveal || i === s.cur) return full;
    return '•'.repeat(Math.min(8, full.length));
}

function renderGrid() {
    const s = seed();
    const grid = $('word-grid');
    const items = [];
    for (let i = 0; i < s.count; i++) {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cell';
        const typed = typedAt(i), r = resolvedAt(i);
        if (i === s.cur) b.classList.add('current');
        if (typed && r >= 0) b.classList.add('done');
        else if (typed && BIP39.countMatches(s.lang, typed) === 0) b.classList.add('invalid');
        b.setAttribute('aria-current', i === s.cur ? 'true' : 'false');
        b.setAttribute('aria-label', t('cell_label', { n: i + 1, state: !typed ? t('cell_empty') : (s.reveal ? cellText(i) : (r >= 0 ? t('cell_complete') : t('cell_partial'))) }));
        const n = document.createElement('span'); n.className = 'cell-n'; n.textContent = i + 1;
        const w = document.createElement('span'); w.className = 'cell-w'; w.textContent = cellText(i);
        b.append(n, w);
        b.addEventListener('click', () => { s.cur = i; refreshSeed(); });
        li.appendChild(b);
        items.push(li);
    }
    grid.replaceChildren(...items);
    grid.classList.toggle('cols-3', s.count >= 18);
    const cur = grid.querySelector('.cell.current');
    if (cur && S.step === 'seed') cur.scrollIntoView({ block: 'nearest' });
}

function renderKeyboard() {
    const kbd = $('kbd');
    if (!kbd.childElementCount) {
        CFG.KEY_ROWS.forEach((row, ri) => {
            const r = document.createElement('div');
            r.className = 'kbd-row';
            for (const ch of row) {
                const k = document.createElement('button');
                k.type = 'button'; k.className = 'key'; k.dataset.key = ch; k.textContent = ch;
                // aria-disabled instead of disabled: the key keeps focus, so screen readers and keyboards don't lose their place
                k.addEventListener('click', () => { if (k.getAttribute('aria-disabled') !== 'true') typeLetter(ch); });
                r.appendChild(k);
            }
            if (ri === 2) {
                const del = document.createElement('button');
                del.type = 'button'; del.className = 'key key-wide'; del.dataset.key = 'del';
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('class', 'ic'); svg.setAttribute('aria-hidden', 'true');
                const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
                use.setAttribute('href', '#i-del'); svg.appendChild(use); del.appendChild(svg);
                del.addEventListener('click', backspace);
                r.appendChild(del);
            }
            kbd.appendChild(r);
        });
        const last = document.createElement('div');
        last.className = 'kbd-row';
        const prev = document.createElement('button');
        prev.type = 'button'; prev.className = 'key key-wide'; prev.dataset.key = 'prev'; prev.textContent = '‹';
        prev.addEventListener('click', () => moveCell(-1));
        const nxt = document.createElement('button');
        nxt.type = 'button'; nxt.className = 'key key-space'; nxt.dataset.key = 'next';
        nxt.addEventListener('click', acceptWord);
        const fwd = document.createElement('button');
        fwd.type = 'button'; fwd.className = 'key key-wide'; fwd.dataset.key = 'fwd'; fwd.textContent = '›';
        fwd.addEventListener('click', () => moveCell(1));
        last.append(prev, nxt, fwd);
        kbd.appendChild(last);
    }
    const s = seed(), typed = typedAt(s.cur);
    const allowed = resolvedAt(s.cur) >= 0 ? null : BIP39.nextLetters(s.lang, typed);
    kbd.querySelectorAll('.key[data-key]').forEach((k) => {
        const key = k.dataset.key;
        if (key.length === 1) k.setAttribute('aria-disabled', String(allowed !== null && !allowed.has(key)));
    });
    kbd.querySelector('[data-key=next]').textContent = s.cur === s.count - 1 ? t('kbd_ok') : t('kbd_next');
    kbd.querySelector('[data-key=del]').setAttribute('aria-label', t('kbd_delete'));
    kbd.querySelector('[data-key=prev]').setAttribute('aria-label', t('kbd_prev'));
    kbd.querySelector('[data-key=fwd]').setAttribute('aria-label', t('kbd_fwd'));
    // suggestions
    const row = $('suggest-row');
    const cands = typed && resolvedAt(s.cur) < 0 || (typed && BIP39.countMatches(s.lang, typed) > 1) ? BIP39.candidates(s.lang, typed, 4) : [];
    row.replaceChildren(...cands.map((i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'suggestion'; b.setAttribute('role', 'option');
        b.textContent = BIP39.word(s.lang, i);
        b.addEventListener('click', () => { s.words[s.cur] = BIP39.lists[s.lang].stripped[i]; moveCell(1, true); });
        return b;
    }));
}

function refreshSeed() { renderGrid(); renderKeyboard(); updateSeedStatus(); }

function typeLetter(ch) {
    const s = seed();
    ch = util.strip(ch);
    if (!/^[a-z]$/.test(ch)) return;
    const p = typedAt(s.cur);
    if (BIP39.countMatches(s.lang, p + ch) > 0) { s.words[s.cur] = p + ch; }
    else if (resolvedAt(s.cur) >= 0 && s.cur < s.count - 1) {
        s.cur++;
        if (!typedAt(s.cur) && BIP39.countMatches(s.lang, ch) > 0) s.words[s.cur] = ch;
    } else { buzz(); return; }
    refreshSeed();
}
function backspace() {
    const s = seed(), p = typedAt(s.cur);
    if (p) s.words[s.cur] = p.slice(0, -1);
    else if (s.cur > 0) s.cur--;
    refreshSeed();
}
function moveCell(d, force) {
    const s = seed();
    const n = Math.max(0, Math.min(s.count - 1, s.cur + d));
    if (n !== s.cur || force) { s.cur = n; }
    refreshSeed();
}
function acceptWord() {
    const s = seed(), p = typedAt(s.cur);
    if (!p) { moveCell(1); return; }
    const r = resolvedAt(s.cur);
    if (r < 0) {
        const c = BIP39.candidates(s.lang, p, 2);
        if (c.length === 1) s.words[s.cur] = BIP39.lists[s.lang].stripped[c[0]];
        else { buzz(); return; }
    }
    if (s.cur < s.count - 1) s.cur++;
    else if (!$('seed-next').disabled) { refreshSeed(); $('seed-next').focus(); return; }
    refreshSeed();
}
function buzz() {
    const c = document.querySelector('#word-grid .cell.current');
    if (c) { c.classList.remove('buzz'); void c.offsetWidth; c.classList.add('buzz'); }
    if (navigator.vibrate) navigator.vibrate(30);
}

async function updateSeedStatus() {
    const s = seed();
    const token = ++S.statusToken;
    const idx = Array.from({ length: s.count }, (_, i) => resolvedAt(i));
    const done = idx.filter((i) => i >= 0).length;
    $('word-counter').textContent = `${done}/${s.count}`;
    const st = $('seed-status');
    st.className = 'status';
    const fp = $('seed-fp');
    fp.hidden = true;
    S.rawAllowed[S.target] = false;
    $('seed-next').disabled = true;
    const bad = Array.from({ length: s.count }, (_, i) => i).filter((i) => typedAt(i) && BIP39.countMatches(s.lang, typedAt(i)) === 0);
    if (bad.length) {
        st.textContent = t('words_invalid', { list: bad.map((i) => i + 1).join(', ') });
        st.classList.add('bad');
        return;
    }
    if (done < s.count) { st.textContent = t('words_progress', { done, n: s.count }); return; }
    const ent = await BIP39.toEntropy(idx);
    // The phrase may have changed while the checksum was computed: only the latest call may update the UI
    if (token !== S.statusToken) { util.wipe(ent); return; }
    if (ent) {
        util.wipe(ent);
        st.textContent = t('checksum_ok'); st.classList.add('good');
        $('seed-next').disabled = false;
        try {
            const f = await M.fingerprint(BIP39.mnemonic(s.lang, idx), '');
            if (token === S.statusToken && S.step === 'seed') { fp.textContent = t('fp_seed', { fp: f }); fp.hidden = false; }
        } catch { /* secp256k1 unavailable */ }
    } else {
        st.textContent = t('checksum_bad'); st.classList.add('bad');
        $('seed-next').disabled = false;
        S.rawAllowed[S.target] = true;
    }
}

function fillFromText(text) {
    const words = text.normalize('NFKD').toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return false;
    const s = seed();
    const lang = 'en';
    s.lang = lang;
    s.count = C.VALID_WORD_COUNTS.find((n) => n >= words.length) || 24;
    s.words = Array(24).fill('');
    words.slice(0, 24).forEach((w, i) => {
        const r = BIP39.resolve(lang, w);
        s.words[i] = r >= 0 ? BIP39.lists[lang].stripped[r] : util.strip(w).replace(/[^a-z]/g, '');
    });
    s.cur = Math.min(words.length, s.count - 1);
    words.fill('');
    renderSeedStep();
    return true;
}
async function pasteSeed() {
    if (!confirm(t('paste_confirm'))) return;
    try {
        const txt = await navigator.clipboard.readText();
        if (fillFromText(txt)) {
            try { await navigator.clipboard.writeText(''); } catch { /* page not focused */ }
            toast(t('pasted'), 'warning');
        }
    } catch { toast(t('paste_failed'), 'error'); }
}

const phraseKey = (w) => Array.from({ length: S.seeds[w].count }, (_, i) => BIP39.resolve('en', S.seeds[w].words[i] || '')).join(',');
async function seedContinue() {
    if (S.target === 'decoy' && phraseKey('decoy') === phraseKey('real')) { toast(t('err_decoy_same_seed'), 'error'); return; }
    if (S.rawAllowed[S.target] && !confirm(t('checksum_confirm'))) return;
    if (S.target === 'real') { goTo('options'); renderStepper('options'); }
    else openPasswordStep();
}

// ============================================================
// OPTIONS AND PASSWORD
// ============================================================
function readOptions() {
    S.opts.note = Array.from($('message-input').value.trim()).slice(0, 100).join('');
    S.opts.ppOn = $('pp-enable').checked;
    S.opts.pp = S.opts.ppOn ? $('pp-input').value : '';
    S.opts.decoy = $('decoy-enable').checked;
    S.opts.kfOn = $('kf-enable').checked;
    const v = $('split-select').value;
    if (v === '1') { S.opts.n = 1; S.opts.k = 1; }
    else if (v === 'custom') {
        const k = Math.max(2, Math.min(16, parseInt($('split-k').value, 10) || 2));
        const n = Math.max(k, Math.min(16, parseInt($('split-n').value, 10) || 3));
        S.opts.k = k; S.opts.n = n;
    } else { const [k, n] = v.split('-').map(Number); S.opts.k = k; S.opts.n = n; }
}
async function optionsContinue() {
    readOptions();
    if (S.opts.ppOn && !S.opts.pp) { toast(t('pp_empty'), 'error'); return; }
    // A mistyped passphrase is a different wallet, and the field is masked: it must be typed twice
    if (S.opts.ppOn && S.opts.pp !== $('pp-confirm').value) { toast(t('pp_mismatch'), 'error'); $('pp-confirm').focus(); return; }
    if (S.opts.ppOn && S.opts.pp !== S.opts.pp.trim() && !confirm(t('pp_spaces_confirm'))) return;
    if (S.opts.kfOn && !S.opts.keyfile) { toast(t('kf_missing'), 'error'); return; }
    const bytes = (x) => new TextEncoder().encode(x).length;
    if (bytes(S.opts.pp.normalize('NFKD')) > C.PASSPHRASE_MAX_BYTES) { toast(t('err_pp_too_long'), 'error'); return; }
    if (bytes(S.opts.note) > C.NOTE_MAX_BYTES) { toast(t('err_note_too_long'), 'error'); return; }
    if (S.opts.decoy) {
        if (S.practice && !S.seeds.decoy.words.some(Boolean)) await prefillRandom(S.seeds.decoy, 12);
        openSeedStep('decoy');
    } else openPasswordStep();
}
function openPasswordStep() {
    goTo('password');
    renderStepper('password');
    $('decoy-set').hidden = !S.opts.decoy;
    $('real-legend').textContent = S.opts.decoy ? t('pw_real_decoy') : t('pw_real');
    updatePasswordUI();
    $('password-input').focus();
    calibrate().then(renderCalib);
}
// Words of the phrase(s) being encrypted: a password must never reuse them
function phraseWords() {
    const out = [];
    for (const w of (S.opts.decoy ? ['real', 'decoy'] : ['real'])) {
        const sd = S.seeds[w];
        for (let i = 0; i < sd.count; i++) { const r = BIP39.resolve('en', sd.words[i] || ''); if (r >= 0) out.push(BIP39.word('en', r)); }
    }
    return out;
}
function strengthOf(pw, words) {
    if (!pw) return { bits: 0, warning: null };
    const inputs = [...words, S.opts.pp, ...S.opts.note.split(/\s+/), 'mnemoniqr', 'bitcoin', 'wallet', 'seed', 'backup', 'crypto'];
    const est = Strength.estimate(pw, inputs);
    // A generated password is scored by how it was generated, not by how it looks
    if (S.lastGen && pw === S.lastGen.password) return { bits: S.lastGen.bits, warning: null };
    return est;
}
function updatePasswordUI() {
    const p = $('password-input').value, c = $('password-confirm').value;
    const words = phraseWords();
    const conflict = p ? Strength.conflicts(p, words, S.opts.pp) : null;
    const { bits, warning } = strengthOf(p, words);
    const ok = { length: Array.from(p).length >= CFG.MIN_PW, entropy: bits >= CFG.MIN_BITS, match: !!p && p === c, phrase: !!p && !conflict };
    const d = $('decoy-input').value, dc = $('decoy-confirm').value;
    if (S.opts.decoy) {
        ok['d-length'] = Array.from(d).length >= CFG.MIN_DECOY_PW;
        ok['d-match'] = !!d && d === dc;
        ok['d-diff'] = !!d && d.normalize('NFKC') !== p.normalize('NFKC');
        ok['d-phrase'] = !!d && !Strength.conflicts(d, words, S.opts.pp);
    }
    document.querySelectorAll('.requirements li').forEach((li) => li.classList.toggle('met', !!ok[li.dataset.req]));
    const level = bits >= 90 ? ['pw_very_strong', 'great'] : bits >= 70 ? ['pw_strong', 'good'] : bits >= 50 ? ['pw_fair', 'fair'] : ['pw_weak', 'weak'];
    $('strength-fill').style.width = p ? `${Math.max(6, Math.min(100, bits))}%` : '0';
    $('strength-fill').dataset.level = level[1];
    $('strength-label').textContent = p ? t(level[0]) : t('pw_type');
    $('strength-bits').textContent = p ? t('approx_bits', { n: bits }) : '';
    const warn = $('strength-warn');
    const msg = conflict ? t(conflict) : (warning && bits < 80 ? t('pw_w_' + warning) : '');
    warn.textContent = msg; warn.hidden = !msg;
    $('password-next').disabled = !Object.values(ok).every(Boolean);
}
function useGenerated(pw, bits) {
    S.lastGen = { password: pw, bits };
    $('password-input').value = pw; $('password-confirm').value = pw;
    $('show-password').checked = true;
    ['password-input', 'password-confirm', 'decoy-input', 'decoy-confirm'].forEach((id) => { $(id).type = 'text'; });
    updatePasswordUI();
    toast(t('pw_generated'), 'warning', { duration: 8000 });
}

// A keyfile is reduced to SHA-256 of its bytes; the file itself is never kept
async function readKeyfile(file) {
    if (!file) return null;
    if (!file.size) throw new MQRError('keyfile_empty');
    if (file.size > CFG.MAX_KEYFILE) throw new MQRError('keyfile_big');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = await util.sha256(bytes);
    util.wipe(bytes);
    return { name: file.name, hash, short: util.hex(hash.slice(0, 4)).toUpperCase() };
}
function pickKeyfile() { $('kf-file').value = ''; $('kf-file').click(); }
async function onKeyfileChosen(file) {
    // The open dialog decides where the file belongs: recovery/verification, or the options step
    const keyfileTarget = $('password-modal').hidden ? 'options' : 'decrypt';
    try {
        const kf = await readKeyfile(file);
        if (!kf) return;
        const info = $(keyfileTarget === 'options' ? 'kf-info' : 'kf-need-info');
        info.textContent = t('kf_selected', { name: kf.name, fp: kf.short });
        info.hidden = false;
        if (keyfileTarget === 'options') { if (S.opts.keyfile) util.wipe(S.opts.keyfile.hash); S.opts.keyfile = kf; }
        else { if (S.collect.keyfile) util.wipe(S.collect.keyfile.hash); S.collect.keyfile = kf; }
    } catch (e) { toast(errText(e), 'error'); }
    finally { $('kf-file').value = ''; }
}

async function prefillRandom(target, count) {
    const idx = await BIP39.randomIndices(count);
    target.lang = 'en'; target.count = count; target.cur = count - 1; target.reveal = true;
    target.words = Array(24).fill('');
    idx.forEach((i, k) => { target.words[k] = BIP39.lists.en.stripped[i]; });
}

async function packSeed(which, withExtras) {
    const s = S.seeds[which];
    const idx = Array.from({ length: s.count }, (_, i) => BIP39.resolve(s.lang, s.words[i] || ''));
    if (idx.some((i) => i < 0)) throw new MQRError('seed_incomplete');
    const entropy = await BIP39.toEntropy(idx);
    if (!entropy && !S.rawAllowed[which]) throw new MQRError('checksum');
    const mnemonic = BIP39.mnemonic(s.lang, idx);
    const pt = M.packPlaintext({
        lang: s.lang, entropy, rawText: entropy ? null : mnemonic,
        passphrase: withExtras ? S.opts.pp : '', note: withExtras ? S.opts.note : ''
    });
    let fp = null;
    if (entropy && withExtras) { try { fp = await M.fingerprint(mnemonic, S.opts.pp); } catch { fp = null; } }
    util.wipe(entropy);
    return { pt, fp };
}

async function startEncryption() {
    if (S.busy) return;
    S.busy = true;
    const level = document.querySelector('input[name=level]:checked').value;
    // Snapshot of everything the encryption reads: nothing changes under it, whatever happens to S.opts
    const o = { decoy: S.opts.decoy, n: S.opts.n, k: S.opts.k,
        kfHash: S.opts.kfOn && S.opts.keyfile ? S.opts.keyfile.hash.slice() : null,
        kfShort: S.opts.kfOn && S.opts.keyfile ? S.opts.keyfile.short : null };
    let real, decoy;
    try {
        spinner(true, t('preparing'));
        await nextPaint();
        real = await packSeed('real', true);
        if (o.decoy && phraseKey('decoy') === phraseKey('real')) throw new MQRError('decoy_same_seed');
        decoy = o.decoy ? await packSeed('decoy', false) : null;
        const total = decoy ? 2 : 1;
        spinner(true, t('kdf_running', { i: 1, n: total }), true);
        await nextPaint();
        const r = await M.encryptV4({
            real: { plaintext: real.pt, password: $('password-input').value },
            decoy: decoy ? { plaintext: decoy.pt, password: $('decoy-input').value } : null,
            level, practice: S.practice, keyfile: o.kfHash,
            onKdf: (i) => { if (i < total) spinner(true, t('kdf_running', { i: i + 1, n: total }), true); }
        });
        spinner(true, t('generating_qr'));
        let texts = [r.text], setId = null;
        if (o.n > 1) { const sp = M.splitBackup(r.blob, o.n, o.k); texts = sp.texts; setId = sp.setId; }
        util.wipe(r.blob);
        S.result = {
            texts, index: 0, kind: texts.length > 1 ? 'shares' : 'single', setId, k: o.k, n: o.n,
            blobText: r.text, hashes: r.hashes, fp: real.fp, verified: false, practice: S.practice, kdf: r.kdf, hasDecoy: !!decoy,
            keyfile: o.kfShort
        };
        if (r.kdf !== M.KDF.ARGON2ID) toast(t('pbkdf2_fallback'), 'warning', { duration: 8000 });
        clearEntry();
        goTo('result');
        await renderResult();
        toast(t('encrypted_ok'), 'success');
    } catch (e) {
        if (e.code !== 'cancelled') { if (!(e instanceof MQRError)) console.error(e); toast(errText(e), 'error'); }
    } finally {
        if (real) util.wipe(real.pt);
        if (decoy) util.wipe(decoy.pt);
        if (o.kfHash) util.wipe(o.kfHash);
        spinner(false);
        S.busy = false;
        Update.apply();
        // The app was left in the background for too long during a failed or cancelled encryption
        if (S.wipeAfterBusy) {
            S.wipeAfterBusy = false;
            if (['seed', 'options', 'password'].includes(S.step)) { clearEntry(); goTo('home'); toast(t('wiped_inactive'), 'warning'); }
        }
    }
}

// ============================================================
// RESULT
// ============================================================
function shareCaption(i) {
    const R = S.result;
    return R.kind === 'shares' ? t('share_caption', { i: i + 1, n: R.n, k: R.k, set: R.setId.slice(0, 4).toUpperCase() }) : t('single_caption');
}
async function renderResult() {
    const R = S.result;
    $('qr-badge').textContent = R.practice ? t('badge_practice') : (R.kdf === M.KDF.ARGON2ID ? 'Argon2id + AES-256-GCM' : 'PBKDF2 + AES-256-GCM');
    $('share-nav').hidden = R.kind !== 'shares';
    $('share-label').textContent = R.kind === 'shares' ? t('share_label', { i: R.index + 1, n: R.n }) : '';
    $('share-prev').disabled = R.index === 0;
    $('share-next').disabled = R.index === R.texts.length - 1;
    await QR.renderSharp($('qr-canvas'), R.texts[R.index], 300, 'Q');
    $('qr-zip').hidden = R.kind !== 'shares';
    const cap = $('qr-caption');
    cap.textContent = (R.verified ? t('verified') + ' · ' : t('unverified') + ' · ') + shareCaption(R.index);
    cap.classList.toggle('ok', R.verified);
    $('result-fp').textContent = R.fp ? t('fp_result', { fp: R.fp }) : '';
    $('result-help').textContent = (R.kind === 'shares' ? t('result_help_shares') : t('result_help')) + (R.keyfile ? ' ' + t('result_help_kf', { fp: R.keyfile }) : '');
}

async function verifyBackup() {
    const R = S.result;
    try {
        // Re-read every QR from actual pixels
        for (let i = 0; i < R.texts.length; i++) {
            const c = document.createElement('canvas');
            await QR.render(c, R.texts[i], 600, 'Q');
            if ((await QR.decodeSource(c, c.width, c.height)) !== R.texts[i]) throw new MQRError('qr_unreadable');
            c.width = 0;
        }
        if (R.kind === 'shares') {
            const dec = R.texts.map((x) => M.Shamir.decode(x));
            // Two different subsets must rebuild the same backup
            const a = M.joinShares(dec.slice(0, R.k));
            const b = M.joinShares(dec.slice(-R.k));
            if (a !== R.blobText || b !== R.blobText) throw new MQRError('shares_mismatch');
        }
    } catch (e) { toast(errText(e), 'error'); return; }
    S.modalMode = 'verify';
    resetDecryptModal(true);
    S.collect.backup = R.blobText;
    S.collect.info = M.inspect(R.blobText);
    updateKeyfileNeed();
    $('decrypt-sub').textContent = R.hasDecoy ? t('verify_sub_decoy') : t('verify_sub');
    $('decrypt-confirm').textContent = t('verify_btn');
    $('qr-ready').hidden = false;
    openModal('password-modal');
}

function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
}
async function labeledPNG(i) {
    const R = S.result;
    const qr = document.createElement('canvas');
    await QR.render(qr, R.texts[i], 1024, 'Q');
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 1144;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(qr, 0, 0);
    ctx.fillStyle = '#1f2a33'; ctx.textAlign = 'center';
    ctx.font = '600 40px system-ui, sans-serif';
    ctx.fillText('MnemoniQR · ' + shareCaption(i), 512, 1060, 960);
    qr.width = 0;
    return new Promise((r) => c.toBlob(r, 'image/png'));
}
// One export at a time; a failure is reported instead of leaving a dead button
async function exporting(fn) {
    if (S.exportBusy) return;
    S.exportBusy = true;
    try { await fn(); } catch (e) { toast(errText(e), 'error'); } finally { S.exportBusy = false; }
}
async function pngBlob(i) {
    const blob = await labeledPNG(i);
    if (!blob) throw new MQRError('png_failed');
    return blob;
}
async function downloadPNG() {
    const R = S.result;
    const name = R.kind === 'shares' ? `mnemoniqr-${R.setId.slice(0, 4)}-${R.index + 1}of${R.n}.png` : 'mnemoniqr-backup.png';
    downloadBlob(await pngBlob(R.index), name);
    toast(t('png_saved'), 'success', { duration: 6000 });
}
// Every share as a PNG in one ZIP, with a short README (no secret beyond what the images hold). One file that
// holds every share is only as safe as the password, so it is a separate, confirmed choice.
async function downloadZIP() {
    const R = S.result;
    if (R.kind !== 'shares' || !confirm(t('zip_confirm', { n: R.n, k: R.k }))) return;
    const set = R.setId.slice(0, 4);
    const files = [];
    for (let i = 0; i < R.texts.length; i++) {
        const blob = await pngBlob(i);
        files.push({ name: `mnemoniqr-${set}-${i + 1}of${R.n}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    const readme = [
        `MnemoniQR backup, set ${set.toUpperCase()}`, '',
        t('zip_readme_1', { n: R.n, k: R.k }),
        t('zip_readme_2'),
        t('zip_readme_3'),
        ...(R.keyfile ? [t('pdf_kf', { fp: R.keyfile })] : []),
        '', 'https://github.com/MPetovick/MnemoniQR', ''
    ].join('\r\n');
    files.push({ name: 'README.txt', data: new TextEncoder().encode(readme) });
    downloadBlob(Zip.make(files), `mnemoniqr-${set}.zip`);
    toast(t('zip_saved', { n: R.n }), 'success', { duration: 7000 });
}

// Minimal ZIP writer: stored entries (PNG is already compressed), CRC-32, a fixed 1980-01-01 date so the
// archive does not record when the backup was made.
const Zip = {
    table: null,
    crc(u8) {
        if (!this.table) {
            this.table = new Uint32Array(256);
            for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; this.table[n] = c >>> 0; }
        }
        let c = 0xFFFFFFFF;
        for (let i = 0; i < u8.length; i++) c = this.table[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    },
    make(files) {
        const parts = [], central = [];
        let offset = 0;
        const DATE = 0x0021, TIME = 0;   // 1980-01-01 00:00
        for (const f of files) {
            const name = new TextEncoder().encode(f.name);
            const crc = this.crc(f.data), size = f.data.length;
            const local = new DataView(new ArrayBuffer(30));
            local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
            local.setUint16(8, 0, true); local.setUint16(10, TIME, true); local.setUint16(12, DATE, true);
            local.setUint32(14, crc, true); local.setUint32(18, size, true); local.setUint32(22, size, true);
            local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
            const cen = new DataView(new ArrayBuffer(46));
            cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
            cen.setUint16(10, 0, true); cen.setUint16(12, TIME, true); cen.setUint16(14, DATE, true);
            cen.setUint32(16, crc, true); cen.setUint32(20, size, true); cen.setUint32(24, size, true);
            cen.setUint16(28, name.length, true); cen.setUint32(42, offset, true);
            parts.push(new Uint8Array(local.buffer), name, f.data);
            central.push(new Uint8Array(cen.buffer), name);
            offset += 30 + name.length + size;
        }
        const cdSize = central.reduce((a, b) => a + b.length, 0);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
        end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
        return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
    }
};

async function shareQR() {
    const R = S.result;
    if (!confirm(R.kind === 'shares' ? t('share_confirm_shares') : t('share_confirm'))) return;
    const blob = await labeledPNG(R.index);
    const file = new File([blob], 'mnemoniqr.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file] }); } catch (e) { if (e.name !== 'AbortError') toast(t('share_failed'), 'warning'); }
    } else { downloadBlob(blob, 'mnemoniqr.png'); toast(t('share_unavailable'), 'info'); }
}
async function makePDF() {
    if (S.pdfBusy) return;   // the shield check is asynchronous: ignore a second tap meanwhile
    S.pdfBusy = true;
    try { await makePDFNow(); } finally { S.pdfBusy = false; }
}
async function makePDFNow() {
    const R = S.result;
    const tpl = document.querySelector('input[name=tpl]:checked').value;
    const ecc = document.querySelector('input[name=ecc]:checked').value;
    const copies = parseInt($('print-copies').value, 10) || 1;
    try {
        const items = R.texts.map((text, i) => ({ text, i }));
        await Brand.ready();   // the shield beside the title
        const blob = tpl === 'cards' ? PDF.cards(items, ecc, copies) : PDF.sheets(items, ecc);
        downloadBlob(blob, R.kind === 'shares' ? `mnemoniqr-${R.setId.slice(0, 4)}.pdf` : 'mnemoniqr-backup.pdf');
        closeModal('print-modal');
        toast(t('pdf_saved'), 'success', { duration: 6000 });
    } catch (e) { toast(errText(e), 'error'); }
}

// ============================================================
// QR
// ============================================================
const QR = {
    lib() {
        if (!self.QRCode || typeof self.QRCode.toCanvas !== 'function') throw new MQRError('no_qr_lib');
        return self.QRCode;
    },
    render(canvas, text, width, ecc = 'Q') {
        return this.lib().toCanvas(canvas, text, { width, margin: 4, errorCorrectionLevel: ecc, color: { dark: '#000000', light: '#ffffff' } });
    },
    // On-screen QR: a whole number of device pixels per module, so the code stays sharp enough to scan from the screen
    async renderSharp(canvas, text, cssPx, ecc = 'Q') {
        const modules = this.matrix(text, ecc).size + 8;
        const dpr = Math.min(4, Math.max(1, self.devicePixelRatio || 1));
        const scale = Math.max(2, Math.ceil((cssPx * dpr) / modules)); // never drawn smaller than shown
        await this.lib().toCanvas(canvas, text, { scale, margin: 4, errorCorrectionLevel: ecc, color: { dark: '#000000', light: '#ffffff' } });
        // The library sets an inline size in device pixels; the stylesheet decides the size on screen
        canvas.style.removeProperty('width');
        canvas.style.removeProperty('height');
    },
    matrix(text, ecc = 'Q') {
        try { return this.lib().create(text, { errorCorrectionLevel: ecc }).modules; }
        catch (e) { if (e instanceof MQRError) throw e; throw new MQRError('qr_too_big'); }
    },
    decodeImageData(d) {
        if (typeof self.jsQR !== 'function') throw new MQRError('no_qr_reader');
        const r = self.jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' });
        return r ? r.data : null;
    },
    async decodeSource(src, w, h) {
        if ('BarcodeDetector' in self) {
            try {
                const r = await new BarcodeDetector({ formats: ['qr_code'] }).detect(src);
                if (r.length) return r[0].rawValue;
            } catch { /* fall back to jsQR */ }
        }
        for (const max of [1200, 800, 1800, 500]) {
            const s = Math.min(1, max / Math.max(w, h));
            const cw = Math.round(w * s), ch = Math.round(h * s);
            const c = document.createElement('canvas');
            c.width = cw; c.height = ch;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(src, 0, 0, cw, ch);
            const data = this.decodeImageData(ctx.getImageData(0, 0, cw, ch));
            c.width = 0;
            if (data) return data;
        }
        return null;
    }
};

// ============================================================
// Dependency-free vector PDF
// ============================================================
// Unicode code points that WinAnsiEncoding places in the 0x80-0x9F range
const WINANSI = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89,
    0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95,
    0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
// ============================================================
// BRAND: the shield in the PDF header (the QR codes themselves stay plain)
// ============================================================
const Brand = {
    img: null, pdf: null,
    // Loaded with the page (assets/shield.png; a data: URI in the single file); false if it is unavailable
    async ready() {
        if (this.img !== null) return !!this.img;
        const el = $('shield-src');
        try {
            if (!el.complete) await new Promise((res, rej) => { el.addEventListener('load', res, { once: true }); el.addEventListener('error', rej, { once: true }); });
            if (!el.naturalWidth) throw new Error('no image');
            if (el.decode) await el.decode();
            this.img = el;
        } catch { this.img = false; }
        return !!this.img;
    },
    // The shield as an uncompressed RGB image for the PDF (built once)
    pdfImage() {
        if (this.pdf !== null || !this.img) return this.pdf || null;
        try { this.pdf = this.rgb(); } catch { this.pdf = false; }   // without it, the PDF is printed without the shield
        return this.pdf || null;
    },
    rgb() {
        const h = 160, w = Math.round(this.img.naturalWidth * h / this.img.naturalHeight);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(this.img, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, h).data;
        let raw = '';
        for (let i = 0; i < d.length; i += 4) raw += String.fromCharCode(d[i], d[i + 1], d[i + 2]);
        c.width = 0;
        return { w, h, raw };
    }
};

const PDF = {
    W: 595.28, H: 841.89,
    lit(s) {
        let o = '(';
        for (const ch of s) {
            const c = ch.codePointAt(0);
            if (ch === '(' || ch === ')' || ch === '\\') o += '\\' + ch;
            else if (c >= 32 && c < 127) o += ch;
            else if (c >= 160 && c < 256) o += '\\' + c.toString(8).padStart(3, '0');
            else if (WINANSI[c]) o += '\\' + WINANSI[c].toString(8);
            else o += '?';
        }
        return o + ')';
    },
    txt(font, sz, x, y, s, gray = 0) { return `BT /${font} ${sz} Tf ${gray} g ${x.toFixed(2)} ${y.toFixed(2)} Td ${this.lit(s)} Tj ET\n`; },
    // The shield beside the title in the page header
    logo(x, y, h) {
        const im = Brand.pdfImage();
        if (!im) return '';
        const w = h * im.w / im.h;
        return `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Sh Do Q\n`;
    },
    qr(text, ecc, x, y, size) {
        const m = QR.matrix(text, ecc), n = m.size, cell = size / n;
        let c = 'q 0 g\n';
        for (let r = 0; r < n; r++) {
            let st = -1;
            for (let col = 0; col <= n; col++) {
                const on = col < n && m.data[r * n + col];
                if (on && st < 0) st = col;
                if (!on && st >= 0) { c += `${(x + st * cell).toFixed(3)} ${(y + (n - 1 - r) * cell).toFixed(3)} ${((col - st) * cell).toFixed(3)} ${cell.toFixed(3)} re\n`; st = -1; }
            }
        }
        return c + 'f Q\n';
    },
    dashed(x, y, w, h) { return `q 0.6 G 0.5 w [4 3] 0 d ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S Q\n`; },
    // v5 text in groups of four, so it can be read aloud and typed back without losing the place
    printable(text) {
        if (!/^MQ[RS]5:/.test(text)) return this.wrap(text, 70);
        const groups = [text.slice(0, 5), ...text.slice(5).match(/.{1,4}/g)];
        const lines = [];
        let line = '';
        for (const g of groups) { if ((line + ' ' + g).length > 70) { lines.push(line); line = g; } else line = line ? line + ' ' + g : g; }
        if (line) lines.push(line);
        return lines;
    },
    wrap(s, n) { const o = []; for (let i = 0; i < s.length; i += n) o.push(s.slice(i, i + n)); return o; },

    sheets(items, ecc) {
        const R = S.result;
        const BOTTOM = 40, LINE = 12;
        const pages = [];
        const tx = Brand.pdfImage() ? 100 : 56;   // title moves right when the shield is drawn
        for (const { text, i } of items) {
            let c = '';
            const qs = 290, x0 = (this.W - qs) / 2, y0 = this.H - 150 - qs;
            c += this.logo(56, this.H - 98, 44);
            c += this.txt('F3', 22, tx, this.H - 72, 'MnemoniQR');
            c += this.txt('F1', 11, tx, this.H - 92, R.kind === 'shares' ? t('pdf_sub_share', { i: i + 1, n: R.n }) : t('pdf_sub'), 0.35);
            if (R.practice) c += this.txt('F3', 12, 56, this.H - 122, t('pdf_practice'), 0.2);
            c += this.qr(text, ecc, x0, y0, qs);
            c += this.txt('F1', 9, x0, y0 - 18, shareCaption(i) + ' · ' + t('pdf_algo'), 0.35);
            let y = y0 - 56;
            const lines = R.kind === 'shares'
                ? [t('pdf_l_share1', { k: R.k, n: R.n }), t('pdf_l_share2'), t('pdf_l3')]
                : [t('pdf_l1'), t('pdf_l2'), t('pdf_l3')];
            if (R.keyfile) lines.push(t('pdf_kf', { fp: R.keyfile }));
            for (const l of lines) { c += this.txt('F1', 10, 56, y, l, 0.15); y -= 16; }
            y -= 14;
            c += this.txt('F1', 10, 56, y, t('pdf_label') + ' ______________________________________', 0.15);
            y -= 32;
            c += this.txt('F1', 9, 56, y, t('pdf_backup_text'), 0.35);
            y -= 14;
            for (const l of this.printable(text)) {
                if (y < BOTTOM) {
                    pages.push(c);
                    c = this.logo(56, this.H - 80, 22) + this.txt('F3', 12, Brand.pdfImage() ? 80 : 56, this.H - 72, 'MnemoniQR · ' + shareCaption(i));
                    c += this.txt('F1', 9, 56, this.H - 90, t('pdf_backup_text_cont'), 0.35);
                    y = this.H - 112;
                }
                c += this.txt('F2', 8.5, 56, y, l, 0.1);
                y -= LINE;
            }
            if (y - 4 < BOTTOM) { pages.push(c); c = ''; y = this.H - 72; }
            c += this.txt('F1', 8, 56, y - 4, t('pdf_type_hint'), 0.35);
            pages.push(c);
        }
        return this.build(pages);
    },

    cards(items, ecc, copies) {
        const R = S.result;
        const cw = 242.65, ch = 153.07, cols = 2, rows = 5;
        // A module smaller than about 0.5 mm does not print or scan reliably
        const densest = Math.max(...items.map(({ text }) => QR.matrix(text, ecc).size));
        if ((ch - 20) / densest < 1.4) throw new MQRError('cards_too_dense');
        const mx = (this.W - cols * cw) / 2, my = (this.H - rows * ch) / 2;
        const all = [];
        items.forEach((it) => { for (let k = 0; k < copies; k++) all.push(it); });
        const pages = [];
        for (let p = 0; p < all.length; p += cols * rows) {
            let c = '';
            all.slice(p, p + cols * rows).forEach(({ text, i }, j) => {
                const col = j % cols, row = Math.floor(j / cols);
                const x = mx + col * cw, y = this.H - my - (row + 1) * ch;
                c += this.dashed(x, y, cw, ch);
                const qs = ch - 20;
                c += this.qr(text, ecc, x + 10, y + 10, qs);
                const tx = x + qs + 18;
                let ty = y + ch - 26;
                c += this.txt('F3', 11, tx, ty, 'MnemoniQR'); ty -= 16;
                if (R.kind === 'shares') {
                    c += this.txt('F1', 8.5, tx, ty, t('card_share', { i: i + 1, n: R.n }), 0.15); ty -= 12;
                    c += this.txt('F1', 8.5, tx, ty, t('card_need', { k: R.k }), 0.15); ty -= 12;
                    c += this.txt('F1', 8.5, tx, ty, t('card_set', { set: R.setId.slice(0, 4).toUpperCase() }), 0.15); ty -= 12;
                } else {
                    c += this.txt('F1', 8.5, tx, ty, t('card_backup'), 0.15); ty -= 12;
                }
                if (R.practice) { c += this.txt('F3', 8.5, tx, ty, t('card_practice'), 0.15); ty -= 12; }
                if (R.keyfile) { c += this.txt('F3', 8.5, tx, ty, t('card_kf'), 0.15); ty -= 12; }
                c += this.txt('F1', 7.5, tx, y + 26, t('pdf_label'), 0.4);
                c += this.txt('F1', 7.5, tx, y + 14, '________________', 0.4);
            });
            pages.push(c);
        }
        return this.build(pages);
    },

    build(pages) {
        const objs = [];
        const add = (s) => { objs.push(s); return objs.length; };
        const catalog = add(null), pagesObj = add(null);
        const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
        const f3 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
        const im = Brand.pdfImage();
        const sh = im ? add(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${im.raw.length} >>\nstream\n${im.raw}\nendstream`) : 0;
        const xobj = sh ? ` /XObject << /Sh ${sh} 0 R >>` : '';
        const kids = [];
        for (const content of pages) {
            const cs = add(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
            kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >>${xobj} >> /Contents ${cs} 0 R >>`));
        }
        objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
        objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
        let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
        const offs = [];
        objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
        const xref = pdf.length;
        pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
        pdf += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
        return new Blob([Uint8Array.from(pdf, (ch) => ch.charCodeAt(0) & 255)], { type: 'application/pdf' });
    }
};

// ============================================================
// SCANNER AND QR / SHARE COLLECTION
// ============================================================
async function startScanner() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast(t('no_camera'), 'error'); return; }
    const sc = S.scanner;
    if (sc.active || sc.starting) return;
    // A token: if the dialog is closed (stopScanner) while the permission prompt is open, the late stream is stopped
    const token = sc.starting = {};
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (e) {
        if (sc.starting === token) { sc.starting = null; toast(e.name === 'NotAllowedError' ? t('camera_denied') : t('camera_failed'), 'error'); }
        return;
    }
    if (sc.starting !== token || !$('password-modal') || $('password-modal').hidden) { stream.getTracks().forEach((x) => x.stop()); return; }
    sc.starting = null;
    sc.stream = stream;
    $('scanner').hidden = false;
    sc.active = true;
    updateSourceActions();
    $('scanner-video').srcObject = sc.stream;
    try { await $('scanner-video').play(); } catch { /* autoplay blocked, or stopped meanwhile */ }
    if (sc.stream !== stream) return;   // stopScanner() ran while the video was starting
    sc.active = true; sc.frame = 0;
    sc.detector = null;
    if ('BarcodeDetector' in self) { try { sc.detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch { /* fall back to jsQR */ } }
    sc.canvas = document.createElement('canvas');
    $('scanner-status').textContent = t('looking_for_qr');
    scanLoop();
}
async function scanLoop() {
    const sc = S.scanner, v = $('scanner-video');
    if (!sc.active) return;
    sc.frame++;
    if (v.readyState >= v.HAVE_ENOUGH_DATA && sc.frame % 3 === 0 && Date.now() > sc.cooldown) {
        let data = null;
        try {
            if (sc.detector) { const r = await sc.detector.detect(v); if (r.length) data = r[0].rawValue; }
            else {
                const s = Math.min(1, 800 / v.videoWidth);
                const w = Math.round(v.videoWidth * s), h = Math.round(v.videoHeight * s);
                sc.canvas.width = w; sc.canvas.height = h;
                const ctx = sc.canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(v, 0, 0, w, h);
                data = QR.decodeImageData(ctx.getImageData(0, 0, w, h));
            }
        } catch { /* keep scanning */ }
        if (data) {
            const res = acceptCode(data);
            sc.cooldown = Date.now() + 900;
            if (res === 'complete' || res === 'backup') { stopScanner(); if (navigator.vibrate) navigator.vibrate(60); $('decrypt-password').focus(); return; }
            if (res === 'share') { if (navigator.vibrate) navigator.vibrate(40); }
        }
    }
    sc.raf = requestAnimationFrame(scanLoop);
}
function stopScanner() {
    const sc = S.scanner;
    sc.active = false; sc.starting = null;
    if (sc.raf) cancelAnimationFrame(sc.raf);
    if (sc.stream) sc.stream.getTracks().forEach((x) => x.stop());
    sc.stream = null; sc.raf = null;
    if (sc.canvas) sc.canvas.width = 0;
    $('scanner-video').srcObject = null;
    $('scanner').hidden = true;
    updateSourceActions();
}

// Returns: 'backup' | 'share' | 'complete' | 'dup' | 'invalid' | 'mixed'
function acceptCode(text) {
    const kind = M.kindOf(text);
    const status = $('scanner-status');
    if (!kind) { status.textContent = t('not_mqr_qr'); return 'invalid'; }
    if (S.modalMode === 'verify') return 'invalid';
    if (kind === 'backup') {
        let info;
        try { info = M.inspect(text); } catch (e) { status.textContent = errText(e); setDecryptStatus(errText(e)); return 'invalid'; }
        S.collect.backup = text; S.collect.info = info; S.collect.shares.clear();
        S.collect.setId = null; S.collect.k = 0; S.collect.n = 0;
        updateKeyfileNeed();
        $('share-progress').hidden = true;
        $('qr-ready').hidden = false;
        return 'backup';
    }
    let d;
    try { d = M.Shamir.decode(text); } catch (e) { status.textContent = errText(e); setDecryptStatus(errText(e)); return 'invalid'; }
    const col = S.collect;
    if (col.setId && col.setId !== d.setId) { status.textContent = t('share_other_set'); toast(t('share_other_set'), 'warning'); return 'mixed'; }
    if (col.shares.has(d.x)) { status.textContent = t('share_dup', { i: d.x }); return 'dup'; }
    col.setId = d.setId; col.k = d.k; col.n = d.n;
    col.shares.set(d.x, d);
    renderShareProgress();
    if (col.shares.size >= col.k) {
        try {
            col.backup = M.joinShares([...col.shares.values()]);
            col.info = M.inspect(col.backup);
            updateKeyfileNeed();
            $('qr-ready').hidden = false;
            return 'complete';
        } catch (e) {
            // Only possible with damaged MQS4 shares (MQS5 has a checksum): start the set again
            col.shares.clear(); col.setId = null; col.k = 0; col.n = 0;
            $('share-progress').hidden = true;
            setDecryptStatus(t('shares_restart'));
            return 'invalid';
        }
    }
    status.textContent = t('share_next', { got: col.shares.size, k: col.k });
    return 'share';
}
function updateSourceActions() {
    $('source-actions').hidden = S.modalMode === 'verify' || !!S.collect.backup || S.scanner.active;
    if (S.collect.backup) $('type-panel').hidden = true;
}
function updateKeyfileNeed() {
    $('kf-need').hidden = !(S.collect.info && S.collect.info.keyfile);
}
// Typed backup text: any number of codes, whitespace anywhere, prefixes in any case
function parseTyped(raw) {
    const compact = String(raw || '').replace(/\s+/g, '');
    const starts = [...compact.matchAll(/MQ[RS][45]:|MQR3:|MQRv2:/gi)].map((m) => m.index);
    return starts.map((start, k) => {
        const chunk = compact.slice(start, starts[k + 1] === undefined ? compact.length : starts[k + 1]);
        const cut = chunk.indexOf(':') + 1;
        const prefix = /^mqrv2:$/i.test(chunk.slice(0, cut)) ? 'MQRv2:' : chunk.slice(0, cut).toUpperCase();
        return prefix + chunk.slice(cut);
    });
}
function useTypedText() {
    const codes = parseTyped($('type-input').value);
    if (!codes.length) { setDecryptStatus(t('type_none')); return; }
    $('decrypt-status').hidden = true;
    for (const code of codes) {
        const r = acceptCode(code);
        if (r === 'invalid' || r === 'mixed') return;
    }
    if (S.collect.backup) { $('type-input').value = ''; $('type-panel').hidden = true; updateSourceActions(); $('decrypt-password').focus(); }
    else if (S.collect.shares.size) { $('type-input').value = ''; setDecryptStatus(t('share_need_more', { k: S.collect.k })); }
}
function renderShareProgress() {
    const col = S.collect;
    const el = $('share-progress');
    el.hidden = false;
    el.replaceChildren();
    const p = document.createElement('p');
    p.textContent = t('share_progress', { got: Math.min(col.shares.size, col.k), k: col.k, set: col.setId.slice(0, 4).toUpperCase() });
    const dots = document.createElement('div');
    dots.className = 'share-dots';
    for (let x = 1; x <= col.n; x++) {
        const s = document.createElement('span');
        s.textContent = x;
        if (col.shares.has(x)) s.className = 'got';
        dots.appendChild(s);
    }
    el.append(p, dots);
}

async function processFiles(files) {
    files = [...files].filter(Boolean);
    if (!files.length) return;
    if (S.step !== 'home' && $('password-modal').hidden) return;
    if ($('password-modal').hidden) openDecrypt(false);
    spinner(true, t('reading_qr'));
    await nextPaint();
    try {
        for (const f of files) {
            if (!/^image\//.test(f.type)) { toast(t('err_not_image'), 'error'); continue; }
            if (f.size > CFG.MAX_IMAGE) { toast(t('err_image_big'), 'error'); continue; }
            const bmp = await createImageBitmap(f);
            if (bmp.width * bmp.height > CFG.MAX_PIXELS) { if (bmp.close) bmp.close(); toast(t('err_image_pixels'), 'error'); continue; }
            const data = await QR.decodeSource(bmp, bmp.width, bmp.height);
            if (bmp.close) bmp.close();
            if (!data) { toast(t('err_no_qr', { name: f.name }), 'error'); continue; }
            const r = acceptCode(data);
            if (r === 'invalid') toast(t('not_mqr_qr'), 'error');
        }
    } catch (e) { toast(errText(e), 'error'); }
    finally {
        spinner(false);
        $('qr-file').value = '';
        updateSourceActions();
        if (S.collect.backup) $('decrypt-password').focus();
    }
}

// ============================================================
// DECRYPTION
// ============================================================
function openDecrypt(withCamera) {
    S.modalMode = 'decrypt';
    resetDecryptModal();
    $('decrypt-sub').textContent = t('decrypt_sub');
    $('decrypt-confirm').textContent = t('decrypt_btn');
    openModal('password-modal');
    if (Date.now() < S.lockUntil) lockCountdown();
    if (withCamera) startScanner();
}
function resetDecryptModal(keepMode) {
    stopScanner();
    $('decrypt-password').value = '';
    $('decrypt-password').type = 'password';
    $('decrypt-show-password').checked = false;
    $('decrypt-status').hidden = true;
    $('qr-ready').hidden = true;
    $('share-progress').hidden = true;
    updateSourceActions();
    if (S.collect.keyfile) util.wipe(S.collect.keyfile.hash);
    S.collect = { backup: null, info: null, keyfile: null, shares: new Map(), setId: null, k: 0, n: 0 };
    $('type-panel').hidden = true; $('type-input').value = '';
    $('kf-need').hidden = true; $('kf-need-info').hidden = true;
    if (!keepMode) S.modalMode = 'decrypt';
    updateSourceActions();
}
function setDecryptStatus(msg) {
    const el = $('decrypt-status');
    el.textContent = msg; el.className = 'decrypt-status error'; el.hidden = false;
}
async function lockCountdown() {
    const btn = $('decrypt-confirm');
    while (Date.now() < S.lockUntil) {
        btn.disabled = true;
        btn.textContent = t('wait_s', { s: Math.ceil((S.lockUntil - Date.now()) / 1000) });
        await sleep(250);
    }
    btn.disabled = false;
    btn.textContent = S.modalMode === 'verify' ? t('verify_btn') : t('decrypt_btn');
}
async function decryptQR() {
    if (S.busy || Date.now() < S.lockUntil) return;
    const pwd = $('decrypt-password').value;
    if (!S.collect.backup) { setDecryptStatus(S.collect.shares.size ? t('share_need_more', { k: S.collect.k }) : t('scan_first')); return; }
    if (!pwd) { setDecryptStatus(t('type_password')); return; }
    const needsKf = !!(S.collect.info && S.collect.info.keyfile);
    if (needsKf && !S.collect.keyfile) { setDecryptStatus(t('err_keyfile_required')); return; }
    S.busy = true;
    stopScanner();
    spinner(true, t('decrypting'), true);
    await nextPaint();
    try {
        const res = await M.decryptAny(S.collect.backup, pwd, needsKf ? S.collect.keyfile.hash : null);
        S.attempts = 0;
        if (S.modalMode === 'verify') {
            res.words.fill('');
            const R = S.result;
            const which = res.hash === R.hashes.real ? 'real' : (R.hashes.decoy && res.hash === R.hashes.decoy ? 'decoy' : null);
            if (!which) throw new MQRError('verify_mismatch');
            if (which === 'real') { R.verified = true; await renderResult(); }
            $('password-modal').hidden = true;
            modalStack = modalStack.filter((m) => m.el !== $('password-modal'));
            resetDecryptModal(true);
            S.modalMode = 'decrypt';
            toast(which === 'real' ? t('verified_real') : t('verified_decoy'), 'success', { duration: 6000 });
        } else {
            closeModal('password-modal');
            await showDecrypted(res);
            if (res.format < 4) toast(t('old_format', { v: res.format }), 'info', { duration: 8000 });
        }
    } catch (e) {
        if (e instanceof WrongPassword) {
            S.attempts++;
            setDecryptStatus(t(needsKf ? 'wrong_password_kf_n' : 'wrong_password_n', { n: S.attempts }));
            if (S.attempts >= 3) { S.lockUntil = Date.now() + Math.min(30, 2 ** (S.attempts - 2)) * 1000; lockCountdown(); }
            $('decrypt-password').select();
        } else if (e.code !== 'cancelled') { if (!(e instanceof MQRError)) console.error(e); setDecryptStatus(errText(e)); }
    } finally { spinner(false); S.busy = false; Update.apply(); }
}

async function showDecrypted(res) {
    wipeDecrypted();
    if (document.hidden) { res.words.fill(''); toast(t('wiped_leave'), 'info'); return; }
    S.decrypted = { words: res.words.slice(), pp: res.passphrase || '', practice: res.practice };
    res.words.fill('');
    const items = S.decrypted.words.map((w, i) => {
        const li = document.createElement('li');
        li.className = 'seed-word';
        const n = document.createElement('span'); n.className = 'word-index'; n.textContent = i + 1;
        const tx = document.createElement('span'); tx.textContent = w;
        li.append(n, tx);
        return li;
    });
    $('seed-grid').replaceChildren(...items);
    $('seed-grid').classList.toggle('cols-3', items.length >= 18);
    $('decrypted-count').textContent = t('n_words', { n: S.decrypted.words.length });
    const meta = $('decrypted-meta');
    const add = (s) => { const p = document.createElement('p'); p.textContent = s; meta.appendChild(p); };
    if (res.note) add(t('meta_note', { note: res.note }));
    if (res.created) add(t('meta_created', { date: res.created.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' }) }));
    if (S.decrypted.pp) { $('decrypted-pp').textContent = t('meta_pp', { pp: S.decrypted.pp }); $('decrypted-pp').hidden = false; }
    $('decrypted-fp').textContent = '';
    if (res.indices) {
        try {
            const f = await M.fingerprint(BIP39.mnemonic(res.lang, res.indices), S.decrypted.pp);
            $('decrypted-fp').textContent = t('fp_result', { fp: f });
        } catch { /* fingerprint unavailable */ }
        res.indices.fill(0);
    }
    // The app may have gone to the background during the fingerprint: then the phrase is never shown
    if (document.hidden) { wipeDecrypted(); toast(t('wiped_leave'), 'info'); return; }
    setReveal(false);
    S.wasDecrypted = true;
    S.recoveredReal = !res.practice;
    goTo('decrypted');
    startTimer();
}
function setReveal(on) {
    $('seed-grid').classList.toggle('blurred', !on);
    $('decrypted-pp').classList.toggle('blurred', !on);
    $('reveal-text').textContent = on ? t('hide') : t('show');
    $('decrypted-reveal').querySelector('use').setAttribute('href', on ? '#i-eye-off' : '#i-eye');
}
function startTimer() {
    stopTimer();
    S.timerLeft = CFG.AUTO_HIDE;
    const tick = () => {
        $('timer-fill').style.width = `${(S.timerLeft / CFG.AUTO_HIDE) * 100}%`;
        $('timer-label').textContent = t('wipe_in', { s: S.timerLeft });
    };
    tick();
    S.timer = setInterval(() => {
        S.timerLeft--; tick();
        if (S.timerLeft <= 0) { wipeDecrypted(); goTo('home'); toast(t('wiped_timer'), 'info'); }
    }, 1000);
}
function stopTimer() { if (S.timer) clearInterval(S.timer); S.timer = null; }
async function copySeed() {
    if (!confirm(t('copy_confirm', { s: CFG.CLIPBOARD_CLEAR }))) return;
    try {
        await navigator.clipboard.writeText(S.decrypted.words.join(' '));
        toast(t('copied', { s: CFG.CLIPBOARD_CLEAR }), 'warning');
        clearTimeout(S.clipTimer);
        S.clipTimer = setTimeout(() => clearClipboard(false), CFG.CLIPBOARD_CLEAR * 1000);
    } catch { toast(t('copy_failed'), 'error'); }
}
// Browsers only allow writing to the clipboard from a focused page. Users usually paste the phrase in
// another app, so the first try often fails: it is retried every time the app is visible or focused again.
async function clearClipboard(retry) {
    S.clipDirty = true;
    if (retry) {
        if (S.clipRetrying) return;
        S.clipRetrying = true;
        if (!document.hasFocus()) await new Promise((r) => window.addEventListener('focus', r, { once: true }));
        S.clipRetrying = false;
        if (!S.clipDirty) return;
    }
    try {
        await navigator.clipboard.writeText('');
        if (retry) toast(t('clipboard_cleared'), 'info');
        S.clipDirty = false;
    } catch {
        if (retry) toast(t('clipboard_not_cleared'), 'warning', { duration: 10000 });
    }
}

// ============================================================
// BUILD FINGERPRINT
// ============================================================
async function buildFingerprint() {
    // Covers every script and the stylesheet (SRI on the PWA, CSP hashes in the single file)
    let list = [...document.querySelectorAll('script[integrity], link[rel=stylesheet][integrity]')].map((el) => el.integrity);
    if (!list.length) {
        const csp = (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '';
        list = (csp.match(/'sha(256|384)-[^']+'/g) || []).map((x) => x.slice(1, -1));
    }
    if (!list.length) return t('build_dev');
    const h = await util.sha256Hex(new TextEncoder().encode(list.sort().join('\n')));
    return h.slice(0, 16).match(/..../g).join(' ').toUpperCase();
}

// ============================================================
// PWA
// ============================================================
// Updates are mandatory: a new service worker takes over by itself (sw.js) and tells every page.
// The page then reloads at the first safe moment: on the home screen, with no dialog open and
// nothing being computed. If the user is in the middle of a flow, a banner says the update will
// be applied on the way back home, so no typed phrase is ever thrown away without notice.
const Update = {
    pending: false, reloaded: false, reg: null, lastCheck: 0,
    safe() { return S.step === 'home' && !modalStack.length && !S.busy; },
    apply() {
        if (!this.pending || this.reloaded) return;
        if (!this.safe()) { $('update-banner').hidden = false; return; }
        this.reloaded = true;
        location.reload();
    },
    maybeShow() { this.apply(); },
    check(force) {
        // Ask the server for a newer sw.js: on start, on every return to the app and every 30 minutes
        if (!this.reg || !navigator.onLine) return;
        const now = Date.now();
        if (!force && now - this.lastCheck < 60e3) return;
        this.lastCheck = now;
        this.reg.update().catch(() => {});
    }
};
function setupPWA() {
    const single = location.protocol === 'file:' || document.documentElement.hasAttribute('data-single');
    if (!single && 'serviceWorker' in navigator) {
        const sw = navigator.serviceWorker;
        // Tell the controlling worker that this page updates itself, so it is never force-reloaded
        const hello = () => { if (sw.controller) sw.controller.postMessage({ type: 'MQR_HELLO', version: APP_BUILD }); };
        sw.addEventListener('message', (e) => {
            if (!e.data || e.data.type !== 'MQR_UPDATED') return;
            if (e.source && e.source.postMessage) e.source.postMessage({ type: 'MQR_ACK' });
            // A first install, or a worker of this very version: nothing to reload
            if (e.data.version === APP_BUILD) return;
            Update.pending = true;
            Update.apply();
        });
        sw.addEventListener('controllerchange', hello);
        if (sw.startMessages) sw.startMessages();
        hello();
        // updateViaCache 'none': the browser HTTP cache is never used when looking for a new sw.js
        sw.register(ttPolicy ? ttPolicy.createScriptURL('sw.js') : 'sw.js', { updateViaCache: 'none' }).then((reg) => {
            Update.reg = reg;
            Update.check(true);
        }).catch(() => {});
        document.addEventListener('visibilitychange', () => { if (!document.hidden) Update.check(false); });
        window.addEventListener('online', () => Update.check(true));
        setInterval(() => Update.check(false), 30 * 60e3);
    }
    Install.init();
}

// ============================================================
// INSTALLATION (bottom sheet)
// ============================================================
const Install = {
    deferred: null, ios: false,
    KEY: 'mqr-install',
    standalone() {
        return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    },
    pref() { try { return JSON.parse(localStorage.getItem(this.KEY) || '{}'); } catch { return {}; } },
    save(v) { try { localStorage.setItem(this.KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } },
    snoozed() { const p = this.pref(); return !!(p.never || (p.until && Date.now() < p.until)); },
    available() { return !this.standalone() && !!(this.deferred || this.ios) && location.protocol !== 'file:'; },
    init() {
        // iPhone/iPad: no install prompt exists, so the sheet shows the manual steps
        this.ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        window.removeEventListener('beforeinstallprompt', onEarlyInstall);
        const take = (e) => { e.preventDefault(); this.deferred = e; this.refreshLink(); this.maybeAuto(); };
        window.addEventListener('beforeinstallprompt', take);
        if (earlyInstallEvent) { take(earlyInstallEvent); earlyInstallEvent = null; }
        window.addEventListener('appinstalled', () => { this.deferred = null; this.close(); this.refreshLink(); toast(t('installed'), 'success'); });
        $('install-link').addEventListener('click', () => this.open());
        $('install-later').addEventListener('click', () => this.dismiss());
        $('install-go').addEventListener('click', () => this.go());
        $('install-sheet').addEventListener('click', (e) => { if (e.target === $('install-sheet')) this.dismiss(); });
        this.refreshLink();
        if (this.ios) this.maybeAuto();
    },
    refreshLink() { $('install-link').hidden = !this.available(); },
    // Only on the home screen, with no other dialog open, honouring “Not now”
    maybeAuto() {
        setTimeout(() => {
            if (this.available() && !this.snoozed() && S.step === 'home' && !modalStack.length && $('install-sheet').hidden) this.open();
        }, 2000);
    },
    render() {
        const ios = this.ios && !this.deferred;
        $('install-benefits').hidden = ios;
        $('install-ios').hidden = !ios;
        $('install-lead').textContent = ios ? t('install_lead_ios') : t('install_lead');
        $('install-go').textContent = ios ? t('got_it') : t('install_go');
        buildFingerprint().then((f) => { $('install-fp').textContent = t('install_fp', { fp: f }); });
    },
    open() {
        this.render();
        $('install-never').checked = false;
        modalStack.push({ el: $('install-sheet'), ret: document.activeElement });
        $('install-sheet').hidden = false;
        setTimeout(() => $('install-go').focus(), 50);
    },
    close() {
        const el = $('install-sheet');
        if (el.hidden) return;
        el.hidden = true;
        const i = modalStack.findIndex((m) => m.el === el);
        if (i >= 0) { const m = modalStack.splice(i, 1)[0]; if (m.ret && m.ret.focus) m.ret.focus(); }
        Update.apply();
    },
    // “Not now” snoozes for 14 days; “Don’t show again” disables it (the footer link stays)
    dismiss() {
        this.save($('install-never').checked ? { never: true } : { until: Date.now() + 14 * 864e5 });
        this.close();
    },
    async go() {
        if (this.deferred) {
            const d = this.deferred;
            this.deferred = null;
            this.close();
            d.prompt();
            try { await d.userChoice; } catch { /* dismissed */ }
            this.refreshLink();
        } else {
            this.save({ until: Date.now() + 30 * 864e5 });
            this.close();
        }
    }
};


// ============================================================
// SUPPORT (donations)
// ============================================================
// Addresses come only from js/donate.js (SRI, build fingerprint, checked by tools/build.py).
// Nothing is fetched and nothing is tracked: the app never knows whether anyone donated.
// The support UI never appears during a flow: a footer link, one quiet line on the home screen
// after the first verified backup (once per device), and a line in "How it protects you".
const Support = {
    KINDS: ['tron', 'evm', 'btc'], list: [], cur: null, copyTimer: null, nudged: false,
    init() {
        try { localStorage.removeItem('mqr-support'); } catch { /* storage unavailable */ }   // flag stored by 6.5.x
        const all = Array.isArray(self.MQR_DONATE) ? self.MQR_DONATE : [];
        this.list = all.filter((d) => d && this.KINDS.includes(d.kind) && typeof d.address === 'string' && /^[0-9A-Za-z]{26,90}$/.test(d.address));
        const on = this.list.length > 0;
        $('support-link').hidden = !on;
        $('support-about').hidden = !on;
        if (!on) return;
        $('support-link').addEventListener('click', () => this.open());
        $('support-about-go').addEventListener('click', () => { closeModal('about-modal'); this.open(); });
        $('support-nudge-go').addEventListener('click', () => { this.hideNudge(); this.open(); });
        $('support-nudge-x').addEventListener('click', () => this.hideNudge());
        $('support-x').addEventListener('click', () => this.close());
        $('support-done').addEventListener('click', () => this.close());
        $('support-copy').addEventListener('click', () => this.copy());
        $('support-sheet').addEventListener('click', (e) => { if (e.target === $('support-sheet')) this.close(); });
        $('support-tabs').addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const i = this.list.indexOf(this.cur);
            const next = this.list[(i + (e.key === 'ArrowRight' ? 1 : this.list.length - 1)) % this.list.length];
            this.select(next.id);
            const b = $('support-tabs').querySelector(`[data-id="${next.id}"]`);
            if (b) b.focus();
        });
    },
    open() {
        if (!this.list.length || S.step !== 'home' || !$('support-sheet').hidden) return;
        const tabs = $('support-tabs');
        tabs.replaceChildren(...this.list.map((d) => {
            const b = document.createElement('button');
            b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.id = d.id;
            b.setAttribute('aria-controls', 'support-panel');
            const a = document.createElement('strong'); a.textContent = t(`support_${d.kind}_asset`);
            const n = document.createElement('span'); n.textContent = t(`support_${d.kind}_net`);
            b.append(a, n);
            b.addEventListener('click', () => this.select(d.id));
            return b;
        }));
        tabs.hidden = this.list.length < 2;
        this.select((this.cur && this.list.includes(this.cur) ? this.cur : this.list[0]).id);
        openModal('support-sheet');
    },
    close() { if (!$('support-sheet').hidden) closeModal('support-sheet'); },
    async select(id) {
        const d = this.list.find((x) => x.id === id);
        if (!d) return;
        this.cur = d;
        $('support-tabs').querySelectorAll('[role=tab]').forEach((b) => {
            const on = b.dataset.id === id;
            b.setAttribute('aria-selected', String(on));
            b.tabIndex = on ? 0 : -1;
        });
        const asset = t(`support_${d.kind}_asset`), net = t(`support_${d.kind}_net`);
        $('support-chip').textContent = t(`support_${d.kind}_chip`);
        $('support-note').textContent = t(`support_${d.kind}_note`);
        // First and last four characters highlighted (what people compare after pasting), the rest in groups of four
        const a = d.address;
        const parts = [a.slice(0, 4), ...(a.slice(4, -4).match(/.{1,4}/g) || []), a.slice(-4)];
        const addr = $('support-addr');
        addr.setAttribute('aria-label', t('support_addr_label', { asset, net, addr: d.address }));
        addr.replaceChildren(...parts.map((g, i) => {
            const sp = document.createElement('span');
            sp.textContent = g;
            if (i === 0 || i === parts.length - 1) sp.className = 'hl';
            return sp;
        }));
        $('support-copy-t').textContent = t('support_copy');
        const c = $('support-qr');
        c.setAttribute('aria-label', t('support_qr_alt', { asset, net }));
        try { await QR.renderSharp(c, d.address, 134, 'M'); } catch { c.width = 0; }
    },
    async copy() {
        if (!this.cur) return;
        try {
            await navigator.clipboard.writeText(this.cur.address);
            $('support-copy-t').textContent = t('support_copied');
            toast(t('support_copied_toast'), 'info', { duration: 6000 });
            clearTimeout(this.copyTimer);
            this.copyTimer = setTimeout(() => { $('support-copy-t').textContent = t('support_copy'); }, 2500);
        } catch { toast(t('copy_failed'), 'error'); }
    },
    // After the first verified, real backup only; never again on this device once shown
    nudge() {
        // Kept in memory only: a stored flag would tell anyone holding the device that a real backup was made here
        if (!this.list.length || this.nudged || Update.pending) return;   // a reloading page would waste it
        this.nudged = true;
        this.showNudge('backup');
    },
    // After every real recovery (never practice, never while the phrase is on screen): the moment the app proved useful
    afterRecovery() {
        if (!this.list.length || Update.pending) return;
        this.showNudge('recovered');
    },
    showNudge(kind) {
        $('nudge-backup').hidden = kind !== 'backup';
        $('nudge-recovered').hidden = kind !== 'recovered';
        $('support-nudge').hidden = false;
    },
    hideNudge() { $('support-nudge').hidden = true; }
};

// ============================================================
// LANGUAGE
// ============================================================
function refreshTexts() {
    self.I18N.apply(document);
    updateNetPill();
    if (S.step === 'seed') renderSeedStep();
    if (S.step === 'options') renderStepper('options');
    if (S.step === 'password') { renderStepper('password'); updatePasswordUI(); renderCalib(); }
    if (S.step === 'result' && S.result) renderResult();
    if (!$('install-sheet').hidden) Install.render();
    if (S.step === 'decrypted') setReveal(!$('seed-grid').classList.contains('blurred'));
}

// ============================================================
// EVENTS
// ============================================================
function anyModalOpen() { return modalStack.length > 0; }

async function init() {
    refreshTexts();
    setupPWA();
    Support.init();
    const lists = await BIP39.init();
    window.addEventListener('online', updateNetPill);
    window.addEventListener('offline', updateNetPill);
    if (!lists.en) {
        ['encrypt-btn-main', 'recover-btn', 'practice-btn'].forEach((id) => { $(id).disabled = true; });
        toast(t('wordlist_bad'), 'error', { duration: 30000 });
    }
    buildFingerprint().then((f) => { $('build-fp').textContent = f; });

    $('net-card').addEventListener('click', () => toast(navigator.onLine ? t('net_online_help') : t('net_offline_help'), 'info', { duration: 9000 }));

    // --- encrypt ---
    $('encrypt-btn-main').addEventListener('click', () => { clearEntry(); S.practice = false; openSeedStep('real'); });
    $('practice-btn').addEventListener('click', () => openModal('practice-modal'));
    $('practice-start').addEventListener('click', async () => {
        closeModal('practice-modal');
        clearEntry();
        S.practice = true;
        await prefillRandom(S.seeds.real, 12);
        openSeedStep('real');
        toast(t('practice_started'), 'info', { duration: 7000 });
    });
    $('seed-back').addEventListener('click', () => {
        if (S.target === 'decoy') { goTo('options'); renderStepper('options'); return; }
        if (S.seeds.real.words.some(Boolean) && !S.practice && !confirm(t('confirm_leave'))) return;
        clearEntry(); goTo('home');
    });
    $('seed-eye').addEventListener('click', () => { seed().reveal = !seed().reveal; renderSeedStep(); });
    $('seed-paste').addEventListener('click', pasteSeed);
    $('seed-next').addEventListener('click', seedContinue);
    document.addEventListener('paste', (e) => {
        if (S.step !== 'seed' || anyModalOpen()) return;
        const txt = e.clipboardData && e.clipboardData.getData('text');
        if (txt) {
            e.preventDefault(); fillFromText(txt); toast(t('pasted'), 'warning');
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText('').catch(() => { /* not allowed */ });
        }
    });
    // physical keyboard (does not go through the system's on-screen keyboard)
    document.addEventListener('keydown', (e) => {
        trapFocus(e);
        if (e.key === 'Escape' && !$('spinner-overlay').hidden) { if (S.cancelKdf) S.cancelKdf(); return; }
        if (e.key === 'Escape' && modalStack.length) {
            const top = modalStack[modalStack.length - 1].el.id;
            if (top === 'password-modal') $('decrypt-cancel').click();
            else if (top === 'install-sheet') Install.dismiss();
            else closeModal(top);
            return;
        }
        if (S.step !== 'seed' || anyModalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'SELECT') return;
        if (e.key.length === 1 && /\p{L}/u.test(e.key)) { e.preventDefault(); typeLetter(e.key.toLowerCase()); }
        else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
        else if (e.key === ' ' || e.key === 'Enter') {
            // Enter on a focused button (an on-screen key included) presses it; Space always ends the word,
            // except on other buttons, where it keeps its usual meaning
            const isKey = e.target.classList && e.target.classList.contains('key');
            if (tag === 'BUTTON' && !e.target.classList.contains('cell') && !(isKey && e.key === ' ')) return;
            e.preventDefault(); acceptWord();
        }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); moveCell(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); moveCell(1); }
    });

    // --- options ---
    $('pp-enable').addEventListener('change', () => { $('pp-box').hidden = !$('pp-enable').checked; if ($('pp-enable').checked) $('pp-input').focus(); });
    $('split-select').addEventListener('change', () => { $('split-custom').hidden = $('split-select').value !== 'custom'; });
    $('message-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') optionsContinue(); });
    $('options-next').addEventListener('click', optionsContinue);
    document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.back === 'seed') openSeedStep('real');
    }));

    // --- password ---
    $('password-back').addEventListener('click', () => { if (S.opts.decoy) openSeedStep('decoy'); else { goTo('options'); renderStepper('options'); } });
    ['password-input', 'password-confirm', 'decoy-input', 'decoy-confirm'].forEach((id) => {
        $(id).addEventListener('input', updatePasswordUI);
        $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !$('password-next').disabled) startEncryption(); });
    });
    $('show-password').addEventListener('change', () => {
        const ty = $('show-password').checked ? 'text' : 'password';
        ['password-input', 'password-confirm', 'decoy-input', 'decoy-confirm'].forEach((id) => { $(id).type = ty; });
    });
    $('gen-words').addEventListener('click', () => {
        const { password, bits } = Strength.generateWords(6, phraseWords());
        useGenerated(password, bits);
    });
    $('gen-chars').addEventListener('click', () => useGenerated(M.generatePassword(), 120));
    $('kf-enable').addEventListener('change', () => { $('kf-box').hidden = !$('kf-enable').checked; });
    $('kf-pick').addEventListener('click', () => pickKeyfile());
    $('kf-need-pick').addEventListener('click', () => pickKeyfile());
    $('kf-file').addEventListener('change', (e) => onKeyfileChosen(e.target.files[0]));
    $('src-type').addEventListener('click', () => { stopScanner(); $('type-panel').hidden = false; $('type-input').focus(); });
    $('type-use').addEventListener('click', useTypedText);
    $('password-next').addEventListener('click', startEncryption);
    $('spinner-cancel').addEventListener('click', () => { if (S.cancelKdf) { S.cancelKdf(); toast(t('cancelled'), 'info'); } });

    // --- result ---
    $('share-prev').addEventListener('click', () => { if (S.result.index > 0) { S.result.index--; renderResult(); } });
    $('share-next').addEventListener('click', () => { if (S.result.index < S.result.texts.length - 1) { S.result.index++; renderResult(); } });
    $('qr-verify').addEventListener('click', verifyBackup);
    $('qr-download').addEventListener('click', () => exporting(downloadPNG));
    $('qr-zip').addEventListener('click', () => exporting(downloadZIP));
    $('qr-print').addEventListener('click', () => { $('copies-row').hidden = false; openModal('print-modal'); });
    $('print-go').addEventListener('click', makePDF);
    $('qr-share').addEventListener('click', shareQR);
    $('qr-done').addEventListener('click', () => {
        if (!S.result.verified && !S.result.practice && !confirm(t('confirm_unverified'))) return;
        const thank = S.result.verified && !S.result.practice;
        wipeResult(); goTo('home');
        if (thank) Support.nudge();
    });

    // --- decrypt ---
    $('recover-btn').addEventListener('click', () => openDecrypt(false));
    $('src-scan').addEventListener('click', startScanner);
    $('src-upload').addEventListener('click', () => $('qr-file').click());
    $('decrypt-x').addEventListener('click', () => $('decrypt-cancel').click());
    $('seed-count').addEventListener('change', (e) => { const s = seed(); s.count = parseInt(e.target.value, 10); if (s.cur >= s.count) s.cur = s.count - 1; renderSeedStep(); });
    $('qr-file').addEventListener('change', (e) => processFiles(e.target.files));
    const ds = $('drop-zone');
    ds.addEventListener('dragover', (e) => { e.preventDefault(); ds.classList.add('dragover'); });
    ds.addEventListener('dragleave', () => ds.classList.remove('dragover'));
    ds.addEventListener('drop', (e) => { e.preventDefault(); ds.classList.remove('dragover'); processFiles(e.dataTransfer.files); });
    $('decrypt-show-password').addEventListener('change', () => { $('decrypt-password').type = $('decrypt-show-password').checked ? 'text' : 'password'; });
    $('decrypt-confirm').addEventListener('click', decryptQR);
    $('decrypt-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); decryptQR(); } });
    $('decrypt-cancel').addEventListener('click', () => {
        if (S.busy) { if (S.cancelKdf) S.cancelKdf(); return; }
        closeModal('password-modal'); S.modalMode = 'decrypt';
    });

    // --- decrypted phrase ---
    const toggle = () => setReveal($('seed-grid').classList.contains('blurred'));
    $('seed-grid').addEventListener('click', toggle);
    $('decrypted-reveal').addEventListener('click', toggle);
    $('decrypted-copy').addEventListener('click', copySeed);
    $('decrypted-done').addEventListener('click', () => { wipeDecrypted(); goTo('home'); });

    // --- modals ---
    $('about-btn').addEventListener('click', () => openModal('about-modal'));
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeModal(b.closest('.modal').id)));
    document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => {
        if (e.target !== m) return;
        if (m.id === 'password-modal') $('decrypt-cancel').click(); else closeModal(m.id);
    }));

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', () => { wipeDecrypted(); wipeResult(); clearEntry(); stopScanner(); });
    // Restored from the back/forward cache: everything was wiped on pagehide, so start from home
    window.addEventListener('pageshow', (e) => { if (e.persisted) { modalStack.slice().forEach((m) => { m.el.hidden = true; }); modalStack = []; goTo('home'); } });

    const action = new URLSearchParams(location.search).get('action');
    if (action) history.replaceState(null, '', location.pathname);
    if (action === 'encrypt') $('encrypt-btn-main').click();
    if (action === 'scan') openDecrypt(true);
    if (action === 'practice') $('practice-btn').click();

}

document.addEventListener('DOMContentLoaded', init);
})();
