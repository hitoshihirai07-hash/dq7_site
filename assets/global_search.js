import { loadCSV } from "./data.js";
import { escapeHTML } from "./util.js";

function norm(s){
  return (s || "").toString().normalize("NFKC").toLowerCase().trim();
}

function dataUrl(file){
  // /assets/ -> go up to root, then data/current/
  return new URL(`../data/current/${file}`, import.meta.url).href;
}

async function safeLoadCSV(path){
  try{
    return await loadCSV(path);
  }catch(e){
    return null;
  }
}

function groupOrder(label){
  const order = {
    "ボス": 1,
    "キャラ": 2,
    "職業": 3,
    "アイテム": 4,
    "呪文": 5,
    "特技": 6,
    "呪文/特技": 7,
    "メダル": 8,
    "ストーリー": 9,
    "その他": 99,
  };
  return order[label] || 99;
}

function scoreHit(q, name, hay){
  const n = norm(name);
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (hay.startsWith(q)) return 2;
  return 3;
}

function splitCols(s){
  return (s || "")
    .toString()
    .split(/[,|]/)
    .map(x=>x.trim())
    .filter(Boolean);
}

function buildKey(obj, cols){
  const parts = cols.map(c => (obj[c] ?? "").toString().trim()).filter(Boolean);
  return norm(parts.join(" "));
}

function buildDisplay(sourceKey, obj, nameCol){
  if (sourceKey === "story_steps"){
    const chap = (obj.chapter || "").toString().trim();
    const step = (obj.step_no || "").toString().trim();
    const loc = (obj.location || "").toString().trim();
    const era = (obj.era || "").toString().trim();
    const head = [chap, step ? `#${step}` : ""].filter(Boolean).join(" ");
    const core = [loc].filter(Boolean).join(" ");
    return [era ? `【${era}】` : "", head, core].filter(Boolean).join(" ");
  }
  if (sourceKey === "medals"){
    const era = (obj.era || "").toString().trim();
    const area = (obj.area || "").toString().trim();
    const loc = (obj.location || "").toString().trim();
    return [era ? `【${era}】` : "", area, loc].filter(Boolean).join(" ");
  }
  const name = (obj[nameCol] ?? "").toString().trim();
  return name;
}


function stripDecor(s){
  return (s || "")
    .toString()
    .replace(/【[^】]*】/g, " ")
    .replace(/#[0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildListQuery(sourceKey, obj, display){
  if (sourceKey === "story_steps"){
    const loc = (obj.location || "").toString().trim();
    const objv = (obj.objective || "").toString().trim();
    const chap = (obj.chapter || "").toString().trim();
    return ([loc, objv, chap].filter(Boolean).join(" ").trim()) || stripDecor(display);
  }
  if (sourceKey === "medals"){
    const loc = (obj.location || "").toString().trim();
    const area = (obj.area || "").toString().trim();
    return ([loc, area].filter(Boolean).join(" ").trim()) || stripDecor(display);
  }
  return stripDecor(display);
}

function buildURL(source, obj, display){
  const idCol = (source.id_col || "").trim();
  const detail = (source.detail_page || "").trim();
  const list = (source.list_page || "").trim();

  if (idCol && detail){
    const id = (obj[idCol] ?? "").toString().trim();
    if (!id) return "";
    return `./${detail}?id=${encodeURIComponent(id)}`;
  }

  if (list){
    // list page: pass q and (if exists) era / area for nicer jump
    const params = new URLSearchParams();
    params.set("useq", "1");

    if (source.source_key === "story_steps"){
      const era = (obj.era || "").toString().trim();
      if (era) params.set("era", era);
    }
    if (source.source_key === "medals"){
      const era = (obj.era || "").toString().trim();
      const area = (obj.area || "").toString().trim();
      if (era) params.set("era", era);
      if (area) params.set("area", area);
    }

    return `./${list}?${params.toString()}`;
  }

  return "";
}

export async function initGlobalSearch(){
  const input = document.getElementById("globalSearchInput");
  const panel = document.getElementById("globalSearchPanel");
  if (!input || !panel) return;

  let index = null;
  let loading = null;
  let lastQ = "";

  function hide(){
    panel.hidden = true;
    panel.innerHTML = "";
  }

  function show(html){
    panel.innerHTML = html;
    panel.hidden = false;
  }

  async function loadSources(){
    const sources = await safeLoadCSV(dataUrl("search_sources.csv"));
    if (sources && sources.length){
      // enabled filter
      return sources.filter(s => (s.enabled ?? "1").toString().trim() !== "0");
    }
    // fallback (shouldn't happen because file is shipped)
    return [
      { source_key:"bosses", label:"ボス", csv:"bosses.csv", id_col:"boss_id", name_col:"name", detail_page:"boss.html", list_page:"bosses.html", extra_cols:"location,notes" },
      { source_key:"characters", label:"キャラ", csv:"characters.csv", id_col:"chara_id", name_col:"name", detail_page:"character.html", list_page:"characters.html", extra_cols:"notes" },
      { source_key:"jobs", label:"職業", csv:"jobs.csv", id_col:"job_id", name_col:"name", detail_page:"job.html", list_page:"jobs.html", extra_cols:"category,notes" },
      { source_key:"items", label:"アイテム", csv:"items.csv", id_col:"item_id", name_col:"name", detail_page:"item.html", list_page:"items.html", extra_cols:"category,slot,notes" },
      { source_key:"skills", label:"呪文/特技", csv:"skills.csv", id_col:"skill_id", name_col:"name", detail_page:"skill.html", list_page:"skills.html", extra_cols:"type,element,target,notes" },
      { source_key:"medals", label:"メダル", csv:"medals.csv", id_col:"medal_id", name_col:"location", detail_page:"", list_page:"medals.html", extra_cols:"era,area,how,notes" },
      { source_key:"story_steps", label:"ストーリー", csv:"story_steps.csv", id_col:"story_id", name_col:"location", detail_page:"", list_page:"story.html", extra_cols:"era,chapter,objective,notes,boss_id" },
    ];
  }

  async function buildIndex(){
    const sources = await loadSources();

    // bosses name mapping for story links (boss_id -> boss name)
    let bossNameById = new Map();
    try{
      const bosses = await loadCSV(dataUrl("bosses.csv"));
      bossNameById = new Map(bosses.map(b=>[(b.boss_id||"").toString().trim(), (b.name||"").toString().trim()]).filter(x=>x[0]&&x[1]));
    }catch(e){}

    const out = [];

    for (const s of sources){
      const file = (s.csv || "").toString().trim();
      const label = (s.label || "その他").toString().trim() || "その他";
      if (!file) continue;

      const data = await safeLoadCSV(dataUrl(file));
      if (!data) continue;

      const idCol = (s.id_col || "").toString().trim();
      const nameCol = (s.name_col || "name").toString().trim();
      const extraCols = splitCols(s.extra_cols);

      for (const obj of data){
        const display = buildDisplay(s.source_key, obj, nameCol);
        if (!display) continue;

        // group split for skills
        let group = label;
        if (s.source_key === "skills"){
          const t = (obj.type || "").toString().trim();
          group = (t === "呪文") ? "呪文" : "特技";
        }

        // enrich story with boss name searchable
        let keyBase = display;
        if (s.source_key === "story_steps"){
          const bid = (obj.boss_id || "").toString().trim();
          const bname = bid ? (bossNameById.get(bid) || "") : "";
          keyBase = [display, bname].filter(Boolean).join(" ");
        }

        const key = norm([keyBase, buildKey(obj, [nameCol, ...extraCols])].filter(Boolean).join(" "));
        const url = buildURL(s, obj, display);
        if (!url) continue;

        out.push({ group, name: display, key, url });
      }
    }

    return out;
  }

  async function ensureIndex(){
    if (index) return index;
    if (!loading){
      loading = buildIndex().then(x => {
        index = x;
        return x;
      });
    }
    return loading;
  }

  function renderResults(hits){
    const groups = new Map();
    for (const h of hits){
      if (!groups.has(h.group)) groups.set(h.group, []);
      groups.get(h.group).push(h);
    }

    const groupKeys = Array.from(groups.keys()).sort((a,b)=>groupOrder(a)-groupOrder(b) || a.localeCompare(b,"ja"));

    const html = groupKeys.map(g=>{
      const items = groups.get(g).slice(0, 10).map(h=>{
        return `
          <a class="gsearch-item" href="${h.url}">
            <span class="gsearch-name">${escapeHTML(h.name)}</span>
            <span class="gsearch-tag">${escapeHTML(g)}</span>
          </a>
        `;
      }).join("");
      return `
        <div class="gsearch-group">
          <div class="gsearch-group-title">${escapeHTML(g)}</div>
          <div class="gsearch-list">${items}</div>
        </div>
      `;
    }).join("");

    if (!html) return `<div class="gsearch-empty">該当なし</div>`;
    return html;
  }

  
  function handleUseQClick(e){
    const t = e.target;
    if (!(t instanceof Element)) return;
    const a = t.closest("a.gsearch-item");
    if (!a) return;

    try{
      const u = new URL(a.getAttribute("href"), location.href);
      if (u.searchParams.get("useq") !== "1") return;

      e.preventDefault();

      const qraw = (input.value || "").toString().trim();
      u.searchParams.delete("useq");
      if (qraw) u.searchParams.set("q", qraw);

      location.href = u.pathname + (u.search ? u.search : "");
    }catch(err){
      // fallback: do nothing
    }
  }

async function onInput(){
    const q = norm(input.value);
    lastQ = q;

    if (!q){
      hide();
      return;
    }

    if (!index && !panel.innerHTML){
      show(`<div class="gsearch-loading">読み込み中…</div>`);
    }

    const idx = await ensureIndex();
    if (lastQ !== q) return;

    const hits = idx
      .filter(it => it.key.includes(q))
      .map(it => ({...it, _s: scoreHit(q, it.name, it.key)}))
      .sort((a,b)=> a._s-b._s || a.group.localeCompare(b.group,"ja") || a.name.localeCompare(b.name,"ja"))
      .slice(0, 60);

    show(renderResults(hits));
  }

  function onKeydown(e){
    if (e.key === "Escape"){
      input.blur();
      hide();
      return;
    }
  }

  function onDocClick(e){
    const t = e.target;
    if (!(t instanceof Element)) return;
    const within = t.closest(".gsearch");
    if (!within) hide();
  }

  input.addEventListener("input", onInput);
  input.addEventListener("focus", onInput);
  input.addEventListener("keydown", onKeydown);
  panel.addEventListener("click", handleUseQClick);
  document.addEventListener("click", onDocClick);
}
