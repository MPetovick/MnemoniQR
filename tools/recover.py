#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) MPetovick and the MnemoniQR contributors. Commercial licenses: see COMMERCIAL.md
"""
MnemoniQR standalone recovery tool (v6.9.0).

Decrypts MnemoniQR backups without the app, so your backup stays recoverable even if the
website or the app disappears. It reads every format the app has ever written:
MQR5/MQS5 (6.2+), MQR4/MQS4 (4.0-6.1), MQR3 (3.x) and MQRv2 (2.x).

Requirements (Python 3.8+):
    pip install argon2-cffi cryptography

Usage:
    python3 recover.py                      # paste the backup text (or several shares), then Ctrl-D
    python3 recover.py backup.txt           # read codes from files
    python3 recover.py "MQS5:..." "MQS5:..."  # or pass them directly
    python3 recover.py --keyfile photo.jpg backup.txt

Get the text by scanning the QR with any offline QR reader, or type the text printed under it.
Spaces, line breaks and letter case do not matter for MQR5/MQS5 text.

Run it on an offline computer. The recovered phrase is printed to this terminal only.
"""
import argparse
import base64
import getpass
import hashlib
import hmac
import json
import re
import struct
import sys
import unicodedata
import zlib

try:
    from argon2.low_level import Type, hash_secret_raw
    from cryptography.exceptions import InvalidTag
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    sys.exit('Missing dependencies. Install them with:  pip install argon2-cffi cryptography')

VERSION = '6.9.0'
WORDLIST_SHA256 = 'f18b9a84c83e38e98eceb0102b275e26438af83ab08f080cdb780a2caa9f3a6d'
WORDS = 'abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor actress actual adapt add addict address adjust admit adult advance advice aerobic affair afford afraid again age agent agree ahead aim air airport aisle alarm album alcohol alert alien all alley allow almost alone alpha already also alter always amateur amazing among amount amused analyst anchor ancient anger angle angry animal ankle announce annual another answer antenna antique anxiety any apart apology appear apple approve april arch arctic area arena argue arm armed armor army around arrange arrest arrive arrow art artefact artist artwork ask aspect assault asset assist assume asthma athlete atom attack attend attitude attract auction audit august aunt author auto autumn average avocado avoid awake aware away awesome awful awkward axis baby bachelor bacon badge bag balance balcony ball bamboo banana banner bar barely bargain barrel base basic basket battle beach bean beauty because become beef before begin behave behind believe below belt bench benefit best betray better between beyond bicycle bid bike bind biology bird birth bitter black blade blame blanket blast bleak bless blind blood blossom blouse blue blur blush board boat body boil bomb bone bonus book boost border boring borrow boss bottom bounce box boy bracket brain brand brass brave bread breeze brick bridge brief bright bring brisk broccoli broken bronze broom brother brown brush bubble buddy budget buffalo build bulb bulk bullet bundle bunker burden burger burst bus business busy butter buyer buzz cabbage cabin cable cactus cage cake call calm camera camp can canal cancel candy cannon canoe canvas canyon capable capital captain car carbon card cargo carpet carry cart case cash casino castle casual cat catalog catch category cattle caught cause caution cave ceiling celery cement census century cereal certain chair chalk champion change chaos chapter charge chase chat cheap check cheese chef cherry chest chicken chief child chimney choice choose chronic chuckle chunk churn cigar cinnamon circle citizen city civil claim clap clarify claw clay clean clerk clever click client cliff climb clinic clip clock clog close cloth cloud clown club clump cluster clutch coach coast coconut code coffee coil coin collect color column combine come comfort comic common company concert conduct confirm congress connect consider control convince cook cool copper copy coral core corn correct cost cotton couch country couple course cousin cover coyote crack cradle craft cram crane crash crater crawl crazy cream credit creek crew cricket crime crisp critic crop cross crouch crowd crucial cruel cruise crumble crunch crush cry crystal cube culture cup cupboard curious current curtain curve cushion custom cute cycle dad damage damp dance danger daring dash daughter dawn day deal debate debris decade december decide decline decorate decrease deer defense define defy degree delay deliver demand demise denial dentist deny depart depend deposit depth deputy derive describe desert design desk despair destroy detail detect develop device devote diagram dial diamond diary dice diesel diet differ digital dignity dilemma dinner dinosaur direct dirt disagree discover disease dish dismiss disorder display distance divert divide divorce dizzy doctor document dog doll dolphin domain donate donkey donor door dose double dove draft dragon drama drastic draw dream dress drift drill drink drip drive drop drum dry duck dumb dune during dust dutch duty dwarf dynamic eager eagle early earn earth easily east easy echo ecology economy edge edit educate effort egg eight either elbow elder electric elegant element elephant elevator elite else embark embody embrace emerge emotion employ empower empty enable enact end endless endorse enemy energy enforce engage engine enhance enjoy enlist enough enrich enroll ensure enter entire entry envelope episode equal equip era erase erode erosion error erupt escape essay essence estate eternal ethics evidence evil evoke evolve exact example excess exchange excite exclude excuse execute exercise exhaust exhibit exile exist exit exotic expand expect expire explain expose express extend extra eye eyebrow fabric face faculty fade faint faith fall false fame family famous fan fancy fantasy farm fashion fat fatal father fatigue fault favorite feature february federal fee feed feel female fence festival fetch fever few fiber fiction field figure file film filter final find fine finger finish fire firm first fiscal fish fit fitness fix flag flame flash flat flavor flee flight flip float flock floor flower fluid flush fly foam focus fog foil fold follow food foot force forest forget fork fortune forum forward fossil foster found fox fragile frame frequent fresh friend fringe frog front frost frown frozen fruit fuel fun funny furnace fury future gadget gain galaxy gallery game gap garage garbage garden garlic garment gas gasp gate gather gauge gaze general genius genre gentle genuine gesture ghost giant gift giggle ginger giraffe girl give glad glance glare glass glide glimpse globe gloom glory glove glow glue goat goddess gold good goose gorilla gospel gossip govern gown grab grace grain grant grape grass gravity great green grid grief grit grocery group grow grunt guard guess guide guilt guitar gun gym habit hair half hammer hamster hand happy harbor hard harsh harvest hat have hawk hazard head health heart heavy hedgehog height hello helmet help hen hero hidden high hill hint hip hire history hobby hockey hold hole holiday hollow home honey hood hope horn horror horse hospital host hotel hour hover hub huge human humble humor hundred hungry hunt hurdle hurry hurt husband hybrid ice icon idea identify idle ignore ill illegal illness image imitate immense immune impact impose improve impulse inch include income increase index indicate indoor industry infant inflict inform inhale inherit initial inject injury inmate inner innocent input inquiry insane insect inside inspire install intact interest into invest invite involve iron island isolate issue item ivory jacket jaguar jar jazz jealous jeans jelly jewel job join joke journey joy judge juice jump jungle junior junk just kangaroo keen keep ketchup key kick kid kidney kind kingdom kiss kit kitchen kite kitten kiwi knee knife knock know lab label labor ladder lady lake lamp language laptop large later latin laugh laundry lava law lawn lawsuit layer lazy leader leaf learn leave lecture left leg legal legend leisure lemon lend length lens leopard lesson letter level liar liberty library license life lift light like limb limit link lion liquid list little live lizard load loan lobster local lock logic lonely long loop lottery loud lounge love loyal lucky luggage lumber lunar lunch luxury lyrics machine mad magic magnet maid mail main major make mammal man manage mandate mango mansion manual maple marble march margin marine market marriage mask mass master match material math matrix matter maximum maze meadow mean measure meat mechanic medal media melody melt member memory mention menu mercy merge merit merry mesh message metal method middle midnight milk million mimic mind minimum minor minute miracle mirror misery miss mistake mix mixed mixture mobile model modify mom moment monitor monkey monster month moon moral more morning mosquito mother motion motor mountain mouse move movie much muffin mule multiply muscle museum mushroom music must mutual myself mystery myth naive name napkin narrow nasty nation nature near neck need negative neglect neither nephew nerve nest net network neutral never news next nice night noble noise nominee noodle normal north nose notable note nothing notice novel now nuclear number nurse nut oak obey object oblige obscure observe obtain obvious occur ocean october odor off offer office often oil okay old olive olympic omit once one onion online only open opera opinion oppose option orange orbit orchard order ordinary organ orient original orphan ostrich other outdoor outer output outside oval oven over own owner oxygen oyster ozone pact paddle page pair palace palm panda panel panic panther paper parade parent park parrot party pass patch path patient patrol pattern pause pave payment peace peanut pear peasant pelican pen penalty pencil people pepper perfect permit person pet phone photo phrase physical piano picnic picture piece pig pigeon pill pilot pink pioneer pipe pistol pitch pizza place planet plastic plate play please pledge pluck plug plunge poem poet point polar pole police pond pony pool popular portion position possible post potato pottery poverty powder power practice praise predict prefer prepare present pretty prevent price pride primary print priority prison private prize problem process produce profit program project promote proof property prosper protect proud provide public pudding pull pulp pulse pumpkin punch pupil puppy purchase purity purpose purse push put puzzle pyramid quality quantum quarter question quick quit quiz quote rabbit raccoon race rack radar radio rail rain raise rally ramp ranch random range rapid rare rate rather raven raw razor ready real reason rebel rebuild recall receive recipe record recycle reduce reflect reform refuse region regret regular reject relax release relief rely remain remember remind remove render renew rent reopen repair repeat replace report require rescue resemble resist resource response result retire retreat return reunion reveal review reward rhythm rib ribbon rice rich ride ridge rifle right rigid ring riot ripple risk ritual rival river road roast robot robust rocket romance roof rookie room rose rotate rough round route royal rubber rude rug rule run runway rural sad saddle sadness safe sail salad salmon salon salt salute same sample sand satisfy satoshi sauce sausage save say scale scan scare scatter scene scheme school science scissors scorpion scout scrap screen script scrub sea search season seat second secret section security seed seek segment select sell seminar senior sense sentence series service session settle setup seven shadow shaft shallow share shed shell sheriff shield shift shine ship shiver shock shoe shoot shop short shoulder shove shrimp shrug shuffle shy sibling sick side siege sight sign silent silk silly silver similar simple since sing siren sister situate six size skate sketch ski skill skin skirt skull slab slam sleep slender slice slide slight slim slogan slot slow slush small smart smile smoke smooth snack snake snap sniff snow soap soccer social sock soda soft solar soldier solid solution solve someone song soon sorry sort soul sound soup source south space spare spatial spawn speak special speed spell spend sphere spice spider spike spin spirit split spoil sponsor spoon sport spot spray spread spring spy square squeeze squirrel stable stadium staff stage stairs stamp stand start state stay steak steel stem step stereo stick still sting stock stomach stone stool story stove strategy street strike strong struggle student stuff stumble style subject submit subway success such sudden suffer sugar suggest suit summer sun sunny sunset super supply supreme sure surface surge surprise surround survey suspect sustain swallow swamp swap swarm swear sweet swift swim swing switch sword symbol symptom syrup system table tackle tag tail talent talk tank tape target task taste tattoo taxi teach team tell ten tenant tennis tent term test text thank that theme then theory there they thing this thought three thrive throw thumb thunder ticket tide tiger tilt timber time tiny tip tired tissue title toast tobacco today toddler toe together toilet token tomato tomorrow tone tongue tonight tool tooth top topic topple torch tornado tortoise toss total tourist toward tower town toy track trade traffic tragic train transfer trap trash travel tray treat tree trend trial tribe trick trigger trim trip trophy trouble truck true truly trumpet trust truth try tube tuition tumble tuna tunnel turkey turn turtle twelve twenty twice twin twist two type typical ugly umbrella unable unaware uncle uncover under undo unfair unfold unhappy uniform unique unit universe unknown unlock until unusual unveil update upgrade uphold upon upper upset urban urge usage use used useful useless usual utility vacant vacuum vague valid valley valve van vanish vapor various vast vault vehicle velvet vendor venture venue verb verify version very vessel veteran viable vibrant vicious victory video view village vintage violin virtual virus visa visit visual vital vivid vocal voice void volcano volume vote voyage wage wagon wait walk wall walnut want warfare warm warrior wash wasp waste water wave way wealth weapon wear weasel weather web wedding weekend weird welcome west wet whale what wheat wheel when where whip whisper wide width wife wild will win window wine wing wink winner winter wire wisdom wise wish witness wolf woman wonder wood wool word work world worry worth wrap wreck wrestle wrist write wrong yard year yellow you young youth zebra zero zone zoo'.split(' ')
if hashlib.sha256(' '.join(WORDS).encode()).hexdigest() != WORDLIST_SHA256:
    sys.exit('The embedded BIP39 word list is corrupted. Do not use this copy of the script.')

HEADER_LEN, IV_LEN, TAG_LEN, PAD_BLOCK = 27, 12, 16, 64
FLAG_PRACTICE, FLAG_KEYFILE, KNOWN_FLAGS = 1, 2, 3
PREFIX = re.compile(r'MQ[RS][45]:|MQR3:|MQRv2:', re.I)


class RecoveryError(Exception):
    pass


# ---------------------------------------------------------------- text encodings
B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'


def b32decode(text):
    val = bits = 0
    out = bytearray()
    for ch in text:
        i = B32.find(ch)
        if i < 0:
            raise RecoveryError(f'Invalid character {ch!r}: the text has a typo.')
        val = ((val << 5) | i) & 0xFFFF
        bits += 5
        if bits >= 8:
            out.append((val >> (bits - 8)) & 0xFF)
            bits -= 8
    if bits >= 5 or val & ((1 << bits) - 1):
        raise RecoveryError('The text has a typo or a missing part.')
    return bytes(out)


def decode_v5(body):
    body = re.sub(r'[\s-]', '', body.upper()).replace('0', 'O').replace('1', 'I')
    data = b32decode(body)
    if len(data) < 5 or struct.unpack('>I', data[-4:])[0] != zlib.crc32(data[:-4]):
        raise RecoveryError('The text has a typo or a missing part (checksum mismatch).')
    return data[:-4]


def b64url_decode(body):
    try:
        return base64.urlsafe_b64decode(body + '=' * (-len(body) % 4))
    except Exception:
        raise RecoveryError('The MQR4/MQS4 text is damaged.')


def split_codes(raw):
    """Find every MnemoniQR code in free text, ignoring whitespace."""
    compact = re.sub(r'\s+', '', raw)
    starts = [m.start() for m in PREFIX.finditer(compact)]
    codes = []
    for k, start in enumerate(starts):
        chunk = compact[start:starts[k + 1] if k + 1 < len(starts) else None]
        cut = chunk.index(':') + 1
        prefix = 'MQRv2:' if chunk[:cut].lower() == 'mqrv2:' else chunk[:cut].upper()
        codes.append(prefix + chunk[cut:])
    return codes


# ---------------------------------------------------------------- Shamir over GF(256)
EXP, LOG = [0] * 510, [0] * 256
_x = 1
for _i in range(255):
    EXP[_i] = _x
    LOG[_x] = _i
    _x ^= ((_x << 1) ^ (0x11B if _x & 0x80 else 0))
    _x &= 0xFF
for _i in range(255, 510):
    EXP[_i] = EXP[_i - 255]


def gf_mul(a, b):
    return EXP[LOG[a] + LOG[b]] if a and b else 0


def gf_div(a, b):
    return EXP[LOG[a] + 255 - LOG[b]] if a else 0


def parse_share(code):
    data = decode_v5(code[5:]) if code.upper().startswith('MQS5:') else b64url_decode(code[5:])
    if len(data) < 49 or data[0] != 4:
        raise RecoveryError('A share is damaged.')
    k, n, x = data[5], data[6], data[7]
    if not (2 <= k <= n <= 16 and 1 <= x <= n):
        raise RecoveryError('A share is damaged.')
    return {'set': data[1:5].hex(), 'k': k, 'n': n, 'x': x, 'y': data[8:]}


def combine(shares):
    first = shares[0]
    uniq = {}
    for s in shares:
        if (s['set'], s['k'], s['n'], len(s['y'])) != (first['set'], first['k'], first['n'], len(first['y'])):
            raise RecoveryError('The shares belong to different backups.')
        uniq[s['x']] = s
    if len(uniq) < first['k']:
        raise RecoveryError(f"{len(uniq)} share(s) given, {first['k']} needed.")
    use = list(uniq.values())[:first['k']]
    out = bytearray(len(first['y']))
    for b in range(len(out)):
        acc = 0
        for i, si in enumerate(use):
            num = den = 1
            for j, sj in enumerate(use):
                if i != j:
                    num = gf_mul(num, sj['x'])
                    den = gf_mul(den, si['x'] ^ sj['x'])
            acc ^= gf_mul(si['y'][b], gf_div(num, den))
        out[b] = acc
    return bytes(out)


# ---------------------------------------------------------------- BIP39 and fingerprint
def entropy_to_words(entropy):
    if len(entropy) not in (16, 20, 24, 28, 32):
        raise RecoveryError('Unexpected entropy length.')
    bits = ''.join(f'{b:08b}' for b in entropy)
    bits += f'{hashlib.sha256(entropy).digest()[0]:08b}'[:len(entropy) // 4]
    return [WORDS[int(bits[i:i + 11], 2)] for i in range(0, len(bits), 11)]


P = 2 ** 256 - 2 ** 32 - 977
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
G = (0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798,
     0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8)


def ec_add(p1, p2):
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    if p1[0] == p2[0] and (p1[1] + p2[1]) % P == 0:
        return None
    if p1 == p2:
        lam = 3 * p1[0] * p1[0] * pow(2 * p1[1], -1, P) % P
    else:
        lam = (p2[1] - p1[1]) * pow(p2[0] - p1[0], -1, P) % P
    x = (lam * lam - p1[0] - p2[0]) % P
    return x, (lam * (p1[0] - x) - p1[1]) % P


def ec_mul(k):
    result, addend = None, G
    while k:
        if k & 1:
            result = ec_add(result, addend)
        addend = ec_add(addend, addend)
        k >>= 1
    return result


def ripemd160(data):
    try:
        return hashlib.new('ripemd160', data).digest()
    except ValueError:  # OpenSSL 3 without the legacy provider
        return _ripemd160(data)


def _ripemd160(msg):
    # Compact pure-Python RIPEMD-160 (reference algorithm)
    def rol(x, n): return ((x << n) | (x >> (32 - n))) & 0xFFFFFFFF
    f = [lambda x, y, z: x ^ y ^ z, lambda x, y, z: (x & y) | (~x & z), lambda x, y, z: (x | ~y) ^ z,
         lambda x, y, z: (x & z) | (y & ~z), lambda x, y, z: x ^ (y | ~z)]
    K1, K2 = [0, 0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xA953FD4E], [0x50A28BE6, 0x5C4DD124, 0x6D703EF3, 0x7A6D76E9, 0]
    R1 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
          3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
          4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13]
    R2 = [5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
          15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
          12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11]
    S1 = [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
          11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
          9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6]
    S2 = [8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
          9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
          8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11]
    h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0]
    msg = bytearray(msg)
    ml = len(msg) * 8
    msg += b'\x80' + b'\x00' * ((55 - len(msg)) % 64) + struct.pack('<Q', ml)
    for off in range(0, len(msg), 64):
        X = struct.unpack('<16I', msg[off:off + 64])
        al, bl, cl, dl, el = h
        ar, br, cr, dr, er = h
        for j in range(80):
            r = j // 16
            t = (rol((al + (f[r](bl, cl, dl) & 0xFFFFFFFF) + X[R1[j]] + K1[r]) & 0xFFFFFFFF, S1[j]) + el) & 0xFFFFFFFF
            al, el, dl, cl, bl = el, dl, rol(cl, 10), bl, t
            t = (rol((ar + (f[4 - r](br, cr, dr) & 0xFFFFFFFF) + X[R2[j]] + K2[r]) & 0xFFFFFFFF, S2[j]) + er) & 0xFFFFFFFF
            ar, er, dr, cr, br = er, dr, rol(cr, 10), br, t
        t = (h[1] + cl + dr) & 0xFFFFFFFF
        h[1] = (h[2] + dl + er) & 0xFFFFFFFF
        h[2] = (h[3] + el + ar) & 0xFFFFFFFF
        h[3] = (h[4] + al + br) & 0xFFFFFFFF
        h[4] = (h[0] + bl + cr) & 0xFFFFFFFF
        h[0] = t
    return struct.pack('<5I', *h)


def fingerprint(words, passphrase):
    mnemonic = unicodedata.normalize('NFKD', ' '.join(words)).encode()
    salt = unicodedata.normalize('NFKD', 'mnemonic' + passphrase).encode()
    seed = hashlib.pbkdf2_hmac('sha512', mnemonic, salt, 2048)
    master = hmac.new(b'Bitcoin seed', seed, hashlib.sha512).digest()
    x, y = ec_mul(int.from_bytes(master[:32], 'big'))
    pub = bytes([2 + (y & 1)]) + x.to_bytes(32, 'big')
    return ripemd160(hashlib.sha256(pub).digest())[:4].hex()


# ---------------------------------------------------------------- decryption
def kdf(password_bytes, salt, kind, p1, p2, p3):
    if kind == 1:
        if not (8192 <= p1 <= 524288 and 1 <= p2 <= 16 and 1 <= p3 <= 8):
            raise RecoveryError('Key-derivation parameters out of range.')
        return hash_secret_raw(password_bytes, salt, time_cost=p2, memory_cost=p1, parallelism=p3, hash_len=32, type=Type.ID, version=19)
    if kind == 2:
        if not (100000 <= p1 <= 5000000):
            raise RecoveryError('Key-derivation parameters out of range.')
        return hashlib.pbkdf2_hmac('sha256', password_bytes, salt, p1, 32)
    raise RecoveryError('Unknown key-derivation method.')


class Reader:
    """Bounds-checked reader: a field that runs past the end is an error, never a shorter value."""

    def __init__(self, buf):
        self.buf, self.o = buf, 0

    def take(self, n):
        if self.o + n > len(self.buf):
            raise RecoveryError('The decrypted content is malformed.')
        v = self.buf[self.o:self.o + n]
        self.o += n
        return v

    def u8(self):
        return self.take(1)[0]

    def u16(self):
        return struct.unpack('>H', self.take(2))[0]

    def u32(self):
        return struct.unpack('>I', self.take(4))[0]

    def text(self, n):
        try:
            return self.take(n).decode('utf-8')
        except UnicodeDecodeError:
            raise RecoveryError('The decrypted content is malformed.')


def unpack(pt):
    r = Reader(pt)
    kind, lang = r.u8(), r.u8()
    if lang != 0:
        raise RecoveryError('This backup uses the Spanish word list (MnemoniQR 4.0-5.1.0), which this tool does not support.')
    if kind == 1:
        words = entropy_to_words(r.take(r.u8()))
    elif kind == 2:
        words = r.text(r.u16()).split(' ')
    else:
        raise RecoveryError('Unexpected content.')
    passphrase = r.text(r.u8())
    note = r.text(r.u8())
    created = r.u32()
    return {'words': words, 'passphrase': passphrase, 'note': note, 'created': created, 'checksum_valid': kind == 1}


def checksum_ok(words):
    """True if the words form a valid BIP39 phrase (used for v2 backups, which stored plain words)."""
    index = {w: i for i, w in enumerate(WORDS)}
    if len(words) not in (12, 15, 18, 21, 24) or any(w not in index for w in words):
        return False
    bits = ''.join(f'{index[w]:011b}' for w in words)
    cs = len(words) // 3
    ent = int(bits[:-cs], 2).to_bytes((len(bits) - cs) // 8, 'big')
    return f'{hashlib.sha256(ent).digest()[0]:08b}'[:cs] == bits[-cs:]


def decrypt_v4(blob, password, keyfile_hash):
    if len(blob) < HEADER_LEN + 2 * (IV_LEN + PAD_BLOCK + TAG_LEN) or blob[:3] != b'MQ\x04' or (len(blob) - HEADER_LEN) % 2:
        raise RecoveryError('The backup is damaged.')
    header = blob[:HEADER_LEN]
    flags, kind = header[3], header[4]
    if flags & ~KNOWN_FLAGS:
        raise RecoveryError('This backup was made by a newer MnemoniQR. Update this tool.')
    if flags & FLAG_KEYFILE and keyfile_hash is None:
        raise RecoveryError('This backup also needs its keyfile: add --keyfile PATH.')
    p1 = struct.unpack('>I', header[5:9])[0]
    pw = unicodedata.normalize('NFKC', password).encode()
    if flags & FLAG_KEYFILE:
        pw = keyfile_hash + pw
    key = AESGCM(kdf(pw, header[11:27], kind, p1, header[9], header[10]))
    half = (len(blob) - HEADER_LEN) // 2
    for slot in (blob[HEADER_LEN:HEADER_LEN + half], blob[HEADER_LEN + half:]):
        try:
            result = unpack(key.decrypt(slot[:IV_LEN], slot[IV_LEN:], header))
            result['practice'] = bool(flags & FLAG_PRACTICE)
            return result
        except InvalidTag:
            continue
    raise RecoveryError('Wrong password' + (' or keyfile.' if flags & FLAG_KEYFILE else '.'))


def decrypt_v3(blob, password):
    if len(blob) < 54 or blob[:3] != b'MQ\x03':
        raise RecoveryError('The backup is damaged.')
    header = blob[:38]
    p1 = struct.unpack('>I', header[4:8])[0]
    key = AESGCM(kdf(unicodedata.normalize('NFKC', password).encode(), header[10:26], header[3], p1, header[8], header[9]))
    try:
        pt = key.decrypt(header[26:38], blob[38:], header)
    except InvalidTag:
        raise RecoveryError('Wrong password.')
    r = Reader(pt)
    kind = r.u8()
    if kind == 1:
        words = entropy_to_words(r.take(r.u8()))
    elif kind == 2:
        words = r.text(r.u16()).split(' ')
    else:
        raise RecoveryError('Unexpected content.')
    note = r.text(r.u8())
    return {'words': words, 'passphrase': '', 'note': note, 'created': r.u32(), 'checksum_valid': kind == 1, 'practice': False}


def decrypt_v2(data, password):
    if len(data) < 192:
        raise RecoveryError('The backup is damaged.')
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), data[128:160], 310000, 32)
    try:
        pt = AESGCM(key).decrypt(data[160:176], data[176:], data[:128])
    except InvalidTag:
        raise RecoveryError('Wrong password.')
    try:
        p = json.loads(pt)
        if not isinstance(p, dict):
            raise ValueError
    except ValueError:
        raise RecoveryError('The decrypted content is malformed.')
    words = str(p.get('seed', '')).split()
    return {'words': words, 'passphrase': '', 'note': str(p.get('userMessage', '')),
            'created': struct.unpack('>I', data[2:6])[0], 'checksum_valid': checksum_ok(words), 'practice': False}


def assemble(codes):
    """Turn the collected codes into one backup: ('v4', blob) | ('v3', blob) | ('v2', data)."""
    backups = [c for c in codes if not c.upper().startswith(('MQS4:', 'MQS5:'))]
    shares = [parse_share(c) for c in codes if c.upper().startswith(('MQS4:', 'MQS5:'))]
    if backups:
        c = backups[0]
        if c.upper().startswith('MQR5:'):
            return 'v4', decode_v5(c[5:])
        if c.startswith('MQR4:'):
            return 'v4', b64url_decode(c[5:])
        if c.startswith('MQR3:'):
            return 'v3', b64url_decode(c[5:])
        try:
            return 'v2', base64.b64decode(c[6:], validate=True)
        except Exception:
            raise RecoveryError('The MQRv2 text is damaged.')
    if shares:
        return 'v4', combine(shares)
    raise RecoveryError('No MnemoniQR code found. Codes start with MQR5:, MQS5:, MQR4:, MQS4:, MQR3: or MQRv2:.')


def recover(codes, password, keyfile_hash=None):
    kind, data = assemble(codes)
    if kind == 'v4':
        return decrypt_v4(data, password, keyfile_hash)
    if kind == 'v3':
        return decrypt_v3(data, password)
    return decrypt_v2(data, password)


def main():
    ap = argparse.ArgumentParser(description='Recover a MnemoniQR backup without the app.')
    ap.add_argument('inputs', nargs='*', help='codes, or files containing codes (default: read standard input)')
    ap.add_argument('--keyfile', help='keyfile, if the backup was created with one')
    ap.add_argument('--password-stdin', action='store_true', help='read the password from the first line of standard input (for scripts)')
    ap.add_argument('--no-fingerprint', action='store_true', help='skip the wallet fingerprint')
    ap.add_argument('--json', action='store_true', help='print the result as JSON')
    ap.add_argument('--version', action='version', version=f'MnemoniQR recover {VERSION}')
    args = ap.parse_args()

    password = sys.stdin.readline().rstrip('\r\n') if args.password_stdin else None
    try:
        raw = []
        for item in args.inputs:
            if PREFIX.match(item.strip()):
                raw.append(item)
            else:
                with open(item, encoding='utf-8') as f:
                    raw.append(f.read())
        if not raw:
            if sys.stdin.isatty():
                print('Paste the backup text or the shares, then press Ctrl-D (Ctrl-Z, Enter on Windows):', file=sys.stderr)
            raw.append(sys.stdin.read())
        codes = split_codes('\n'.join(raw))
        keyfile_hash = None
        if args.keyfile:
            with open(args.keyfile, 'rb') as f:
                keyfile_hash = hashlib.sha256(f.read()).digest()
        if password is None:
            password = getpass.getpass('Password: ')
        result = recover(codes, password, keyfile_hash)
    except RecoveryError as e:
        sys.exit(f'Error: {e}')
    except OSError as e:
        sys.exit(f'Error: {e}')
    except UnicodeDecodeError:
        sys.exit('Error: an input file is not text. Pass the backup text, not the QR image.')

    if not args.no_fingerprint and result['checksum_valid']:
        result['fingerprint'] = fingerprint(result['words'], result['passphrase'])
    if args.json:
        print(json.dumps(result, ensure_ascii=False))
        return
    if result['practice']:
        print('PRACTICE BACKUP: this is not a real seed.')
    for i, w in enumerate(result['words'], 1):
        print(f'{i:>2}. {w}')
    if result['passphrase']:
        print(f'BIP39 passphrase: {result["passphrase"]}')
    if result['note']:
        print(f'Note: {result["note"]}')
    if result.get('fingerprint'):
        print(f'Wallet fingerprint: {result["fingerprint"]}')
    if not result['checksum_valid']:
        print('Warning: the phrase was saved without a valid BIP39 checksum.')


if __name__ == '__main__':
    main()
