#!/usr/bin/env python3
"""
icon_slicer.py — 어떤 스프라이트 시트(PNG)든 정확하게 잘라 개별 아이콘으로 만든다.

왜 단순 분할(W/N)로는 안 되나:
  - AI나 디자인툴이 만든 시트는 셀 간격이 일정하지 않다(서브픽셀/불균등).
  - 배경(흰색·단색)이나 '연한 회색 카드 프레임'이 깔려 있다.
  - 셀마다 아이콘 크기/위치가 미묘하게 다르다.
  → 균등 분할은 어긋나게 잘리고, 배경/프레임이 함께 묻어 나온다.

이 스크립트는 '내용 기반(content-aware)'으로 푼다:
  1) 배경 모드 자동 판별: alpha(이미 투명) / light(흰·밝은배경+회색프레임) / color(단색배경)
  2) 전경(아이콘) 마스크 생성 → 고립 잡티(despeckle) 제거
  3) 세로 여백으로 열을 가르고, 각 열 안에서 가로 여백으로 행을 갈라 그리드 검출
     (열을 먼저 가르므로 옆 칸의 큰 아이콘과 겹쳐 행이 합쳐지는 문제를 피한다)
  4) 각 셀에서 전경의 '무게중심'을 잡아 균일 크기 창으로 잘라 정렬
     (모든 아이콘을 같은 배율로 → 선 두께·상대 크기 보존, 시각적으로 가운데)
  5) 배경 투명화 + 색 디컨태미네이션(흰/회색 프린지 제거) + 업스케일 선명도 보정

산출물:
  <out>/icons/<name>.png   개별 아이콘(투명, 정사각, 목표 크기)
  <out>/atlas.png          완벽히 균등한 그리드로 재배치한 깨끗한 시트(W/N 코드 드롭인 교체용)
  <out>/manifest.json      그리드/셀/아이콘 좌표 메타데이터

의존성: pillow, numpy, scipy
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


# ─────────────────────────────────────────────────────────────────────────────
# 배경 모드 판별
# ─────────────────────────────────────────────────────────────────────────────
def estimate_corner_color(rgb: np.ndarray, sample: int = 8) -> np.ndarray:
    s = sample
    patches = np.concatenate([
        rgb[:s, :s].reshape(-1, 3), rgb[:s, -s:].reshape(-1, 3),
        rgb[-s:, :s].reshape(-1, 3), rgb[-s:, -s:].reshape(-1, 3),
    ])
    return np.median(patches, axis=0)


def detect_bg_mode(rgba: np.ndarray) -> str:
    """입력을 보고 배경 처리 방식을 자동 선택.

    - alpha : 이미 알파 채널에 의미있는 투명도가 있다(게임 스프라이트 등).
    - light : 모서리가 밝다(흰/연회색 배경 + 카드 프레임 케이스).
    - color : 모서리가 어둡거나 채도 있는 단색 배경.
    """
    alpha = rgba[..., 3]
    if (alpha < 250).mean() > 0.05:
        return "alpha"
    corner = estimate_corner_color(rgba[..., :3])
    return "light" if corner.mean() >= 200 else "color"


# ─────────────────────────────────────────────────────────────────────────────
# 전경 마스크 / 매팅 (모드별)
# ─────────────────────────────────────────────────────────────────────────────
def background_mask_light(rgb, light_thr, sat_thr):
    """배경 = 밝고(고휘도) 채도 낮은 픽셀. 흰 바탕 + 연회색 카드 프레임을 함께 잡는다.
    아이콘 획은 어둡거나 채도가 높아 이 조건에 안 걸리므로 프레임만 깔끔히 떨어진다."""
    rgb = rgb.astype(np.int16)
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    return (lum >= light_thr) & (sat <= sat_thr)


def foreground_mask(rgba, mode, *, light_thr, sat_thr, color_tol, alpha_thr):
    rgb = rgba[..., :3]
    if mode == "alpha":
        return rgba[..., 3] > alpha_thr
    if mode == "color":
        bg = estimate_corner_color(rgb)
        return np.abs(rgb.astype(int) - bg).sum(axis=2) > color_tol
    # light
    return ~background_mask_light(rgb, light_thr, sat_thr)


def matte(rgba, mode, fg, *, light_thr, sat_thr, color_tol, edge_lo=0.12, edge_hi=0.85):
    """배경 투명화 + 색 디컨태미네이션.
    관측 O = a·F + (1-a)·BG → 알파 a 추정 후 전경색 F를 역산해 프린지를 없앤다."""
    out = rgba.astype(np.float32)
    rgb = out[..., :3]
    if mode == "alpha":
        out[..., 3] = np.where(fg, out[..., 3], 0)
        return out.astype(np.uint8)

    if mode == "color":
        bg = estimate_corner_color(rgba[..., :3]).astype(np.float32)
    else:  # light → 흰색 기준
        bg = np.array([255.0, 255.0, 255.0])

    if not fg.any():
        out[..., 3] = 0
        return out.astype(np.uint8)
    dist = np.abs(rgb - bg).sum(axis=2)
    ref = max(float(np.percentile(dist[fg], 90)), 1.0)
    alpha = np.clip(dist / ref, 0.0, 1.0)
    alpha[~fg] = 0.0
    # 가장자리 정리: 아주 옅은 알파(프린지/노이즈)는 잘라내고 경계를 단단히 한다.
    # 옅은 알파를 남기면 그 위에서 색 역산이 노이즈를 증폭시켜 speckle가 생긴다.
    alpha = np.clip((alpha - edge_lo) / max(edge_hi - edge_lo, 1e-3), 0.0, 1.0)
    # 색 역산은 알파가 충분히 단단한 곳에서만 (낮은 알파에서 1/a 증폭 방지).
    a = alpha[..., None]
    solid = a > 0.5
    F = np.where(solid, (rgb - (1 - a) * bg) / np.where(solid, a, 1), rgb)
    out[..., :3] = np.clip(F, 0, 255)
    a_out = out[..., 3] * alpha
    # 알파 디스페클: 본체와 떨어진 작은 반점(매팅 잔재)을 제거. 얇은 획은 본체에
    # 연결돼 있어 큰 컴포넌트라 보존되고, 고립된 ≤5px 점만 사라진다.
    st = ndimage.generate_binary_structure(2, 2)
    lbl, n = ndimage.label(a_out > 20, structure=st)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(lbl), lbl, range(1, n + 1))
        small = np.concatenate([[False], sizes < 6])[lbl]
        a_out[small] = 0
    out[..., 3] = a_out
    return out.astype(np.uint8)


# ─────────────────────────────────────────────────────────────────────────────
# 그리드 검출 (투영 기반 길로틴)
# ─────────────────────────────────────────────────────────────────────────────
def projection_blocks(proj, min_gap, min_size):
    on = proj > 0
    blocks, start, gap = [], None, 0
    for i, v in enumerate(on):
        if v:
            if start is None:
                start = i
            gap = 0
        else:
            if start is not None:
                gap += 1
                if gap >= min_gap:
                    blocks.append((start, i - gap))
                    start, gap = None, 0
    if start is not None:
        blocks.append((start, len(on) - 1))
    return [b for b in blocks if b[1] - b[0] + 1 >= min_size]


def kmeans_1d(values, k, iters=50):
    v = np.sort(np.asarray(values, dtype=float))
    if len(v) <= k:
        return list(v) + [v[-1]] * (k - len(v))
    centers = np.quantile(v, np.linspace(0, 1, k))
    for _ in range(iters):
        idx = np.abs(v[:, None] - centers[None, :]).argmin(axis=1)
        new = centers.copy()
        for j in range(k):
            sel = v[idx == j]
            if len(sel):
                new[j] = sel.mean()
        if np.allclose(new, centers):
            break
        centers = new
    return sorted(centers.tolist())


def centers_to_bounds(centers, lo, hi):
    bounds = [lo]
    for a, b in zip(centers, centers[1:]):
        bounds.append(int(round((a + b) / 2)))
    bounds.append(hi)
    return [(bounds[i], bounds[i + 1]) for i in range(len(centers))]


def detect_grid(fg, cols, rows, min_gap, min_size):
    H, W = fg.shape
    col_blocks = projection_blocks(fg.sum(axis=0), min_gap, min_size)
    if cols is None:
        cols = len(col_blocks)
    col_centers = sorted((a + b) / 2 for a, b in col_blocks)
    if len(col_centers) != cols:
        col_centers = kmeans_1d(col_centers, cols)

    row_pts, per_col = [], []
    for a, b in col_blocks:
        rb = projection_blocks(fg[:, a:b + 1].sum(axis=1), min_gap, min_size)
        per_col.append(len(rb))
        row_pts.extend((y0 + y1) / 2 for y0, y1 in rb)
    if rows is None:
        vals, cnts = np.unique(per_col, return_counts=True)
        rows = int(vals[cnts.argmax()]) if len(vals) else 1
    row_centers = kmeans_1d(row_pts, rows) if row_pts else [H / 2] * rows

    return rows, cols, centers_to_bounds(row_centers, 0, H), centers_to_bounds(col_centers, 0, W)


# ─────────────────────────────────────────────────────────────────────────────
# 셀 크롭 (무게중심 + 균일 크기)
# ─────────────────────────────────────────────────────────────────────────────
def tight_bbox(cell_fg):
    ys, xs = np.where(cell_fg)
    if len(xs) == 0:
        return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def cell_bbox(fg, ry, rx):
    y0, y1 = ry
    x0, x1 = rx
    bb = tight_bbox(fg[y0:y1, x0:x1])
    if bb is None:
        return None
    bx0, by0, bx1, by1 = bb
    return x0 + bx0, y0 + by0, x0 + bx1, y0 + by1


def content_centroid(fg, ry, rx):
    y0, y1 = ry
    x0, x1 = rx
    ys, xs = np.where(fg[y0:y1, x0:x1])
    if len(xs) == 0:
        return None
    return y0 + ys.mean(), x0 + xs.mean()


def place_window(rgba, cy, cx, box):
    H, W = rgba.shape[:2]
    half = box / 2.0
    top, left = int(round(cy - half)), int(round(cx - half))
    out = np.zeros((box, box, 4), dtype=np.uint8)
    sy0, sx0 = max(0, top), max(0, left)
    sy1, sx1 = min(H, top + box), min(W, left + box)
    out[sy0 - top:sy0 - top + (sy1 - sy0), sx0 - left:sx0 - left + (sx1 - sx0)] = rgba[sy0:sy1, sx0:sx1]
    return out


# ─────────────────────────────────────────────────────────────────────────────
# main
# ─────────────────────────────────────────────────────────────────────────────
def main(argv=None):
    ap = argparse.ArgumentParser(description="스프라이트 시트를 정확히 잘라 아이콘화한다")
    ap.add_argument("input", help="입력 스프라이트 PNG")
    ap.add_argument("--out", default="build/icons", help="출력 디렉토리")
    ap.add_argument("--cols", type=int, default=None, help="열 개수(미지정 시 자동검출)")
    ap.add_argument("--rows", type=int, default=None, help="행 개수(미지정 시 자동검출)")
    ap.add_argument("--size", type=int, default=128, help="개별 아이콘 출력 크기(px)")
    ap.add_argument("--bg", choices=["auto", "alpha", "light", "color"], default="auto",
                    help="배경 처리 모드(기본 auto). alpha=이미투명, light=흰배경+회색프레임, color=단색배경")
    ap.add_argument("--light-thr", type=int, default=232,
                    help="[light] 이 휘도 이상+저채도면 배경(흰바탕·연회색프레임)")
    ap.add_argument("--sat-thr", type=int, default=18,
                    help="[light] 이 채도 이하+고휘도면 배경. 색 있는 획은 보존")
    ap.add_argument("--color-tol", type=int, default=60,
                    help="[color] 모서리색과 이 거리 이내면 배경")
    ap.add_argument("--alpha-thr", type=int, default=32,
                    help="[alpha] 이 알파 초과면 전경")
    ap.add_argument("--pad", type=float, default=0.08, help="정사각 패딩 비율(작을수록 꽉 참)")
    ap.add_argument("--sharpen", type=float, default=0.6,
                    help="업스케일 보정 언샤프 강도(0=끔)")
    ap.add_argument("--edge-lo", type=float, default=0.12,
                    help="이 알파 미만의 옅은 가장자리(프린지/노이즈)는 잘라냄. 높이면 더 선명/하드")
    ap.add_argument("--edge-hi", type=float, default=0.85,
                    help="이 알파 이상은 불투명으로 포화. 낮추면 획이 더 단단해짐")
    ap.add_argument("--min-gap", type=int, default=5, help="셀 경계로 볼 최소 여백(px)")
    ap.add_argument("--min-size", type=int, default=12, help="최소 블록 크기(px)")
    ap.add_argument("--min-area", type=int, default=8, help="이 픽셀수 미만 고립 잡티 제거")
    ap.add_argument("--names", default=None,
                    help='이름 매핑 JSON ({"row,col":"name"} 또는 [["name",col,row],...])')
    ap.add_argument("--no-atlas", action="store_true", help="atlas.png 생성 안 함")
    ap.add_argument("--keep-bg", action="store_true", help="배경 투명화 안 함")
    ap.add_argument("--fit-cell", action="store_true",
                    help="아이콘마다 셀에 꽉 차게 리스케일(상대크기 깨짐). 기본은 균일 스케일")
    args = ap.parse_args(argv)

    src = Path(args.input)
    if not src.exists():
        sys.exit(f"입력 파일 없음: {src}")
    rgba = np.array(Image.open(src).convert("RGBA"))
    H, W = rgba.shape[:2]

    mode = detect_bg_mode(rgba) if args.bg == "auto" else args.bg
    print(f"[bg] 모드={mode}  (원본 {W}×{H})")

    fg = foreground_mask(rgba, mode, light_thr=args.light_thr, sat_thr=args.sat_thr,
                         color_tol=args.color_tol, alpha_thr=args.alpha_thr)

    if args.min_area > 0:
        st = ndimage.generate_binary_structure(2, 2)
        lbl, n = ndimage.label(fg, structure=st)
        if n:
            sizes = ndimage.sum(np.ones_like(lbl), lbl, range(1, n + 1))
            removed = int((sizes < args.min_area).sum())
            fg = np.concatenate([[False], sizes >= args.min_area])[lbl]
            if removed:
                print(f"[despeckle] 잡티 {removed}개 제거 (<{args.min_area}px)")

    rows, cols, row_cells, col_cells = detect_grid(fg, args.cols, args.rows,
                                                   args.min_gap, args.min_size)
    if rows < 1 or cols < 1:
        sys.exit(f"그리드 검출 실패 (rows={rows}, cols={cols}). --cols/--rows로 직접 지정하세요.")
    print(f"[grid] {cols}열 × {rows}행")

    names = {}
    if args.names:
        data = json.loads(Path(args.names).read_text(encoding="utf-8"))
        if isinstance(data, dict):
            for k, v in data.items():
                r, c = (int(x) for x in k.replace(" ", "").split(","))
                names[(r, c)] = v
        else:
            for e in data:
                names[(int(e[2]), int(e[1]))] = e[0]

    out_dir = Path(args.out)
    icons_dir = out_dir / "icons"
    icons_dir.mkdir(parents=True, exist_ok=True)

    cells = {}
    for r in range(rows):
        for c in range(cols):
            bb = cell_bbox(fg, row_cells[r], col_cells[c])
            if bb is not None:
                cells[(r, c)] = bb

    dims = [max(x1 - x0, y1 - y0) for (x0, y0, x1, y1) in cells.values()]
    p98 = float(np.percentile(dims, 98)) if dims else 1.0
    gbox = max(1, int(round(p98 * (1 + 2 * args.pad))))

    manifest = {"source": src.name, "bg_mode": mode,
                "grid": {"cols": cols, "rows": rows}, "size": args.size, "icons": []}
    atlas = None if args.no_atlas else np.zeros((rows * args.size, cols * args.size, 4), np.uint8)

    saved = 0
    for (r, c), bb in cells.items():
        if args.fit_cell:
            bx0, by0, bx1, by1 = bb
            ih, iw = by1 - by0, bx1 - bx0
            side = max(ih, iw)
            pad = int(round(side * args.pad))
            canvas = side + 2 * pad
            icon = np.zeros((canvas, canvas, 4), np.uint8)
            oy, ox = pad + (side - ih) // 2, pad + (side - iw) // 2
            icon[oy:oy + ih, ox:ox + iw] = rgba[by0:by1, bx0:bx1]
            fg_icon = None
        else:
            cy, cx = content_centroid(fg, row_cells[r], col_cells[c])
            icon = place_window(rgba, cy, cx, gbox)
            fg_icon = place_window(np.dstack([fg, fg, fg, fg]).astype(np.uint8) * 255,
                                   cy, cx, gbox)[..., 0] > 0

        if not args.keep_bg:
            if fg_icon is None:
                fg_icon = foreground_mask(icon, mode, light_thr=args.light_thr,
                                          sat_thr=args.sat_thr, color_tol=args.color_tol,
                                          alpha_thr=args.alpha_thr)
            icon = matte(icon, mode, fg_icon, light_thr=args.light_thr,
                         sat_thr=args.sat_thr, color_tol=args.color_tol,
                         edge_lo=args.edge_lo, edge_hi=args.edge_hi)

        pim = Image.fromarray(icon, "RGBA").resize((args.size, args.size), Image.LANCZOS)
        if args.sharpen > 0:
            pim = pim.filter(ImageFilter.UnsharpMask(radius=1.2,
                             percent=int(args.sharpen * 100), threshold=0))
        name = names.get((r, c), f"r{r:02d}_c{c:02d}")
        pim.save(icons_dir / f"{name}.png")
        if atlas is not None:
            atlas[r * args.size:(r + 1) * args.size,
                  c * args.size:(c + 1) * args.size] = np.array(pim)
        manifest["icons"].append({"name": name, "row": r, "col": c})
        saved += 1

    if atlas is not None:
        Image.fromarray(atlas, "RGBA").save(out_dir / "atlas.png")
        print(f"[atlas] {out_dir/'atlas.png'} ({cols*args.size}×{rows*args.size})")
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[done] 아이콘 {saved}개 → {icons_dir}")


if __name__ == "__main__":
    main()
