# Music bed + sound effects for the release promo. 120 BPM, so every scene cut lands on a beat.
# python sound.py cues.json out.wav
import json, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR, DUR, BPM = 48000, 40.0, 120
BEAT = 60 / BPM
N = int(DUR * SR)
rng = np.random.default_rng(11)

def t_(sec): return np.arange(int(sec * SR)) / SR
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def noise(sec): return rng.standard_normal(int(sec * SR))
def put(buf, x, at, gain=1.0):
    s = int(at * SR)
    if s >= len(buf): return
    e = min(s + len(x), len(buf)); buf[s:e] += x[:e - s] * gain
def saw(f, sec, det=0.0):
    t = t_(sec); ph = (f * (1 + det)) * t
    return 2 * (ph - np.floor(ph + .5))
def hz(n): return 440 * 2 ** ((n - 69) / 12)

# ---------------- drums ----------------
def kick():
    t = t_(.42)
    f = 46 + 110 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7.5) + .25 * bp(noise(.42), 1500, 5000) * np.exp(-t * 120)
def hat(open_=False):
    sec = .18 if open_ else .045; t = t_(sec)
    return hp(noise(sec), 7000) * np.exp(-t * (18 if open_ else 95))
def clap():
    t = t_(.25); x = np.zeros(len(t))
    for d in (0, .011, .022): put_ = int(d * SR); x[put_:] += np.exp(-(t[:len(t) - put_]) * 60)
    return bp(noise(.25), 900, 3500) * x * .8

# ---------------- tonal ----------------
# Am - F - C - G, one chord per bar (2 s)
PROG = [(57, 60, 64), (53, 57, 60), (48, 55, 60), (55, 59, 62)]
ROOT = [45, 41, 48, 43]
def bass_note(n, sec):
    x = saw(hz(n - 12), sec) + .5 * saw(hz(n - 12), sec, .004)
    t = t_(sec); env = np.minimum(t / .005, 1) * np.exp(-t * 5)
    return lp(x, 420) * env
def pluck(n, sec=.32):
    t = t_(sec); x = saw(hz(n), sec) + saw(hz(n), sec, .006)
    return lp(x, 2600) * np.exp(-t * 11) * np.minimum(t / .003, 1)
def pad(ch, sec):
    t = t_(sec); x = sum(saw(hz(n), sec, d) for n in ch for d in (-.004, .004))
    env = np.minimum(t / .6, 1) * np.minimum((sec - t) / .4, 1)
    return lp(x, 1100) * env * .12

def music():
    L = np.zeros(N); R = np.zeros(N)
    drums = np.zeros(N); bass = np.zeros(N); synth = np.zeros(N); padb = np.zeros(N)
    nb = int(DUR / BEAT)
    for i in range(nb):
        at = i * BEAT; bar = int(at // 2) % 4
        sec_ = at
        full = 4 <= sec_ < 32 or 36 <= sec_ < 38
        soft = 32 <= sec_ < 36
        if full or (sec_ >= .8 and sec_ < 4 and i % 2 == 0) or (soft and i % 2 == 0):
            put(drums, kick(), at, 1.0 if not soft else .7)
        if full and i % 2 == 1: put(drums, clap(), at, .5)
        # hats on the offbeat eighths, 16ths in the busy middle
        if sec_ >= 1.0 and sec_ < 38:
            put(drums, hat(), at + BEAT / 2, .35 if not soft else .18)
            if 9 <= sec_ < 32:
                put(drums, hat(), at + BEAT / 4, .14); put(drums, hat(), at + 3 * BEAT / 4, .14)
        # bass: eighths after the kick, ducked
        if sec_ >= .8 and sec_ < 38:
            for k in (1, 2, 3) if full else (2,):
                put(bass, bass_note(ROOT[bar], BEAT / 4 * .9), at + k * BEAT / 4, .55)
        # pluck arp in sixteenths, from the kinematics scene on
        if 9 <= sec_ < 32:
            ch = PROG[bar]
            for k in range(4):
                n = ch[(i * 4 + k) % 3] + (12 if (i + k) % 5 == 0 else 0)
                put(synth, pluck(n + 12), at + k * BEAT / 4, .10)
    for b_ in range(int(DUR // 2)):
        if b_ * 2 < 38: put(padb, pad(PROG[b_ % 4], 2.05), b_ * 2, 1.0 if b_ * 2 >= 4 else .6)
    # final chord at the logo
    put(padb, pad((57, 60, 64, 69), 4.0) * 1.6, 36.0)
    mix = drums + bass + synth + padb
    # gentle stereo: synth wider
    L = mix + .25 * synth; R = mix - .25 * synth
    return L, R

# ---------------- sound effects ----------------
def ring(f0, sec, decay, ratios=(1, 1.59, 2.41, 3.37), amps=(1, .6, .4, .25)):
    t = t_(sec)
    return sum(a * np.exp(-t * decay * r ** .6) * np.sin(2 * np.pi * f0 * r * t) for r, a in zip(ratios, amps))
def tick():
    x = bp(noise(.03), 2500, 7000) * np.exp(-t_(.03) * 300)
    return .55 * x + .12 * ring(2100, .03, 260)
def ratchet():
    # a rod end turning: a run of clicks, a touch higher each one
    out = np.zeros(int(1.2 * SR))
    for i in range(12):
        f = 1500 * 2 ** (i / 30); x = .42 * bp(noise(.05), 1800, 8000) * np.exp(-t_(.05) * 190) + .26 * ring(f, .05, 110)
        put(out, x * .6, i * .085)
    return out
def clunk():
    t = t_(.42)
    low = np.exp(-t * 15) * np.sin(2 * np.pi * (84 + 70 * np.exp(-t * 30)) * t)
    return .95 * low + .38 * ring(430, .42, 15) + .3 * lp(noise(.42), 2600) * np.exp(-t * 60)
def land():
    t = t_(.9)
    low = np.exp(-t * 7) * np.sin(2 * np.pi * (58 + 80 * np.exp(-t * 24)) * t)
    rattle = bp(noise(.9), 1200, 5200) * np.exp(-t * 11) * (.55 + .45 * np.sin(2 * np.pi * 21 * t))
    return 1.15 * low + .35 * rattle + .35 * ring(310, .9, 9)
def steer():
    t = t_(.3); env = np.minimum(t / .04, 1) * np.exp(-t * 12)
    return .85 * bp(noise(.3), 300, 1500) * env
def whoosh():
    sec = .5; t = t_(sec); x = noise(sec)
    env = np.sin(np.pi * np.clip(t / sec, 0, 1)) ** 2
    lo = bp(x, 400, 2400) * env; hi = hp(x, 3000) * env * .4
    return .55 * (lo + hi)
def hit():
    t = t_(2.5)
    low = np.exp(-t * 3.2) * np.sin(2 * np.pi * (44 + 60 * np.exp(-t * 18)) * t)
    return 1.1 * low + .3 * lp(noise(2.5), 1800) * np.exp(-t * 9) + .25 * ring(220, 2.5, 2.2)
MAKE = dict(tick=tick, ratchet=ratchet, clunk=clunk, land=land, steer=steer, whoosh=whoosh, hit=hit)
GAIN = dict(tick=.7, ratchet=.8, clunk=.8, land=.9, steer=.6, whoosh=.55, hit=1.0)

def main(cues, out):
    L, R = music()
    mpk = max(abs(L).max(), abs(R).max()); L *= .55 / mpk; R *= .55 / mpk
    fx = np.zeros(N)
    for name, at in json.load(open(cues)):
        put(fx, MAKE[name](), at, GAIN[name])
    fx *= .5 / max(abs(fx).max(), 1e-9)
    L += fx; R += fx
    tt = np.arange(N) / SR
    fade = np.clip((DUR - tt) / 1.2, 0, 1) * np.clip(tt / .05, 0, 1)
    L *= fade; R *= fade
    # soft limiter
    g = 10 ** (-1.0 / 20) / max(abs(L).max(), abs(R).max())
    L = np.tanh(L * g * 1.3) / np.tanh(1.3); R = np.tanh(R * g * 1.3) / np.tanh(1.3)
    wavfile.write(out, SR, (np.stack([L, R], 1) * .89 * 32767).astype(np.int16))
    print('ok')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
