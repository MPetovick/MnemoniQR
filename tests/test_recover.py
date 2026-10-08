#!/usr/bin/env python3
"""
Robustness tests for tools/recover.py (Python standard library + the tool's own dependencies).

    pip install argon2-cffi cryptography
    python3 tests/test_recover.py

Every parser in recover.py is fed thousands of malformed inputs. The only acceptable failure is a
RecoveryError with a readable message: never a traceback.
"""
import importlib.util
import os
import random
import string
import struct
import sys
import unittest
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('recover', os.path.join(ROOT, 'tools', 'recover.py'))
rec = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rec)

B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
rng = random.Random(1234)


def b32(data):
    out, val, bits = '', 0, 0
    for b in data:
        val = ((val << 8) | b) & 0xFFFF
        bits += 8
        while bits >= 5:
            out += B32[(val >> (bits - 5)) & 31]
            bits -= 5
    if bits:
        out += B32[(val << (5 - bits)) & 31]
    return out


def v5(prefix, data):
    return prefix + b32(data + struct.pack('>I', zlib.crc32(data)))


def only_recovery_errors(test, fn, inputs):
    for i, x in enumerate(inputs):
        try:
            fn(x)
        except rec.RecoveryError as e:
            test.assertTrue(str(e), 'empty error message')
        except Exception as e:  # noqa: BLE001
            test.fail(f'{type(e).__name__}: {e} on input #{i}: {x!r:.80}')


class RecoverRobustness(unittest.TestCase):
    def test_word_list_and_checksum(self):
        self.assertTrue(rec.checksum_ok(['abandon'] * 11 + ['about']))
        self.assertFalse(rec.checksum_ok(['abandon'] * 12))
        self.assertFalse(rec.checksum_ok(['notaword'] * 12))
        self.assertEqual(rec.entropy_to_words(bytes(16)), ['abandon'] * 11 + ['about'])

    def test_base32_roundtrip_and_typos(self):
        for n in range(1, 120):
            data = os.urandom(n)
            self.assertEqual(rec.decode_v5(v5('', data)), data)
        good = v5('', os.urandom(80))
        for i in range(len(good)):
            bad = good[:i] + B32[(B32.index(good[i]) + 7) % 32] + good[i + 1:]
            with self.assertRaises(rec.RecoveryError):
                rec.decode_v5(bad)

    def test_fuzz_text_parsers(self):
        junk = [''.join(rng.choice(string.printable) for _ in range(rng.randrange(400))) for _ in range(2000)]
        prefixes = ['MQR5:', 'MQS5:', 'MQR4:', 'MQS4:', 'MQR3:', 'MQRv2:', 'mqr5:', '']
        inputs = [prefixes[i % len(prefixes)] + j for i, j in enumerate(junk)]
        only_recovery_errors(self, lambda x: rec.assemble(rec.split_codes(x)), inputs)

    def test_fuzz_valid_checksums(self):
        inputs = [v5(rng.choice(['MQR5:', 'MQS5:']), os.urandom(rng.randrange(600))) for _ in range(2000)]
        only_recovery_errors(self, lambda x: rec.assemble(rec.split_codes(x)), inputs)

    def test_fuzz_decrypted_content(self):
        inputs = []
        for i in range(5000):
            b = bytearray(os.urandom(rng.randrange(300)))
            if i % 2 and len(b) > 4:
                b[0], b[1], b[2] = rng.choice([1, 2]), 0, rng.choice([16, 20, 24, 28, 32, rng.randrange(256)])
            inputs.append(bytes(b))
        only_recovery_errors(self, rec.unpack, inputs)

    def test_truncation_never_shortens(self):
        good = bytes([1, 0, 16]) + bytes(16) + bytes([2]) + b'pp' + bytes([4]) + b'note' + struct.pack('>I', 1)
        self.assertEqual(rec.unpack(good)['note'], 'note')
        for cut in range(len(good)):
            with self.assertRaises(rec.RecoveryError):
                rec.unpack(good[:cut])

    def test_shares_need_a_full_set(self):
        share = bytes([4]) + b'\x01\x02\x03\x04' + bytes([2, 3, 1]) + os.urandom(60)
        code = v5('MQS5:', share)
        with self.assertRaises(rec.RecoveryError):
            rec.assemble([code])


if __name__ == '__main__':
    unittest.main(verbosity=1)
