export type TierSettings = {
  widthMM: number;
  depthMM: number;
  lowerHeightMM: number;
  middleHeightMM: number;
  upperHeightMM: number;
};
export const DEFAULT_TIERS: TierSettings = { widthMM: 250, depthMM: 180, lowerHeightMM: 40, middleHeightMM: 40, upperHeightMM: 20 };
export function normalizeTiers(value: Partial<TierSettings> = {}): TierSettings {
  const result = { ...DEFAULT_TIERS };
  for (const key of Object.keys(result) as (keyof TierSettings)[]) {
    const n = Number(value[key] ?? result[key]);
    result[key] = Number.isFinite(n) ? Math.max(key === "widthMM" ? 5 : 1, n) : result[key];
  }
  return result;
}
export function tierGeometry(value: Partial<TierSettings> = {}) {
  const t = normalizeTiers(value);
  return {
    settings: t,
    width: t.widthMM + 6,
    depth: t.depthMM + 6,
    height: t.lowerHeightMM + 5 + t.middleHeightMM + 2 + t.upperHeightMM + 2,
    trays: [
      { widthMM: t.widthMM, depthMM: t.depthMM, heightMM: t.lowerHeightMM, count: 1 },
      { widthMM: t.widthMM, depthMM: t.depthMM, heightMM: t.middleHeightMM, count: 1 },
      { widthMM: (t.widthMM - 3) / 2, depthMM: t.depthMM, heightMM: t.upperHeightMM, count: 2 },
    ],
  };
}
