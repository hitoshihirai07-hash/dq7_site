// ダメージ計算の中核だけをまとめたファイル。
// ここを差し替えれば、画面（damage.html）は触らずに「式」だけ変更できます。

export const RESIST_LABEL = {
  weak: "弱点",
  normal: "等倍",
  half: "半減",
  immune: "無効",
  absorb: "吸収",
  custom: "倍率入力",
};

// 倍率はデフォルト値（必要なら自由に変更OK）
export const RESIST_MULT = {
  weak: 1.5,
  normal: 1,
  half: 0.5,
  immune: 0,
  absorb: -1,
};

export function toNum(v, fallback = 0) {
  const s = (v ?? "").toString().replace(/,/g, "").trim();
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

export function getResistMul(resistValue, customMul) {
  const key = (resistValue || "normal").toString().trim();
  if (key === "custom") return toNum(customMul, 1);
  return (RESIST_MULT[key] ?? 1);
}

// --- ここが「式」の本体 ---
// 既存の計算式があるなら、この関数だけ差し替えればOK。
export function computeBaseDamage({ atk, def, atkCoef = 1, defCoef = 0.5, mult = 1, add = 0 }) {
  const raw = (atk * atkCoef - def * defCoef) * mult + add;
  return Math.floor(Math.max(0, raw));
}

export function computeDamageRange({ base, randMin = 1, randMax = 1, resistMul = 1, selfMul = 1 }) {
  let a = Math.floor(base * randMin * resistMul * selfMul);
  let b = Math.floor(base * randMax * resistMul * selfMul);
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
