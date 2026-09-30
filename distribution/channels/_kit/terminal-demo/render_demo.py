"""Render demo.html frame by frame to MP4 (1600×900, 30 fps) and GIF (960 px, 12 fps).

Usage (from this folder):  python render_demo.py <out_basename> [--beta]
Writes <out_basename>.mp4 and <out_basename>.gif; frames go to ./frames (git-ignored, deleted afterwards).
Chromium: CHROME_PATH or /opt/pw-browsers/chromium.
"""
import functools
import http.server
import os
import shutil
import socketserver
import subprocess
import sys
import threading
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
FPS = 30
FF = imageio_ffmpeg.get_ffmpeg_exe()


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args) -> None:
        pass


def serve() -> int:
    handler = functools.partial(QuietHandler, directory=str(HERE.parent))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd.server_address[1]


def chrome() -> str:
    base = Path(os.environ.get("CHROME_PATH", "/opt/pw-browsers/chromium"))
    if base.is_file():
        return str(base)
    return str(sorted(Path("/opt/pw-browsers").glob("chromium-*/chrome-linux/chrome"))[0])


def main(out_base: str, beta: bool) -> None:
    frames = HERE / "frames"
    shutil.rmtree(frames, ignore_errors=True)
    frames.mkdir()
    port = serve()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=chrome())
        page = browser.new_page(viewport={"width": 1600, "height": 900})
        page.goto(f"http://127.0.0.1:{port}/terminal-demo/demo.html" + ("?beta=1" if beta else ""))
        page.wait_for_function("window.demoReady === true")
        duration = page.evaluate("window.DURATION")
        stage = page.query_selector("#stage")
        for index in range(int(duration * FPS)):
            page.evaluate(f"window.seek({index / FPS})")
            stage.screenshot(path=str(frames / f"f_{index:05d}.png"))
        browser.close()
    color = ["-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]
    subprocess.run([FF, "-v", "error", "-y", "-framerate", str(FPS), "-i", str(frames / "f_%05d.png"),
                    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-shortest",
                    "-vf", "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p",
                    "-c:v", "libx264", "-profile:v", "high", "-crf", "16", "-preset", "slow", *color,
                    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", f"{out_base}.mp4"], check=True)
    subprocess.run([FF, "-v", "error", "-y", "-framerate", str(FPS), "-i", str(frames / "f_%05d.png"),
                    "-vf", "fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
                    f"{out_base}.gif"], check=True)
    shutil.rmtree(frames)
    print("wrote", f"{out_base}.mp4", f"{out_base}.gif")


if __name__ == "__main__":
    main(sys.argv[1], "--beta" in sys.argv)
