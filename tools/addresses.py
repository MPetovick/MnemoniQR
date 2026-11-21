# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) MPetovick and the MnemoniQR contributors. Commercial licenses: see COMMERCIAL.md
"""
MnemoniQR · donation address check (Python 3 standard library only).

Used by tools/build.py so that a release can never publish a mistyped address. Donations are Bitcoin only:
  - btc:  Bech32 (P2WPKH/P2WSH, v0) or Bech32m (Taproot, v1+) with hrp "bc", or Base58Check P2PKH/P2SH
"""
import hashlib

B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'


def b58decode_check(s):
    n = 0
    for ch in s:
        if ch not in B58:
            return None
        n = n * 58 + B58.index(ch)
    raw = n.to_bytes((n.bit_length() + 7) // 8, 'big')
    raw = b'\0' * (len(s) - len(s.lstrip('1'))) + raw
    if len(raw) < 5:
        return None
    body, check = raw[:-4], raw[-4:]
    return body if hashlib.sha256(hashlib.sha256(body).digest()).digest()[:4] == check else None


def b58encode_check(body):
    raw = body + hashlib.sha256(hashlib.sha256(body).digest()).digest()[:4]
    n = int.from_bytes(raw, 'big')
    out = ''
    while n:
        n, r = divmod(n, 58)
        out = B58[r] + out
    return '1' * (len(raw) - len(raw.lstrip(b'\0'))) + out


_CS = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'


def _polymod(values):
    gen = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
    chk = 1
    for v in values:
        top = chk >> 25
        chk = (chk & 0x1ffffff) << 5 ^ v
        for i in range(5):
            chk ^= gen[i] if ((top >> i) & 1) else 0
    return chk


def _convertbits(data, frm, to):
    acc = bits = 0
    out = []
    for v in data:
        acc = (acc << frm) | v
        bits += frm
        while bits >= to:
            bits -= to
            out.append((acc >> bits) & ((1 << to) - 1))
    if bits >= frm or ((acc << (to - bits)) & ((1 << to) - 1)):
        return None
    return out


def segwit_ok(addr):
    if addr.lower() != addr and addr.upper() != addr:
        return False
    addr = addr.lower()
    pos = addr.rfind('1')
    if addr[:pos] != 'bc' or pos + 7 > len(addr) or len(addr) > 90 or any(ch not in _CS for ch in addr[pos + 1:]):
        return False
    data = [_CS.index(ch) for ch in addr[pos + 1:]]
    const = _polymod([ord(ch) >> 5 for ch in 'bc'] + [0] + [ord(ch) & 31 for ch in 'bc'] + data)
    if not data or data[0] > 16:
        return False
    if const != (1 if data[0] == 0 else 0x2bc830a3):
        return False
    prog = _convertbits(data[1:-6], 5, 8)
    if prog is None or not 2 <= len(prog) <= 40:
        return False
    return data[0] != 0 or len(prog) in (20, 32)


def check(kind, address):
    """None when the address is valid for its network, else a short reason."""
    a = address.strip()
    if a != address or not a:
        return 'empty or surrounded by spaces'
    if kind != 'btc':
        return f'unknown kind "{kind}" (donations are Bitcoin only)'
    if a.lower().startswith('bc1'):
        return None if segwit_ok(a) else 'not a valid Bitcoin Bech32/Bech32m address'
    body = b58decode_check(a)
    return None if body and len(body) == 21 and body[0] in (0x00, 0x05) else 'not a valid Bitcoin address'


if __name__ == '__main__':
    assert check('btc', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4') is None
    assert check('btc', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5') is not None
    assert check('btc', 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0') is None
    assert check('btc', '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2') is None
    assert check('btc', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy') is None
    assert check('btc', 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx') is not None   # testnet: refused
    assert check('evm', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed') is not None    # other networks: refused
    print('addresses.py: ok')
