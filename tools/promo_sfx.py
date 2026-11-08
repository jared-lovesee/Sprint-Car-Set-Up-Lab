# Sound effects for the beta promo, synthesised and placed from the cue list promo_beta.js writes.
# Shop sounds only, no music: python promo_sfx.py cues.json out.wav
import json, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR, DUR = 48000, 30.0
rng = np.random.default_rng(7)

def t_(sec): return np.arange(int(sec * SR)) / SR
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def noise(sec): return rng.standard_normal(int(sec * SR))

# struck steel: a few inharmonic modes that ring and die
def ring(f0, sec, decay, ratios=(1, 1.59, 2.41, 3.37), amps=(1, .6, .4, .25)):
    t = t_(sec)
    return sum(a * np.exp(-t * decay * r ** .6) * np.sin(2 * np.pi * f0 * r * t) for r, a in zip(ratios, amps))

def tick():
    x = bp(noise(.03), 2500, 7000) * np.exp(-t_(.03) * 300)
    return .55 * x + .12 * ring(2100, .03, 260)

def clack():
    return .5 * ring(620, .16, 34) + .5 * bp(noise(.16), 900, 4200) * np.exp(-t_(.16) * 70)

def ratchet(i):
    # the pawl dropping, a touch higher each round so the eight of them climb
    f = 1500 * 2 ** (i / 24)
    return .42 * bp(noise(.05), 1800, 8000) * np.exp(-t_(.05) * 190) + .26 * ring(f, .05, 110)

def clunk():
    t = t_(.42)
    low = np.exp(-t * 15) * np.sin(2 * np.pi * (84 + 70 * np.exp(-t * 30)) * t)
    return .95 * low + .38 * ring(430, .42, 15) + .3 * lp(noise(.42), 2600) * np.exp(-t * 60)

def land():
    t = t_(.9)
    low = np.exp(-t * 7) * np.sin(2 * np.pi * (58 + 80 * np.exp(-t * 24)) * t)
    rattle = bp(noise(.9), 1200, 5200) * np.exp(-t * 11) * (.55 + .45 * np.sin(2 * np.pi * 21 * t))
    return 1.15 * low + .35 * rattle + .35 * ring(310, .9, 9)

def cut():
    # no riser or whoosh: a short, dry thump of air
    t = t_(.14)
    return .7 * np.exp(-t * 42) * np.sin(2 * np.pi * (110 + 60 * np.exp(-t * 60)) * t) + .22 * bp(noise(.14), 500, 2600) * np.exp(-t * 55)

def steer():
    t = t_(.3)
    env = np.minimum(t / .04, 1) * np.exp(-t * 12)
    return .85 * bp(noise(.3), 300, 1500) * env

def bump():
    t = t_(.38)
    return .55 * np.exp(-t * 16) * np.sin(2 * np.pi * (72 + 34 * np.exp(-t * 22)) * t) + .12 * bp(noise(.38), 1500, 4500) * np.exp(-t * 30)

def hiss():
    # air coming out of the LR while it shrinks, 1.4 s, matching the picture
    sec = 1.5; t = t_(sec)
    env = np.minimum(t / .05, 1) * np.clip((sec - t) / .35, 0, 1) ** 1.5
    return .34 * bp(noise(sec), 2800, 11000) * env

def gun():
    # an impact gun, two hits, rattling at about 24 blows a second
    out = np.zeros(int(.95 * SR))
    for start, sec in ((0, .36), (.48, .42)):
        n = int(sec * SR); t = t_(sec)
        blows = (np.sin(2 * np.pi * 24 * t) > .2) * np.exp(-((t * 24) % 1) * 3.5)
        x = (.65 * bp(noise(sec), 900, 6500) + .55 * np.sign(np.sin(2 * np.pi * 240 * t)) * .32 + .4 * np.sin(2 * np.pi * 96 * t)) * blows
        s = int(start * SR); out[s:s + n] += x * np.clip((sec - t) / .05, 0, 1)
    return .8 * out

MAKE = dict(tick=tick, clack=clack, clunk=clunk, land=land, cut=cut, steer=steer, bump=bump, hiss=hiss, gun=gun)
PAN = dict(tick=.18, ratchet=.12, steer=-.15, hiss=-.2)

def main(cues, out):
    L, R = np.zeros(int(DUR * SR)), np.zeros(int(DUR * SR))
    nr = 0
    for name, at in json.load(open(cues)):
        if name == 'ratchet': x = ratchet(nr); nr += 1
        else: x = MAKE[name]()
        p = PAN.get(name, 0) * rng.choice((-1, 1)); s = int(at * SR); e = min(s + len(x), len(L))
        L[s:e] += x[:e - s] * (1 - max(p, 0)); R[s:e] += x[:e - s] * (1 + min(p, 0))
    # a very quiet shop-air bed so the gaps are not digital silence
    def bed(): return lp(hp(rng.standard_normal(len(L)), 90), 900) * .0035
    L += bed(); R += bed()
    fade = np.clip((DUR - np.arange(len(L)) / SR) / .25, 0, 1); L *= fade; R *= fade
    pk = max(abs(L).max(), abs(R).max()); g = 10 ** (-1.5 / 20) / pk
    wavfile.write(out, SR, (np.stack([L, R], 1) * g * 32767).astype(np.int16))
    print('peak gain', round(g, 3))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
