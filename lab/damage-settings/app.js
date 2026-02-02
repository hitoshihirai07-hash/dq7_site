import { DEFAULT_DAMAGE_CONFIG, normalizeDamageConfig, toNum } from "../../assets/damage_calc.js";

const EL = {
  randMin: document.getElementById("randMin"),
  randMax: document.getElementById("randMax"),
  atkCoef: document.getElementById("atkCoef"),
  defCoef: document.getElementById("defCoef"),
  mulWeak: document.getElementById("mulWeak"),
  mulNormal: document.getElementById("mulNormal"),
  mulHalf: document.getElementById("mulHalf"),
  mulImmune: document.getElementById("mulImmune"),
  mulAbsorb: document.getElementById("mulAbsorb"),
  preview: document.getElementById("preview"),
  msg: document.getElementById("msg"),
  btnReload: document.getElementById("btnReload"),
  btnSaveLocal: document.getElementById("btnSaveLocal"),
  btnExport: document.getElementById("btnExport"),
  btnReset: document.getElementById("btnReset"),
};

const LS_KEY = "dq7_damage_config_v1";

function getFormConfig(){
  const cfg = {
    version: 1,
    formula: {
      atkCoef: toNum(EL.atkCoef.value, 1.0),
      defCoef: toNum(EL.defCoef.value, 0.5),
    },
    rand: {
      min: toNum(EL.randMin.value, 1.0),
      max: toNum(EL.randMax.value, 1.0),
    },
    resistMult: {
      weak: toNum(EL.mulWeak.value, 1.5),
      normal: toNum(EL.mulNormal.value, 1.0),
      half: toNum(EL.mulHalf.value, 0.5),
      immune: toNum(EL.mulImmune.value, 0.0),
      absorb: toNum(EL.mulAbsorb.value, -1.0),
    }
  };
  return normalizeDamageConfig(cfg);
}

function setForm(cfg){
  const c = normalizeDamageConfig(cfg);

  EL.randMin.value = c.rand.min;
  EL.randMax.value = c.rand.max;
  EL.atkCoef.value = c.formula.atkCoef;
  EL.defCoef.value = c.formula.defCoef;

  EL.mulWeak.value = c.resistMult.weak;
  EL.mulNormal.value = c.resistMult.normal;
  EL.mulHalf.value = c.resistMult.half;
  EL.mulImmune.value = c.resistMult.immune;
  EL.mulAbsorb.value = c.resistMult.absorb;

  renderPreview();
}

function renderPreview(){
  const c = getFormConfig();
  EL.preview.textContent = JSON.stringify(c, null, 2);
}

function toast(text){
  EL.msg.textContent = text;
  setTimeout(()=>{ EL.msg.textContent = ""; }, 2500);
}

async function loadFromSite(){
  try{
    const r = await fetch("../../data/current/damage_config.json", { cache: "no-store" });
    if (!r.ok) throw new Error("読み込みに失敗しました");
    const cfg = await r.json();
    setForm(cfg);
    toast("現在の設定を読み込みました");
  }catch(e){
    setForm(DEFAULT_DAMAGE_CONFIG);
    toast("設定が見つからないため、初期値にしました");
  }
}

function saveLocal(){
  const c = getFormConfig();
  localStorage.setItem(LS_KEY, JSON.stringify(c));
  toast("端末内に保存しました");
}

function loadLocalIfAny(){
  try{
    const s = localStorage.getItem(LS_KEY);
    if (!s) return false;
    setForm(JSON.parse(s));
    toast("端末内の保存を読み込みました");
    return true;
  }catch(e){
    return false;
  }
}

function exportJson(){
  const c = getFormConfig();
  const blob = new Blob([JSON.stringify(c, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "damage_config.json";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  toast("JSONを書き出しました");
}

function resetAll(){
  setForm(DEFAULT_DAMAGE_CONFIG);
  toast("初期値に戻しました");
}

for (const k of Object.keys(EL)){
  const el = EL[k];
  if (el && el.classList && el.classList.contains("input")){
    el.addEventListener("input", renderPreview);
  }
}

EL.btnReload.addEventListener("click", loadFromSite);
EL.btnSaveLocal.addEventListener("click", saveLocal);
EL.btnExport.addEventListener("click", exportJson);
EL.btnReset.addEventListener("click", resetAll);

// init
(async ()=>{
  const hasLocal = loadLocalIfAny();
  if (!hasLocal) await loadFromSite();
})();
