// MnemoniQR v6.6.3 · Argon2id worker: key derivation never blocks the UI and can be cancelled.
'use strict';
if (typeof self.hashwasm === 'undefined') {
    const tt = self.trustedTypes
        ? self.trustedTypes.createPolicy('mqr', { createScriptURL: (u) => (u === 'vendor/argon2.min.js' ? u : '') })
        : null;
    importScripts(tt ? tt.createScriptURL('vendor/argon2.min.js') : 'vendor/argon2.min.js');
}
self.onmessage = async (e) => {
    const { id, password, salt, m, t, p } = e.data;
    try {
        const hash = await self.hashwasm.argon2id({
            password, salt, memorySize: m, iterations: t, parallelism: p, hashLength: 32, outputType: 'binary'
        });
        self.postMessage({ id, hash }, [hash.buffer]);
    } catch (err) {
        self.postMessage({ id, error: String((err && err.message) || err) });
    } finally {
        if (password && password.fill) password.fill(0);
    }
};
