#!/usr/bin/env python3
"""Gera ícones Android e splash da Carteira Orbis sem depender de assets binários no Git."""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android" / "app" / "src" / "main" / "res"

NAVY = "#071322"
BLUE = "#2E90FA"
CYAN = "#43D9FF"
GREEN = "#49E0A5"
WHITE = "#F6FAFF"

DENSITIES = {
    "mdpi": 1.0,
    "hdpi": 1.5,
    "xhdpi": 2.0,
    "xxhdpi": 3.0,
    "xxxhdpi": 4.0,
}


def market_mark(size: int, background: bool, round_mask: bool = False) -> Image.Image:
    scale = size / 1024
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    if background:
        inset = int(34 * scale)
        radius = int((250 if not round_mask else 500) * scale)
        draw.rounded_rectangle(
            (inset, inset, size - inset, size - inset),
            radius=radius,
            fill=NAVY,
        )

    center = size // 2
    ring_box = (
        int(180 * scale),
        int(180 * scale),
        int(844 * scale),
        int(844 * scale),
    )
    draw.ellipse(ring_box, outline=BLUE, width=max(2, int(44 * scale)))

    # Candles: leitura imediata de mercado, mesmo em tamanhos pequenos.
    candles = [
        (300, 610, 520, 700),
        (430, 510, 380, 635),
        (560, 420, 300, 550),
        (690, 320, 230, 455),
    ]
    for x, top, wick_top, bottom in candles:
        x_px = int(x * scale)
        body_top = int(top * scale)
        wick_top_px = int(wick_top * scale)
        bottom_px = int(bottom * scale)
        width = max(3, int(58 * scale))
        wick_width = max(2, int(18 * scale))
        draw.line((x_px, wick_top_px, x_px, bottom_px), fill=CYAN, width=wick_width)
        draw.rounded_rectangle(
            (x_px - width // 2, body_top, x_px + width // 2, bottom_px - int(28 * scale)),
            radius=max(2, int(14 * scale)),
            fill=GREEN,
        )

    points = [(275, 690), (420, 570), (545, 520), (690, 365), (760, 300)]
    line_points = [(int(x * scale), int(y * scale)) for x, y in points]
    draw.line(line_points, fill=WHITE, width=max(3, int(26 * scale)), joint="curve")
    for x, y in line_points:
        radius = max(2, int(17 * scale))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=WHITE)

    # Seta final da tendência.
    tip_x, tip_y = line_points[-1]
    arrow = [
        (tip_x, tip_y),
        (int(704 * scale), int(315 * scale)),
        (int(744 * scale), int(365 * scale)),
    ]
    draw.polygon(arrow, fill=WHITE)
    return image


def save_icon_assets() -> None:
    for density, multiplier in DENSITIES.items():
        directory = RES / f"mipmap-{density}"
        directory.mkdir(parents=True, exist_ok=True)

        legacy_size = int(48 * multiplier)
        foreground_size = int(108 * multiplier)
        market_mark(legacy_size, background=True).save(directory / "ic_launcher.png")
        market_mark(legacy_size, background=True, round_mask=True).save(
            directory / "ic_launcher_round.png"
        )
        market_mark(foreground_size, background=False).save(
            directory / "ic_launcher_foreground.png"
        )

    values = RES / "values"
    values.mkdir(parents=True, exist_ok=True)
    (values / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<resources><color name="ic_launcher_background">#071322</color></resources>\n',
        encoding="utf-8",
    )

    adaptive = RES / "mipmap-anydpi-v26"
    adaptive.mkdir(parents=True, exist_ok=True)
    xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background" />\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
        '</adaptive-icon>\n'
    )
    (adaptive / "ic_launcher.xml").write_text(xml, encoding="utf-8")
    (adaptive / "ic_launcher_round.xml").write_text(xml, encoding="utf-8")


def save_splash() -> None:
    width, height = 1440, 2560
    splash = Image.new("RGBA", (width, height), NAVY)
    mark = market_mark(720, background=False)
    splash.alpha_composite(mark, ((width - mark.width) // 2, (height - mark.height) // 2 - 80))
    directory = RES / "drawable"
    directory.mkdir(parents=True, exist_ok=True)
    splash.convert("RGB").save(directory / "splash.png", optimize=True)


def main() -> None:
    if not RES.exists():
        raise SystemExit("Projeto Android não encontrado. Execute `npx cap add android` antes.")
    save_icon_assets()
    save_splash()
    print("Ícones e splash da Carteira Orbis gerados com sucesso.")


if __name__ == "__main__":
    main()
