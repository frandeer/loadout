/* ===== Loadout 프론트엔드 (바닐라 JS) ===== */
const RARITY = {
  legendary: { ko: "S-CLASS", c: "var(--r-legendary)", g: "var(--r-legendary-glow)" },
  epic:      { ko: "A-CLASS", c: "var(--r-epic)", g: "var(--r-epic-glow)" },
  rare:      { ko: "B-CLASS", c: "var(--r-rare)", g: "var(--r-rare-glow)" },
  uncommon:  { ko: "C-CLASS", c: "var(--r-uncommon)", g: "var(--r-uncommon-glow)" },
  common:    { ko: "D-CLASS", c: "var(--r-common)", g: "var(--r-common-glow)" },
};
const PAGE = 60;

// 즐겨찾기: localStorage 영속(서버 상태와 무관한 개인 표식). 파싱 실패 시 빈 집합으로 폴백.
const FAV_KEY = "loadout-fav";
const loadFavSet = () => { try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch { return new Set(); } };

const state = {
  all: [], meta: {},
  kind: "all", rarity: "all", q: "", sort: "score",
  dupOnly: false, equipOnly: false, favOnly: false,
  filtered: [], shown: PAGE, selected: null,
  picked: new Set(),          // 일괄 이미지 생성용 다중 선택(체크박스). selected(단일 상세선택)와 별개.
  fav: loadFavSet(),          // 즐겨찾기한 id 집합(localStorage 영속).
  aiEngine: "heuristic", engines: ["heuristic"],
  lang: "en",                 // 표시 언어: ko(한국어 번역본 우선) | en(원문). 기본=원문(영어).
  docCache: {},               // id → 원본 전체 내용 캐시(/api/content)
  theme: localStorage.getItem("loadout-theme") || "light",
  font: "pretendard",
  sources: { roots: [], repos: [] },
};
const ENGINE_LABEL = { heuristic: "휴리스틱(즉시)", claude: "Claude", codex: "Codex", gemini: "Gemini", grok: "Grok" };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => (s || "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

// 표시용 이름/설명 — 한국어 모드면 번역본(nameKo/descKo) 우선, 없으면 원문으로 폴백.
// 원문(name/description)은 절대 덮어쓰지 않는다. 번역본은 서버가 별도 파일로 관리.
const dispName = (it) => (state.lang === "ko" && it.nameKo) ? it.nameKo : it.displayName;
const dispDesc = (it) => (state.lang === "ko" && it.descKo) ? it.descKo : it.description;

// 카드용 한 줄 요약 — 설명에서 "Use when …/사용 시점" 같은 트리거 군더더기를 떼고
// 첫 문장만 추려 짧게. (카드는 요약만, 전체 내용은 상세보기/더보기에서.)
function summarize(text, max = 110) {
  let s = (text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  // 트리거/사용처 안내 절은 카드에서 잘라낸다(요약 가독성).
  s = s.replace(/\s*(Use (this )?(skill )?when|Trigger|사용 시점|사용할 때|이럴 때 사용|언제 사용)\b.*$/i, "").trim() || s;
  const stop = s.search(/[.。!?！？]\s|[.。!?！?]$|\n/);
  if (stop > 24) s = s.slice(0, stop + 1).trim();
  if (s.length > max) s = s.slice(0, max - 1).trimEnd() + "…";
  return s;
}

// 여러 핸들러에서 반복되던 사이드 패널 3종 렌더 + 언어 버튼 라벨 동기화 헬퍼.
const renderSides = () => { renderRoster(); renderFormation(); renderEquipmentStrip(); };
const syncLangButton = () => { const b = $("#langToggle"); if (b) b.textContent = state.lang === "ko" ? "🌐 한국어" : "🌐 원문(EN)"; };

function iconFor(it) {
  if (it.kind === "agent") return "요원";
  if (it.kind === "mcp") return "모듈";
  const t = (it.name + " " + it.category + " " + it.description).toLowerCase();
  const map = [["pdf",  "문서"],["doc","문서"],["design","설계"],["debug","수리"],["test","검증"],["security","방패"],
    ["game","게임"],["data","자료"],["web","웹"],["api","연결"],["git","관리"],["deploy","출정"],["image","그림"],
    ["music|audio","음향"],["video","영상"],["ml|ai|model","비전"],["search","탐색"],["plan","책략"],["write|doc","집필"],
    ["memory","기억"],["slide","발표"],["review","감정"]];
  for (const [k, e] of map) if (new RegExp(k).test(t)) return e;
  return "자산";
}

/* ---------- 데이터 로드 ---------- */
// 인덱스 데이터를 상태에 반영하고 전체 화면을 다시 그린다(최초 로드 + 실시간 재반영 공용).
function setData(data) {
  state.all = data.items || [];
  state.meta = data;
  // 요소가 있을 때만 갱신(우측 카운터 rc-* 는 제거됨 → null 가드).
  const setTxt = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
  setTxt("#rc-skill", (data.counts?.skill || 0).toLocaleString());
  setTxt("#rc-agent", (data.counts?.agent || 0).toLocaleString());
  setTxt("#rc-mcp", (data.counts?.mcp || 0).toLocaleString());
  setTxt("#rc-leg", state.all.filter((i) => i.rarity === "legendary").length.toLocaleString());
  setTxt("#hsTotal", (data.total || state.all.length).toLocaleString());
  setTxt("#hsDup", (data.dupGroups || 0).toLocaleString());
  renderSides();
  apply();
}

// /api/index 재요청 → 화면 즉시 갱신(소스 추가/삭제/clone 후 실시간 반영).
async function reload() {
  try {
    const r = await fetch("/api/index");
    if (!r.ok) throw 0;
    const data = await r.json();
    // 선택/번역 상태가 유실되지 않도록 selected는 유지
    setData(data);
    if (state.selected && state.all.some((i) => i.id === state.selected)) select(state.selected);
  } catch (e) { toast("인덱스 새로고침 실패 (서버 필요)", true); }
}

async function load() {
  let data;
  try {
    const r = await fetch("/api/index");
    if (!r.ok) throw 0;
    data = await r.json();
  } catch {
    try { data = await (await fetch("../../data/index.json")).json(); }
    catch { $("#loader").innerHTML = "<div style='color:#ff5d6c'>data/index.json 을 불러오지 못했습니다.<br>서버(node src/server.mjs)로 실행하세요.</div>"; return; }
  }
  // 사용 가능한 AI 엔진(번역/검증) 탐지 — 첫 렌더 전에 확보
  try {
    const e = await (await fetch("/api/engines")).json();
    if (e.engines?.length) {
      state.engines = e.engines;
      state.aiEngine = e.engines.includes("claude") ? "claude" : (e.engines.find((x) => x !== "heuristic") || "heuristic");
    }
  } catch {}
  setData(data);
  $("#loader").style.display = "none";
}

/* ---------- 소스 관리 패널 ---------- */
async function renderSources() {
  const box = $("#srcList");
  if (!box) return;
  box.innerHTML = "<div class='hint'>불러오는 중…</div>";
  let s;
  try { s = await (await fetch("/api/sources")).json(); }
  catch { box.innerHTML = "<div class='hint'>소스 목록을 불러오지 못했습니다 (서버 필요).</div>"; return; }
  state.sources = s;
  box.innerHTML = (s.roots || []).map((r) => `
    <div class="src-item ${r.exists ? "" : "missing"}">
      <div class="src-meta">
        <b>${esc(r.path)}</b>
        <small>${r.claude ? "🏠 ~/.claude · " : ""}${r.exists ? `${(r.count || 0).toLocaleString()}개 자산` : "경로 없음"}</small>
      </div>
      <button class="btn sm" onclick="LO.removeSource('${esc(r.path).replace(/\\/g, "\\\\")}')">제거</button>
    </div>`).join("") || "<div class='hint'>등록된 소스가 없습니다.</div>";
}

/* ---------- 필터/정렬 ---------- */
function apply() {
  let xs = state.all;
  if (state.kind !== "all") xs = xs.filter((i) => i.kind === state.kind);
  if (state.rarity !== "all") xs = xs.filter((i) => i.rarity === state.rarity);
  if (state.dupOnly) xs = xs.filter((i) => i.group);
  if (state.equipOnly) xs = xs.filter((i) => i.equipped);
  if (state.favOnly) xs = xs.filter((i) => state.fav.has(i.id));
  if (state.q) {
    const q = state.q.toLowerCase();
    // 원문 + 한국어 번역본 + 저장소 모두에서 검색되도록.
    xs = xs.filter((i) => (i.name + " " + i.description + " " + (i.nameKo || "") + " " + (i.descKo || "") + " " + i.source.repo).toLowerCase().includes(q));
  }
  const s = state.sort;
  xs = [...xs].sort((a, b) =>
    s === "name" ? a.name.localeCompare(b.name, "ko")
      : (b.stats?.[s] ?? b.score) - (a.stats?.[s] ?? a.score) || b.score - a.score);
  state.filtered = xs;
  state.shown = PAGE;
  renderGrid();
}

/* ---------- 카드 그리드 ---------- */
function cardHTML(it) {
  const r = RARITY[it.rarity] || RARITY.common;
  
  // Calculate level based on power
  const lvl = Math.max(1, Math.round((it.stats?.power || 50) / 12));
  const maxExp = lvl === 7 ? 50 : lvl === 6 ? 40 : lvl === 5 ? 30 : lvl === 4 ? 25 : lvl === 3 ? 20 : lvl === 2 ? 15 : 10;
  const curExp = Math.max(1, Math.min(maxExp - 1, Math.round((it.stats?.popularity || 40) / 100 * maxExp)));

  const kindKo = it.kind === "skill" ? "스킬" : it.kind === "agent" ? "요원" : "모듈";
  const art = it.image ? `<img src="${esc(it.image)}" alt="">` : `<span class="fallback-icon">${iconFor(it)}</span>`;
  const isFav = state.fav.has(it.id);

  return `<div class="card r-${it.rarity} ${it.equipped ? "is-equipped" : ""} animate__animated animate__fadeIn" style="--rc:${r.c}" data-id="${esc(it.id)}">
    <div class="card-inner">
      <div class="card-header">
        <div class="card-meta">
          <span class="kind-text">${kindKo}</span>
        </div>
        <div class="card-status">
          <span class="status-dot" style="background:${it.equipped ? 'var(--rc)' : '#565e56'}"></span>
        </div>
        <div class="card-actions">
          ${it.group ? '<div class="newbadge" title="중복 후보 있음">복수</div>' : ""}
          <button type="button" class="card-fav ${isFav ? "is-fav" : ""}" data-id="${esc(it.id)}" title="즐겨찾기" aria-pressed="${isFav}">★</button>
          <input type="checkbox" class="card-pick" data-id="${esc(it.id)}" ${state.picked.has(it.id) ? "checked" : ""} title="일괄 이미지 생성에 포함">
        </div>
      </div>
      
      <div class="art">${art}</div>
      
      <div class="body">
        <div class="nm">${esc(dispName(it))}</div>
        <div class="card-desc">${esc(summarize(dispDesc(it))) || "<span style='color:var(--dim)'>설명 없음</span>"}</div>
        <div class="card-progress">
          <span class="lv">LV.${lvl}</span>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width:${(curExp/maxExp)*100}%; background: var(--rc)"></div>
          </div>
          <span class="exp">${curExp}/${maxExp}</span>
        </div>
      </div>
      
      ${it.equipped ? '<div class="equipped-badge">장착 중</div>' : ""}
    </div>
  </div>`;
}

function renderGrid() {
  const grid = $("#grid");
  const slice = state.filtered.slice(0, state.shown);
  grid.innerHTML = slice.map(cardHTML).join("");
  $("#hsShown").textContent = state.filtered.length.toLocaleString();
  $("#hsEquip").textContent = state.all.filter((i) => i.equipped).length;
  $("#gridMeta").textContent = `${state.filtered.length.toLocaleString()}개 중 ${slice.length.toLocaleString()} 표시`;
  $("#loadMore").style.display = state.shown < state.filtered.length ? "block" : "none";
  $("#emptyNote").style.display = state.filtered.length ? "none" : "block";
  $$(".card", grid).forEach((el) => el.onclick = () => select(el.dataset.id));
  // 체크박스: 카드 선택(상세) 이벤트와 분리(stopPropagation) — 일괄 생성 대상 토글.
  $$(".card-pick", grid).forEach((cb) => cb.onclick = (e) => { e.stopPropagation(); togglePick(cb.dataset.id, cb.checked); });
  updateBatchBar();
  if (state.selected) $(`.card[data-id="${cssEsc(state.selected)}"]`)?.classList.add("sel");
  else if (slice.length) queueMicrotask(() => select(slice[0].id));
}
const cssEsc = (s) => s.replace(/["\\]/g, "\\$&");
function kindLabel(kind) {
  return kind === "skill" ? "자산" : kind === "agent" ? "요원" : kind === "mcp" ? "모듈" : "자산";
}

/* ---------- 일괄 이미지 생성 (체크박스 선택 → 순차 처리) ---------- */
function togglePick(id, on) { if (on) state.picked.add(id); else state.picked.delete(id); updateBatchBar(); }
function clearPicks() { state.picked.clear(); renderGrid(); }
function pickAllVisible() {
  const ids = state.filtered.slice(0, state.shown).map((i) => i.id);
  const allOn = ids.length && ids.every((id) => state.picked.has(id));
  ids.forEach((id) => allOn ? state.picked.delete(id) : state.picked.add(id));
  renderGrid();
}
function updateBatchBar() {
  const bar = $("#batchBar"); if (!bar) return;
  const n = state.picked.size;
  bar.style.display = n > 0 ? "flex" : "none";
  const c = $("#batchCount"); if (c) c.textContent = `${n}개 선택`;
}
function updateCardArt(id, url) {
  const el = $(`.card[data-id="${cssEsc(id)}"] .art`);
  if (el) el.innerHTML = `<img src="${esc(url)}" alt="">`;
}
function markCardBusy(id, on) { $(`.card[data-id="${cssEsc(id)}"]`)?.classList.toggle("gen-busy", on); }

let batchRunning = false;
async function batchGenerate() {
  if (batchRunning) return toast("이미 일괄 생성 중입니다", true);
  const items = [...state.picked].map((id) => state.all.find((i) => i.id === id)).filter(Boolean);
  if (!items.length) return toast("선택된 카드가 없습니다", true);
  const engine = $("#batchEngine .preset.on")?.dataset.engine || "chatgpt";
  batchRunning = true;
  const goBtn = $("#batchGo"); if (goBtn) goBtn.disabled = true;
  let ok = 0, fail = 0;
  // 순차 처리: ChatGPT/Grok 탭 하나를 차례로 사용해 충돌·제한을 피한다. 각 건은 서버가 즉시 영구 저장.
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    toast(`🪄 일괄 생성 ${i + 1}/${items.length} — ${dispName(it)} (${engine === "grok" ? "Grok" : "ChatGPT"})`);
    markCardBusy(it.id, true);
    try {
      const res = await api("/api/generate", { prompt: promptFor("card", it), expectedCount: 1, imageEngine: engine, itemId: it.id });
      if (res.ok && res.images?.length) { it.image = bust(res.images[0].url); updateCardArt(it.id, it.image); ok++; }
      else { fail++; toast(`⚠️ ${dispName(it)} 실패 — ${res.error || "생성 실패"}`, true); }
    } catch (e) { fail++; toast(`⚠️ ${dispName(it)} 오류 — ${e.message}`, true); }
    markCardBusy(it.id, false);
  }
  batchRunning = false;
  if (goBtn) goBtn.disabled = false;
  toast(`✅ 일괄 생성 완료 — 성공 ${ok}개, 실패 ${fail}개 / 총 ${items.length}개. 새로고침해도 유지됩니다.`);
}

/* ---------- 상세 패널 ---------- */
const STAT_HELP = {
  "신뢰도": "소스 저장소의 인지도(GitHub 스타 등). 많이 쓰일수록 높음 (0~99).",
  "작전력": "복잡도·기능량 — 도구 수·본문 분량·참조 수로 추정 (0~99).",
  "명확도": "설명 품질 — 이름·설명·예시가 잘 갖춰졌는지 (0~99).",
  "신선도": "최근 업데이트 정도 — git 마지막 커밋이 최근일수록 높음 (0~99).",
  "무게": "용량·토큰 비용 — 낮을수록 가볍다 (0~99).",
  "AI 유용성": "AI가 채점한 실제 유용성 (검증 실행 시).",
  "AI 우세도": "같은 이름 카드들 중 얼마나 우세한지 (검증 실행 시).",
};
function bar(label, val, ai = false) {
  const help = (STAT_HELP[label] || "").replace(/"/g, "&quot;");
  return `<div class="sbar ${ai ? "ai" : ""}"><span class="sl" title="${help}">${label}</span>
    <div class="track"><div class="fill" style="width:${val}%"></div></div><span class="sv">${val}</span></div>`;
}
function select(id) {
  const it = state.all.find((i) => i.id === id);
  if (!it) return;
  state.selected = id;
  $$(".card.sel").forEach((e) => e.classList.remove("sel"));
  $(`.card[data-id="${cssEsc(id)}"]`)?.classList.add("sel");
  const r = RARITY[it.rarity] || RARITY.common;
  const st = it.stats || {};
  const v = it.verdict;
  const dupGroup = it.group ? state.all.filter((x) => x.group === it.group && x.id !== it.id) : [];
  const art = it.image ? `<img src="${esc(it.image)}">` : iconFor(it);
  $("#detail").innerHTML = `
    <div class="bigcard r-${it.rarity} animate__animated animate__fadeInRight" style="--rc:${r.c}">
      <div class="bi"><div class="bart">${art}</div>
        <div class="bmeta">
          <div class="kind">${it.kind === "skill" ? "기밀 자산" : it.kind === "agent" ? "작전 요원" : "지원 모듈"}${it.installed ? ' · <span style="color:var(--r-rare)">설치됨</span>' : ""}</div>
          <h3>${esc(dispName(it))}</h3>
          <span class="rarity-pill" style="background:${r.g};color:${r.c}">${r.ko} · ${it.score}점</span>
        </div></div>
    </div>
    ${state.lang === "ko" && it.translated && it.descKo ? `<div class="desc">${esc(it.descKo)}</div><details class="orig"><summary>원문 보기</summary><div class="desc dim">${esc(it.description) || "설명이 없습니다."}</div></details>`
      : `<div class="desc">${esc(dispDesc(it)) || "설명이 없습니다."}</div>`}
    <div class="stat-bars">
      ${bar("신뢰도", st.popularity ?? 0)}
      ${bar("작전력", st.power ?? 0)}
      ${bar("명확도", st.clarity ?? 0)}
      ${bar("신선도", st.freshness ?? 0)}
      ${bar("무게", st.weight ?? 0)}
      ${v ? bar("AI 유용성", v.usefulness, true) + bar("AI 우세도", v.dominance, true) : ""}
    </div>
    <div class="kv"><span>소스</span><b title="${esc(it.source.repo)}">${esc(it.source.owner)}/${esc(it.source.repo)}</b></div>
    <div class="kv"><span>경로</span><b title="${esc(it.source.path)}">${esc(it.source.path)}</b></div>
    ${it.meta?.model ? `<div class="kv"><span>모델</span><b>${esc(it.meta.model)}</b></div>` : ""}
    ${it.meta?.allowedTools ? `<div class="kv"><span>도구</span><b>${esc([].concat(it.meta.allowedTools).join(", "))}</b></div>` : ""}
    ${dupGroup.length ? `<div class="dup-hint">동일 계열 자산 <b>${dupGroup.length + 1}개</b> 감지. 우세 분석으로 투입 우선순위를 판정하세요.</div>` : ""}
    <div class="actions">
      ${it.installed
        ? `<button class="btn equipped" disabled title="이미 ~/.claude 에 설치되어 바로 사용 가능">✓ 설치됨 (사용 가능)</button>`
        : `<button class="btn ${it.equipped ? "equipped" : "primary"}" onclick="LO.equip('${esc(it.id)}')">${it.equipped ? "투입 해제" : "작전 투입"}</button>`}
      <div class="engine-pick">
        <span>감정 방식</span>
        <select id="aiEngine" onchange="LO.setEngine(this.value)">
          ${state.engines.map((e) => `<option value="${e}" ${e === state.aiEngine ? "selected" : ""}>${ENGINE_LABEL[e] || e}</option>`).join("")}
        </select>
      </div>
      <div class="btn-row2">
        <button class="btn ai sm" onclick="LO.verify('${esc(it.id)}')">신호 감정</button>
        <button class="btn sm" onclick="LO.translate('${esc(it.id)}')" title="선택한 엔진으로 이름·설명을 한국어로 번역(번역본은 별도 저장)">${it.translated ? "한국어 재번역" : "한국어 번역"}</button>
      </div>
      <div class="btn-row2">
        <button class="btn sm" onclick="LO.openImg('${esc(it.id)}')">ChatGPT 이미지 생성</button>
        ${dupGroup.length ? `<button class="btn sm" onclick="LO.compare('${esc(it.id)}')">우세 분석</button>` : ""}
      </div>
    </div>
    <div class="doc-section">
      <div class="doc-section-head">
        <span class="doc-section-title">전체 내용</span>
        <button class="btn sm doc-more" type="button" onclick="LO.openDoc('${esc(it.id)}')" title="GitBook 스타일 팝업으로 크게 보기">더보기 ⤢</button>
      </div>
      <div class="doc-inline markdown-body" id="detailDoc"><div class="doc-loading">전체 내용 불러오는 중…</div></div>
    </div>`;
  loadDetailDoc(it.id);
}

// 상세 패널 하단에 원본 전체 내용을 인라인 렌더(캐시). 실패 시 안내만.
async function loadDetailDoc(id) {
  const host = $("#detailDoc");
  if (!host) return;
  try {
    const doc = await fetchDoc(id);
    if (state.selected !== id || !$("#detailDoc")) return; // 그 사이 다른 카드 선택됨
    if (!doc.ok) { host.innerHTML = `<div class="doc-empty">${esc(doc.error || "내용을 불러오지 못했습니다.")}</div>`; return; }
    host.innerHTML = mdToHtml(stripFrontmatter(doc.content));
  } catch {
    host.innerHTML = `<div class="doc-empty">내용을 불러오지 못했습니다. (서버 필요)</div>`;
  }
}

/* ---------- 원본 내용 로드 + 마크다운 렌더(GitBook 더보기 공용) ---------- */
async function fetchDoc(id) {
  if (state.docCache[id]) return state.docCache[id];
  const r = await fetch("/api/content?id=" + encodeURIComponent(id));
  const doc = await r.json().catch(() => ({ ok: false, error: "응답을 해석하지 못했습니다." }));
  if (doc.ok) state.docCache[id] = doc;
  return doc;
}
// 선두 YAML frontmatter(--- … ---) 제거 — 이름/설명은 헤더에서 이미 보여줌.
function stripFrontmatter(md) {
  const m = (md || "").match(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return m ? md.slice(m[0].length) : (md || "");
}
// 마크다운 → HTML. marked(CDN) 있으면 사용, 없으면 자체 폴백. 본문은 로컬 신뢰 파일.
function mdToHtml(md) {
  const src = md || "";
  if (window.marked) {
    try { return window.marked.parse(src, { gfm: true, breaks: false }); } catch { /* fall through */ }
  }
  return mdFallback(src);
}
function mdFallback(src) {
  const e = (s) => s.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));
  const inline = (s) => s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return e(src).split(/\r?\n\r?\n+/).map((b) => {
    const fence = b.match(/^```[\w-]*\r?\n([\s\S]*?)\r?\n?```$/);
    if (fence) return `<pre><code>${fence[1]}</code></pre>`;
    const h = b.match(/^(#{1,6})\s+(.*)$/);
    if (h) return `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
    if (/^\s*[-*+]\s+/.test(b))
      return `<ul>${b.split(/\r?\n/).filter(Boolean).map((l) => `<li>${inline(l.replace(/^\s*[-*+]\s+/, ""))}</li>`).join("")}</ul>`;
    return `<p>${inline(b).replace(/\r?\n/g, "<br>")}</p>`;
  }).join("\n");
}
// 렌더된 컨테이너의 h1~h3에 id를 부여하고 목차 배열을 만든다(marked 버전 무관).
function decorateHeadings(container) {
  const used = {}, toc = [];
  $$("h1, h2, h3", container).forEach((h) => {
    const base = (h.textContent || "h").toLowerCase().trim()
      .replace(/[^\w가-힣]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "h";
    let id = base, n = 1;
    while (used[id]) id = base + "-" + (++n);
    used[id] = true; h.id = id;
    toc.push({ id, level: +h.tagName[1], text: h.textContent || "" });
  });
  return toc;
}
function renderToc(toc) {
  const host = $("#docToc");
  if (!host) return;
  if (toc.length < 2) { host.innerHTML = ""; host.classList.add("hidden"); return; }
  host.classList.remove("hidden");
  host.innerHTML = '<div class="toc-h">목차</div>' +
    toc.map((t) => `<a class="toc-i lvl-${t.level}" data-id="${esc(t.id)}">${esc(t.text)}</a>`).join("");
  $$(".toc-i", host).forEach((a) => a.onclick = () => {
    document.getElementById(a.dataset.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/* ---------- 액션 ---------- */
async function api(path, body) {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  return await r.json().catch(() => ({ ok: false, error: "bad json" }));
}

const LO = {
  async equip(id) {
    const it = state.all.find((i) => i.id === id); if (!it) return;
    if (it.installed) return toast(`"${dispName(it)}" 은(는) 이미 ~/.claude 에 설치되어 바로 사용 가능합니다.`);
    const res = await api("/api/equip", { id, equip: !it.equipped });
    if (res.ok) {
      it.equipped = !!res.equipped;
      toast(it.equipped ? `"${dispName(it)}" 작전 투입 완료 - ${res.target || "~/.claude"}` : `작전 투입 해제됨`);
      renderGrid(); select(id); renderSides();
    } else toast("⚠️ " + (res.error || "장착 실패 (서버 필요)"), true);
  },
  setEngine(v) { state.aiEngine = v; },
  // 표시 언어 전환(한국어 번역본 ↔ 원문). 데이터는 그대로, 표시만 바뀜.
  toggleLang() {
    state.lang = state.lang === "ko" ? "en" : "ko";
    syncLangButton();
    renderGrid(); renderSides();
    if (state.selected) select(state.selected);
    toast(state.lang === "ko" ? "한국어 번역본 표시 (번역 없는 항목은 원문)" : "원문(영어) 표시");
  },
  // 더보기 — 스킬 전체 내용을 GitBook 스타일 팝업으로. 목차(좌) + 본문(우).
  async openDoc(id) {
    const it = state.all.find((i) => i.id === id);
    const modal = $("#docModal");
    $("#docTitle").textContent = it ? dispName(it) : "자산 문서";
    $("#docKind").textContent = it ? (it.kind === "skill" ? "기밀 자산" : it.kind === "agent" ? "작전 요원" : "지원 모듈") : "";
    $("#docPath").textContent = it?.source ? `${it.source.owner}/${it.source.repo}/${it.source.path}` : "";
    $("#docToc").innerHTML = ""; $("#docToc").classList.add("hidden");
    $("#docContent").innerHTML = `<div class="doc-loading">불러오는 중…</div>`;
    modal.classList.add("open");
    document.body.classList.add("modal-open");
    const doc = await fetchDoc(id);
    if (!modal.classList.contains("open")) return; // 그새 닫힘
    const content = $("#docContent");
    if (!doc.ok) { content.innerHTML = `<div class="doc-empty">${esc(doc.error || "내용을 불러오지 못했습니다.")}</div>`; return; }
    content.innerHTML = mdToHtml(stripFrontmatter(doc.content));
    renderToc(decorateHeadings(content));
    content.scrollTop = 0;
  },
  closeDoc() {
    $("#docModal").classList.remove("open");
    document.body.classList.remove("modal-open");
  },
  toggleTheme() {
    state.theme = state.theme === "light" ? "dark" : "light";
    applyTheme();
    toast(state.theme === "light" ? "Light 테마 - NASA blueprint" : "Dark 테마 - NASA cyber");
  },
  changeFont(val) {
    state.font = "pretendard";
    applyFont();
    toast("글꼴은 Pretendard로 고정되어 있습니다.");
  },
  // 단일 카드 한국어 번역 — 선택 엔진으로 이름·설명을 번역해 별도 저장.
  async translate(id) {
    const it = state.all.find((i) => i.id === id); if (!it) return;
    const eng = state.aiEngine === "heuristic" ? "claude" : state.aiEngine;
    toast(`${ENGINE_LABEL[eng] || eng}(으)로 한국어 번역 중…`);
    const res = await api("/api/translate", { id, engine: eng, force: true });
    if (res.ok && res.translations && res.translations[id]) {
      const t = res.translations[id];
      it.nameKo = t.name; it.descKo = t.description; it.translated = true;
      state.lang = "ko";
      syncLangButton();
      toast(`✅ 번역 완료 [${ENGINE_LABEL[res.engine] || res.engine}] — "${t.name}"`);
      renderGrid(); select(id); renderSides();
    } else toast("⚠️ " + (res.error || "번역 실패 (AI 엔진 필요)"), true);
  },
  // 현재 보이는 카드 중 미번역분을 16개씩 묶어 일괄 번역.
  async translatePage() {
    const eng = state.aiEngine === "heuristic" ? "claude" : state.aiEngine;
    const shown = state.filtered.slice(0, state.shown).filter((i) => !i.translated);
    if (!shown.length) return toast("표시된 카드는 이미 모두 번역되어 있습니다.");
    toast(`${shown.length}개 카드를 ${ENGINE_LABEL[eng] || eng}(으)로 번역 중… (잠시 걸립니다)`);
    let done = 0;
    for (let i = 0; i < shown.length; i += 16) {
      const chunk = shown.slice(i, i + 16);
      const res = await api("/api/translate", { ids: chunk.map((c) => c.id), engine: eng });
      if (res.ok && res.translations) {
        for (const [id, t] of Object.entries(res.translations)) {
          const it = state.all.find((x) => x.id === id);
          if (it) { it.nameKo = t.name; it.descKo = t.description; it.translated = true; done++; }
        }
        state.lang = "ko"; renderGrid();
        toast(`번역 진행 ${done}/${shown.length}…`);
      } else { toast("⚠️ " + (res.error || "번역 실패"), true); break; }
    }
    syncLangButton();
    renderGrid(); if (state.selected) select(state.selected);
    toast(`✅ 일괄 번역 완료 — ${done}개`);
  },
  async verify(id) {
    const it = state.all.find((i) => i.id === id); if (!it) return;
    toast(`${ENGINE_LABEL[state.aiEngine] || state.aiEngine}(으)로 신호를 감정하는 중...`);
    const res = await api("/api/verify", { id, engine: state.aiEngine });
    if (res.ok && res.verdict) {
      it.verdict = res.verdict;
      if (res.score) { it.score = res.score; it.rarity = res.rarity || it.rarity; }
      const eng = ENGINE_LABEL[res.engine] || res.engine;
      toast(`신호 감정 완료 [${eng}] - 유용성 +${res.verdict.usefulness}, 우세도 +${res.verdict.dominance}`);
      select(id); renderGrid();
    } else toast("⚠️ " + (res.error || "AI 검증 실패"), true);
  },
  compare(id) {
    const it = state.all.find((i) => i.id === id);
    const grp = state.all.filter((x) => x.group === it.group);
    const best = [...grp].sort((a, b) => b.score - a.score)[0];
    toast(`우세 분석: ${grp.length}개 자산 중 "${dispName(best)}" (${best.source.repo}) 가 ${best.score}점으로 우세`);
    select(best.id);
  },
  openImg(id) { openImgModal(id); },
  closeImg() { $("#imgModal").classList.remove("open"); },
  // ----- 일괄 이미지 생성(체크박스 선택) -----
  batchGen() { batchGenerate(); },
  clearPicks() { clearPicks(); },
  pickAll() { pickAllVisible(); },
  // ----- 소스 관리(어디서 스킬을 가져올지) -----
  async openSources() {
    $("#srcModal").classList.add("open");
    await renderSources();
  },
  closeSources() { $("#srcModal").classList.remove("open"); },
  async addSource() {
    const inp = $("#srcPath"); const p = (inp.value || "").trim();
    if (!p) return toast("추가할 폴더 경로를 입력하세요", true);
    toast("폴더 추가 후 재스캔 중…");
    const res = await api("/api/sources/add", { path: p });
    if (res.ok) { inp.value = ""; toast(`✅ 소스 추가됨 — 전체 ${res.total?.toLocaleString?.() ?? res.total}개`); await Promise.all([reload(), renderSources()]); }
    else toast("⚠️ " + (res.error || "추가 실패"), true);
  },
  async cloneRepo() {
    const inp = $("#srcUrl"); const url = (inp.value || "").trim();
    if (!url) return toast("git URL을 입력하세요", true);
    toast("git clone 후 재스캔 중… (네트워크에 따라 수십 초)");
    const res = await api("/api/clone", { url });
    if (res.ok) { inp.value = ""; toast(`✅ clone + 등록 완료 — 전체 ${res.total?.toLocaleString?.() ?? res.total}개`); await Promise.all([reload(), renderSources()]); }
    else toast("⚠️ " + (res.error || "clone 실패"), true);
  },
  async removeSource(p) {
    toast("소스 제거 후 재스캔 중…");
    const res = await api("/api/sources/remove", { path: p });
    if (res.ok) { toast(`소스 제거됨 — 전체 ${res.total?.toLocaleString?.() ?? res.total}개`); await Promise.all([reload(), renderSources()]); }
    else toast("⚠️ " + (res.error || "제거 실패"), true);
  },
  saveDeckPulse() {
    const btn = $(".deck-save");
    btn?.classList.remove("animate__animated", "animate__pulse");
    void btn?.offsetWidth;
    btn?.classList.add("animate__animated", "animate__pulse");
    toast("현재 편성과 연결 자산을 임무 패키지로 저장할 준비가 되었습니다.");
  },
  generate: genImage, loadIntoSlicer, autoGrid, clearSlices,
};
window.LO = LO;

/* ---------- 로스터(팀) ---------- */
function renderRoster() {
  const agents = state.all.filter((i) => i.kind === "agent").slice(0, 8);
  const equipped = state.all.filter((i) => i.equipped);
  $("#teamCount").textContent = `${equipped.length}/6`;
  $("#roster").innerHTML = agents.map((a) => {
    const r = RARITY[a.rarity] || RARITY.common;
    const lvl = Math.round((a.score || 50) / 2);
    return `<div class="unit" data-id="${esc(a.id)}">
      <div class="rarity-edge" style="background:${r.c}"></div>
      <div class="av">${iconFor(a)}</div>
      <div><div class="nm">${esc(dispName(a))}</div><div class="sub">${esc(a.meta?.model || a.category)}</div></div>
      <div class="lv"><b>Lv.${lvl}</b><small>${r.ko}</small></div>
    </div>`;
  }).join("") || `<div class="empty-note">에이전트 유닛 없음</div>`;
  $$("#roster .unit").forEach((el) => el.onclick = () => { $$("#roster .unit").forEach(u=>u.classList.remove("sel")); el.classList.add("sel"); select(el.dataset.id); });
}

function renderFormation() {
  const roles = ["Planner", "Researcher", "Builder", "Reviewer", "Operator"];
  const equipped = state.all.filter((i) => i.equipped);
  const agents = state.all.filter((i) => i.kind === "agent").slice(0, 5);
  const skills = equipped.filter((i) => i.kind === "skill").slice(0, 3);
  const totalPower = equipped.reduce((sum, i) => sum + (i.stats?.power || i.score || 0), 0);
  $("#teamPower").textContent = totalPower.toLocaleString();
  $("#formationBoard").innerHTML = roles.map((role, idx) => {
    const unit = agents[idx];
    const skill = skills[idx % Math.max(skills.length, 1)];
    if (!unit) {
      return `<button class="formation-slot empty" type="button"><span>${roleKo(role)}</span><b>빈 슬롯</b><small>요원 배치 대기</small></button>`;
    }
    const r = RARITY[unit.rarity] || RARITY.common;
    return `<button class="formation-slot filled" type="button" style="--rc:${r.c}" data-id="${esc(unit.id)}">
      <span>${roleKo(role)}</span>
      <b>${esc(dispName(unit))}</b>
      <small>${skill ? esc(dispName(skill)) : "자산 미투입"} · LV.${Math.round((unit.score || 50) / 2)}</small>
    </button>`;
  }).join("");
  $$("#formationBoard .filled").forEach((el) => el.onclick = () => select(el.dataset.id));
  const synergy = equipped.length >= 3 ? "발동" : "대기";
  const bonus = equipped.length >= 3 ? `+${Math.min(27, equipped.length * 4)}% 효율` : `${equipped.length}/3 필요`;
  $("#synergyPanel").innerHTML = `<b>신호 링크 ${synergy}</b><span>${bonus} · 투입 ${equipped.length}개</span>`;
}

function roleKo(role) {
  return {
    Planner: "분석관",
    Researcher: "정찰관",
    Builder: "구축관",
    Reviewer: "감정관",
    Operator: "집행관",
  }[role] || role;
}

function renderEquipmentStrip() {
  const equipped = state.all.filter((i) => i.equipped).slice(0, 6);
  const mcp = state.all.filter((i) => i.kind === "mcp").slice(0, 4);
  const pool = equipped.length ? equipped : mcp;
  $("#equipmentStrip").innerHTML = `
    <div class="equipment-head"><span>지원 모듈 / 활성 임무 패키지</span><b>${pool.length || 0} 슬롯</b></div>
    <div class="equipment-row">
      ${pool.map((it, idx) => {
        const r = RARITY[it.rarity] || RARITY.common;
        return `<button class="equipment-card" type="button" style="--rc:${r.c}" data-id="${esc(it.id)}">
          <span>${["주 모듈", "보조 모듈", "신호기", "문양키", "지원 모듈", "작전덱"][idx] || "슬롯"}</span>
          <b>${esc(dispName(it))}</b>
          <small>추진력 +${it.stats?.power ?? it.score ?? 0}</small>
        </button>`;
      }).join("")}
      ${pool.length ? "" : `<div class="equipment-empty">연결된 자산이 없습니다. 자산을 선택해 임무 패키지에 추가하세요.</div>`}
    </div>`;
  $$("#equipmentStrip .equipment-card").forEach((el) => el.onclick = () => select(el.dataset.id));
}

/* ---------- 탭/필터 바인딩 ---------- */
function bind() {
  $$("#nav button").forEach((b) => b.onclick = () => {
    $$("#nav button").forEach((x) => x.classList.remove("active")); b.classList.add("active");
    const t = b.dataset.tab;
    const map = { collection: "all", team: "agent", arsenal: "mcp", inventory: "all" };
    state.kind = map[t]; state.equipOnly = t === "inventory";
    $$("#kindChips .chip").forEach((c) => c.classList.toggle("on", c.dataset.kind === (state.kind)));
    $("#equipOnly").classList.toggle("on", state.equipOnly);
    $("#heroTitle").textContent = { collection: "전체", team: "SKILL", arsenal: "AGENT", inventory: "MCP" }[t];
    $("#gridTitle").childNodes[0].nodeValue = { collection: "전체 ", team: "SKILL ", arsenal: "AGENT ", inventory: "MCP " }[t];
    apply();
  });
  $$("#kindChips .chip").forEach((c) => c.onclick = () => {
    $$("#kindChips .chip").forEach((x) => x.classList.remove("on")); c.classList.add("on");
    state.kind = c.dataset.kind; apply();
  });
  $$("#rarityChips .chip").forEach((c) => c.onclick = () => {
    $$("#rarityChips .chip").forEach((x) => x.classList.remove("on")); c.classList.add("on");
    state.rarity = c.dataset.rarity; apply();
  });
  $("#sortSel").onchange = (e) => { state.sort = e.target.value; apply(); };
  $("#dupOnly").onclick = (e) => { state.dupOnly = !state.dupOnly; e.target.classList.toggle("on", state.dupOnly); apply(); };
  $("#equipOnly").onclick = (e) => { state.equipOnly = !state.equipOnly; e.target.classList.toggle("on", state.equipOnly); apply(); };
  let t; $("#search").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); apply(); }, 180); };
  $("#loadMore").onclick = () => { state.shown += PAGE; renderGrid(); };
  $$("#presetRow .preset").forEach((p) => p.onclick = () => {
    $$("#presetRow .preset").forEach((x) => x.classList.remove("on")); p.classList.add("on");
    $("#genPrompt").value = promptFor(p.dataset.preset, slicerCtxItem);
  });
  $$("#engineRow .preset").forEach((p) => p.onclick = () => {
    $$("#engineRow .preset").forEach((x) => x.classList.remove("on")); p.classList.add("on");
    checkChrome();
  });
  $$("#batchEngine .preset").forEach((p) => p.onclick = () => {
    $$("#batchEngine .preset").forEach((x) => x.classList.remove("on")); p.classList.add("on");
  });
  // 더보기 팝업: position:fixed 가 조상 transform/filter 에 갇히지 않도록 body 직속으로 이동(포털).
  const dm = $("#docModal");
  if (dm && dm.parentElement !== document.body) document.body.appendChild(dm);
  // 더보기 팝업: 배경 클릭 + ESC 로 닫기.
  $("#docModal").onclick = (e) => { if (e.target.id === "docModal") LO.closeDoc(); };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("#docModal").classList.contains("open")) LO.closeDoc();
  });
}

/* ---------- 토스트 ---------- */
let toastT;
function toast(msg, err = false) {
  const el = $("#toast"); el.textContent = msg; el.className = "toast show" + (err ? " err" : "");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 3200);
}

/* ===================== 이미지 작업실 ===================== */
let slicerCtxItem = null;
// 같은 파일명 덮어쓰기 후 즉시 갱신용 캐시버스터(서버에 저장되는 경로는 깨끗하게 유지).
const bust = (u) => u + (u.includes("?") ? "&" : "?") + "v=" + Date.now();
const ORBITAL_MONITOR_STYLE = "밝고 깔끔한 플랫 아이콘 일러스트. 흰색~아주 옅은 하늘색 단색 배경(격자는 생략하거나 거의 안 보이게), 단순하고 또렷한 플랫 라인 아이콘, 넉넉한 여백, 부드럽고 절제된 그림자. SHIP은 차분한 launch blue, MONITOR는 안정적인 orbit green 포인트 컬러. 친근하지만 진중한 엔지니어링 문서 톤. 빽빽한 디테일·여러 오브젝트 나열·과한 네온·어두운 군사 콘솔·홀로그램·실제 로고·국기·무기·군인·긴 문자는 없음.";

function promptFor(preset, it) {
  const itemName = it ? (dispName(it) || it.displayName || it.name) : "generic mission asset";
  const itemDesc = it ? (dispDesc(it) || it.description || "").replace(/\s+/g, " ").slice(0, 360) : "";
  const itemTools = it?.meta?.allowedTools ? [].concat(it.meta.allowedTools).join(", ").slice(0, 160) : "";
  const itemSource = it?.source ? `${it.source.owner}/${it.source.repo}/${it.source.path}`.slice(0, 180) : "";
  const itemRole = it ? (it.kind === "skill" ? "skill/procedure" : it.kind === "mcp" ? "MCP support module/tool connector" : "agent/operator") : "mission asset";
  const subject = it
    ? `"${itemName}" ${itemRole}. Category: ${it.category}. Description: ${itemDesc || "No description provided."}. Tools/source clues: ${itemTools || itemSource || "none"}`
    : "generic mission asset";
  const laneAccent = it ? (it.kind === "mcp" || it.rarity === "legendary" || it.rarity === "uncommon" ? "orbit green MONITOR lane" : "launch blue SHIP lane") : "launch blue SHIP lane and orbit green MONITOR lane";
  const identityRule = "Make the asset's purpose recognizable at a glance with ONE single clear, flat, literal icon of what it actually does — a concrete object that matches its name, description and category. Good examples: a browser window for web, a document with 'Aa' and color chips for design, a terminal with code brackets for code, a magnifier over a page for review/search, a shield or lock for security, a bar/line chart or database for data, a stacked server for infra, a glowing node for AI, a plug/connector for an MCP module, an operator badge or small robot for an agent. Pick the single best-fitting object. Keep it simple: one focal subject, clean light background, generous empty space, flat minimal style — never a busy diagram, a pile of objects, or a generic rocket. No readable long text; at most a tiny abstract label.";
  
  const P = {
    card: `Simple, clean, flat icon-style card art for this exact Loadout asset: ${subject}. ${identityRule} ${ORBITAL_MONITOR_STYLE}. Compose ONE large, simple central icon that literally depicts what the asset does, centered with calm empty space; use ${laneAccent} only as a restrained accent. Keep it minimal and uncluttered — no dense telemetry, no crowded diagrams, no multiple competing objects. Borderless edge-to-edge graphic, no outer card frame, no generic stock image, no readable long text.`,
    icon: `항공우주 운영용 아이콘 시트 1장(4x4 격자, 16개). ${ORBITAL_MONITOR_STYLE}. 각 칸은 로켓, 체크리스트, 업로드 구름, 성능 게이지, 위성, 문서 동기화, 모델 비교, 레이더 상태 아이콘. 균일한 셀 크기, 밝은 배경, 또렷한 파란/초록 라인.`,
    logo: `A premium, modern app logo emblem for a mission-control deck called LOADOUT. One bold central mark: a sleek stylized rocket lifting off along a dotted telemetry arc that curves up to a glowing orbit node with a small satellite, evoking launch then monitor. Palette: launch blue (#2E73DF) and orbit green (#22965A) on a clean white to pale-blue background. Flat geometric crisp vector style with subtle depth and soft shadow, rounded-square app-icon composition, centered with generous padding and balanced negative space, polished and confident like a top tech brand mark. No text, no letters, no words, no military insignia, no clutter. 1:1 square.`,
    bg: `Wide 16:9 SHIP MONITOR dashboard background. ${ORBITAL_MONITOR_STYLE}. Left rocket launch pad impression, center dotted orbital arc, right satellite over earth horizon, plenty of empty central space for UI panels, bright blueprint grid.`,
    layout: `Full 16:9 web dashboard mockup in the style of gstack SHIP MONITOR. ${ORBITAL_MONITOR_STYLE}. Two large operation panels: blue SHIP checklist lane and green MONITOR telemetry lane, top breadcrumb capsule, rocket-to-satellite orbital arc hero.`,
    sprite: `Bright blueprint UI sprite sheet, 5x4 grid. ${ORBITAL_MONITOR_STYLE}. Buttons, checklist rows, status chips, telemetry dots, module slots, launch queue badges, orbit monitor badges. Crisp web-ready components.`,
  };
  return P[preset] || P.card;
}

async function checkChrome() {
  try {
    const engine = $("#engineRow .preset.on")?.dataset.engine || "chatgpt";
    const r = await (await fetch(`/api/chrome/health?engine=${engine}`)).json();
    $("#chromeDot").classList.toggle("ok", !!r.connected);
    $("#chromeStat").textContent = r.connected 
      ? `${engine === "grok" ? "Grok" : "Chrome"} 연결됨` 
      : `${engine === "grok" ? "Grok" : "Chrome"} 미연결 (launch-chrome 실행)`;
  } catch { $("#chromeStat").textContent = "서버 미연결"; }
}

function openImgModal(id) {
  slicerCtxItem = id ? state.all.find((i) => i.id === id) : null;
  const active = $("#presetRow .preset.on")?.dataset.preset || "card";
  $("#genPrompt").value = promptFor(active, slicerCtxItem);
  resetSlicerCanvas();
  if (slicerCtxItem?.image) loadImageToCanvas(slicerCtxItem.image);
  $("#imgModal").classList.add("open");
  checkChrome();
}

async function genImage() {
  const prompt = $("#genPrompt").value.trim();
  if (!prompt) return toast("프롬프트를 입력하세요", true);
  const engine = $("#engineRow .preset.on")?.dataset.engine || "chatgpt";
  toast(`🪄 ${engine === "grok" ? "Grok" : "ChatGPT"}으로 이미지 생성 중… (수십 초)`);
  // itemId를 보내면 서버가 스킬 이름 파일명으로 저장하고 카드에 영구 연결(새로고침해도 유지).
  const res = await api("/api/generate", { prompt, expectedCount: 1, imageEngine: engine, itemId: slicerCtxItem?.id });
  if (res.ok && res.images?.length) {
    const disp = bust(res.images[0].url); // 재생성 시 같은 파일명 덮어쓰기 → 캐시버스터로 즉시 갱신
    toast(slicerCtxItem ? `✅ 생성 완료 — 카드에 자동 적용됨.` : `✅ 생성 완료 — ${res.images.length}장. 슬라이서로 불러옵니다.`);
    loadImageToCanvas(disp);
    if (slicerCtxItem) { slicerCtxItem.image = disp; renderGrid(); select(slicerCtxItem.id); }
  } else toast("⚠️ " + (res.error || "생성 실패 — Chrome/로그인 확인"), true);
}

/* ----- 슬라이서 (캔버스, 무의존) ----- */
const sc = { img: null, canvas: null, ctx: null, scale: 1, drag: null, slices: [] };
function resetSlicerCanvas() {
  sc.img = null;
  sc.drag = null;
  sc.slices = [];
  const cv = $("#sliceCanvas");
  if (cv) {
    const ctx = cv.getContext("2d");
    ctx?.clearRect(0, 0, cv.width, cv.height);
    cv.width = 0;
    cv.height = 0;
  }
  renderSlices();
}
function loadImageToCanvas(url) {
  const img = new Image(); img.crossOrigin = "anonymous";
  img.onload = () => {
    sc.img = img;
    const cv = $("#sliceCanvas"); sc.canvas = cv; sc.ctx = cv.getContext("2d");
    const maxW = 560; sc.scale = Math.min(1, maxW / img.naturalWidth);
    cv.width = img.naturalWidth * sc.scale; cv.height = img.naturalHeight * sc.scale;
    drawCanvas();
  };
  img.onerror = () => toast("이미지 로드 실패: " + url, true);
  img.src = url;
}
function drawCanvas() {
  const { ctx, canvas, img } = sc; if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if (sc.drag) {
    ctx.strokeStyle = "#e8c37a"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    const d = sc.drag; ctx.strokeRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = "rgba(232,195,122,.12)"; ctx.fillRect(d.x, d.y, d.w, d.h);
  }
}
function bindSlicer() {
  const cv = $("#sliceCanvas");
  let start = null;
  cv.onmousedown = (e) => { const r = cv.getBoundingClientRect(); start = { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.onmousemove = (e) => {
    if (!start) return; const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    sc.drag = { x: Math.min(start.x, x), y: Math.min(start.y, y), w: Math.abs(x - start.x), h: Math.abs(y - start.y) };
    drawCanvas();
  };
  cv.onmouseup = () => { if (sc.drag && sc.drag.w > 8 && sc.drag.h > 8) extractSlice(sc.drag); start = null; sc.drag = null; drawCanvas(); };
}
function extractSlice(d) {
  const { img, scale } = sc;
  const sx = d.x / scale, sy = d.y / scale, sw = d.w / scale, sh = d.h / scale;
  const off = document.createElement("canvas"); off.width = sw; off.height = sh;
  off.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const dataUrl = off.toDataURL("image/png");
  sc.slices.push(dataUrl); renderSlices();
}
function autoGrid() {
  if (!sc.img) return toast("먼저 이미지를 불러오세요", true);
  const m = ($("#gridN").value || "3x2").match(/(\d+)\s*[x×]\s*(\d+)/);
  if (!m) return toast("격자 형식: 3x2", true);
  const cols = +m[1], rows = +m[2];
  const cw = sc.canvas.width / cols, ch = sc.canvas.height / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) extractSlice({ x: c * cw, y: r * ch, w: cw, h: ch });
  toast(`🔲 ${cols * rows}조각 추출`);
}
function renderSlices() {
  $("#sliceList").innerHTML = sc.slices.map((s, i) =>
    `<div class="slice-thumb"><img src="${s}"><div style="flex:1;font-size:11px">조각 #${i + 1}</div>
      <button class="btn sm" style="padding:5px 8px" onclick="LO_saveSlice(${i})">💾</button></div>`).join("")
    || `<div class="hint">아직 조각이 없습니다.</div>`;
}
window.LO_saveSlice = async (i) => {
  // itemId를 보내면 슬라이스를 스킬 이름 파일명으로 저장하고 카드에 영구 연결(새로고침해도 유지).
  const res = await api("/api/save-slice", { dataUrl: sc.slices[i], name: `slice-${Date.now()}-${i}`, itemId: slicerCtxItem?.id });
  if (res.ok) {
    toast(slicerCtxItem ? `💾 카드에 적용됨 → ${res.url}` : `💾 저장됨 → ${res.url}`);
    if (slicerCtxItem) { slicerCtxItem.image = bust(res.url); renderGrid(); select(slicerCtxItem.id); }
  } else toast("⚠️ 저장 실패 (서버 필요)", true);
};
function clearSlices() { sc.slices = []; renderSlices(); }
function loadIntoSlicer() {
  const url = prompt("불러올 이미지 경로(URL 또는 /media/...)를 입력:", "/media/reference/ref-teal-loadout.png");
  if (url) loadImageToCanvas(url);
}

/* ---------- 시작 ---------- */
function applyTheme() {
  document.body.classList.toggle("theme-light", state.theme === "light");
  document.body.classList.toggle("theme-dark", state.theme === "dark");
  localStorage.setItem("loadout-theme", state.theme);
  const btn = $("#themeToggle");
  if (btn) btn.textContent = state.theme === "light" ? "Light" : "Dark";
}
function applyFont() {
  state.font = "pretendard";
  const stack = "'Pretendard', 'Malgun Gothic', 'Segoe UI', sans-serif";
  document.documentElement.style.setProperty("--font-sans", stack);
  localStorage.setItem("loadout-font", "pretendard");
  const select = $("#fontSelect");
  if (select) select.value = "pretendard";
}
applyTheme(); applyFont(); bind(); bindSlicer(); renderSlices(); load();
