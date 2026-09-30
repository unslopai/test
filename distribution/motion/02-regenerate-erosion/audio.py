"""Soundtrack for 02-regenerate-erosion (v2: new music + designed sound), then mux into final.mp4.

Music: Mixkit "Waka Floka Type" (Arulo, #364, trap, 130 BPM, Mixkit Stock Music Free License). Measured: quiet intro
until the drop at song 14.77 s (bass +37 dB), loud section to ~44 s. Film layout (film time, 130-BPM grid):
  0 - 5.54 s    hook       song 25.85-31.38 (loud section, 6 bars after the drop), ends in a tape stop
  5.54 - 12.92  break      song 7.38-14.77 (the quiet 4 bars before the drop), low-pass opening up, riser + reverse swell
  12.92 -       drop       song 14.77 onward, lands on the failing check run
Sound design: Mixkit SFX placed by peak plus synthesized sounds (seeded, deterministic), tuned to D minor like the track:
glitch bursts on every regenerate, pitched plinks for the chart bars (panned left to right), sub boom on the drop,
success arpeggio, 8-bit blips while the pixel shield builds. Music is side-chained under the big hits.
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
SONG_DROP = 14.77
SCENE_TO_FILM = TL["anchors"][-1][1] / TL["anchors"][-1][0]     # film.html's scene grid is 128 BPM
RNG = np.random.default_rng(364)
NOTE = {"D4": 293.66, "F4": 349.23, "G4": 392.0, "A4": 440.0, "C5": 523.25, "D5": 587.33, "F5": 698.46, "A5": 880.0,
        "D3": 146.83, "A3": 220.0}


def film(scene_t):
    return scene_t * SCENE_TO_FILM


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
    sweep = np.sin(2 * np.pi * np.cumsum(NOTE["D3"] * (8 ** (t / dur))) / SR)
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
song = load(HERE / "assets/audio/waka-floka-type.mp3")
cut = lambda a, b: song[int(round(a * SR)):int(round(b * SR))].copy()
hook = tape_stop(cut(SONG_DROP + 6 * BAR, SONG_DROP + 6 * BAR + BRK))
brk = lowpass_sweep(cut(SONG_DROP - (DROP - BRK), SONG_DROP), 600, 9000) * 1.25
drop = cut(SONG_DROP, SONG_DROP + DUR - DROP + 0.05)
xf = int(0.004 * SR)
music = np.concatenate([hook, brk, drop])[:N].copy()
assert abs(len(hook) / SR - BRK) < 0.002 and abs((len(hook) + len(brk)) / SR - DROP) < 0.002, "drop must land on the red check"
for edge in (len(hook), len(hook) + len(brk)):                          # 4 ms de-click at the two cuts
    music[edge - xf:edge] *= np.linspace(1, 0, xf)[:, None]
    music[edge:edge + xf] *= np.linspace(0, 1, xf)[:, None]
music[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]

# ---------------------------------------------------------------- sound events (film time)
MK = {name: load(HERE / f"assets/sfx/{name}.mp3") for name in
      ["click", "key", "tick", "check", "toast", "whoosh", "impact", "fail", "success"]}
clicks = [film(t) for t in (60 / 128, 2 * 60 / 128, 3 * 60 / 128)]
EVENTS = []                                                         # (time, sound array, gain, peak-align?)
for i, c in enumerate(clicks):                                      # three regenerates
    EVENTS += [(c, MK["click"], .30, True), (c + .01, glitch(0.2, [-.4, .4, 0][i]), .22, False)]
EVENTS += [(clicks[2] + .02, MK["fail"], .16, True), (clicks[2] + .02, sub_boom(0.6), .22, False)]   # the injection lands
EVENTS += [(film(3 * 60 / 128 + .3), MK["tick"], .10, True)]                                          # red squiggle
EVENTS += [(BRK - .05, MK["whoosh"], .12, True)]                                                     # cut to the chart
for i, (note, pan) in enumerate([("D4", -.6), ("F4", 0), ("A4", .6)]):                               # three bars, rising
    EVENTS += [(film(5.95 + i * .47), plink(NOTE[note], 0.8, pan), .19, False)]
EVENTS += [(film(7.6), plink(NOTE["D5"], 0.6), .12, False)]                                          # caption
EVENTS += [(film(10.35), MK["whoosh"], .09, True), (film(10.55), MK["tick"], .09, True), (film(10.72), MK["tick"], .09, True)]
EVENTS += [(film(11.25), arpeggio(["A4", "D5"], 0.06, -.2), .14, False)]                             # first commit green
EVENTS += [(DROP - 2.6, riser(2.6), .10, False), (DROP - 1.6, reverse_swell(1.6), .16, False)]       # into the drop
EVENTS += [(DROP, sub_boom(1.2), .42, False), (DROP, MK["impact"], .20, True), (DROP + .02, MK["fail"], .20, True)]
EVENTS += [(film(15.85), MK["whoosh"], .10, True), (film(16.05), MK["tick"], .10, True), (film(17.7), plink(NOTE["A4"], .5, .3), .12, False)]
EVENTS += [(film(43 * 60 / 128), MK["click"], .30, True)]                                            # Commit suggestion
EVENTS += [(film(20.3), MK["whoosh"], .08, True), (film(20.55), MK["tick"], .09, True)]
EVENTS += [(film(21.5625), arpeggio(["D5", "F5", "A5"], 0.07, .2), .20, False)]                     # green again
END = film(13 * 4 * 60 / 128)
PENTA = ["D4", "F4", "G4", "A4", "C5", "D5"]
for k, y in enumerate(range(0, 11, 2)):                                                               # pixel shield builds
    EVENTS += [(END + film(y * .035), blip(NOTE[PENTA[k]], 0.07, (k - 2.5) / 3), .16, False)]
EVENTS += [(END + film(.47), chord([NOTE["D4"], NOTE["A4"], NOTE["D5"]], 0.6), .14, False), (END + film(.47), MK["toast"], .10, True)]

sfx = np.zeros((N, 2), np.float32)
for t, snd, gain, by_peak in EVENTS:
    s = snd / (np.abs(snd).max() + 1e-9) * gain
    i0 = int(round(t * SR)) - (int(np.abs(s).sum(1).argmax()) if by_peak else 0)
    lo, hi = max(0, i0), min(N, i0 + len(s))
    if hi > lo:
        sfx[lo:hi] += s[lo - i0:hi - i0]

# side-chain: duck the music under the big hits (clicks, injection, drop, green)
duck = np.ones(N, np.float32)
for t, depth, length in [(c, .35, .22) for c in clicks] + [(DROP, .45, .5), (film(21.5625), .3, .35)]:
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
