#!/usr/bin/env python3
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

DIR = Path(__file__).resolve().parent.parent / "public" / "tuxemon"
STEP = 20


def rgba(h):
    return np.array([int(h[i : i + 2], 16) for i in (1, 3, 5)] + [255], np.uint8)


def rnd(v):
    return int(math.floor(v + 0.5))


def region(img, rect):
    x0, y0, x1, y1 = rect
    m = np.zeros(img.shape[:2], bool)
    m[y0 : y1 + 1, x0 : x1 + 1] = True
    return m & (img[..., 3] > 0)


def colored(img, colors):
    m = np.zeros(img.shape[:2], bool)
    for c in colors:
        m |= np.all(img == rgba(c), axis=2)
    return m


def component(img, seed):
    op = img[..., 3] > 0
    h, w = op.shape
    m = np.zeros((h, w), bool)
    stack = [seed[::-1]]
    while stack:
        y, x = stack.pop()
        if 0 <= y < h and 0 <= x < w and op[y, x] and not m[y, x]:
            m[y, x] = True
            stack += [(y + dy, x + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)]
    return m


def remap(img, mask, fn):
    out = img.copy()
    out[mask] = 0
    h, w = mask.shape
    for y, x in zip(*np.nonzero(mask)):
        ny, nx = fn(y, x)
        if 0 <= ny < h and 0 <= nx < w:
            out[ny, nx] = img[y, x]
    return out


def shear(img, op, v):
    if not v:
        return img
    root, tip = op["root"], op["tip"]

    def t(p):
        return min(1, max(0, (p - root) / (tip - root)))

    if op["axis"] == "y":
        return remap(img, region(img, op["rect"]), lambda y, x: (y + rnd(v * t(x)), x))
    return remap(img, region(img, op["rect"]), lambda y, x: (y, x + rnd(v * t(y))))


def bob(img, op, v):
    if not v:
        return img
    return remap(img, component(img, op["seed"]), lambda y, x: (y + v, x))


def stretch_column(img, x, pivot, d):
    col = img[: pivot + 1, x].copy()
    if d > 0:
        img[: pivot + 1, x] = np.concatenate([col[d:], np.repeat(col[-1:], d, 0)])
    elif d < 0:
        img[: pivot + 1, x] = np.concatenate([np.zeros((-d, 4), np.uint8), col[:d]])


def lift(img, op, v):
    if not v:
        return img
    out = img.copy()
    x0, x1 = op["cols"]
    for x in range(x0, x1 + 1):
        stretch_column(out, x, op["pivot"], v)
    return out


def flicker(img, op, v):
    out = img.copy()
    mask = region(img, op["rect"]) & colored(img, op["colors"])
    for x in range(op["rect"][0], op["rect"][2] + 1):
        ys = np.nonzero(mask[:, x])[0]
        if len(ys):
            d = int(np.random.default_rng((x // op.get("width", 2), v, op["rect"][0])).integers(-1, 2))
            stretch_column(out, x, ys[0] + op.get("depth", 3), d)
    if v % 2:
        hits = [(region(out, op["rect"]) & colored(out, [a]), b) for a, b in op.get("swap", {}).items()]
        for hit, b in hits:
            out[hit] = rgba(b)
    return out


def spin(img, op, v):
    if v == 1:
        return img
    x0, y0, x1, y1 = op["rect"]
    mask = region(img, op["rect"]) & colored(img, op["colors"]) & ~region(img, op["keep"])
    out = img.copy()
    out[mask] = 0
    cx = op["axis"]
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            sx = x if v == "ring" and x > cx else 2 * cx - x
            if v == "ring" and sx <= cx:
                continue
            if x0 <= sx <= x1 and mask[y, sx] and not out[y, x, 3]:
                out[y, x] = img[y, sx]
    return out


def paste(img, op, v):
    if not v:
        return img
    out = img.copy()
    x, y = op["to"]
    h, w = op["pixels"].shape[:2]
    out[y : y + h, x : x + w] = op["pixels"]
    return out


def draw(img, op, v):
    if not v:
        return img
    out = img.copy()
    x0, y0 = op["at"]
    for dy, row in enumerate(op["rows"]):
        for dx, ch in enumerate(row):
            if ch != ".":
                out[y0 + dy, x0 + dx] = rgba(op["colors"][ch])
    return out


def blink(img, eyes, state):
    if not state:
        return img
    out = img.copy()
    for eye in eyes:
        mask = region(img, eye["rect"])
        if "colors" in eye:
            mask &= colored(img, eye["colors"])
        for r in eye.get("include", []):
            mask |= region(img, r)
        ys, xs = np.nonzero(mask)
        yt, yb = ys.min(), ys.max()
        h = yb - yt + 1
        cx = (xs.min() + xs.max()) / 2
        hw = max(1, (xs.max() - xs.min()) / 2)
        lid, line = rgba(eye["lid"]), rgba(eye["line"])

        def bend(x):
            return rnd(eye.get("curve", 0) * (1 - ((x - cx) / hw) ** 2))

        edge = yt + (h + 1) // 2 - 1 if state == 1 else yb - rnd((h - 1) * eye.get("lift", 0))
        for y, x in zip(ys, xs):
            e = edge + bend(x)
            if y == e:
                out[y, x] = line
            elif y < e or state == 2:
                out[y, x] = lid
        if eye.get("solid") and state == 2:
            for x in np.unique(xs):
                out[edge + bend(x), x] = line
    return out


def breathe(img, spec, v):
    if not v:
        return img
    if spec.get("float"):
        out = np.zeros_like(img)
        out[v:] = img[:-v]
        return out
    kept = np.delete(img, sorted(spec["rows"][:v]), axis=0)
    return np.concatenate([np.zeros((v, img.shape[1], 4), np.uint8), kept])


OPS = {"shear": shear, "bob": bob, "lift": lift, "flicker": flicker, "spin": spin, "paste": paste, "draw": draw}


def at(track, t):
    total = sum(d for _, d in track)
    t %= total
    for v, d in track:
        if t < d:
            return v
        t -= d


def render(base, spec, t):
    img = base
    if "eyes" in spec:
        img = blink(img, spec["eyes"], at(spec["blink"], t))
    for op in spec.get("moves", []):
        img = OPS[op["op"]](img, op, at(op["track"], t))
    return breathe(img, spec["breath"], at(spec["breath"]["track"], t))


def tracks(spec):
    yield spec["breath"]["track"]
    if "blink" in spec:
        yield spec["blink"]
    for op in spec.get("moves", []):
        yield op["track"]


def resolve(op, sheet):
    if op["op"] != "paste":
        return op
    x0, y0, x1, y1 = op["from"]
    return dict(op, pixels=sheet[y0 : y1 + 1, x0 : x1 + 1])


def frames(name, spec):
    sheet = np.array(Image.open(DIR / f"{spec.get('sheet', name)}-sheet.png").convert("RGBA"))
    cx, cy, cw, ch = spec.get("crop", (0, 0, 64, 64))
    base = sheet[cy : cy + ch, cx : cx + cw]
    spec = dict(spec, moves=[resolve(op, sheet) for op in spec.get("moves", [])])
    loop = spec["loop"]
    for tr in tracks(spec):
        total = sum(d for _, d in tr)
        assert loop % total == 0 and all(d % STEP == 0 for _, d in tr), (name, tr)
    out = []
    for t in range(0, loop, STEP):
        f = render(base, spec, t)
        if out and np.array_equal(out[-1][0], f):
            out[-1][1] += STEP
        else:
            out.append([f, STEP])
    return out


def save(name, spec):
    fs = frames(name, spec)
    imgs = [Image.fromarray(f) for f, _ in fs]
    path = DIR / (f"{name}.png" if "sheet" in spec else f"{name}-idle.png")
    imgs[0].save(
        path,
        save_all=True,
        append_images=imgs[1:],
        duration=[d for _, d in fs],
        loop=0,
        disposal=0,
        blend=0,
    )
    return path.name, len(fs)


def breath(rows, *track):
    return {"rows": rows, "track": list(track)}


def hover(*track):
    return {"float": True, "track": list(track)}


def eyes_closed_at(t, loop, double=False):
    seq = [(0, t), (1, 40), (2, 100), (1, 40)]
    if double:
        seq += [(0, 160), (1, 40), (2, 80), (1, 40)]
    return seq + [(0, loop - sum(d for _, d in seq))]


FACE_EYE_COLORS = ["#00c000", "#ffffff", "#000000", "#008000", "#c0ffc0"]
FACE_EYES = [
    {"rect": (6, 10, 8, 12), "colors": FACE_EYE_COLORS, "include": [(6, 10, 6, 10), (8, 12, 8, 12)], "lid": "#808080", "line": "#202020", "lift": 0.5},
    {"rect": (13, 10, 15, 12), "colors": FACE_EYE_COLORS, "include": [(13, 10, 13, 10), (15, 12, 15, 12)], "lid": "#808080", "line": "#202020", "lift": 0.5},
]
MOUTH = [(1, 140), (0, 100), (1, 180), (0, 120), (1, 120), (0, 100), (1, 200), (0, 340)]

SPRITES = {
    "propellercat": {
        "loop": 4800,
        "breath": hover((0, 500), (1, 300), (2, 500), (1, 300)),
        "moves": [
            {
                "op": "spin",
                "rect": (8, 4, 50, 14),
                "keep": (26, 9, 32, 20),
                "axis": 29,
                "colors": ["#dfdfdf", "#c0c0c0"],
                "track": [(1, 60), ("ring", 60), (-1, 60), ("ring", 60)],
            },
            {"op": "shear", "axis": "x", "rect": (47, 13, 58, 27), "root": 27, "tip": 14, "track": [(0, 1000), (1, 1400)]},
        ],
        "eyes": [
            {"rect": (17, 30, 19, 31), "lid": "#808080", "line": "#202020"},
            {"rect": (25, 30, 27, 31), "lid": "#808080", "line": "#202020"},
        ],
        "blink": eyes_closed_at(2900, 4800),
    },
    "selmatek": {
        "loop": 4800,
        "breath": breath([44, 47], (0, 900), (1, 200), (2, 1000), (1, 200), (0, 100)),
        "moves": [
            {"op": "bob", "seed": (30, 12), "track": [(0, 600), (-1, 1200), (0, 600)]},
            {"op": "bob", "seed": (48, 8), "track": [(-1, 600), (0, 1200), (-1, 600)]},
        ],
        "eyes": [
            {
                "rect": (11, 31, 21, 37),
                "colors": ["#508848", "#ffffff", "#9ec89a"],
                "lid": "#d9b75c",
                "line": "#482421",
            }
        ],
        "blink": eyes_closed_at(3300, 4800),
    },
    "moloch": {
        "loop": 4400,
        "breath": breath([33, 35], (0, 800), (1, 160), (2, 880), (1, 160), (0, 200)),
        "moves": [
            {"op": "shear", "axis": "y", "rect": (44, 12, 63, 30), "root": 44, "tip": 62, "track": [(0, 1100), (-1, 1100)]},
            {"op": "shear", "axis": "x", "rect": (0, 30, 10, 52), "root": 30, "tip": 50, "track": [(1, 1100), (0, 1100)]},
        ],
    },
    "vamporm": {
        "loop": 4200,
        "breath": breath([44, 43], (0, 500), (1, 120), (2, 560), (1, 120), (0, 100)),
        "moves": [
            {
                "op": "shear",
                "axis": "y",
                "rect": (34, 17, 50, 23),
                "root": 37,
                "tip": 49,
                "track": [(0, 340), (-1, 360), (0, 340), (1, 360)],
            }
        ],
        "eyes": [
            {
                "rect": (36, 31, 41, 37),
                "colors": ["#000000", "#16d698", "#ffffff"],
                "lid": "#0077aa",
                "line": "#000000",
                "lift": 0.35,
            }
        ],
        "blink": eyes_closed_at(1500, 4200, double=True),
    },
    "noctalo": {
        "loop": 4800,
        "breath": hover((0, 400), (1, 400)),
        "moves": [
            {
                "op": "shear",
                "axis": "y",
                "rect": (0, 0, 23, 47),
                "root": 23,
                "tip": 9,
                "track": [(1, 200), (0, 100), (-1, 100), (-2, 200), (-1, 100), (0, 100)],
            },
            {
                "op": "shear",
                "axis": "y",
                "rect": (37, 8, 63, 47),
                "root": 37,
                "tip": 60,
                "track": [(1, 200), (0, 100), (-1, 100), (-2, 200), (-1, 100), (0, 100)],
            },
        ],
        "eyes": [
            {"rect": (24, 24, 25, 25), "lid": "#b885a8", "line": "#554a5a"},
            {"rect": (28, 24, 31, 25), "lid": "#b885a8", "line": "#554a5a"},
        ],
        "blink": eyes_closed_at(2400, 4800),
    },
    "possessun": {
        "loop": 4800,
        "breath": hover((0, 500), (1, 300), (2, 500), (1, 300)),
        "eyes": [
            {"rect": (24, 28, 25, 29), "colors": ["#f14e56", "#ed1c24", "#a90e15"], "lid": "#000000", "line": "#000000"},
            {"rect": (28, 28, 29, 30), "colors": ["#f14e56", "#ed1c24", "#a90e15"], "lid": "#000000", "line": "#000000"},
        ],
        "blink": eyes_closed_at(3100, 4800, double=True),
    },
    "agnidon": {
        "loop": 4800,
        "breath": breath([37, 33], (0, 600), (1, 120), (2, 640), (1, 120), (0, 120)),
        "moves": [
            {
                "op": "flicker",
                "rect": (10, 9, 40, 31),
                "colors": ["#c91f2c", "#f86000", "#f8d800", "#f89800", "#e80000"],
                "swap": {"#f8d800": "#f89800", "#f89800": "#f8d800"},
                "track": [(0, 80), (1, 80), (2, 80), (3, 80), (4, 80), (5, 80)],
            },
            {
                "op": "flicker",
                "rect": (49, 21, 57, 29),
                "colors": ["#c91f2c", "#5c0f18", "#971424"],
                "track": [(3, 80), (4, 80), (5, 80), (0, 80), (1, 80), (2, 80)],
            },
        ],
        "eyes": [{"rect": (14, 27, 16, 28), "lid": "#aa6712", "line": "#101010"}],
        "blink": eyes_closed_at(2000, 4800),
    },
    "bigfin": {
        "loop": 4800,
        "breath": hover((0, 500), (1, 300), (2, 500), (1, 300)),
        "moves": [
            {"op": "shear", "axis": "x", "rect": (37, 0, 63, 33), "root": 33, "tip": 4, "track": [(0, 400), (1, 400), (0, 400), (-1, 400)]},
            {"op": "shear", "axis": "x", "rect": (11, 7, 30, 21), "root": 21, "tip": 8, "track": [(0, 600), (1, 600), (0, 600), (-1, 600)]},
        ],
        "eyes": [
            {
                "rect": (26, 30, 31, 35),
                "colors": ["#000000", "#b8c8e0", "#787878"],
                "lid": "#4870a8",
                "line": "#000000",
                "lift": 0.4,
            }
        ],
        "blink": eyes_closed_at(3500, 4800),
    },
    "eaglace": {
        "loop": 4800,
        "breath": breath([35, 30], (0, 600), (1, 120), (2, 640), (1, 120), (0, 120)),
        "moves": [
            {"op": "shear", "axis": "y", "rect": (0, 10, 29, 26), "root": 29, "tip": 2, "track": [(0, 300), (-1, 300), (-2, 300), (-1, 300)]},
            {"op": "shear", "axis": "x", "rect": (31, 0, 63, 29), "root": 29, "tip": 4, "track": [(0, 300), (1, 300), (2, 300), (1, 300)]},
        ],
    },
    "chillimp": {
        "loop": 4800,
        "breath": breath([40, 30], (0, 600), (1, 120), (2, 640), (1, 120), (0, 120)),
        "moves": [{"op": "lift", "cols": (3, 16), "pivot": 27, "track": [(0, 700), (1, 500)]}],
        "eyes": [
            {"rect": (22, 22, 27, 25), "colors": ["#d8b92d", "#b09621", "#2e1b30"], "lid": "#68d1c5", "line": "#2b2f38"},
            {"rect": (32, 22, 37, 25), "colors": ["#d8b92d", "#b09621", "#2e1b30"], "lid": "#68d1c5", "line": "#2b2f38"},
        ],
        "blink": eyes_closed_at(2700, 4800),
    },
    "hampotamos": {
        "loop": 4200,
        "breath": breath([44, 47], (0, 800), (1, 180), (2, 900), (1, 180), (0, 40)),
        "eyes": [
            {"rect": (26, 31, 27, 34), "colors": ["#ffffff", "#000000"], "lid": "#8885b8", "line": "#000000"},
            {"rect": (29, 32, 31, 36), "colors": ["#ffffff", "#000000"], "lid": "#8885b8", "line": "#000000"},
        ],
        "blink": eyes_closed_at(2600, 4200),
    },
    "cateye": {
        "loop": 4800,
        "breath": breath([41, 38], (0, 600), (1, 120), (2, 640), (1, 120), (0, 120)),
        "moves": [{"op": "shear", "axis": "x", "rect": (50, 33, 60, 46), "root": 46, "tip": 34, "track": [(0, 800), (1, 800)]}],
        "eyes": [
            {
                "rect": (21, 17, 41, 25),
                "colors": ["#000000", "#bbbba8", "#ffffff", "#428e3a", "#ffffe4"],
                "lid": "#a49cac",
                "line": "#000000",
                "lift": 0.25,
                "curve": 1,
            }
        ],
        "blink": eyes_closed_at(3800, 4800),
    },
    "nut": {
        "loop": 3600,
        "breath": breath([47], (0, 700), (1, 500)),
        "eyes": [
            {
                "rect": (20, 26, 36, 40),
                "colors": ["#b0b0a0", "#d8e0e8"],
                "include": [(25, 30, 26, 36)],
                "lid": "#808088",
                "line": "#000000",
                "lift": 0.45,
                "curve": 1,
            }
        ],
        "blink": eyes_closed_at(2300, 3600),
    },
    "propellercat-face": {
        "sheet": "propellercat",
        "crop": (0, 64, 24, 24),
        "loop": 6000,
        "breath": hover((0, 1000), (1, 1000)),
        "moves": [{"op": "shear", "axis": "x", "rect": (2, 2, 7, 6), "root": 6, "tip": 3, "track": [(0, 3800), (1, 80), (0, 80), (1, 80), (0, 1960)]}],
        "eyes": FACE_EYES,
        "blink": eyes_closed_at(1400, 6000),
    },
    "propellercat-talk": {
        "sheet": "propellercat",
        "crop": (0, 64, 24, 24),
        "loop": 2600,
        "breath": hover((0, 660), (1, 640)),
        "moves": [
            {"op": "paste", "from": (33, 78, 37, 78), "to": (9, 15), "track": MOUTH},
            {"op": "paste", "from": (33, 80, 37, 81), "to": (9, 16), "track": MOUTH},
        ],
        "eyes": FACE_EYES,
        "blink": eyes_closed_at(2300, 2600),
    },
    "shybulb": {
        "loop": 6000,
        "breath": hover((0, 600), (1, 400), (2, 600), (1, 400)),
        "moves": [{"op": "shear", "axis": "y", "rect": (18, 45, 28, 52), "root": 28, "tip": 19, "track": [(0, 500), (-1, 500), (0, 500), (1, 500)]}],
        "eyes": [{"rect": (35, 40, 36, 42), "colors": ["#a349a2", "#ffffff", "#000000"], "lid": "#ece82d", "line": "#000000", "lift": 0.5}],
        "blink": eyes_closed_at(3000, 6000),
    },
    "rockitten": {
        "loop": 4800,
        "breath": breath([36], (0, 800), (1, 800)),
        "moves": [{"op": "lift", "cols": (16, 19), "pivot": 25, "track": [(0, 4000), (1, 80), (0, 80), (1, 80), (0, 560)]}],
        "eyes": [
            {"rect": (21, 29, 22, 31), "lid": "#b0b7ac", "line": "#292626", "lift": 0.5},
            {"rect": (30, 30, 31, 32), "lid": "#b0b7ac", "line": "#292626", "lift": 0.5},
        ],
        "blink": eyes_closed_at(2600, 4800),
    },
    "budaye": {
        "loop": 5600,
        "breath": breath([38, 29], (0, 500), (1, 120), (2, 660), (1, 120)),
        "moves": [{"op": "shear", "axis": "x", "rect": (43, 32, 55, 47), "root": 47, "tip": 33, "track": [(0, 700), (1, 700), (0, 700), (-1, 700)]}],
        "eyes": [
            {"rect": (12, 17, 19, 23), "colors": ["#201f1d", "#6b5242", "#ffffff"], "lid": "#ffe1aa", "line": "#201f1d", "lift": 0.3, "curve": 1, "solid": True},
            {"rect": (22, 16, 31, 23), "colors": ["#201f1d", "#6b5242", "#ffffff"], "lid": "#ffe1aa", "line": "#201f1d", "lift": 0.3, "curve": 1, "solid": True},
        ],
        "blink": eyes_closed_at(3500, 5600),
    },
    "anoleaf": {
        "loop": 4800,
        "breath": breath([43, 45], (0, 600), (1, 120), (2, 640), (1, 120), (0, 120)),
        "moves": [{"op": "shear", "axis": "y", "rect": (38, 36, 48, 50), "root": 38, "tip": 47, "track": [(0, 600), (-1, 600), (0, 600), (1, 600)]}],
        "eyes": [{"rect": (28, 29, 32, 33), "colors": ["#000000", "#00a2e8", "#f0f9e8"], "lid": "#64d792", "line": "#000000", "lift": 0.4}],
        "blink": eyes_closed_at(1900, 4800, double=True),
    },
    "hatchling": {
        "loop": 4800,
        "breath": breath([], (0, 4800)),
        "moves": [
            {"op": "shear", "axis": "y", "rect": (24, 31, 42, 43), "root": 23, "tip": 24, "track": [(0, 500), (1, 300), (0, 400), (1, 300), (0, 700), (1, 300), (0, 2300)]},
            {"op": "shear", "axis": "x", "rect": (23, 30, 43, 58), "root": 57, "tip": 32, "track": [(0, 3000), (1, 120), (0, 120), (-1, 120), (0, 120), (1, 120), (0, 1200)]},
        ],
        "eyes": [{"rect": (32, 36, 33, 37), "colors": ["#e6e6e6", "#ffffff", "#000540"], "lid": "#6d9c00", "line": "#000540"}],
        "blink": eyes_closed_at(2200, 4800),
    },
    "tumbleworm": {
        "loop": 4800,
        "breath": breath([], (0, 4800)),
        "moves": [
            {"op": "shear", "axis": "x", "rect": (24, 20, 40, 42), "root": 42, "tip": 22, "track": [(0, 600), (1, 600), (0, 600), (-1, 600)]},
            {"op": "shear", "axis": "y", "rect": (46, 44, 56, 53), "root": 46, "tip": 55, "track": [(0, 1200), (-1, 300), (0, 300), (-1, 300), (0, 300)]},
        ],
        "eyes": [
            {"rect": (28, 28, 29, 30), "colors": ["#ffffff", "#000000"], "lid": "#ffcd4a", "line": "#000000", "lift": 0.5},
            {"rect": (32, 28, 33, 30), "colors": ["#ffffff", "#000000"], "lid": "#ffcd4a", "line": "#000000", "lift": 0.5},
        ],
        "blink": eyes_closed_at(3300, 4800),
    },
}


def face_specs(name, eyes=(), talk=None):
    base = {"sheet": name, "crop": (0, 64, 24, 24)}
    second = {"op": "paste", "from": (24, 64, 47, 87), "to": (0, 0)}
    idle = base | {"loop": 6000, "breath": hover((0, 1000), (1, 1000)), "moves": [second | {"track": [(0, 4200), (1, 360), (0, 1440)]}]}
    speak = base | {"loop": 2600, "breath": hover((0, 660), (1, 640)), "moves": [(talk or second) | {"track": MOUTH}]}
    if eyes:
        idle |= {"eyes": eyes, "blink": eyes_closed_at(1600, 6000)}
        speak |= {"eyes": eyes, "blink": eyes_closed_at(2300, 2600)}
    return {f"{name}-face": idle, f"{name}-talk": speak}


def face_eye(rect, colors, lid, line, **kw):
    return {"rect": rect, "colors": colors, "lid": lid, "line": line} | kw


for n in ["selmatek", "moloch", "vamporm", "noctalo", "possessun", "agnidon", "bigfin", "eaglace", "chillimp", "hampotamos", "cateye", "nut"]:
    SPRITES |= face_specs(n)


SPRITES |= face_specs("shybulb", [face_eye((15, 12, 16, 14), ["#a349a2", "#ffffff", "#000000"], "#ece82d", "#000000", lift=0.5)])
SPRITES |= face_specs(
    "rockitten",
    [
        face_eye((6, 10, 9, 13), ["#030303", "#050505", "#ffffff"], "#bababa", "#242424", lift=0.34),
        face_eye((14, 10, 17, 13), ["#030303", "#050505", "#ffffff"], "#bababa", "#242424", lift=0.34),
    ],
)
SPRITES |= face_specs(
    "budaye",
    [
        face_eye((1, 10, 7, 16), ["#201f1d", "#6b5242", "#ffffff"], "#ffe1aa", "#201f1d", lift=0.3, curve=1, solid=True),
        face_eye((12, 10, 20, 16), ["#201f1d", "#6b5242", "#ffffff"], "#ffe1aa", "#201f1d", lift=0.3, curve=1, solid=True),
    ],
    talk={"op": "draw", "at": (8, 17), "rows": ["eee", "efe", ".e."], "colors": {"e": "#201f1d", "f": "#6b5242"}},
)
SPRITES |= face_specs("anoleaf", [face_eye((11, 6, 15, 10), ["#000000", "#00a2e8", "#f0f9e8"], "#64d792", "#000000", lift=0.4)])
SPRITES |= face_specs(
    "hatchling",
    [
        face_eye((8, 11, 9, 12), ["#e6e6e6", "#000540", "#ffffff"], "#6d9c00", "#000540"),
        face_eye((14, 11, 15, 12), ["#e6e6e6", "#000540", "#ffffff"], "#6d9c00", "#000540"),
    ],
)
SPRITES |= face_specs(
    "tumbleworm",
    [
        face_eye((8, 7, 10, 11), ["#ffffff", "#000000"], "#ffcd4a", "#000000", lift=0.4),
        face_eye((14, 7, 16, 11), ["#ffffff", "#000000"], "#ffcd4a", "#000000", lift=0.4),
    ],
)

if __name__ == "__main__":
    for name in sys.argv[1:] or SPRITES:
        file, count = save(name, SPRITES[name])
        print(f"{file}: {count} frames")
