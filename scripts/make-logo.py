# LOADOUT 로고 후처리 — 배경 제거(투명) + 정사각 트림 + favicon 생성
# 입력: 사용자가 준 원본 PNG / 출력: media/brand/logo.png(투명), media/brand/favicon.png
import sys, os
from PIL import Image, ImageDraw
import numpy as np

SRC = sys.argv[1] if len(sys.argv) > 1 else "0fb4d69a-768b-4722-a061-aed7a10660b1.png"
OUT_LOGO = "media/brand/logo.png"
OUT_FAV = "media/brand/favicon.png"
SENT = (255, 0, 255)   # 배경 표식용(이미지에 없을 색)
THRESH = int(sys.argv[2]) if len(sys.argv) > 2 else 210  # 흰/옅은 배경 + 그림자까지 제거(L1 거리). 아이콘은 색이 진해 보존됨.

img = Image.open(SRC).convert("RGBA")
w, h = img.size

# 1) 네 모서리에서 floodfill → 연결된 배경만 SENT로 칠함(아이콘 내부는 안 건드림)
rgb = img.convert("RGB")
for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
    ImageDraw.floodfill(rgb, seed, SENT, thresh=THRESH)

# 2) SENT로 칠해진 픽셀만 알파 0 (numpy 벡터화)
rgb_arr = np.array(rgb)
mask = np.all(rgb_arr == np.array(SENT), axis=-1)
out = np.array(img)
out[mask, 3] = 0
res = Image.fromarray(out, "RGBA")

# 3) 알파 기준으로 트림 후 정사각 캔버스에 가운데 배치(여백 소량)
alpha = res.split()[3]
bbox = alpha.getbbox()
if bbox:
    res = res.crop(bbox)
cw, ch = res.size
margin = int(max(cw, ch) * 0.04)
side = max(cw, ch) + margin * 2
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(res, ((side - cw) // 2, (side - ch) // 2), res)

os.makedirs("media/brand", exist_ok=True)
canvas.save(OUT_LOGO)
canvas.resize((64, 64), Image.LANCZOS).save(OUT_FAV)
print("logo:", OUT_LOGO, canvas.size, "| favicon:", OUT_FAV, "64x64 | removed bg px:", int(mask.sum()))
