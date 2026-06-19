// web-image-forge · 한국어 게임 웹 자산용 프롬프트 빌더
// 기밀 작전 콘솔(Black-Ops Tactical Console) 카드/아이콘/로고/BG/레이아웃 디자인 지침에 맞춤

export const STYLE =
  "기밀 작전 콘솔(Black-Ops Tactical Console) 스타일, 최첨단 군사 시뮬레이션 UI, 그래파이트 아머 플레이트, 레이더 신호 분석 라인, 진중하고 비밀스러운 분위기";

// ── 카드 전용 통일 스타일 디렉션 ──────────────────────────────────────────────
// 모든 스킬 카드가 "한 눈에 이해되는 손그림 비유"로 보이도록 고정된 아트 디렉션.
// (레퍼런스: 따뜻한 모눈 노트 위 마커+수채 낙서, 친근한 캐릭터/사물 + 화살표 비유)
export const CARD_STYLE =
  "손으로 그린 낙서(hand-drawn doodle) 스타일 단일 일러스트 1장, 1:1 정사각. " +
  "깨끗한 단색 미색(off-white) 배경 — 모눈/노트 격자선 없음, 종이 질감 없음, 배경 잡티 없음. " +
  "굵고 진한 검정 잉크 아웃라인 + 밝고 선명한 평면 채색(고대비, 부드러운 음영 최소화), 친근하고 귀여운 분위기. " +
  "딱 하나의 크고 단순한 비유 장면 — 큰 형태와 적은 디테일로, 작은 썸네일로 줄여도 또렷하게 보이도록 구성. " +
  "설명문을 그대로 쓰지 말고 사물·동작·상태 변화로 해석해서 표현. " +
  "제목·도구명·사물 라벨·말풍선·명령어·코드·계기판 글자·숫자·로고 텍스트·가짜 글자·워터마크 금지. " +
  "텍스트는 하단에 짧고 쉬운 핵심 캡션 1개만 허용(2~5단어, 문장/마침표 금지). " +
  "사진풍 사실주의 금지, 어둡거나 군사적인 톤 금지, 복잡한 배경·여러 패널·카드 테두리 프레임 금지.";

// 등급별 라벨 강조색 (스킬 이름 뒤 형광펜 하이라이트로 주입)
const RARITY_ACCENT = {
  legendary: "황금 앰버색 형광펜 하이라이트",
  epic: "보라색 형광펜 하이라이트",
  rare: "하늘색 형광펜 하이라이트",
  uncommon: "연두색 형광펜 하이라이트",
  common: "옅은 회색 형광펜 하이라이트",
};

// 도메인별 비유 톤 힌트 (description이 없을 때만 사용하는 폴백)
const CATEGORY_MOTIF = {
  security: "방패·자물쇠로 무언가를 막아 주는 장면",
  data: "데이터 상자·표를 정리하고 흐르게 하는 장면",
  web: "지구본·브라우저 창 사이를 잇는 장면",
  code: "블록·레고로 코드를 짜 맞추는 장면",
  infra: "여러 서버 상자를 쌓고 연결하는 장면",
  ai: "작은 로봇·전구가 생각을 떠올리는 장면",
  design: "도화지·자·붓으로 화면을 그리는 장면",
  agent: "심부름하는 작은 로봇 비서 장면",
  mcp: "플러그를 콘센트에 꽂아 연결하는 장면",
  general: "공구 상자에서 알맞은 도구를 꺼내는 장면",
};

const RARITY_KO = { legendary: "S-CLASS", epic: "A-CLASS", rare: "B-CLASS", uncommon: "C-CLASS", common: "D-CLASS" };

// description을 비유의 소재로 다듬는다: 트리거 문구/괄호 군더더기 제거 후 핵심 한 문장만.
function cleanDesc(s) {
  let t = String(s || "").replace(/\s+/g, " ").trim();
  t = t.replace(/\s*\([^)]*\)\s*$/g, "");            // 끝의 " (gstack)" 류 제거
  t = t.split(/\s+Use\s+(?:when|this|it)\b/i)[0];     // "Use when/this/it ..." 트리거 절 잘라냄
  const first = t.match(/^.*?[.!?](?=\s|$)/);          // 첫 문장만
  return (first ? first[0] : t).replace(/[.\s]+$/, "").trim();
}

export function buildPrompt(preset, ctx = {}) {
  const subj = ctx.name ? `"${ctx.name}"(${ctx.kind || "스킬"}, ${ctx.category || "general"})를 상징하는` : "범용 스킬을 상징하는";
  const rk = RARITY_KO[ctx.rarity] || "A-CLASS";
  switch (preset) {
    case "card": { // 카드 1장 — 텍스트 없이 한 눈에 이해되는 손그림 비유
      const rarityAccent = RARITY_ACCENT[ctx.rarity] || RARITY_ACCENT.epic;
      const cat = (ctx.category || ctx.kind || "general").toLowerCase();
      const desc = cleanDesc(ctx.description);
      const what = desc || CATEGORY_MOTIF[cat] || CATEGORY_MOTIF.general; // 비유의 소재
      const label = ctx.name || "스킬";
      return (
        `${CARD_STYLE} ` +
        `내부 참고용 이름(이미지에 쓰지 말 것): "${label}". ` +
        `내부 참고용 기능 설명(이미지에 쓰지 말 것): ${what}. ` +
        `이 기능을 초보자도 즉시 이해할 수 있는 단 하나의 재치 있는 비유 장면으로 번역한다. ` +
        `단어를 복사하지 말고 원인과 결과, 전/후 변화, 연결, 보호, 변환, 자동화 같은 시각적 행동으로 표현한다. ` +
        `${rarityAccent}는 작은 색 포인트로만 사용하고, 형광펜 밑줄이나 글자 배경으로 쓰지 않는다. ` +
        `도구 이름·카테고리·타이틀은 이미지 안에 넣지 않는다. ` +
        `그림 속 사물에도 글자를 쓰지 않는다. ` +
        `하단에는 기능을 쉬운 한국어 2~5단어로 압축한 핵심 캡션 1개만 넣고, 완전한 문장이나 마침표는 쓰지 않는다.`
      );
    }
    case "icon": // 격자 시트 — autoGrid(4x4)로 16조각
      return `군사용 HUD 인벤토리 아이콘 시트 1장, 4x4 격자(총 16개). ${STYLE}. 각 칸은 독립된 통신/보안/시스템/센서 플러그인 아이콘, 셀 크기 균일, 어두운 백그라운드, 칸 사이 일정 간격.`;
    case "logo":
      return `"LOADOUT" 블랙옵스 작전 로고 1장. ${STYLE}. 그래파이트 메탈 엠블럼 + 시안 레이더 레이아웃, 투명 배경, 정사각 1:1.`;
    case "bg":
      return `기밀 작전 지휘실 대시보드 배경(BG) 1장, 와이드 16:9. ${STYLE}. 중앙은 어둡고 비어 전술 패널을 얹기 좋게, 미세 스캔라인 및 격자망 레이아웃, 장식은 가장자리에만 배치.`;
    case "frame": // 카드 프레임만 (투명) — 어떤 아트에도 덧씌우기
      return `투명 배경의 ${rk} 등급 작전 자산 카드 프레임(테두리만) 1장. ${STYLE}. 중앙은 완전히 비어 있고 테두리/모서리 인터페이스 장식만, 비율 16:22, PNG 투명.`;
    case "layout":
      return `${STYLE}의 블랙옵스 작전 콘솔 화면 풀 레이아웃 목업 1장, 16:9. 좌측 팀 로스터, 중앙 자산 카드+지원 모듈 슬롯, 우측 신호 분석 패널. UI 조각으로 잘라 쓸 수 있게 요소 경계가 또렷하게.`;
    default:
      return `${subj} 전술 분석 화면 1장. ${STYLE}.`;
  }
}

// 슬라이스 가이드: 프리셋별 추천 격자 (slicer autoGrid 입력)
export const SLICE_HINT = {
  icon: "4x4", layout: "3x3", card: "1x1", frame: "1x1", bg: "1x1", logo: "1x1",
};
