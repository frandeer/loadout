// web-image-forge · 한국어 게임 웹 자산용 프롬프트 빌더
// 기밀 작전 콘솔(Black-Ops Tactical Console) 카드/아이콘/로고/BG/레이아웃 디자인 지침에 맞춤

export const STYLE =
  "기밀 작전 콘솔(Black-Ops Tactical Console) 스타일, 최첨단 군사 시뮬레이션 UI, 그래파이트 아머 플레이트, 레이더 신호 분석 라인, 진중하고 비밀스러운 분위기";

// ── 카드 전용 통일 스타일 디렉션 ──────────────────────────────────────────────
// 모든 스킬 카드가 한 작전 덱처럼 보이도록 고정된 아트 디렉션 (Classified Asset Card Design 기준)
export const CARD_STYLE =
  "기밀 작전 콘솔 화면용 자산 분석 일러스트 1장, 화면 비율 1:1 정사각 또는 가로형. " +
  "배경: 무광택 블랙 바디(matte black body) 및 미세 격자(micro grid) 그리드 텍스처, 암호화된 지도/파형 신호 분석. " +
  "외곽 테두리선 및 카드 프레임 일절 없음. 중첩된 카드 레이아웃 배제. " +
  "그래픽: 해당 작전 자산의 신호, 파형, 레이더 스캔, 기하학적 이상 신호 분석 기하학 그래픽 일러스트. 캔버스 끝까지 꽉 차는 구도. " +
  "글자·텍스트·UI 라벨·HUD 요소 일절 없음. 실제 무기, 군인, 국기, 실제 군 문장, 판타지 룬 문자, 귀여운 게임 스타일 배제. 워터마크 없음.";

// 등급별 액센트 색 (프롬프트에 명시적으로 주입)
const RARITY_ACCENT = {
  legendary: "기밀 앰버(classified amber, #D49A2A) 라인 및 노란색 발광(yellow glow) 신호선",
  epic: "이상 현상 바이올렛(anomaly violet, #8D5CFF) 액센트 라인, 은은하게 보랏빛으로 빛나는 이상 영역",
  rare: "레이더 시안(radar cyan, #38D6C6) 액센트 라인, 신호 스캔라인 및 파형",
  uncommon: "시그널 그린(signal green, #39D98A) 액센트 신호선",
  common: "뮤트 그래파이트(muted graphite, #18201D) 베이스 라인",
};

// 도메인별 중앙 모티프 힌트 (07-card-design.md 기준: 실제 인물/무기 대신 레이더, 파형, 기하도형, 지도 등 사용)
const CATEGORY_MOTIF = {
  security: "기밀 방화벽 시스템 노드, 보안 이상 신호 분석 격자",
  data: "분석 격자망, 고정밀 데이터 파형 및 매트릭스 흐름",
  web: "글로벌 네트워크 토폴로지 연결망, 데이터 전송 신호선",
  code: "기계어 컴파일 트리 구조, 알고리즘 펄스 분석 그래프",
  infra: "컴퓨팅 클러스터 다이어그램, 로드 밸런싱 이상 신호",
  ai: "신경망 연결 구조, 인공지능 시냅스 이상 파생 신호 펄스",
  design: "벡터 격자선(vector grids), 캔버스 레이아웃 와이어프레임 구조",
  agent: "작전 통제 노드, 요원 통신 주파수 신호 흔적",
  mcp: "프로토콜 확장 커넥터 모듈, 멀티포트 연결 신호 링크",
  general: "레이더 스캔 흔적, 기하학적 이상 신호 격자",
};

const RARITY_KO = { legendary: "S-CLASS", epic: "A-CLASS", rare: "B-CLASS", uncommon: "C-CLASS", common: "D-CLASS" };

export function buildPrompt(preset, ctx = {}) {
  const subj = ctx.name ? `"${ctx.name}"(${ctx.kind || "스킬"}, ${ctx.category || "general"})를 상징하는` : "범용 스킬을 상징하는";
  const rk = RARITY_KO[ctx.rarity] || "A-CLASS";
  switch (preset) {
    case "card": { // 세로 카드 1장 — CARD_STYLE 고정 prefix 사용
      const rarityAccent = RARITY_ACCENT[ctx.rarity] || RARITY_ACCENT.epic;
      const cat = (ctx.category || ctx.kind || "general").toLowerCase();
      const motif = CATEGORY_MOTIF[cat] || CATEGORY_MOTIF.general;
      return (
        `${CARD_STYLE} ` +
        `신호 컬러: ${rarityAccent}. ` +
        `중앙 그래픽 모티프: ${subj} ${motif}.`
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
