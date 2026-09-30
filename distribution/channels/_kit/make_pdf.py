"""Combine rendered PNG pages into one PDF (LinkedIn document post, Product Hunt/press kit).

Usage:  python make_pdf.py <out.pdf> <page1.png> <page2.png> ...
Pages keep their pixel size (1 px = 1 pt at 72 dpi), RGB, no recompression artefacts beyond JPEG q95.
"""
import sys
from PIL import Image

pages = [Image.open(path).convert("RGB") for path in sys.argv[2:]]
pages[0].save(sys.argv[1], save_all=True, append_images=pages[1:], resolution=72.0, quality=95)
print(f"{sys.argv[1]}: {len(pages)} pages")
