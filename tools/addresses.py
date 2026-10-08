"""
MnemoniQR · donation address checks (Python 3 standard library only).

Used by tools/build.py so that a release can never publish a mistyped address:
  - tron: Base58Check, version byte 0x41, 25 bytes
  - evm:  0x + 40 hex digits in the EIP-55 checksummed (mixed-case) form (Keccak-256)
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


# ---------- Keccak-256 (the pre-standard SHA-3 padding used by Ethereum) ----------
_RC = [0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000, 0x000000000000808B,
       0x0000000080000001, 0x8000000080008081, 0x8000000000008009, 0x000000000000008A, 0x0000000000000088,
       0x0000000080008009, 0x000000008000000A, 0x000000008000808B, 0x800000000000008B, 0x8000000000008089,
       0x8000000000008003, 0x8000000000008002, 0x8000000000000080, 0x000000000000800A, 0x800000008000000A,
       0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008]
_ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]]
_M = (1 << 64) - 1


def _rol(x, n):
    return ((x << n) | (x >> (64 - n))) & _M if n else x


def _keccak_f(a):
    for rc in _RC:
        c = [a[x][0] ^ a[x][1] ^ a[x][2] ^ a[x][3] ^ a[x][4] for x in range(5)]
        d = [c[(x - 1) % 5] ^ _rol(c[(x + 1) % 5], 1) for x in range(5)]
        a = [[a[x][y] ^ d[x] for y in range(5)] for x in range(5)]
        b = [[0] * 5 for _ in range(5)]
        for x in range(5):
            for y in range(5):
                b[y][(2 * x + 3 * y) % 5] = _rol(a[x][y], _ROT[x][y])
        a = [[b[x][y] ^ ((~b[(x + 1) % 5][y]) & b[(x + 2) % 5][y]) for y in range(5)] for x in range(5)]
        a[0][0] ^= rc
    return a


def keccak256(data):
    rate = 136
    msg = bytearray(data) + b'\x01'
    msg += b'\0' * (-len(msg) % rate)
    msg[-1] |= 0x80
    a = [[0] * 5 for _ in range(5)]
    for off in range(0, len(msg), rate):
        block = msg[off:off + rate]
        for i in range(rate // 8):
            x, y = i % 5, i // 5
            a[x][y] ^= int.from_bytes(block[8 * i:8 * i + 8], 'little')
        a = _keccak_f(a)
    out = b''.join(a[i % 5][i // 5].to_bytes(8, 'little') for i in range(4))
    return out


def eip55(addr_hex):
    h = keccak256(addr_hex.lower().encode()).hex()
    return '0x' + ''.join(ch.upper() if ch.isalpha() and int(h[i], 16) >= 8 else ch for i, ch in enumerate(addr_hex.lower()))


# ---------- Bech32 / Bech32m (BIP-173 / BIP-350) ----------
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
    if kind == 'tron':
        body = b58decode_check(a) if a.startswith('T') else None
        return None if body and len(body) == 21 and body[0] == 0x41 else 'not a valid TRON address (Base58Check, starts with T)'
    if kind == 'evm':
        h = a[2:]
        if not a.startswith('0x') or len(h) != 40 or any(ch not in '0123456789abcdefABCDEF' for ch in h):
            return 'not an EVM address (0x + 40 hex digits)'
        # Only the mixed-case EIP-55 form carries a checksum: without it a typo would go unnoticed
        if eip55(h) != a:
            return f'EIP-55 checksummed form required (expected {eip55(h)} if the digits are right)'
        return None
    if kind == 'btc':
        if a.lower().startswith('bc1'):
            return None if segwit_ok(a) else 'not a valid Bitcoin Bech32/Bech32m address'
        body = b58decode_check(a)
        return None if body and len(body) == 21 and body[0] in (0x00, 0x05) else 'not a valid Bitcoin address'
    return f'unknown kind "{kind}"'


if __name__ == '__main__':
    assert keccak256(b'').hex() == 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
    for good in ('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359'):
        assert check('evm', good) is None, good
    assert check('evm', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD') is not None
    assert check('evm', '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed') is not None   # no checksum: refused
    assert check('btc', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4') is None
    assert check('btc', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5') is not None
    assert check('btc', 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0') is None
    assert check('btc', '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2') is None
    assert check('btc', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy') is None
    tron_zero = b58encode_check(b'\x41' + b'\0' * 20)
    assert tron_zero == 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb', tron_zero
    assert check('tron', tron_zero) is None and check('tron', tron_zero[:-1] + 'c') is not None
    print('address checks OK')
