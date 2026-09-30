"""Measure every asset in a folder for the per-channel spec check (CHECK.md).

Usage:  python specs.py <dir> [--max-mb 50]
MP4: resolution, SAR, fps, duration, video/audio codec, total bitrate, size (ffmpeg stream info).
PNG/JPG/GIF: pixel size and file size. Prints a Markdown table; exits 1 if a video is over --max-mb.
"""
import re
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
from PIL import Image

FF = imageio_ffmpeg.get_ffmpeg_exe()


def probe_video(path: Path) -> str:
    info = subprocess.run([FF, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    duration = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info)
    seconds = int(duration[1]) * 3600 + int(duration[2]) * 60 + float(duration[3]) if duration else 0.0
    bitrate = re.search(r"bitrate: (\d+) kb/s", info)
    video = re.search(r"Video: (\w+) \((\w+)\).*?, (\d{2,5})x(\d{2,5}).*?, ([\d.]+) fps", info)
    audio = re.search(r"Audio: (\w+) \(?(\w*)", info)
    vcodec = f"{video[1]} {video[2]}" if video else "?"
    size = f"{video[3]}×{video[4]}" if video else "?"
    fps = video[5] if video else "?"
    acodec = f"{audio[1]} {audio[2]}".strip() if audio else "none"
    return f"{size} | {fps} fps | {seconds:.1f} s | {vcodec} / {acodec} | {bitrate[1] if bitrate else '?'} kb/s"


def main(folder: str, max_mb: float) -> int:
    over = 0
    print("| Datei | Maße / fps / Dauer / Codecs / Bitrate | Größe |")
    print("|---|---|---|")
    for path in sorted(Path(folder).rglob("*")):
        if "plates" in path.parts or not path.is_file():
            continue
        mb = path.stat().st_size / 1024 / 1024
        if path.suffix == ".mp4":
            over += mb > max_mb
            print(f"| `{path.name}` | {probe_video(path)} | {mb:.1f} MB{' **> limit**' if mb > max_mb else ''} |")
        elif path.suffix in (".png", ".jpg", ".gif"):
            with Image.open(path) as img:
                print(f"| `{path.name}` | {img.width}×{img.height} | {path.stat().st_size / 1024:.0f} KB |")
    return 1 if over else 0


if __name__ == "__main__":
    limit = float(sys.argv[sys.argv.index("--max-mb") + 1]) if "--max-mb" in sys.argv else 50.0
    sys.exit(main(sys.argv[1], limit))
