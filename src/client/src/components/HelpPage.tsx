import { useState } from "react";
import { Icon } from "./Icon";

type SectionKey = "overview" | "features" | "stats" | "windows" | "cli" | "faq";

interface FAQItem {
  q: string;
  a: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    q: "스캔(Scan)은 언제 실행해야 하나요?",
    a: "새로운 Skill, Agent, MCP 레포지토리 폴더를 `sources/` 디렉토리에 추가하거나, 기존 파일 내용을 수동으로 수정했을 때 실행합니다. 헤더의 **'가져오기' (또는 '전체 재스캔')** 버튼을 클릭하거나 CLI에서 `npm run scan`을 실행하면 `data/index.json` 파일이 새로 빌드되며 카탈로그가 갱신됩니다."
  },
  {
    q: "장착(Equip) 버튼을 누르면 내부적으로 어떤 작업이 일어나나요?",
    a: "선택한 카드의 폴더 경로를 사용자의 `~/.claude/skills` (에이전트인 경우 `~/.claude/agents`) 경로 하위에 디렉토리 링크(Windows의 경우 Junction)로 연결합니다. 이를 통해 Claude Code 터미널 실행 시 별도의 수동 경로 등록 없이 장착된 스킬/에이전트를 즉시 사용할 수 있습니다."
  },
  {
    q: "Windows 환경에서 개발자 모드나 관리자 권한이 필수인가요?",
    a: "아닙니다. Windows에서 파일 심링크 생성 시에는 관리자 권한이 필수적이지만, 폴더 대상 심링크에 해당하는 **Junction(디렉터리 연결점, `mklink /J`)**은 일반 사용자 권한에서도 자유롭게 생성할 수 있습니다. LOADOUT 시스템은 Junction 생성을 먼저 시도하며, 혹시 모를 권한 예외 시 수동 폴더 복사(fallback) 방식으로 작동을 보장합니다."
  },
  {
    q: "AI 검증(Verify, ⚡+99) 기능은 무엇인가요?",
    a: "카드 뒷면에서 '검증' 버튼을 누르면, 백엔드 서버가 로컬 AI Judge 모델을 호출하여 해당 스킬/에이전트의 코드 완성도와 유용성을 동적으로 분석합니다. 분석된 AI 점수가 반영되면 카드 스탯바의 유용성이 올라가고, 총합 점수가 상승하여 등급(Rarity)이 올라갈 수 있습니다."
  },
  {
    q: "볼트(Vault) 백업과 라이브(Live) 파일 간의 '분기(Divergence)'는 무엇인가요?",
    a: "디스크 관리 효율을 높이기 위해, 대용량 스킬 폴더를 비활성화하면 볼트(Vault) 디렉토리로 이동하여 임시 저장됩니다. 이때 로컬 작업 공간의 스كيل 코드와 볼트 백업 사이에 내용 불일치가 감지되면 '분기' 경고가 뜹니다. 인벤토리에서 Pull(볼트 데이터를 로컬로 가져오기) 또는 Push(로컬 변경본을 볼트에 덮어쓰기)를 통해 불일치를 동기화할 수 있습니다."
  }
];

export function HelpPage() {
  const [activeTab, setActiveTab] = useState<SectionKey>("overview");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Stats Calculator State
  const [popularity, setPopularity] = useState(70);
  const [power, setPower] = useState(60);
  const [clarity, setClarity] = useState(80);
  const [freshness, setFreshness] = useState(90);
  const [hasAi, setHasAi] = useState(false);
  const [aiUsefulness, setAiUsefulness] = useState(85);

  // Calculate score & rarity using scanner formula
  const realScore = 0.25 * popularity + 0.2 * power + 0.2 * clarity + 0.2 * freshness;
  const calculatedScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(hasAi ? realScore + 0.15 * aiUsefulness : realScore / 0.85)
    )
  );

  let calculatedRarity = "common";
  let rarityLabel = "Common (일반)";
  let rarityColorClass = "bg-slate-100 text-slate-700 border-slate-200";
  let rarityThemeColor = "#64748B";

  if (calculatedScore >= 85) {
    calculatedRarity = "legendary";
    rarityLabel = "Legendary (전설)";
    rarityColorClass = "bg-amber-50 text-amber-600 border-amber-200 animate-pulse";
    rarityThemeColor = "#F59E0B";
  } else if (calculatedScore >= 70) {
    calculatedRarity = "epic";
    rarityLabel = "Epic (서사)";
    rarityColorClass = "bg-purple-50 text-purple-600 border-purple-200";
    rarityThemeColor = "#8B5CF6";
  } else if (calculatedScore >= 55) {
    calculatedRarity = "rare";
    rarityLabel = "Rare (희귀)";
    rarityColorClass = "bg-blue-50 text-blue-600 border-blue-200";
    rarityThemeColor = "#3B82F6";
  } else if (calculatedScore >= 40) {
    calculatedRarity = "uncommon";
    rarityLabel = "Uncommon (고급)";
    rarityColorClass = "bg-emerald-50 text-emerald-600 border-emerald-200";
    rarityThemeColor = "#10B981";
  }

  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const copyCommand = (cmd: string, key: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const navItems: { key: SectionKey; label: string; icon: string }[] = [
    { key: "overview", label: "시스템 개요", icon: "home" },
    { key: "features", label: "화면별 주요 기능", icon: "dashboard-grid" },
    { key: "stats", label: "등급/스탯 시뮬레이터", icon: "gauge" },
    { key: "windows", label: "장착 & Windows 환경", icon: "settings" },
    { key: "cli", label: "CLI 및 백엔드 관리", icon: "terminal" },
    { key: "faq", label: "자주 묻는 질문 (FAQ)", icon: "help" },
  ];

  return (
    <div className="mx-auto max-w-[1500px] px-8 py-10 animate-reveal">
      {/* 도움말 타이틀 */}
      <div className="mb-10 border-b border-hairline pb-6">
        <h1 className="text-4xl font-black tracking-tight text-ink flex items-center gap-4">
          <Icon name="help" size="xl" className="text-primary" />
          LOADOUT 작전 도움말 및 시스템 설명서
        </h1>
        <p className="mt-3 text-base text-muted leading-relaxed">
          Claude Code의 스킬(Skill), 에이전트(Agent), MCP 서버를 효율적으로 관리하고 전투력을 극대화하기 위한 가이드입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[300px_1fr]">
        {/* 좌측 사이드바 내비게이션 */}
        <aside className="space-y-2">
          <div className="px-4 mb-3 text-xs font-black uppercase tracking-wider text-muted-soft">
            도움말 카테고리
          </div>
          {navItems.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-4 px-5 py-4 text-base font-bold rounded-xl transition-all text-left ${
                  active
                    ? "bg-primary-soft text-primary shadow-xs border border-primary/20"
                    : "text-body hover:text-ink hover:bg-surface-soft border border-transparent"
                }`}
              >
                <Icon name={item.icon} size="md" className={active ? "text-primary" : "text-muted"} />
                {item.label}
              </button>
            );
          })}
        </aside>

        {/* 우측 콘텐츠 영역 */}
        <main className="rounded-2xl border border-hairline bg-canvas p-8 shadow-md min-h-[600px]">
          {/* 1. 시스템 개요 */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              <h2 className="text-2xl font-black text-ink border-b border-hairline pb-3 flex items-center gap-3">
                <Icon name="home" size="md" className="text-primary" />
                LOADOUT 시스템이란?
              </h2>
              <div className="prose text-base text-body leading-loose space-y-6">
                <div className="rounded-xl border border-primary/20 bg-primary-soft/30 p-5">
                  <h3 className="text-base font-black text-primary mb-2 flex items-center gap-2">
                    <Icon name="backpack" size="sm" /> 🎒 '로드아웃(Loadout)'의 뜻과 유래
                  </h3>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-body">
                    <li>
                      <strong>게임 및 군사 용어</strong>: FPS나 RPG 게임(데스티니, 에이펙스 레전드, 콜 오브 듀티 등) 혹은 실제 군사 작전에서 <strong>'로드아웃(Loadout)'</strong>은 전장에 진입하기 직전, 요원이 소지할 무기, 탄약, 보호구, 특수 능력(스킬)들의 <strong>맞춤형 장비 세트 프리셋</strong>을 뜻합니다.
                    </li>
                    <li>
                      <strong>본 프로젝트에서의 의미</strong>: Claude Code 터미널 환경에서 사용되는 수많은 개발 자산들(스킬, 에이전트 설정, MCP 서버)을 마치 게임 아이템처럼 수집하고 능력치(`⚡작전력`)를 비교해 가며, 마우스 클릭 한 번으로 활성화된 장비 세트인 <strong>'인벤토리/로드아웃'에 장착(Equip)</strong>하여 즉시 사용할 수 있도록 관리해주는 개인 제어 대시보드입니다.
                    </li>
                  </ul>
                </div>

                <p>
                  수백 개 이상의 다양한 스킬을 로컬 백엔드 서버가 자동으로 스캔하여 메타데이터와 성능 점수를 추출하고,
                  사용자는 이를 '장비 카드'처럼 정렬 및 비교한 후 <strong>'장착(Equip)'</strong>을 통해 Claude Code 환경에 실시간으로 반영합니다.
                </p>
              </div>

              {/* 게임 메타포 매핑 표 */}
              <div className="mt-8">
                <h3 className="text-lg font-extrabold text-ink mb-4 uppercase tracking-wider">🎮 기술 개체와 게임 컨셉의 매핑</h3>
                <div className="overflow-x-auto rounded-xl border border-hairline shadow-xs">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-surface-soft border-b border-hairline">
                        <th className="px-5 py-4 font-extrabold text-muted">실제 기술 개체</th>
                        <th className="px-5 py-4 font-extrabold text-muted">게임 메타포</th>
                        <th className="px-5 py-4 font-extrabold text-muted">역할과 특징</th>
                        <th className="px-5 py-4 font-extrabold text-muted">핵심 인터랙션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      <tr className="hover:bg-surface-app/30 transition-colors">
                        <td className="px-5 py-4 font-extrabold text-primary">Skill (스킬)</td>
                        <td className="px-5 py-4"><span className="inline-flex items-center gap-2 font-semibold text-ink"><Icon name="file-alt" size="sm"/> 스킬/아이템 카드</span></td>
                        <td className="px-5 py-4 text-body">프롬프트 가이드라인(SKILL.md) 및 스크립트 도구 묶음</td>
                        <td className="px-5 py-4 text-muted-soft">3D 플립 카드 조회, 비교 후 슬롯 장착</td>
                      </tr>
                      <tr className="hover:bg-surface-app/30 transition-colors">
                        <td className="px-5 py-4 font-extrabold text-primary">Agent (에이전트)</td>
                        <td className="px-5 py-4"><span className="inline-flex items-center gap-2 font-semibold text-ink"><Icon name="team" size="sm"/> 작전 요원 (팀원)</span></td>
                        <td className="px-5 py-4 text-body">독립된 에이전트 인격 및 파이프라인 유닛</td>
                        <td className="px-5 py-4 text-muted-soft">작전실 포메이션 배치, 시너지 발동, 팀 프리셋</td>
                      </tr>
                      <tr className="hover:bg-surface-app/30 transition-colors">
                        <td className="px-5 py-4 font-extrabold text-primary">MCP Server (MCP)</td>
                        <td className="px-5 py-4"><span className="inline-flex items-center gap-2 font-semibold text-ink"><Icon name="wrench" size="sm"/> 무기 / 보조 장비</span></td>
                        <td className="px-5 py-4 text-body">Model Context Protocol 규격 외부 인터페이스 장비</td>
                        <td className="px-5 py-4 text-muted-soft">무기 슬롯 장착을 통한 특수 보너스/도구 부여</td>
                      </tr>
                      <tr className="hover:bg-surface-app/30 transition-colors">
                        <td className="px-5 py-4 font-extrabold text-primary">Active Config</td>
                        <td className="px-5 py-4"><span className="inline-flex items-center gap-2 font-semibold text-ink"><Icon name="backpack" size="sm"/> 인벤토리 / 로드아웃</span></td>
                        <td className="px-5 py-4 text-body">현재 장착 완료되어 Claude Code에 로드된 자산 덱</td>
                        <td className="px-5 py-4 text-muted-soft">실시간 심링크 활성화, 볼트 백업 동기화</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. 화면별 주요 기능 */}
          {activeTab === "features" && (
            <div className="space-y-8">
              <h2 className="text-2xl font-black text-ink border-b border-hairline pb-3 flex items-center gap-3">
                <Icon name="dashboard-grid" size="md" className="text-primary" />
                핵심 메뉴 및 화면 기능 안내
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 카드 컬렉션 (홈) */}
                <div className="p-6 rounded-2xl border border-hairline bg-surface-app/50 hover:bg-canvas hover:shadow-xs transition-all duration-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Icon name="home" size="md"/></div>
                    <h3 className="font-extrabold text-ink text-base">홈 (Deck & Catalog)</h3>
                  </div>
                  <ul className="text-sm text-body space-y-2.5 list-disc pl-5 leading-loose">
                    <li>스캔된 모든 스킬 카드를 그리드로 나열하여 탐색합니다.</li>
                    <li>종합 스탯순, 신선도순, 이름순 정렬 및 카테고리별 필터를 지원합니다.</li>
                    <li>카드 클릭 시 <strong>3D 플립 연출</strong>과 함께 뒷면의 세부 메타데이터, 도구 목록을 조회할 수 있습니다.</li>
                    <li>비슷한 그룹의 중복 카드가 있을 때 <strong>'대결 비교'</strong> 및 <strong>'AI 감정'</strong>을 통해 우세한 카드를 추천받을 수 있습니다.</li>
                  </ul>
                </div>

                {/* 작전 준비실 */}
                <div className="p-6 rounded-2xl border border-hairline bg-surface-app/50 hover:bg-canvas hover:shadow-xs transition-all duration-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Icon name="team" size="md"/></div>
                    <h3 className="font-extrabold text-ink text-base">작전 준비 (Ops Room)</h3>
                  </div>
                  <ul className="text-sm text-body space-y-2.5 list-disc pl-5 leading-loose">
                    <li>로스터에서 에이전트를 선택하여 <strong>Planner, Executor, Reviewer, Explorer, Verifier</strong> 슬롯에 드래프트/배치합니다.</li>
                    <li>배치된 에이전트 간의 특성 매칭에 따라 <strong>시너지 링크(유대 효과)</strong>가 등급별로 발동합니다.</li>
                    <li>완성된 팀 구성은 프리셋으로 저장할 수 있으며, AI 채점을 거쳐 팀 전투력(Elo)을 실시간으로 확인합니다.</li>
                    <li>완성된 구성을 한 번에 Claude Code 팀 파이프라인 파일(OMC 설정)로 변환해 복사하거나 저장할 수 있습니다.</li>
                  </ul>
                </div>

                {/* 인벤토리 */}
                <div className="p-6 rounded-2xl border border-hairline bg-surface-app/50 hover:bg-canvas hover:shadow-xs transition-all duration-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Icon name="backpack" size="md"/></div>
                    <h3 className="font-extrabold text-ink text-base">인벤토리 (Inventory)</h3>
                  </div>
                  <ul className="text-sm text-body space-y-2.5 list-disc pl-5 leading-loose">
                    <li>현재 장착되어 Claude Code 내에서 활성화된 스킬/에이전트 목록을 관리합니다.</li>
                    <li>불필요한 디스크 용량을 차지하는 거대 자산의 경우 <strong>Vault 기능</strong>을 켜서 안전하게 보관 상태로 전환할 수 있습니다.</li>
                    <li>작업 폴더의 파일 변경 시 볼트와의 <strong>분기(Divergence)</strong>를 추적하고 Push/Pull을 통해 손쉽게 동기화합니다.</li>
                  </ul>
                </div>

                {/* 포지 */}
                <div className="p-6 rounded-2xl border border-hairline bg-surface-app/50 hover:bg-canvas hover:shadow-xs transition-all duration-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Icon name="wrench" size="md"/></div>
                    <h3 className="font-extrabold text-ink text-base">포지 (Design Forge)</h3>
                  </div>
                  <ul className="text-sm text-body space-y-2.5 list-disc pl-5 leading-loose">
                    <li>특정 카드 생성 세션 단위로 AI 프롬프트 기반의 디자인 다형성(Variants)을 대량으로 생성합니다.</li>
                    <li>생성된 다형성 디자인 후보들을 **Pairwise 매칭(토너먼트 대결)**하여 최적의 Elo 점수 서열을 형성합니다.</li>
                    <li>가장 우수한 평가를 얻은 디자인 결과물을 정제해 최종 파일로 내보내기(Export)할 수 있습니다.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 3. 등급 및 스탯 시뮬레이터 */}
          {activeTab === "stats" && (
            <div className="space-y-8">
              <h2 className="text-2xl font-black text-ink border-b border-hairline pb-3 flex items-center gap-3">
                <Icon name="gauge" size="md" className="text-primary" />
                등급 및 스탯 계산 시뮬레이터
              </h2>
              <p className="text-sm text-muted leading-relaxed">
                스캐너 스크립트(`src/scan.mjs`)가 산출하는 4대 스탯과 AI 유용성 점수를 바탕으로, 카드의 총합 전투력 점수 및 등급(Rarity)이 실시간 산정되는 방식을 시뮬레이션해 볼 수 있습니다.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 mt-6">
                {/* 조절 패널 */}
                <div className="space-y-6 rounded-2xl border border-hairline bg-surface-app/30 p-6">
                  <h3 className="text-sm font-extrabold text-ink uppercase tracking-wider border-b border-hairline pb-2">스탯 조절 다이얼</h3>
                  
                  {/* 인기 (Popularity) */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-body">인기 (Popularity)</span>
                      <span className="font-mono font-extrabold text-primary">{popularity}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={popularity}
                      onChange={(e) => setPopularity(Number(e.target.value))}
                      className="w-full accent-primary h-2 bg-surface-soft rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-muted-soft">Stars 및 최근 활성 사용도를 통해 계산</p>
                  </div>

                  {/* 파워 (Power) */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-body">파워 (Power)</span>
                      <span className="font-mono font-extrabold text-primary">{power}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={power}
                      onChange={(e) => setPower(Number(e.target.value))}
                      className="w-full accent-primary h-2 bg-surface-soft rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-muted-soft">코드/문서 크기, 허용 도구 수, 스크립트 수 연동</p>
                  </div>

                  {/* 명확도 (Clarity) */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-body">명확도 (Clarity)</span>
                      <span className="font-mono font-extrabold text-primary">{clarity}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={clarity}
                      onChange={(e) => setClarity(Number(e.target.value))}
                      className="w-full accent-primary h-2 bg-surface-soft rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-muted-soft">설명글(Description) 길이 최적도 및 핵심 트리거 패턴 포함 여부</p>
                  </div>

                  {/* 신선도 (Freshness) */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-body">신선도 (Freshness)</span>
                      <span className="font-mono font-extrabold text-primary">{freshness}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={freshness}
                      onChange={(e) => setFreshness(Number(e.target.value))}
                      className="w-full accent-primary h-2 bg-surface-soft rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-muted-soft">최근 업스트림 업데이트 경과 일수(Age)에 반비례</p>
                  </div>

                  {/* AI 유용성 추가 */}
                  <div className="pt-4 border-t border-hairline space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasAi}
                        onChange={(e) => setHasAi(e.target.checked)}
                        className="rounded border-hairline text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                      />
                      <span className="text-sm font-bold text-ink">AI Judge 검증 결과 (+99) 추가 적용</span>
                    </label>
                    
                    {hasAi && (
                      <div className="space-y-2 animate-reveal pl-8">
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-indigo-600">AI 유용성 (Usefulness)</span>
                          <span className="font-mono text-indigo-600 font-extrabold">{aiUsefulness}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={aiUsefulness}
                          onChange={(e) => setAiUsefulness(Number(e.target.value))}
                          className="w-full accent-indigo-600 h-2 bg-surface-soft rounded-lg appearance-none cursor-pointer"
                        />
                        <p className="text-xs text-muted-soft">AI가 코드를 정밀 분석한 후 산출하는 유용성 스탯</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 결과 시뮬레이션 카드 */}
                <div className="flex flex-col justify-between rounded-2xl border border-hairline bg-canvas p-8 shadow-md relative overflow-hidden"
                     style={{ borderTop: `6px solid ${rarityThemeColor}` }}>
                  {/* Shimmer overlay for Legendary */}
                  {calculatedRarity === "legendary" && (
                    <div className="absolute inset-0 bg-linear-to-r from-transparent via-amber-500/5 to-transparent pointer-events-none animate-pulse" />
                  )}
                  
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-black border ${rarityColorClass}`}>
                        {rarityLabel}
                      </span>
                      <span className="text-xs font-extrabold text-muted-soft tracking-wider">LOADOUT CARD DECISION</span>
                    </div>

                    <div className="text-center my-8">
                      <span className="text-sm font-medium text-muted block mb-2">최종 산출 스코어</span>
                      <span className="text-6xl font-black tracking-tight text-ink block" style={{ color: rarityThemeColor }}>
                        ⚡ {calculatedScore}
                      </span>
                    </div>

                    {/* 스탯 바 요약 */}
                    <div className="space-y-3 mt-6">
                      <div className="flex items-center text-xs">
                        <span className="w-20 font-bold text-muted">인기 (25%)</span>
                        <div className="flex-1 bg-surface-soft h-2.5 rounded-full overflow-hidden">
                          <div className="bg-primary h-full transition-all" style={{ width: `${popularity}%` }} />
                        </div>
                        <span className="w-10 text-right font-mono font-bold text-ink">{popularity}</span>
                      </div>
                      <div className="flex items-center text-xs">
                        <span className="w-20 font-bold text-muted">파워 (20%)</span>
                        <div className="flex-1 bg-surface-soft h-2.5 rounded-full overflow-hidden">
                          <div className="bg-primary h-full transition-all" style={{ width: `${power}%` }} />
                        </div>
                        <span className="w-10 text-right font-mono font-bold text-ink">{power}</span>
                      </div>
                      <div className="flex items-center text-xs">
                        <span className="w-20 font-bold text-muted">명확도 (20%)</span>
                        <div className="flex-1 bg-surface-soft h-2.5 rounded-full overflow-hidden">
                          <div className="bg-primary h-full transition-all" style={{ width: `${clarity}%` }} />
                        </div>
                        <span className="w-10 text-right font-mono font-bold text-ink">{clarity}</span>
                      </div>
                      <div className="flex items-center text-xs">
                        <span className="w-20 font-bold text-muted">신선도 (20%)</span>
                        <div className="flex-1 bg-surface-soft h-2.5 rounded-full overflow-hidden">
                          <div className="bg-primary h-full transition-all" style={{ width: `${freshness}%` }} />
                        </div>
                        <span className="w-10 text-right font-mono font-bold text-ink">{freshness}</span>
                      </div>
                      {hasAi && (
                        <div className="flex items-center text-xs">
                          <span className="w-20 font-bold text-indigo-600">AI검증 (15%)</span>
                          <div className="flex-1 bg-indigo-50 h-2.5 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full transition-all" style={{ width: `${aiUsefulness}%` }} />
                          </div>
                          <span className="w-10 text-right font-mono font-black text-indigo-600">{aiUsefulness}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-hairline text-center">
                    <p className="text-xs text-muted-soft leading-normal">
                      * 스코어 분포: 85점 이상 Legendary / 70~84점 Epic / 55~69점 Rare / 40~54점 Uncommon / 40점 미만 Common.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. 장착 & Windows 환경 */}
          {activeTab === "windows" && (
            <div className="space-y-8">
              <h2 className="text-2xl font-black text-ink border-b border-hairline pb-3 flex items-center gap-3">
                <Icon name="settings" size="md" className="text-primary" />
                장착(Equip) 연동 메커니즘 & Windows 개발 설정
              </h2>
              <div className="prose text-base text-body leading-loose space-y-5">
                <p>
                  <strong>LOADOUT</strong>은 사용자가 웹 브라우저에서 <strong>'장착(Equip)'</strong> 버튼을 누르면 물리적으로 파일들을 매번 복사해 옮겨 다니지 않고,
                  운영체제 레벨의 <strong>심볼릭 링크(Symbolic Link)</strong> 기술을 이용해 원본 위치를 가리키게 만듭니다.
                </p>

                <div className="p-6 rounded-2xl bg-surface-soft border border-hairline shadow-xs my-6">
                  <h3 className="text-sm font-extrabold text-ink uppercase tracking-wider mb-3">📁 대상 디렉토리 구조</h3>
                  <ul className="text-sm text-body list-disc pl-5 space-y-2">
                    <li><strong>스킬 장착 시:</strong> <code className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-mono text-xs rounded border border-indigo-100">sources/&lt;owner&gt;__&lt;repo&gt;/&lt;skill_folder&gt;</code> ──&gt; <code className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-mono text-xs rounded border border-indigo-100">~/.claude/skills/&lt;skill_name&gt;</code></li>
                    <li><strong>에이전트 장착 시:</strong> <code className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-mono text-xs rounded border border-indigo-100">sources/&lt;owner&gt;__&lt;repo&gt;/&lt;agent_folder&gt;</code> ──&gt; <code className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-mono text-xs rounded border border-indigo-100">~/.claude/agents/&lt;agent_name&gt;</code></li>
                  </ul>
                </div>

                <h3 className="font-extrabold text-ink text-lg mt-8 mb-3">Windows의 Junction 연결점 활용</h3>
                <p>
                  Linux나 macOS의 파일 링크 생성과 달리, Windows에서 순수 디렉터리 심링크(`mklink /D`)를 만들기 위해서는 로컬 그룹 정책 편집기 수정 또는 **관리자 권한**이 요구됩니다.
                  이를 우회하고 사용자 편의를 확보하기 위해, LOADOUT 백엔드 서버는 Windows에서 관리자 권한 없이도 생성이 가능한 **디렉터리 연결점(Junction, `mklink /J`)** 명령어를 사용하여 안정적인 소프트링크를 빌드합니다.
                </p>

                <div className="p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-sm text-body flex items-start gap-4 mt-6">
                  <Icon name="warning" className="text-amber-500 mt-1 shrink-0" size="md" />
                  <div className="leading-relaxed">
                    <span className="font-extrabold text-ink text-base block mb-1.5">장착 실패 시 대응 가이드 (Junction Fallback)</span>
                    보안 시스템 정책이나 경로 잠금 문제 등으로 인해 Junction 생성이 차단될 경우, 시스템은 에러 발생 후 자동으로 물리적 폴더 복사본(Fallback)을 대상 디렉토리에 전송하여 정상 사용 가능 상태를 보증합니다. 
                    다만 이 경우 원본 파일 수정본이 실시간 연동되지 않으므로, 작업 시 '재스캔'을 통해 갱신이 필요할 수 있습니다.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. CLI 및 백엔드 관리 */}
          {activeTab === "cli" && (
            <div className="space-y-8">
              <h2 className="text-2xl font-black text-ink border-b border-hairline pb-3 flex items-center gap-3">
                <Icon name="terminal" size="md" className="text-primary" />
                CLI 명령어 & 백엔드 저장소 관리
              </h2>
              <p className="text-base text-body leading-relaxed">
                LOADOUT 시스템 백엔드는 파일 기반의 경량 상태 관리를 지향합니다. 터미널 명령어를 통해 인덱스를 갱신하고 서버를 구동할 수 있습니다.
              </p>

              <div className="space-y-6">
                {/* 1) 스캔 명령어 */}
                <div className="border border-hairline rounded-2xl p-6 hover:shadow-xs transition-shadow duration-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-extrabold text-ink flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      1. 카탈로그 스캔 및 수동 분석
                    </span>
                    <button
                      onClick={() => copyCommand("npm run scan", "scan")}
                      className="text-xs font-semibold text-muted hover:text-ink transition flex items-center gap-1.5 cursor-pointer bg-surface-soft px-2.5 py-1 rounded-md"
                    >
                      <Icon name={copiedCmd === "scan" ? "check" : "copy"} size="xs" />
                      {copiedCmd === "scan" ? "복사됨" : "복사"}
                    </button>
                  </div>
                  <pre className="p-4 bg-surface-soft rounded-xl text-sm font-mono text-slate-800 overflow-x-auto border border-hairline-strong/20">
                    npm run scan
                  </pre>
                  <p className="mt-3 text-xs text-muted leading-relaxed">
                    `sources/` 내부의 스킬 폴더를 스캔하여 구조를 탐지하고 스탯을 채점하여 `data/index.json` 파일을 작성합니다.
                  </p>
                </div>

                {/* 2) 로컬 서버 명령어 */}
                <div className="border border-hairline rounded-2xl p-6 hover:shadow-xs transition-shadow duration-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-extrabold text-ink flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      2. 로컬 백엔드 서버 시작
                    </span>
                    <button
                      onClick={() => copyCommand("npm start", "start")}
                      className="text-xs font-semibold text-muted hover:text-ink transition flex items-center gap-1.5 cursor-pointer bg-surface-soft px-2.5 py-1 rounded-md"
                    >
                      <Icon name={copiedCmd === "start" ? "check" : "copy"} size="xs" />
                      {copiedCmd === "start" ? "복사됨" : "복사"}
                    </button>
                  </div>
                  <pre className="p-4 bg-surface-soft rounded-xl text-sm font-mono text-slate-800 overflow-x-auto border border-hairline-strong/20">
                    npm start
                  </pre>
                  <p className="mt-3 text-xs text-muted leading-relaxed">
                    포트 `4970`에서 API 및 웹 어플리케이션을 호스팅합니다. 브라우저로 `http://localhost:4970`에 접속 가능합니다.
                  </p>
                </div>

                {/* 3) 데이터 구조 소개 */}
                <div className="mt-8">
                  <h3 className="text-sm font-extrabold text-ink uppercase tracking-wider mb-4">📁 로컬 데이터베이스 역할 (`data/` 폴더)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                    <div className="p-4 rounded-xl border border-hairline bg-surface-soft/40 hover:bg-surface-soft/60 transition-colors">
                      <strong className="text-ink text-sm font-extrabold block mb-1">index.json</strong>
                      <span className="text-muted-soft text-xs block mb-2 font-medium">작성 주체: 스캐너</span>
                      <p className="text-xs text-body leading-relaxed">
                        전체 카탈로그 정보, 기본 분석 스탯 및 중복 그룹핑 결과를 보관합니다.
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-hairline bg-surface-soft/40 hover:bg-surface-soft/60 transition-colors">
                      <strong className="text-ink text-sm font-extrabold block mb-1">loadout.json</strong>
                      <span className="text-muted-soft text-xs block mb-2 font-medium">작성 주체: 서버 (/equip)</span>
                      <p className="text-xs text-body leading-relaxed">
                        현재 인벤토리에 담겨 장착 완료된 스킬/에이전트 연결 상태를 기록합니다.
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-hairline bg-surface-soft/40 hover:bg-surface-soft/60 transition-colors">
                      <strong className="text-ink text-sm font-extrabold block mb-1">verdicts.json</strong>
                      <span className="text-muted-soft text-xs block mb-2 font-medium">작성 주체: 서버 (/verify)</span>
                      <p className="text-xs text-body leading-relaxed">
                        AI Judge가 판정한 개별 항목 점수(`+99`) 및 카드 대결 결과 캐시를 기록합니다.
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-hairline bg-surface-soft/40 hover:bg-surface-soft/60 transition-colors">
                      <strong className="text-ink text-sm font-extrabold block mb-1">teams.json</strong>
                      <span className="text-muted-soft text-xs block mb-2 font-medium">작성 주체: 서버 (작전 저장)</span>
                      <p className="text-xs text-body leading-relaxed">
                        사용자가 작전실(Ops Room)에서 설계한 팀 포메이션 및 전술 프리셋을 영속 보관합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. 자주 묻는 질문 (FAQ) */}
          {activeTab === "faq" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-ink border-b border-hairline pb-3 flex items-center gap-3">
                <Icon name="help" size="md" className="text-primary" />
                자주 묻는 질문 (FAQ)
              </h2>

              <div className="divide-y divide-hairline">
                {FAQ_ITEMS.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div key={idx} className="py-5 first:pt-0 last:pb-0">
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full flex justify-between items-center text-left font-extrabold text-base text-ink hover:text-primary transition-colors py-2 cursor-pointer"
                      >
                        <span>Q. {faq.q}</span>
                        <Icon
                          name="chevron-down"
                          size="sm"
                          className={`text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      
                      {isOpen && (
                        <div className="mt-3 text-sm text-body leading-loose pl-5 animate-reveal border-l-2 border-primary/20 pb-1">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
