"""Count every ```post block in a channel Markdown file against the platform limit.

Usage:  python count.py <file.md> <platform>     platform: x | linkedin | reddit-title | plain
Each ```post block is labelled with the nearest preceding Markdown heading.
X: weighted count per docs.x.com/fundamentals/counting-characters and the twitter-text v3 ranges
   (URLs = 23; code points 0-4351, 8192-8205, 8208-8223, 8242-8247 = 1; everything else incl. emoji,
   arrows and the ellipsis = 2; newlines count as 1). A block may contain several posts of a thread,
   separated by a line that is exactly '---'; each part is counted on its own.
LinkedIn post: 3,000 characters; first ~210 characters show before "see more" (RESEARCH.md of 02-linkedin).
"""
import re
import sys

URL = re.compile(r"https?://\S+|\b[a-z0-9-]+\.(?:codes|com|org|dev|io)(?:/\S*)?", re.I)
LIMITS = {"x": 280, "linkedin": 3000, "reddit-title": 300, "plain": 10**9}


def x_weight(text: str) -> int:
    total = 0
    for url in URL.findall(text):
        total += 23
        text = text.replace(url, "", 1)
    for ch in text:
        code = ord(ch)
        if code in (0xFE0F, 0x200D):  # emoji variation selector / joiner: part of the previous glyph
            continue
        # twitter-text v3 config: weight 100 (= 1 char) only in these ranges, 200 (= 2) everywhere else
        light = code <= 4351 or 8192 <= code <= 8205 or 8208 <= code <= 8223 or 8242 <= code <= 8247
        total += 1 if light else 2
    return total


def blocks(md: str):
    heading = "(no heading)"
    inside, buf = False, []
    for line in md.splitlines():
        if not inside and line.startswith("#"):
            heading = line.lstrip("#").strip()
        if line.strip() == "```post":
            inside, buf = True, []
            continue
        if inside and line.strip() == "```":
            inside = False
            yield heading, "\n".join(buf)
            continue
        if inside:
            buf.append(line)


def main(path: str, platform: str) -> int:
    limit = LIMITS[platform]
    failures = 0
    for heading, body in blocks(open(path, encoding="utf-8").read()):
        parts = body.split("\n---\n") if platform == "x" else [body]
        for index, part in enumerate(parts, 1):
            count = x_weight(part.strip()) if platform == "x" else len(part.strip())
            flag = "OK " if count <= limit else "OVER"
            failures += count > limit
            label = f"{heading} [{index}/{len(parts)}]" if len(parts) > 1 else heading
            print(f"{flag} {count:5d}/{limit}  {label}")
    return failures


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
