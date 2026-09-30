"""Soundtrack for 01-silent-failure (v3: new music + designed sound), then mux into final.mp4.

Music: Mixkit #190 (electronic, 120 BPM, Mixkit Stock Music Free License). Measured: quiet intro until the drop at
song 16.03 s (+18.6 dB overall), steady loud section to ~46 s, key B-flat minor. Film layout (film time, 120-BPM grid):
  0 - 6.0 s    hook    song 28.03-34.03 (loud section, 6 bars after the drop), ends in a tape stop
  6.0 - 12.0   break   song 10.03-16.03 (the quiet 3 bars before the drop), low-pass opening up, riser + reverse swell
  12.0 -       drop    song 16.03 onward, lands on the failing check run
Sound design: Mixkit SFX by peak plus synthesized sounds (seeded, deterministic) tuned to B-flat minor:
16th-note blips for the AI reviewer's line-by-line "approval", a chord slam on LGTM, glitch + sub on the ticks that
flip to red, a blip cascade for the 44 blocks, sub boom on the drop, arpeggios on green, 8-bit blips for the shield.
Event times are written in SCENE time (film.html's own clock) and mapped to film time through timeline.json.
Loudness: two-pass loudnorm to -14 LUFS integrated, -1 dBTP.

  python fetch_assets.py && python audio.py            -> out/audio.wav + final.mp4 (needs out/video.mp4)
"""
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg
import numpy as np

HERE = Path(__file__).parent
FF, SR = imageio_ffmpeg.get_ffmpeg_exe(), 48000
TL = json.loads((HERE / "timeline.json").read_text())
BEAT = 60 / TL["bpm"]
BAR = 4 * BEAT
DUR, BRK, DROP = TL["duration"], TL["filmBreak"], TL["filmDrop"]
N = int(round(DUR * SR))
SONG_DROP = 16.03
RNG = np.random.default_rng(190)
NOTE = {"Bb2": 116.54, "Bb3": 233.08, "Db4": 277.18, "Eb4": 311.13, "F4": 349.23, "Ab4": 415.30, "Bb4": 466.16,
        "Db5": 554.37, "Eb5": 622.25, "F5": 698.46, "Ab5": 830.61, "Bb5": 932.33, "D3": 146.83}
PENTA = ["Bb3", "Db4", "Eb4", "F4", "Ab4", "Bb4", "Db5", "Eb5", "F5", "Ab5", "Bb5"]


def film(scene_t):
    """Scene time -> film time (inverse of film.html's warp, same anchors)."""
    a = TL["anchors"]
    for (s0, f0), (s1, f1) in zip(a, a[1:]):
        if scene_t <= s1:
            return f0 + (f1 - f0) * (scene_t - s0) / (s1 - s0)
    return a[-1][1]


def load(path):
    raw = subprocess.run([FF, "-v", "quiet", "-i", str(path), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def stereo(mono, pan=0.0):
    """Constant-power pan, -1 = left, +1 = right."""
    a = (pan + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], 1).astype(np.float32)


def env(n, attack=0.002, decay=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / attack) * np.exp(-t / decay)


# ---------------------------------------------------------------- synthesized sounds
def plink(freq, dur=0.7, pan=0.0):
    t = np.arange(int(dur * SR)) / SR
    mono = (np.sin(2 * np.pi * freq * t + 0.8 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 18))
            + 0.25 * np.sin(2 * np.pi * freq * 3 * t)) * env(len(t), 0.002, 0.22)
    return stereo(mono, pan)


def glitch(dur=0.2, pan=0.0):
    n = int(dur * SR)
    noise = RNG.standard_normal(n)
    held = np.repeat(noise[::180], 180)[:n]                              # sample-and-hold = bit-crushed texture
    gate = (np.sin(2 * np.pi * 38 * np.arange(n) / SR) > -0.2).astype(float)
    tone = np.sign(np.sin(2 * np.pi * 1450 * np.arange(n) / SR)) * 0.3
    return stereo((held * 0.8 + tone) * gate * env(n, 0.001, dur / 3), pan)


def sub_boom(dur=1.1):
    t = np.arange(int(dur * SR)) / SR
    freq = 32 + 58 * np.exp(-t * 7)
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 3.2)
    click = RNG.standard_normal(len(t)) * np.exp(-t * 400) * 0.4
    return stereo(np.tanh(1.6 * (body + click)))


def reverse_swell(dur=1.6):
    n = int(dur * SR)
    noise = RNG.standard_normal(n)
    smooth = np.convolve(noise, np.ones(6) / 6, "same")                  # soften the top end a little
    shape = (np.arange(n) / n) ** 3.2
    mono = smooth * shape
    mono[-int(0.003 * SR):] *= np.linspace(1, 0, int(0.003 * SR))
    return np.stack([mono * 0.9, np.roll(mono, 240) * 0.9], 1).astype(np.float32)   # slight width


def riser(dur=2.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sweep = np.sin(2 * np.pi * np.cumsum(NOTE["Bb2"] * (8 ** (t / dur))) / SR)
    mono = sweep * (t / dur) ** 2.4
    mono[-int(0.003 * SR):] *= np.linspace(1, 0, int(0.003 * SR))
    return stereo(mono)


def blip(freq, dur=0.07, pan=0.0):
    t = np.arange(int(dur * SR)) / SR
    return stereo(np.sign(np.sin(2 * np.pi * freq * t)) * env(len(t), 0.001, dur / 2.5) * 0.6, pan)


def chord(freqs, dur=0.5):
    t = np.arange(int(dur * SR)) / SR
    return stereo(sum(np.sign(np.sin(2 * np.pi * f * t)) for f in freqs) / len(freqs) * env(len(t), 0.002, 0.18) * 0.6)


def arpeggio(notes, gap=0.07, pan=0.0):
    parts = [plink(NOTE[n], 0.8, pan) for n in notes]
    out = np.zeros((int(gap * SR) * (len(notes) - 1) + len(parts[0]), 2), np.float32)
    for i, p in enumerate(parts):
        o = int(i * gap * SR)
        out[o:o + len(p)] += p
    return out


def tape_stop(seg, dur=0.32):
    """Slow the last `dur` seconds of a segment to a halt (playback rate 1 -> 0)."""
    n = int(dur * SR)
    tail = seg[-n:]
    rate = np.linspace(1, 0, n) ** 1.3
    pos = np.cumsum(rate)
    pos = np.clip(pos, 0, n - 1)
    out = np.stack([np.interp(pos, np.arange(n), tail[:, c]) for c in range(2)], 1) * np.linspace(1, 0.2, n)[:, None]
    seg = seg.copy()
    seg[-n:] = out
    return seg


def lowpass_sweep(seg, f0, f1):
    """Time-varying one-pole low-pass, cutoff moves exponentially from f0 to f1 across the segment."""
    n = len(seg)
    fc = f0 * (f1 / f0) ** (np.arange(n) / n)
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    out = np.zeros_like(seg)
    acc = np.zeros(2, np.float32)
    for i in range(n):
        acc += a[i] * (seg[i] - acc)
        out[i] = acc
    return out


# ---------------------------------------------------------------- music bed
song = load(HERE / "assets/audio/track-190.mp3")
cut = lambda a, b: song[int(round(a * SR)):int(round(b * SR))].copy()
hook = tape_stop(cut(SONG_DROP + 6 * BAR, SONG_DROP + 6 * BAR + BRK))
brk = lowpass_sweep(cut(SONG_DROP - (DROP - BRK), SONG_DROP), 600, 9000) * 1.3
drop = cut(SONG_DROP, SONG_DROP + DUR - DROP + 0.05)
xf = int(0.004 * SR)
music = np.concatenate([hook, brk, drop])[:N].copy()
assert abs(len(hook) / SR - BRK) < 0.002 and abs((len(hook) + len(brk)) / SR - DROP) < 0.002, "drop must land on the red check"
for edge in (len(hook), len(hook) + len(brk)):                          # 4 ms de-click at the two cuts
    music[edge - xf:edge] *= np.linspace(1, 0, xf)[:, None]
    music[edge:edge + xf] *= np.linspace(0, 1, xf)[:, None]
music[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]

# ---------------------------------------------------------------- sound events (scene time -> film time)
MK = {name: load(HERE / f"assets/sfx/{name}.mp3") for name in
      ["click", "key", "tick", "check", "toast", "whoosh", "impact", "fail", "success"]}
SB = 60 / 128                                                   # film.html's scene clock runs on a 128-BPM grid
EVENTS = []                                                     # (film time, sound, gain, align by peak?)
for i in range(9):                                              # the AI reviewer ticks every line on 16ths
    EVENTS += [(film(SB + i * SB / 4), blip(NOTE[PENTA[i + 1]], 0.06, -.6 + i * .15), .11, False)]
EVENTS += [(film(1.5), MK["tick"], .10, True)]                                                       # approval row
EVENTS += [(film(1.64), MK["click"], .26, True), (film(1.64), chord([NOTE["Bb3"], NOTE["F4"], NOTE["Bb4"]], 0.5), .16, False),
           (film(1.64), sub_boom(0.5), .16, False)]                                                  # LGTM slam
for t_bug, g in ((2.34, 1.0), (2.81, .8)):                                                           # ticks flip to red
    EVENTS += [(film(t_bug), glitch(0.2, -.3 if g == 1 else .3), .22 * g, False), (film(t_bug) + .02, MK["fail"], .15 * g, True),
               (film(t_bug), sub_boom(0.5), .20 * g, False)]
EVENTS += [(film(2.42), MK["tick"], .07, True), (film(2.9), MK["tick"], .07, True)]                  # squiggles
EVENTS += [(BRK - .05, MK["whoosh"], .12, True)]                                                     # cut to 44 : 1
for d in range(14):                                                                                  # 44 blocks cascade in
    EVENTS += [(film(3.95 + d * .025), blip(NOTE[PENTA[min(10, d // 2 + 2)]], 0.05, -.7 + d * .1), .06, False)]
EVENTS += [(film(4.5), plink(NOTE["Bb3"], 0.9, .7), .22, False)]                                     # the single LLM-judge block
EVENTS += [(film(4.12), plink(NOTE["F5"], .5), .08, False)]                                          # caption
EVENTS += [(film(5.9), MK["whoosh"], .09, True), (film(5.95), MK["tick"], .09, True)]                # gate card
EVENTS += [(DROP - 2.6, riser(2.6), .10, False), (DROP - 1.6, reverse_swell(1.6), .16, False)]       # into the drop
EVENTS += [(DROP, sub_boom(1.2), .42, False), (DROP, MK["impact"], .20, True), (DROP + .02, MK["fail"], .20, True)]
EVENTS += [(film(9.42), MK["whoosh"], .10, True), (film(9.6), MK["tick"], .10, True), (film(11.28), plink(NOTE["F4"], .5, .3), .12, False)]
EVENTS += [(film(13.59), MK["click"], .30, True)]                                                    # Commit suggestion
EVENTS += [(film(13.9), MK["whoosh"], .08, True)] + [(film(14.1 + i * .07), MK["key"], .05, True) for i in range(3)]
EVENTS += [(film(14.53), arpeggio(["Bb4", "Db5", "F5"], 0.07, .2), .20, False)]                      # green again
EVENTS += [(film(15.08), MK["whoosh"], .08, True), (film(15.25), plink(NOTE["Db5"], .5, -.3), .12, False),
           (film(15.45), plink(NOTE["F5"], .5, .3), .12, False), (film(15.65), MK["key"], .06, True),
           (film(16.05), arpeggio(["F5", "Bb5"], 0.06, .4), .12, False)]                             # surfaces
for k, y in enumerate(range(0, 11, 2)):                                                              # pixel shield builds
    EVENTS += [(film(16.9 + y * .035), blip(NOTE[PENTA[k + 3]], 0.07, (k - 2.5) / 3), .16, False)]
EVENTS += [(film(17.34), chord([NOTE["Bb3"], NOTE["F4"], NOTE["Bb4"]], 0.6), .14, False), (film(17.34), MK["toast"], .10, True)]

sfx = np.zeros((N, 2), np.float32)
for t, snd, gain, by_peak in EVENTS:
    s = snd / (np.abs(snd).max() + 1e-9) * gain
    i0 = int(round(t * SR)) - (int(np.abs(s).sum(1).argmax()) if by_peak else 0)
    lo, hi = max(0, i0), min(N, i0 + len(s))
    if hi > lo:
        sfx[lo:hi] += s[lo - i0:hi - i0]

# side-chain: duck the music under the big hits (LGTM, red flips, drop, green)
duck = np.ones(N, np.float32)
for t, depth, length in [(film(1.64), .35, .3), (film(2.34), .35, .25), (film(2.81), .3, .25), (DROP, .45, .5), (film(14.53), .3, .35)]:
    i = int(t * SR)
    n = int(length * SR)
    seg = 1 - depth * np.exp(-np.arange(n) / (0.35 * n))
    duck[i:i + n] = np.minimum(duck[i:i + n], seg[:max(0, min(n, N - i))])
mix = music * 0.55 * duck[:, None] + sfx

fade_from = int((DUR - 0.9) * SR)
mix[fade_from:] *= (np.linspace(1, 0, N - fade_from) ** 1.4)[:, None]

out = HERE / "out"
out.mkdir(exist_ok=True)
raw_path = out / "raw.wav"
subprocess.run([FF, "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", str(raw_path)],
               input=mix.astype(np.float32).tobytes(), check=True)
measure = subprocess.run([FF, "-hide_banner", "-i", str(raw_path), "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(measure[measure.rindex("{"):measure.rindex("}") + 1])
af = (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
      f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run([FF, "-v", "error", "-y", "-i", str(raw_path), "-af", af, "-ar", str(SR), str(out / "audio.wav")], check=True)
print("audio ->", out / "audio.wav")

video = out / "video.mp4"
if video.exists():
    subprocess.run([FF, "-v", "error", "-y", "-i", str(video), "-i", str(out / "audio.wav"), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart",
                    str(HERE / "final.mp4")], check=True)
    print("final ->", HERE / "final.mp4")
