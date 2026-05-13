#!/usr/bin/env python3
"""
App Store Screenshot Composer — Plateoffs Edition
Light background, left/right layout, independently-sized large text,
and a rotated gold offset layer behind main black text for a sticker effect.
"""

import argparse
import os
from PIL import Image, ImageDraw, ImageFont

# ── Canvas ──────────────────────────────────────────────────────────
CANVAS_W = 1290
CANVAS_H = 2796

# ── Device template constants ────────────────────────────────────────
DEVICE_W = 1030
BEZEL = 15
SCREEN_W = DEVICE_W - 2 * BEZEL
SCREEN_CORNER_R = 62

# ── Layout ──────────────────────────────────────────────────────────
TEXT_TOP   = 80
DEVICE_Y   = 820
TEXT_MAX_H = DEVICE_Y - TEXT_TOP - 80    # ~660px generous text zone

# Left verb / right descriptor split
SPLIT_X    = int(CANVAS_W * 0.40)        # 516px
VERB_MAX_W = SPLIT_X - 60
DESC_MAX_W = CANVAS_W - SPLIT_X - 60
DESC_LINE_GAP = 32

# ── Typography ──────────────────────────────────────────────────────
FONT_PATH = "/Library/Fonts/FuturaLTProHeavyOblique.otf"

VERB_COLOR = "#000000"
DESC_COLOR = "#000000"

# Sticker offset: gold rotated slab behind the main black text
OFFSET_COLOR = (246, 189, 80, 255)   # #f6bd50 trophyGold
OFFSET_X     = 14
OFFSET_Y     = 14
OFFSET_ANGLE = -4                    # degrees CCW

VERB_SIZE_MAX = 400
VERB_SIZE_MIN = 120
DESC_SIZE_MAX = 200
DESC_SIZE_MIN = 60

# ── Graphic layer colours ────────────────────────────────────────────
HAZARD_GOLD  = "#f0b84b"
HAZARD_BLACK = "#000000"

FRAME_PATH = os.path.join(os.path.dirname(__file__), "assets", "device_frame.png")


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ── Background layers ────────────────────────────────────────────────

def draw_bg_stripes(canvas, bg_hex):
    r, g, b = hex_to_rgb(bg_hex)
    dr, dg, db = max(0, r - 28), max(0, g - 28), max(0, b - 28)
    layer = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    stripe_w, stride = 70, 210
    for x in range(-CANVAS_H, CANVAS_W + CANVAS_H, stride):
        d.polygon([
            (x,                       0),
            (x + stripe_w,            0),
            (x + stripe_w + CANVAS_H, CANVAS_H),
            (x + CANVAS_H,            CANVAS_H),
        ], fill=(dr, dg, db, 55))
    return Image.alpha_composite(canvas, layer)


def draw_hazard_bar(canvas, y, bar_h=24, stripe_w=38, skew=0.45):
    layer = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    colors = [hex_to_rgb(HAZARD_BLACK), hex_to_rgb(HAZARD_GOLD)]
    offset = int(bar_h * skew)
    x, i = -stripe_w * 2, 0
    while x < CANVAS_W + stripe_w * 2:
        r, g, b = colors[i % 2]
        d.polygon([
            (x - offset,            y),
            (x + stripe_w - offset, y),
            (x + stripe_w + offset, y + bar_h),
            (x + offset,            y + bar_h),
        ], fill=(r, g, b, 255))
        x += stripe_w
        i += 1
    return Image.alpha_composite(canvas, layer)


# ── Font helpers ─────────────────────────────────────────────────────

def _dummy():
    return ImageDraw.Draw(Image.new("RGBA", (1, 1)))


def fit_verb_font(text):
    d = _dummy()
    for size in range(VERB_SIZE_MAX, VERB_SIZE_MIN - 1, -4):
        font = ImageFont.truetype(FONT_PATH, size)
        bb = d.textbbox((0, 0), text, font=font)
        if (bb[2] - bb[0]) <= VERB_MAX_W and (bb[3] - bb[1]) <= TEXT_MAX_H:
            return font
    return ImageFont.truetype(FONT_PATH, VERB_SIZE_MIN)


def fit_desc_font(lines):
    d = _dummy()
    for size in range(DESC_SIZE_MAX, DESC_SIZE_MIN - 1, -2):
        font = ImageFont.truetype(FONT_PATH, size)
        if all(
            (d.textbbox((0, 0), l, font=font)[2] - d.textbbox((0, 0), l, font=font)[0]) <= DESC_MAX_W
            for l in lines
        ):
            return font
    return ImageFont.truetype(FONT_PATH, DESC_SIZE_MIN)


def text_dims(text, font):
    bb = _dummy().textbbox((0, 0), text, font=font)
    return bb[2] - bb[0], bb[3] - bb[1], bb[0], bb[1]


# ── Rotated offset layer ──────────────────────────────────────────────

def make_offset_layer(canvas_size, text, font, draw_x, draw_y, color_rgba, angle, ox, oy):
    tw, th, bx0, by0 = text_dims(text, font)
    pad = int(max(tw, th) * 0.6) + 20
    cell_w, cell_h = tw + pad * 2, th + pad * 2

    cell = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
    ImageDraw.Draw(cell).text((pad - bx0, pad - by0), text, fill=color_rgba, font=font)
    rotated = cell.rotate(angle, expand=False, resample=Image.BICUBIC)

    cx = draw_x + tw // 2 + ox
    cy = draw_y + th // 2 + oy

    layer = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    layer.paste(rotated, (cx - rotated.width // 2, cy - rotated.height // 2), rotated)
    return layer


# ── Main composer ────────────────────────────────────────────────────

def compose(bg_hex, verb, desc_lines, screenshot_path, output_path):
    bg_rgb = hex_to_rgb(bg_hex)

    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (*bg_rgb, 255))
    canvas = draw_bg_stripes(canvas, bg_hex)
    canvas = draw_hazard_bar(canvas, y=DEVICE_Y - 32, bar_h=24)

    # ── Font sizing ─────────────────────────────────────────────────
    verb_upper = verb.upper()
    desc_upper = [l.upper() for l in desc_lines]

    verb_font = fit_verb_font(verb_upper)
    desc_font = fit_desc_font(desc_upper)

    vw, vh, vx0, vy0 = text_dims(verb_upper, verb_font)
    d_dims       = [text_dims(l, desc_font) for l in desc_upper]
    desc_block_h = sum(d[1] for d in d_dims) + DESC_LINE_GAP * (len(desc_lines) - 1)

    # ── Vertical centering ───────────────────────────────────────────
    text_block_h = max(vh, desc_block_h)
    zone_center  = TEXT_TOP + TEXT_MAX_H // 2
    block_top    = zone_center - text_block_h // 2

    verb_draw_x = (SPLIT_X - vw) // 2 - vx0
    verb_draw_y = block_top + (text_block_h - vh) // 2 - vy0

    desc_draw_x = SPLIT_X + 44
    desc_draw_y = block_top + (text_block_h - desc_block_h) // 2

    # ── Rotated gold offset — verb ───────────────────────────────────
    canvas = Image.alpha_composite(canvas, make_offset_layer(
        canvas.size, verb_upper, verb_font,
        verb_draw_x + vx0, verb_draw_y + vy0,
        OFFSET_COLOR, OFFSET_ANGLE, OFFSET_X, OFFSET_Y,
    ))

    # ── Rotated gold offset — descriptor lines ───────────────────────
    dy = desc_draw_y
    for line, (dw, dh, dx0, dy0) in zip(desc_upper, d_dims):
        canvas = Image.alpha_composite(canvas, make_offset_layer(
            canvas.size, line, desc_font,
            desc_draw_x + dx0, dy + dy0,
            OFFSET_COLOR, OFFSET_ANGLE, OFFSET_X // 2, OFFSET_Y // 2,
        ))
        dy += dh + DESC_LINE_GAP

    # ── Main text on top ─────────────────────────────────────────────
    draw = ImageDraw.Draw(canvas)
    draw.text((verb_draw_x, verb_draw_y), verb_upper, fill=VERB_COLOR, font=verb_font)

    dy = desc_draw_y
    for line, (dw, dh, dx0, dy0) in zip(desc_upper, d_dims):
        draw.text((desc_draw_x - dx0, dy - dy0), line, fill=DESC_COLOR, font=desc_font)
        dy += dh + DESC_LINE_GAP

    # ── Gold vertical divider ────────────────────────────────────────
    draw.rectangle(
        [SPLIT_X + 10, block_top, SPLIT_X + 16, block_top + text_block_h],
        fill=(*hex_to_rgb(HAZARD_GOLD), 220),
    )

    # ── Screenshot ───────────────────────────────────────────────────
    device_x = (CANVAS_W - DEVICE_W) // 2
    screen_x = device_x + BEZEL
    screen_y = DEVICE_Y + BEZEL
    screen_h = CANVAS_H - screen_y + 500

    shot = Image.open(screenshot_path).convert("RGBA")
    shot = shot.resize((SCREEN_W, int(shot.height * SCREEN_W / shot.width)), Image.LANCZOS)

    scr_mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(scr_mask).rounded_rectangle(
        [screen_x, screen_y, screen_x + SCREEN_W, screen_y + screen_h],
        radius=SCREEN_CORNER_R, fill=255,
    )
    scr_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(scr_layer).rounded_rectangle(
        [screen_x, screen_y, screen_x + SCREEN_W, screen_y + screen_h],
        radius=SCREEN_CORNER_R, fill=(0, 0, 0, 255),
    )
    scr_layer.paste(shot, (screen_x, screen_y))
    scr_layer.putalpha(scr_mask)
    canvas = Image.alpha_composite(canvas, scr_layer)

    # ── Device frame ──────────────────────────────────────────────────
    frame = Image.open(FRAME_PATH).convert("RGBA")
    frame_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    frame_layer.paste(frame, (device_x, DEVICE_Y))
    canvas = Image.alpha_composite(canvas, frame_layer)

    canvas.convert("RGB").save(output_path, "PNG")
    print(f"✓ {output_path} ({CANVAS_W}×{CANVAS_H})")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--bg",         required=True)
    p.add_argument("--verb",       required=True)
    p.add_argument("--desc",       required=True, help="Pipe-separated: LINE ONE|LINE TWO")
    p.add_argument("--screenshot", required=True)
    p.add_argument("--output",     required=True)
    args = p.parse_args()
    compose(args.bg, args.verb, args.desc.split("|"), args.screenshot, args.output)


if __name__ == "__main__":
    main()
