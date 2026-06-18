export type IconName = string;
export const ICON_NAMES: Record<string, [number, number]> = {};
export function getIconUrl(_name: string): string | undefined { return undefined; }
export function ensureAtlas(): Promise<void> { return Promise.resolve(); }
export function isAtlasReady(): boolean { return true; }
