// Design Forge 클라이언트 타입 — 서버 forge.mjs 변형/세션 스키마와 1:1 대응.
export type ForgeKind = "html" | "image" | "image2html";
export type ForgeStatus = "pending" | "running" | "done" | "error";
export type SessionStatus = "created" | "generating" | "ready" | "error";

export interface ForgeVariant {
  id: string;
  sessionId: string;
  kind: ForgeKind;
  engine: string;
  strategy: string | null;
  style: string | null;
  prompt: string | null;
  status: ForgeStatus;
  file: string | null;        // 웹 경로(/data/forge/...) — html 또는 이미지
  fileSize: number;
  generatedAt: number | null;
  generationTimeMs: number;
  elo: number;
  wins: number;
  losses: number;
  error: string | null;
  derivedFrom: string | null;
  refImage?: string | null;   // image2html 의 참고 이미지
}

export interface ForgeSession {
  id: string;
  title: string;
  prompt: string;
  createdAt: number;
  status: SessionStatus;
  matrix: Array<Record<string, unknown>>;
  variants: ForgeVariant[];
  matches?: { matches: ForgeMatch[]; elo: Record<string, number> };
}

export interface ForgeMatch {
  variantA: string;
  variantB: string;
  result: 0 | 0.5 | 1;
  timeMs: number;
  at: number;
}

export interface ForgeSessionSummary {
  id: string;
  title: string;
  status: SessionStatus;
  createdAt: number;
  variantCount: number;
}

export interface ForgeCapabilities {
  clis: string[];
  strategies: string[];
  styles: { key: string; label: string }[];
  imageEngines: string[];
}

export interface ForgeStatusResp {
  status: SessionStatus;
  total: number;
  done: number;
  error: number;
  pending: number;
  variants: ForgeVariant[];
}

export interface ForgeExportResult {
  ok: boolean;
  chosenId: string;
  files: { designMd: string; variablesCss: string; exampleHtml: string };
  tokens: { colors: string[]; fonts: string[]; customProps: Record<string, string> };
}
