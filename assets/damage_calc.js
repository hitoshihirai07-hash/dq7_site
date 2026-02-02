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
export function computeBaseDamage({ atk, def, mult = 1, cfg }) {
  const c = cfg || DEFAULT_DAMAGE_CONFIG;
  const atkCoef = toNum(c?.formula?.atkCoef, 0.5);
  const defCoef = toNum(c?.formula?.defCoef, 0.25);

  // まず基本値（端数切り捨て）
  const basic0 = Math.trunc(atk * atkCoef - def * defCoef);
  // 技倍率を反映（端数切り捨て）
  const basic = Math.trunc(basic0 * mult);

  return basic;
}

export function computeDamageRange({ base, resistMul = 1, cfg }) {
  // 幅 = 基本値 ÷ 16 + 1（Qiita式）
  const b0 = Math.trunc(base);

  // 無効は常に0
  if (resistMul === 0) return { min: 0, max: 0, avg: 0 };

  // 基本値が0以下でも最低1ダメージ扱い（物理想定）
  const b = (b0 <= 0) ? 1 : b0;

  const width = Math.trunc(Math.round(b / 16 + 1));
  let minRaw = b - width;
  let maxRaw = b + width;

  // 最低ダメージ（0以下にならない）
  if (minRaw < 1) minRaw = 1;

  // 属性等の倍率を反映
  const a = Math.trunc(minRaw * resistMul);
  const c = Math.trunc(maxRaw * resistMul);

  const min = Math.min(a, c);
  const max = Math.max(a, c);
  const avg = (min + max) / 2;
  return { min, max, avg };
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
