"""Render film.html frame by frame (claude-motion-design pipeline, see .claude/skills/motion-design/SKILL.md).

  python render.py probe 0.9 2.9 4.9 7.7 10.6 12.2 14.8 18.8   -> probe/sheet.png (+ probe/p_XX.png full size)
  python render.py full [--jobs 4] [--sub 6]                    -> sub/ subframes, then out/video.mp4 (motion blur via tmix)
  python render.py encode                                       -> out/video.mp4 from existing sub/ frames
  python render.py pops [file]                                  -> single-frame pop scan
  python render.py qa [file]                                    -> out/qa/ contact sheets (overview, phone width, dense strips)
  python render.py poster <t>                                   -> poster.png (one sharp frame)

Env: LANG_FILM=de renders the German copy (film.html?lang=de).
The script serves this folder itself on a free port, no separate http.server needed.
"""
import asyncio
import functools
import json
import http.server
import os
import shutil
import socketserver
import subprocess
import sys
import threading
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from playwright.async_api import async_playwright

HERE = Path(__file__).parent
FF = imageio_ffmpeg.get_ffmpeg_exe()
FPS = 60
DUR = json.loads((HERE / "timeline.json").read_text())["duration"]   # film length from timeline.json
W, H = 1080, 1920
LANG = os.environ.get("LANG_FILM", "en")
# Explicit Chromium: CHROME_PATH, else the preinstalled /opt/pw-browsers/chromium if present, else Playwright's managed one.
CHROME = os.environ.get("CHROME_PATH") or ("/opt/pw-browsers/chromium" if Path("/opt/pw-browsers/chromium").exists() else None)


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=str(HERE))
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{httpd.server_address[1]}/film.html" + ("?lang=de" if LANG == "de" else "")


async def open_page(p, url):
    kw = {"executable_path": CHROME} if CHROME else {}
    b = await p.chromium.launch(**kw)
    pg = await b.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console: " + m.text) if m.type in ("error", "warning") else None)
    await pg.goto(url)
    await pg.wait_for_function("window.ready === true", timeout=120000)
    return b, pg, errs


async def shot(pg, t, path, fmt="png"):
    await pg.evaluate(f"window.seek({t})")
    await pg.screenshot(path=str(path), type=fmt, **({"quality": 94} if fmt == "jpeg" else {}))


def sheet(pattern, n, out, cols=4, size=360):
    rows = -(-n // cols)
    subprocess.run([FF, "-v", "error", "-y", "-i", str(pattern), "-vf",
                    f"scale={size}:-1,tile={cols}x{rows}:padding=6:color=white", "-frames:v", "1", str(out)], check=True)


async def probe(times):
    out = HERE / "probe"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir()
    url = serve()
    async with async_playwright() as p:
        b, pg, errs = await open_page(p, url)
        for i, t in enumerate(times):
            await shot(pg, t, out / f"p_{i:02d}.png")
        await b.close()
    if errs:
        print("PAGE ERRORS:", errs[:8])
    sheet(out / "p_%02d.png", len(times), out / "sheet.png", cols=min(4, len(times)))
    print("probe:", len(times), "->", out / "sheet.png")


async def render_chunk(url, sub_dir, frames, sub):
    offs = [(j - (sub - 1) / 2) / (FPS * sub) for j in range(sub)]
    async with async_playwright() as p:
        b, pg, errs = await open_page(p, url)
        for i in frames:
            for j, o in enumerate(offs):
                t = min(DUR - 1e-3, max(0.0, i / FPS + o))
                await shot(pg, t, sub_dir / f"s_{i * sub + j:06d}.jpg", "jpeg")
            if i % 120 == 0:
                print(f"frame {i}", flush=True)
        await b.close()
    return errs


async def full(jobs, sub):
    sub_dir = HERE / "sub"
    shutil.rmtree(sub_dir, ignore_errors=True)
    sub_dir.mkdir()
    (HERE / "sub" / "SUB").write_text(str(sub))
    n = int(round(DUR * FPS))
    url = serve()
    chunks = [list(range(k, n, jobs)) for k in range(jobs)]
    results = await asyncio.gather(*(render_chunk(url, sub_dir, c, sub) for c in chunks))
    errs = [e for r in results for e in r]
    if errs:
        print("PAGE ERRORS:", errs[:8])
    encode()


def encode():
    sub = int((HERE / "sub" / "SUB").read_text())
    (HERE / "out").mkdir(exist_ok=True)
    vf = (f"tmix=frames={sub},select='eq(mod(n\\,{sub})\\,{sub - 1})',setpts=N/{FPS}/TB,"
          "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p")
    subprocess.run([FF, "-v", "error", "-y", "-framerate", str(FPS * sub), "-i", str(HERE / "sub/s_%06d.jpg"),
                    "-vf", vf, "-r", str(FPS), "-c:v", "libx264", "-crf", "15", "-preset", "slow", "-profile:v", "high",
                    "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                    str(HERE / "out/video.mp4")], check=True)
    print("video ->", HERE / "out/video.mp4")


def pops(path=None):
    path = path or HERE / "out/video.mp4"
    raw = subprocess.run([FF, "-v", "quiet", "-i", str(path), "-vf", "scale=180:320,format=gray", "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, 320, 180).astype(np.float32)
    d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
    hits = []
    for i in range(1, len(d) - 1):
        nb = max(d[i - 1], d[i + 1], 0.3)
        if d[i] > 3 * nb and d[i] > 2.0:
            hits.append((i + 1, round((i + 1) / FPS, 3), round(float(d[i]), 2), round(float(nb), 2)))
    print("pops:", len(hits))
    for h in hits:
        print("  frame", h[0], "t", h[1], "diff", h[2], "neighbours", h[3])


def qa(path=None):
    path = str(path or HERE / "out/video.mp4")
    q = HERE / "out/qa"
    q.mkdir(parents=True, exist_ok=True)
    run = lambda *a: subprocess.run([FF, "-v", "error", "-y", *a], check=True)
    run("-i", path, "-vf", "fps=2,scale=216:-1,tile=10x6:padding=4", "-frames:v", "1", str(q / "contact.png"))
    run("-i", path, "-vf", "fps=1,scale=360:-1,tile=6x5:padding=4", "-frames:v", "1", str(q / "phone.png"))
    for t in [0.0, 1.6, 2.7, 7.3, 11.0, 13.7, 14.7, 16.5, 18.8, 20.3, 22.0]:
        run("-ss", f"{max(0, t):.2f}", "-i", path, "-vf", "fps=30,scale=200:-1,tile=12x1:padding=3", "-frames:v", "1",
            str(q / f"strip_{t:05.2f}.png"))
    print("qa ->", q)


async def poster(t):
    url = serve()
    async with async_playwright() as p:
        b, pg, _ = await open_page(p, url)
        await shot(pg, t, HERE / "poster.png")
        await b.close()
    print("poster ->", HERE / "poster.png")


if __name__ == "__main__":
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == "probe":
        asyncio.run(probe([float(x) for x in args]))
    elif cmd == "full":
        jobs = int(args[args.index("--jobs") + 1]) if "--jobs" in args else 4
        sub = int(args[args.index("--sub") + 1]) if "--sub" in args else 6
        asyncio.run(full(jobs, sub))
    elif cmd == "encode":
        encode()
    elif cmd == "pops":
        pops(args[0] if args else None)
    elif cmd == "qa":
        qa(args[0] if args else None)
    elif cmd == "poster":
        asyncio.run(poster(float(args[0])))
