#!/usr/bin/env python3
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

DIR = Path(__file__).resolve().parent.parent / "public" / "tuxemon"
STEP = 20
N = 64


def rgba(h):
    return np.array([int(h[i : i + 2], 16) for i in (1, 3, 5)] + [255], np.uint8)


def rnd(v):
    return int(math.floor(v + 0.5))


def region(img, rect):
    x0, y0, x1, y1 = rect
    m = np.zeros((N, N), bool)
    m[y0 : y1 + 1, x0 : x1 + 1] = True
    return m & (img[..., 3] > 0)


def colored(img, colors):
    m = np.zeros((N, N), bool)
    for c in colors:
        m |= np.all(img == rgba(c), axis=2)
    return m


def component(img, seed):
    op = img[..., 3] > 0
    m = np.zeros((N, N), bool)
    stack = [seed[::-1]]
    while stack:
        y, x = stack.pop()
        if 0 <= y < N and 0 <= x < N and op[y, x] and not m[y, x]:
            m[y, x] = True
            stack += [(y + dy, x + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)]
    return m


def remap(img, mask, fn):
    out = img.copy()
    out[mask] = 0
    for y, x in zip(*np.nonzero(mask)):
        ny, nx = fn(y, x)
        if 0 <= ny < N and 0 <= nx < N:
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
    return out


def breathe(img, spec, v):
    if not v:
        return img
    if spec.get("float"):
        out = np.zeros_like(img)
        out[v:] = img[: N - v]
        return out
    kept = np.delete(img, sorted(spec["rows"][:v]), axis=0)
    return np.concatenate([np.zeros((v, N, 4), np.uint8), kept])


OPS = {"shear": shear, "bob": bob, "lift": lift, "flicker": flicker, "spin": spin}


def at(track, t):
    total = sum(d for _, d in track)
    t %= total
    for v, d in track:
        if t < d:
            return v
        t -= d


def render(base, spec, t):
    img = base
    for op in spec.get("moves", []):
        img = OPS[op["op"]](img, op, at(op["track"], t))
    if "eyes" in spec:
        img = blink(img, spec["eyes"], at(spec["blink"], t))
    return breathe(img, spec["breath"], at(spec["breath"]["track"], t))


def tracks(spec):
    yield spec["breath"]["track"]
    if "blink" in spec:
        yield spec["blink"]
    for op in spec.get("moves", []):
        yield op["track"]


def frames(name, spec):
    base = np.array(Image.open(DIR / f"{name}-sheet.png").convert("RGBA"))[:N, :N]
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
    imgs[0].save(
        DIR / f"{name}-idle.png",
        save_all=True,
        append_images=imgs[1:],
        duration=[d for _, d in fs],
        loop=0,
        disposal=0,
        blend=0,
    )
    return len(fs)


def breath(rows, *track):
    return {"rows": rows, "track": list(track)}


def hover(*track):
    return {"float": True, "track": list(track)}


def eyes_closed_at(t, loop, double=False):
    seq = [(0, t), (1, 40), (2, 100), (1, 40)]
    if double:
        seq += [(0, 160), (1, 40), (2, 80), (1, 40)]
    return seq + [(0, loop - sum(d for _, d in seq))]


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
    "aardorn": {
        "loop": 4000,
        "breath": breath([41], (0, 800), (1, 1000), (0, 200)),
        "moves": [
            {
                "op": "shear",
                "axis": "x",
                "rect": (29, 16, 38, 29),
                "root": 29,
                "tip": 17,
                "track": [(0, 2000), (1, 80), (0, 80), (1, 80), (0, 1760)],
            }
        ],
        "eyes": [{"rect": (37, 37, 40, 40), "colors": ["#000000", "#ffeed5", "#62626a"], "lid": "#ad7b5a", "line": "#000000"}],
        "blink": eyes_closed_at(900, 4000),
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
}

if __name__ == "__main__":
    for name in sys.argv[1:] or SPRITES:
        print(f"{name}-idle.png: {save(name, SPRITES[name])} frames")
