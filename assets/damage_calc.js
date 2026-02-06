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


// 会心（確定）ダメージ範囲
// 仕様書にある「(1)守備無視: 攻撃力×0.95〜1.05」「(2)基本ダメ×1.2」を両方計算し、高い方を採用。
// ※会心率（きようさ等）は扱わず、確定会心の“ダメージ”だけを出す。
export function computeCriticalRange({ atk, base, resistMul = 1, cfg }) {
  const a0 = Math.trunc(toNum(atk, 0));
  const b0 = Math.trunc(toNum(base, 0));
  const r = toNum(resistMul, 1);

  // (1) 守備無視：攻撃力そのまま × 0.95〜1.05（端数切り捨て）
  let aMin = Math.trunc(a0 * 0.95);
  let aMax = Math.trunc(a0 * 1.05);
  if (aMin < 1) aMin = 1;
  if (aMax < 1) aMax = 1;

  // (2) 基本ダメ×1.2（乱数は通常計算の乱数レンジを使用 → その後に1.2倍）
  // まず耐性なしで通常の乱数幅を作る
  const normalNoResist = computeDamageRange({ base: b0, resistMul: 1, cfg });
  let bMin = Math.trunc(normalNoResist.min * 1.2);
  let bMax = Math.trunc(normalNoResist.max * 1.2);
  if (bMin < 1) bMin = 1;
  if (bMax < 1) bMax = 1;

  // 高い方を採用（範囲なので min/max はそれぞれ max を取る）
  const rawMin = Math.max(aMin, bMin);
  const rawMax = Math.max(aMax, bMax);

  // 耐性倍率（最後に反映）
  if (r === 0) return { min: 0, max: 0, avg: 0 };

  const x = Math.trunc(rawMin * r);
  const y = Math.trunc(rawMax * r);
  const min = Math.min(x, y);
  const max = Math.max(x, y);
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
