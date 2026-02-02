// ダメージ計算（サイト側の固定設定を使う）

export const RESIST_LABEL = {
  weak: "弱点",
  normal: "等倍",
  half: "半減",
  immune: "無効",
  absorb: "吸収",
};

export const DEFAULT_DAMAGE_CONFIG = {
  version: 1,
  formula: {
    atkCoef: 1.0,
    defCoef: 0.5,
  },
  rand: {
    min: 1.0,
    max: 1.0,
  },
  resistMult: {
    weak: 1.5,
    normal: 1.0,
    half: 0.5,
    immune: 0.0,
    absorb: -1.0,
  },
};

export function toNum(v, fallback = 0) {
  const s = (v ?? "").toString().replace(/,/g, "").trim();
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

export function normalizeDamageConfig(cfg) {
  const c = (cfg && typeof cfg === "object") ? cfg : {};
  const out = JSON.parse(JSON.stringify(DEFAULT_DAMAGE_CONFIG));

  // formula
  out.formula.atkCoef = toNum(c?.formula?.atkCoef, out.formula.atkCoef);
  out.formula.defCoef = toNum(c?.formula?.defCoef, out.formula.defCoef);

  // rand
  out.rand.min = toNum(c?.rand?.min, out.rand.min);
  out.rand.max = toNum(c?.rand?.max, out.rand.max);
  out.rand.min = clamp(out.rand.min, 0, 10);
  out.rand.max = clamp(out.rand.max, 0, 10);

  // resist
  if (c?.resistMult && typeof c.resistMult === "object") {
    for (const k of Object.keys(out.resistMult)) {
      out.resistMult[k] = toNum(c.resistMult[k], out.resistMult[k]);
    }
  }

  return out;
}

export function getResistMul(key, cfg) {
  const k = (key || "normal").toString().trim();
  const c = cfg || DEFAULT_DAMAGE_CONFIG;
  return (c.resistMult && k in c.resistMult) ? c.resistMult[k] : (c.resistMult?.normal ?? 1);
}

// 既存式（係数は設定から反映）
export function computeBaseDamage({ atk, def, mult = 1, add = 0, cfg }) {
  const c = cfg || DEFAULT_DAMAGE_CONFIG;
  const atkCoef = toNum(c?.formula?.atkCoef, 1);
  const defCoef = toNum(c?.formula?.defCoef, 0.5);

  const raw = (atk * atkCoef - def * defCoef) * mult + add;
  return Math.floor(Math.max(0, raw));
}

export function computeDamageRange({ base, resistMul = 1, cfg }) {
  const c = cfg || DEFAULT_DAMAGE_CONFIG;
  const randMin = toNum(c?.rand?.min, 1);
  const randMax = toNum(c?.rand?.max, 1);

  let a = Math.floor(base * randMin * resistMul);
  let b = Math.floor(base * randMax * resistMul);
  if (a > b) [a, b] = [b, a];
  const avg = (a + b) / 2;
  return { min: a, max: b, avg };
}

export function ceilDiv(a, b) {
  if (b === 0) return Infinity;
  return Math.ceil(a / b);
}

export function computeHitsToKill({ hp, dmgMin, dmgMax, dmgAvg }) {
  const H = toNum(hp, 0);
  if (H <= 0) return { best: null, avg: null, worst: null };

  const best = (dmgMax > 0) ? ceilDiv(H, dmgMax) : null;
  const avg = (dmgAvg > 0) ? ceilDiv(H, dmgAvg) : null;
  const worst = (dmgMin > 0) ? ceilDiv(H, dmgMin) : null;

  return { best, avg, worst };
}
