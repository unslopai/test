"""Soundtrack for 03-terminal-to-pr, then mux into final.mp4.

Music: Mixkit "Young Trizzy" (#416, trap, 130 BPM, Mixkit Stock Music Free License), same style as film 02 but a
different track. Measured: intro practically without bass (-63 dB), drop at song 14.77 s (+43 dB bass), key ~B minor.
Film layout (film time, 130-BPM grid):
  0 - 3.69 s    hook    song 22.15-25.85 (loud), ends in a tape stop when "unslop scan" is entered
  3.69 - 7.38   scan    song 11.08-14.77 (the quiet 2 bars before the drop), low-pass opening up, riser + reverse swell
  7.38 -        drop    song 14.77 onward, lands on the CRITICAL finding printing in the terminal
Sound design (seeded, deterministic, tuned to B minor): typing and backspace clicks, Enter thump, scan ticks on the
beat, sub boom + glitch on the finding, editor clicks, fix/clean arpeggios, rising blips for the CTA command, final chord.
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
RNG = np.random.default_rng(416)
NOTE = {"B2": 123.47, "B3": 246.94, "D4": 293.66, "E4": 329.63, "F#4": 369.99, "A4": 440.0, "B4": 493.88,
        "D5": 587.33, "E5": 659.26, "F#5": 739.99, "A5": 880.0, "B5": 987.77}
PENTA = ["B3", "D4", "E4", "F#4", "A4", "B4", "D5", "E5", "F#5", "A5", "B5"]


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
    sweep = np.sin(2 * np.pi * np.cumsum(NOTE["B2"] * (8 ** (t / dur))) / SR)
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
song = load(HERE / "assets/audio/young-trizzy.mp3")
cut = lambda a, b: song[int(round(a * SR)):int(round(b * SR))].copy()
hook = tape_stop(cut(SONG_DROP + 4 * BAR, SONG_DROP + 4 * BAR + BRK), 0.28)
brk = lowpass_sweep(cut(SONG_DROP - (DROP - BRK), SONG_DROP), 700, 9000) * 0.85
drop = cut(SONG_DROP, SONG_DROP + DUR - DROP + 0.05)
xf = int(0.004 * SR)
music = np.concatenate([hook, brk, drop])[:N].copy()
assert abs(len(hook) / SR - BRK) < 0.002 and abs((len(hook) + len(brk)) / SR - DROP) < 0.002, "drop must land on the finding"
for edge in (len(hook), len(hook) + len(brk)):                          # 4 ms de-click at the two cuts
    music[edge - xf:edge] *= np.linspace(1, 0, xf)[:, None]
    music[edge:edge + xf] *= np.linspace(0, 1, xf)[:, None]
music[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]

# ---------------------------------------------------------------- sound events (film time, mirrors film.html)
MK = {name: load(HERE / f"assets/sfx/{name}.mp3") for name in
      ["click", "key", "tick", "check", "toast", "whoosh", "impact", "fail", "success"]}
EVENTS = []                                                     # (film time, sound, gain, align by peak?)
EVENTS += [(0.12 + i * .07, MK["key"], .06, True) for i in range(8)]                                 # "git push"
EVENTS += [(3 * BEAT + i * .045, blip(NOTE["B3"] * (1 - i * .03), 0.04, -.2), .05, False) for i in range(8)]   # backspace
EVENTS += [(1.85 + i * .06, MK["key"], .06, True) for i in range(11)]                                # "unslop scan"
ENTER = 6 * BEAT
EVENTS += [(ENTER, MK["click"], .30, True), (ENTER, sub_boom(0.45), .18, False)]                     # Enter
EVENTS += [(ENTER + .05, blip(NOTE["B4"], 0.06), .08, False)]                                        # "Scanning..."
EVENTS += [(BRK + k * BEAT, blip(NOTE["B5"] if k % 2 else NOTE["F#5"], 0.04, -.4 if k % 2 else .4), .045, False) for k in range(8)]
EVENTS += [(DROP - 2.4, riser(2.4), .10, False), (DROP - 1.4, reverse_swell(1.4), .15, False)]       # into the drop
EVENTS += [(DROP, sub_boom(1.2), .32, False), (DROP, MK["impact"], .15, True), (DROP + .02, MK["fail"], .18, True),
           (DROP, glitch(0.22), .16, False)]                                                        # CRITICAL prints
EVENTS += [(DROP + i * .055, MK["key"], .035, True) for i in range(1, 11)]                           # output lines
EDIT = 6 * BAR
EVENTS += [(EDIT, MK["whoosh"], .10, True), (EDIT + .45, MK["tick"], .08, True), (EDIT + .8, MK["tick"], .07, True),
           (12.3, plink(NOTE["A4"], .5, -.3), .14, False), (12.6, MK["tick"], .08, True)]            # editor, hover, bulb, menu
FIX, RESCAN, CLEAN = 30 * BEAT, 32 * BEAT, 34 * BEAT
EVENTS += [(FIX, MK["click"], .30, True), (FIX + .05, arpeggio(["B4", "D5", "F#5"], 0.06, .2), .18, False)]
EVENTS += [(RESCAN, MK["click"], .22, True), (RESCAN + .1, blip(NOTE["F#5"], .05), .06, False)]
EVENTS += [(CLEAN, arpeggio(["D5", "F#5", "B5"], 0.06, .3), .16, False)]
PR = 9 * BAR
EVENTS += [(PR, MK["whoosh"], .09, True)] + [(PR + .12 + i * .07, MK["key"], .06, True) for i in range(8)]
EVENTS += [(38 * BEAT, MK["click"], .26, True), (17.6, MK["tick"], .08, True)]                      # push, check card
OK = 41 * BEAT
EVENTS += [(OK, arpeggio(["B4", "D5", "F#5", "B5"], 0.07, -.2), .20, False), (OK, MK["success"], .08, True)]
CTAT = 11 * BAR
EVENTS += [(CTAT, MK["whoosh"], .10, True)]
CMD1 = "npm i -g @unslopcodes/cli"
for i, ch in enumerate(CMD1):                                                                        # typed, rising blips
    if ch != " ":
        EVENTS += [(CTAT + .25 + i * .05, blip(NOTE[PENTA[min(10, i * 11 // len(CMD1))]], 0.04, -.5 + i / len(CMD1)), .05, False),
                   (CTAT + .25 + i * .05, MK["key"], .03, True)]
E1 = 48 * BEAT
EVENTS += [(E1, MK["click"], .28, True), (E1, chord([NOTE["B3"], NOTE["F#4"], NOTE["B4"]], 0.6), .16, False), (E1, sub_boom(.5), .14, False)]
EVENTS += [(E1 + .2 + i * .06, MK["key"], .05, True) for i in range(11)]                             # "unslop scan"
EVENTS += [(23.1 + y * .03, blip(NOTE[PENTA[k + 4]], 0.07, (k - 2.5) / 3), .13, False) for k, y in enumerate(range(0, 11, 2))]
EVENTS += [(23.4, chord([NOTE["B3"], NOTE["F#4"], NOTE["B4"], NOTE["D5"]], 0.8), .16, False), (23.4, MK["toast"], .10, True)]

sfx = np.zeros((N, 2), np.float32)
for t, snd, gain, by_peak in EVENTS:
    s = snd / (np.abs(snd).max() + 1e-9) * gain
    i0 = int(round(t * SR)) - (int(np.abs(s).sum(1).argmax()) if by_peak else 0)
    lo, hi = max(0, i0), min(N, i0 + len(s))
    if hi > lo:
        sfx[lo:hi] += s[lo - i0:hi - i0]

# side-chain: duck the music under the big hits
duck = np.ones(N, np.float32)
for t, depth, length in [(ENTER, .35, .3), (DROP, .45, .5), (FIX, .3, .3), (OK, .3, .35), (E1, .35, .4)]:
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
def true_peak(path):
    r = subprocess.run([FF, "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(r[r.rindex("Summary"):].split("Peak:")[1].split()[0])


if true_peak(out / "audio.wav") > -1.0:                                   # linear mode could not hold -1 dBTP: dynamic mode can
    subprocess.run([FF, "-v", "error", "-y", "-i", str(raw_path), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR),
                    str(out / "audio.wav")], check=True)
print("audio ->", out / "audio.wav", "| true peak", true_peak(out / "audio.wav"), "dBTP")

video = out / "video.mp4"
if video.exists():
    subprocess.run([FF, "-v", "error", "-y", "-i", str(video), "-i", str(out / "audio.wav"), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart",
                    str(HERE / "final.mp4")], check=True)
    print("final ->", HERE / "final.mp4")
