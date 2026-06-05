// 첫 화면(점수 내림차순 상위 N개) 자산을 한국어로 미리 번역해 둔다.
// 서버(/api/translate)를 16개씩 호출 → data/translations.json에 적재. 서버가 떠 있어야 함.
// 사용: node scripts/pretranslate.mjs [limit]   (기본 60 = 첫 페이지)
const PORT = process.env.PORT || 4970;
const BASE = `http://localhost:${PORT}`;
const limit = Number(process.argv[2] || 60);

const idx = await (await fetch(`${BASE}/api/index`)).json();
const items = (idx.items || [])
  .slice()
  .sort((a, b) => b.score - a.score)
  .slice(0, limit)
  .filter((i) => !i.translated);

if (!items.length) { console.log("이미 모두 번역됨 — 할 일 없음"); process.exit(0); }
console.log(`첫 페이지 ${items.length}개 번역 시작 (16개씩)…`);

let done = 0;
for (let i = 0; i < items.length; i += 16) {
  const chunk = items.slice(i, i + 16);
  try {
    const res = await fetch(`${BASE}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: chunk.map((c) => c.id), engine: "claude" }),
    }).then((r) => r.json());
    if (res.ok) { done += res.count || 0; console.log(`  진행 ${done}/${items.length}`); }
    else console.warn(`  배치 실패: ${res.error}`);
  } catch (e) { console.warn(`  배치 오류: ${e.message}`); }
}
console.log(`✅ 완료 — ${done}개 번역됨`);
