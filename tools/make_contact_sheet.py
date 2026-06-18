#!/usr/bin/env python3
"""
make_contact_sheet.py — 잘라낸 아이콘들을 체커보드 위에 한 장으로 모아 시각 검증용 이미지를 만든다.

왜 체커보드인가: 투명 배경 위에 남은 '연한 회색 프레임/카드'나 '흰색 후광(halo)',
그리고 잘림/어긋남은 단색 배경에선 잘 안 보인다. 중간 톤 체커보드 위에 올리면
배경 잔재와 가장자리 결함이 즉시 드러난다. 잘라낸 직후 이걸로 꼭 눈으로 확인할 것.

사용:
  python make_contact_sheet.py <out_dir>/manifest.json [--cell 96] [--out <out_dir>/_contact.png]
  python make_contact_sheet.py <out_dir>/icons          # 폴더만 줘도 됨
"""
from __future__ import annotations
import argparse, json
from pathlib import Path
import numpy as np
from PIL import Image


def checker(w, h, sq=10):
    yy, xx = np.mgrid[0:h, 0:w]
    a = np.where(((xx // sq + yy // sq) % 2 == 0), 205, 170).astype(np.uint8)
    return Image.fromarray(np.dstack([a, a, a]), "RGB").convert("RGBA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target", help="manifest.json 경로 또는 icons 폴더")
    ap.add_argument("--cell", type=int, default=96, help="셀 크기(px)")
    ap.add_argument("--cols", type=int, default=0, help="열 수(0=자동, manifest 그리드 사용)")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    target = Path(args.target)
    items, grid_cols = [], None
    if target.is_dir():
        icons_dir = target
        files = sorted(icons_dir.glob("*.png"))
        items = [(p.stem, None, None) for p in files]
    else:
        man = json.loads(target.read_text(encoding="utf-8"))
        icons_dir = target.parent / "icons"
        grid_cols = man["grid"]["cols"]
        items = [(i["name"], i["row"], i["col"]) for i in man["icons"]]

    cell = args.cell
    lblh = 16
    cols = args.cols or grid_cols or max(1, int(len(items) ** 0.5 + 0.5))
    rows = (len(items) + cols - 1) // cols
    sheet = checker(cols * cell, rows * (cell + lblh))

    from PIL import ImageDraw
    d = ImageDraw.Draw(sheet)
    for i, (name, r, c) in enumerate(items):
        gx, gy = (i % cols), (i // cols)
        x, y = gx * cell, gy * (cell + lblh)
        p = icons_dir / f"{name}.png"
        if p.exists():
            ic = Image.open(p).convert("RGBA").resize((cell - 8, cell - 8), Image.LANCZOS)
            sheet.alpha_composite(ic, (x + 4, y + 2))
        d.text((x + 3, y + cell), name[:14], fill=(40, 40, 40, 255))

    out = Path(args.out) if args.out else icons_dir.parent / "_contact.png"
    sheet.convert("RGB").save(out)
    print(f"[contact] {out}  ({len(items)}개)")


if __name__ == "__main__":
    main()
