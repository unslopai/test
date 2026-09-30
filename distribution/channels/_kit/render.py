"""Render every <section class="frame" data-out="…" data-w="…" data-h="…"> of an HTML file to a PNG.

Usage:  python render.py <page.html> <out_dir> [--only name1,name2]
The page is served over a local HTTP server rooted at distribution/channels/ so it can reference
_kit/kit.css and _kit/assets/ with relative paths. Chromium: CHROME_PATH or /opt/pw-browsers/chromium.
Then:   python render.py check <out_dir>   prints size (px, KB) of every PNG for the spec check.
"""
import functools
import http.server
import os
import socketserver
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # distribution/channels


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args) -> None:  # keep render output readable
        pass


def serve() -> int:
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd.server_address[1]


def chrome_path() -> str | None:
    for candidate in (os.environ.get("CHROME_PATH"), "/opt/pw-browsers/chromium"):
        if candidate and Path(candidate).exists():
            return candidate
    return None


def find_chrome_binary(base: str | None) -> str | None:
    if base is None:
        return None
    base_path = Path(base)
    if base_path.is_file():
        return str(base_path)
    hits = sorted(base_path.rglob("chrome")) + sorted(Path("/opt/pw-browsers").glob("chromium-*/chrome-linux/chrome"))
    return str(hits[0]) if hits else None


def render(page: str, out_dir: str, only: set[str]) -> None:
    from playwright.sync_api import sync_playwright

    port = serve()
    rel = Path(page).resolve().relative_to(ROOT)
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=find_chrome_binary(chrome_path()))
        tab = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
        tab.goto(f"http://127.0.0.1:{port}/{rel.as_posix()}")
        tab.evaluate("document.fonts.ready")
        tab.wait_for_function("window.ready !== false")  # pages that load data set window.ready = false first
        tab.wait_for_timeout(400)
        frames = tab.query_selector_all("section.frame")
        for frame in frames:
            name = frame.get_attribute("data-out")
            if only and name not in only:
                continue
            target = Path(out_dir) / f"{name}.png"
            frame.screenshot(path=str(target))
            print("wrote", target)
        browser.close()


def check(out_dir: str) -> None:
    from PIL import Image

    for png in sorted(Path(out_dir).glob("*.png")):
        with Image.open(png) as img:
            print(f"{png.name:44s} {img.width}x{img.height}  {png.stat().st_size / 1024:7.1f} KB")


if __name__ == "__main__":
    if sys.argv[1] == "check":
        check(sys.argv[2])
    else:
        only_names = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else set()
        render(sys.argv[1], sys.argv[2], only_names)
