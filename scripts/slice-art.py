"""Slice Castle Quest ChatGPT sheets into transparent PNGs."""
from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = Path(
    r"C:\Users\david\.cursor\projects\c-Users-david-icecastles\assets"
)
OUT = ROOT / "public" / "assets" / "art"
SOURCE = ROOT / "docs" / "art-source"

SHEETS = {
    "brand.jpg": "c__Users_david_AppData_Roaming_Cursor_User_workspaceStorage_609372c16fdf5094308243d0edd62273_images_ChatGPT_Image_Sep_29__2026__11_07_51_AM-8-6faf481a-55dd-46bd-abdf-f21151f70a28.jpg",
    "badges.jpg": "c__Users_david_AppData_Roaming_Cursor_User_workspaceStorage_609372c16fdf5094308243d0edd62273_images_ChatGPT_Image_Sep_29__2026__11_07_47_AM-4-22596c91-48f7-4882-9534-3549cf3e94e3.jpg",
    "cascade-tiles.jpg": "c__Users_david_AppData_Roaming_Cursor_User_workspaceStorage_609372c16fdf5094308243d0edd62273_images_ChatGPT_Image_Sep_29__2026__11_07_48_AM-5-acbebde7-0731-4db0-b5bd-50056edf225d.jpg",
    "realms.jpg": "c__Users_david_AppData_Roaming_Cursor_User_workspaceStorage_609372c16fdf5094308243d0edd62273_images_ChatGPT_Image_Sep_29__2026__11_07_44_AM-1-bdf0293d-24bb-4205-8a7b-b64aa3151564.jpg",
    "portraits.jpg": "c__Users_david_AppData_Roaming_Cursor_User_workspaceStorage_609372c16fdf5094308243d0edd62273_images_ChatGPT_Image_Sep_29__2026__11_07_53_AM-9-b1ff3d49-d8e7-4b95-822c-ebfeaeda0b25.jpg",
    "shrines.jpg": "c__Users_david_AppData_Roaming_Cursor_User_workspaceStorage_609372c16fdf5094308243d0edd62273_images_ChatGPT_Image_Sep_29__2026__11_07_55_AM-10-079479e4-9cba-4036-a51f-ca3f3cad53e8.jpg",
    "lanterns.jpg": "c__Users_david_AppData_Roaming_Cursor_User_workspaceStorage_609372c16fdf5094308243d0edd62273_images_ChatGPT_Image_Sep_29__2026__11_07_49_AM-6-be0464d6-8de4-4d77-9b9b-02a597ac27c7.jpg",
    "chrome.jpg": "c__Users_david_AppData_Roaming_Cursor_User_workspaceStorage_609372c16fdf5094308243d0edd62273_images_ChatGPT_Image_Sep_29__2026__11_07_46_AM-3-58f68bc5-3a32-49c6-9181-b2bbb7ac8424.jpg",
    "landing-chrome.jpg": "c__Users_david_AppData_Roaming_Cursor_User_workspaceStorage_609372c16fdf5094308243d0edd62273_images_ChatGPT_Image_Sep_29__2026__11_07_45_AM-2-c0989fef-8661-4b24-b513-52bcf3c6772f.jpg",
    "ice-gate.jpg": "c__Users_david_AppData_Roaming_Cursor_User_workspaceStorage_609372c16fdf5094308243d0edd62273_images_ChatGPT_Image_Sep_29__2026__11_07_50_AM-7-77d5ae84-1ad4-460b-a971-509e277509ec.jpg",
}

NAMES = {
    "brand": ["wordmark-winter-keeper", "seal-winter-keeper", "icon-app"],
    "badges": [
        "realm-water",
        "realm-earth",
        "realm-fire",
        "realm-air",
        "realm-spirit",
        "pin-water-complete",
        "pin-park",
        "icon-check",
    ],
    "cascade-tiles": [
        "cascade-ice-vein",
        "cascade-lantern-glow",
        "cascade-ice-arch",
        "cascade-silk-wing",
        "cascade-ice-ripple",
        "cascade-rune-cut",
    ],
    "realms": [
        "realm-water-on",
        "realm-earth-on",
        "realm-fire-on",
        "realm-air-on",
        "realm-spirit-on",
        "realm-water-off",
        "realm-earth-off",
        "realm-fire-off",
        "realm-air-off",
        "realm-spirit-off",
    ],
    "portraits": [
        "guardian-cascade",
        "guardian-granite",
        "guardian-ember",
        "guardian-summit",
        "guardian-aurora",
    ],
    "shrines": [
        "shrine-water",
        "shrine-earth",
        "shrine-fire",
        "shrine-air",
        "shrine-spirit",
    ],
    "lanterns": [
        "lantern-ice",
        "lantern-amber",
        "lantern-rose",
        "lantern-violet",
        "pad-water",
        "pad-earth",
        "pad-fire",
        "pad-air",
        "pad-spirit",
    ],
    "chrome": [
        "icon-meet",
        "icon-discover",
        "icon-play",
        "chip-map-path",
        "icon-journey",
        "icon-recenter",
        "icon-guardians",
        "icon-filter",
        "icon-scan",
        "btn-back-quest",
    ],
    "landing-chrome": [
        "btn-begin-quest",
        "icon-howto",
        "icon-map",
        "btn-pill-a",
        "btn-pill-b",
    ],
}


def knock_black(im: Image.Image, floor: int = 14, fade: int = 26) -> Image.Image:
    rgba = im.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            peak = max(r, g, b)
            if peak <= floor:
                px[x, y] = (r, g, b, 0)
            elif peak < floor + fade:
                px[x, y] = (r, g, b, int(255 * (peak - floor) / fade))
    return rgba


def blobs(mask: list[list[bool]], min_area: int = 400):
    h = len(mask)
    w = len(mask[0]) if h else 0
    seen = [[False] * w for _ in range(h)]
    found = []
    for y in range(h):
        row = mask[y]
        seen_row = seen[y]
        for x in range(w):
            if not row[x] or seen_row[x]:
                continue
            stack = [(x, y)]
            seen_row[x] = True
            minx = maxx = x
            miny = maxy = y
            area = 0
            while stack:
                cx, cy = stack.pop()
                area += 1
                if cx < minx:
                    minx = cx
                elif cx > maxx:
                    maxx = cx
                if cy < miny:
                    miny = cy
                elif cy > maxy:
                    maxy = cy
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if area >= min_area:
                found.append((minx, miny, maxx + 1, maxy + 1, area))
    return found


def reading_order(boxes, row_slop: float = 0.18):
    if not boxes:
        return []
    heights = [b[3] - b[1] for b in boxes]
    slop = max(40, int(sum(heights) / len(heights) * row_slop))
    rows = []
    for box in sorted(boxes, key=lambda b: (b[1] + b[3]) / 2):
        cy = (box[1] + box[3]) / 2
        placed = False
        for row in rows:
            rcy = sum((b[1] + b[3]) / 2 for b in row) / len(row)
            if abs(cy - rcy) <= slop:
                row.append(box)
                placed = True
                break
        if not placed:
            rows.append([box])
    ordered = []
    for row in rows:
        ordered.extend(sorted(row, key=lambda b: b[0]))
    return ordered


def axis_ink(px, x0, y0, x1, y1, axis: str):
    if axis == "x":
        return [
            sum(1 for y in range(y0, y1) if px[x, y][3] > 48)
            for x in range(x0, x1)
        ]
    return [
        sum(1 for x in range(x0, x1) if px[x, y][3] > 48)
        for y in range(y0, y1)
    ]


def ink_segments(values, floor: float, min_len: int):
    segs = []
    start = None
    for i, v in enumerate(values):
        if v > floor and start is None:
            start = i
        elif v <= floor and start is not None:
            if i - start >= min_len:
                segs.append((start, i))
            start = None
    if start is not None and len(values) - start >= min_len:
        segs.append((start, len(values)))
    return segs


def projection_boxes(px, box, expected: int):
    x0, y0, x1, y1, area = box
    row_ink = axis_ink(px, x0, y0, x1, y1, "y")
    col_ink = axis_ink(px, x0, y0, x1, y1, "x")
    row_floor = max(6, (max(row_ink) if row_ink else 1) * 0.18)
    col_floor = max(6, (max(col_ink) if col_ink else 1) * 0.18)
    rows = ink_segments(row_ink, row_floor, 18)
    cols = ink_segments(col_ink, col_floor, 18)
    if not rows:
        rows = [(0, y1 - y0)]
    if not cols:
        cols = [(0, x1 - x0)]
    if len(rows) * len(cols) == expected:
        out = []
        for ry0, ry1 in rows:
            for cx0, cx1 in cols:
                out.append((
                    x0 + cx0, y0 + ry0, x0 + cx1, y0 + ry1,
                    max(1, area // expected),
                ))
        return out
    if len(rows) == 1 and len(cols) == expected:
        return [
            (x0 + a, y0, x0 + b, y1, max(1, area // expected))
            for a, b in cols
        ]
    if len(cols) == 1 and len(rows) == expected:
        return [
            (x0, y0 + a, x1, y0 + b, max(1, area // expected))
            for a, b in rows
        ]
    return None


def best_grid(width: int, height: int, count: int):
    best = (1, count)
    best_score = 10**9
    for rows in range(1, count + 1):
        if count % rows:
            continue
        cols = count // rows
        score = abs((width / cols) / (height / rows) - 1)
        if score < best_score:
            best = (rows, cols)
            best_score = score
    return best


def split_grid(box, count: int):
    x0, y0, x1, y1, area = box
    rows, cols = best_grid(x1 - x0, y1 - y0, count)
    out = []
    for r in range(rows):
        for c in range(cols):
            a = x0 + int((x1 - x0) * c / cols)
            b = x0 + int((x1 - x0) * (c + 1) / cols)
            c0 = y0 + int((y1 - y0) * r / rows)
            c1 = y0 + int((y1 - y0) * (r + 1) / rows)
            out.append((a, c0, b, c1, max(1, area // count)))
    return out


def proposed_counts(boxes, expected: int) -> list[int]:
    props = []
    for b in boxes:
        w, h = b[2] - b[0], b[3] - b[1]
        props.append(1 if w <= 1.55 * h else max(2, round(w / h)))
    while sum(props) > expected:
        wide = [i for i, n in enumerate(props) if n > 1]
        if not wide:
            break
        i = min(wide, key=lambda i: boxes[i][3] - boxes[i][1])
        props[i] -= 1
    while sum(props) < expected:
        def score(i):
            w = boxes[i][2] - boxes[i][0]
            h = max(1, boxes[i][3] - boxes[i][1])
            aspect = w / h
            if aspect < 1.2 and props[i] == 1:
                return -1
            return aspect / props[i]
        i = max(range(len(boxes)), key=score)
        props[i] += 1
    return props


def match_expected(px, boxes, expected: int):
    boxes = reading_order(boxes)
    print("  raw", [(b[0], b[1], b[2] - b[0], b[3] - b[1]) for b in boxes])
    if len(boxes) == expected:
        return boxes
    if len(boxes) > expected:
        raise SystemExit(f"too many blobs ({len(boxes)} > {expected})")
    parts = proposed_counts(boxes, expected)
    expanded = []
    for box, n in zip(boxes, parts):
        if n == 1:
            expanded.append(box)
            continue
        projected = projection_boxes(px, box, n)
        expanded.extend(projected if projected else split_grid(box, n))
    return reading_order(expanded)


def slice_sheet(path: Path, names: list[str], pad: int = 8, min_area: int = 900):
    raw = Image.open(path)
    print(f"{path.name}: {raw.size}")
    rgba = knock_black(raw)
    w, h = rgba.size
    px = rgba.load()
    mask = [[px[x, y][3] > 40 for x in range(w)] for y in range(h)]
    raw_boxes = blobs(mask, min_area=min_area)
    boxes = match_expected(px, raw_boxes, len(names))
    print(f"  blobs={len(raw_boxes)} sliced={len(boxes)} expected={len(names)}")
    for i, box in enumerate(boxes):
        print(f"    {i}: {box[0]},{box[1]} {box[2] - box[0]}x{box[3] - box[1]} area={box[4]}")
    if len(boxes) != len(names):
        raise SystemExit(f"blob count mismatch on {path.name}")
    saved = []
    for name, (x0, y0, x1, y1, _) in zip(names, boxes):
        crop = rgba.crop((
            max(0, x0 - pad),
            max(0, y0 - pad),
            min(w, x1 + pad),
            min(h, y1 + pad),
        ))
        dest = OUT / f"{name}.png"
        box = crop.getbbox()
        if box:
            crop = crop.crop(box)
        crop.save(dest, "PNG")
        saved.append(dest)
    return saved


def copy_sources():
    SOURCE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for dest_name, src_name in SHEETS.items():
        src = SRC_DIR / src_name
        if not src.exists():
            raise SystemExit(f"missing source {src}")
        shutil.copy2(src, SOURCE / dest_name)


def save_gate():
    raw = Image.open(SOURCE / "ice-gate.jpg").convert("RGB")
    raw.save(OUT / "landing-gate.jpg", "JPEG", quality=90)
    raw.save(OUT / "landing-gate.webp", "WEBP", quality=86, method=6)


def main():
    copy_sources()
    for stem, names in NAMES.items():
        min_area = 2500 if stem in {"portraits", "shrines", "cascade-tiles"} else 900
        if stem == "landing-chrome":
            min_area = 1200
        slice_sheet(SOURCE / f"{stem}.jpg", names, min_area=min_area)
    save_gate()
    print("done", len(list(OUT.glob("*"))), "files in", OUT)


if __name__ == "__main__":
    main()
