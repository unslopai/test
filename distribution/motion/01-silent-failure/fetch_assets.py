"""Download the third-party assets that are NOT committed (Mixkit license forbids redistributing the raw files).
Mixkit music + SFX (Mixkit free license), Geist Mono (SIL OFL 1.1). Run once before rendering / building audio."""
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
UA = {"User-Agent": "Mozilla/5.0"}
MUSIC = {"track-190": 190}   # Mixkit #190, Mixkit Stock Music Free License
SFX = {"click": 1125, "key": 2568, "tick": 1117, "check": 1113, "toast": 2573, "whoosh": 1490, "rise": 1489, "impact": 1143, "fail": 2569, "success": 2865}


def get(url, dest):
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read())
    print("ok", dest.relative_to(HERE))


for name, mid in MUSIC.items():
    get(f"https://assets.mixkit.co/music/{mid}/{mid}.mp3", HERE / f"assets/audio/{name}.mp3")
for name, sid in SFX.items():
    get(f"https://assets.mixkit.co/active_storage/sfx/{sid}/{sid}-preview.mp3", HERE / f"assets/sfx/{name}.mp3")
get("https://cdn.jsdelivr.net/npm/@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2", HERE / "assets/fonts/geist-mono-400.woff2")
get("https://cdn.jsdelivr.net/npm/@fontsource/geist-mono/files/geist-mono-latin-500-normal.woff2", HERE / "assets/fonts/geist-mono-500.woff2")
print("done")
