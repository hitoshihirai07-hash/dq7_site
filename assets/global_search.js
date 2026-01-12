import { loadCSV } from "./data.js";
import { escapeHTML } from "./util.js";

function norm(s){
  return (s || "").toString().normalize("NFKC").toLowerCase().trim();
}

function urlData(pathFromRoot){
  // global_search.js is under /assets/, so go up one level.
  return new URL(`../${pathFromRoot}`, import.meta.url).href;
}

function groupOrder(label){
  const order = {
    "ボス": 1,
    "キャラ": 2,
    "職業": 3,
    "アイテム": 4,
    "呪文": 5,
    "特技": 6,
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

export function initGlobalSearch(){
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

  async function buildIndex(){
    const [bosses, chars, jobs, items, skills] = await Promise.all([
      loadCSV(urlData("data/current/bosses.csv")),
      loadCSV(urlData("data/current/characters.csv")),
      loadCSV(urlData("data/current/jobs.csv")),
      loadCSV(urlData("data/current/items.csv")),
      loadCSV(urlData("data/current/skills.csv")),
    ]);

    const out = [];

    for (const b of bosses){
      const id = (b.boss_id || "").toString().trim();
      const name = (b.name || "").toString().trim();
      if (!id || !name) continue;
      out.push({
        group: "ボス",
        name,
        key: norm(name),
        url: `./boss.html?id=${encodeURIComponent(id)}`
      });
    }

    for (const c of chars){
      const id = (c.chara_id || "").toString().trim();
      const name = (c.name || "").toString().trim();
      if (!id || !name) continue;
      out.push({
        group: "キャラ",
        name,
        key: norm(name),
        url: `./character.html?id=${encodeURIComponent(id)}`
      });
    }

    for (const j of jobs){
      const id = (j.job_id || "").toString().trim();
      const name = (j.name || "").toString().trim();
      if (!id || !name) continue;
      out.push({
        group: "職業",
        name,
        key: norm(name),
        url: `./job.html?id=${encodeURIComponent(id)}`
      });
    }

    for (const it of items){
      const id = (it.item_id || "").toString().trim();
      const name = (it.name || "").toString().trim();
      if (!id || !name) continue;
      const cat = (it.category || "").toString().trim();
      const slot = (it.slot || "").toString().trim();
      const extra = [cat, slot].filter(Boolean).join(" ");
      out.push({
        group: "アイテム",
        name,
        key: norm(name + " " + extra),
        url: `./item.html?id=${encodeURIComponent(id)}`
      });
    }

    for (const s of skills){
      const id = (s.skill_id || "").toString().trim();
      const name = (s.name || "").toString().trim();
      if (!id || !name) continue;
      const type = (s.type || "").toString().trim();
      const group = (type === "呪文") ? "呪文" : "特技";
      const extra = [type, s.element, s.target].map(x => (x||"").toString().trim()).filter(Boolean).join(" ");
      out.push({
        group,
        name,
        key: norm(name + " " + extra),
        url: `./skill.html?id=${encodeURIComponent(id)}`
      });
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

  function renderResults(q, hits){
    // group
    const groups = new Map();
    for (const h of hits){
      if (!groups.has(h.group)) groups.set(h.group, []);
      groups.get(h.group).push(h);
    }

    const groupKeys = Array.from(groups.keys()).sort((a,b)=>groupOrder(a)-groupOrder(b) || a.localeCompare(b,"ja"));

    const html = groupKeys.map(g=>{
      const items = groups.get(g).slice(0, 8).map(h=>{
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

  async function onInput(){
    const q = norm(input.value);
    lastQ = q;

    if (!q){
      hide();
      return;
    }

    // show quick loading UI the first time
    if (!index && !panel.innerHTML){
      show(`<div class="gsearch-loading">読み込み中…</div>`);
    }

    const idx = await ensureIndex();
    if (lastQ !== q) return;

    const hits = idx
      .filter(it => it.key.includes(q))
      .map(it => ({...it, _s: scoreHit(q, it.name, it.key)}))
      .sort((a,b)=> a._s-b._s || a.group.localeCompare(b.group,"ja") || a.name.localeCompare(b.name,"ja"))
      .slice(0, 40);

    show(renderResults(q, hits));
  }

  function onKeydown(e){
    if (e.key === "Escape"){
      input.blur();
      hide();
      return;
    }
    if (e.key === "Enter"){
      const q = norm(input.value);
      if (!q) return;
      // If there's exactly one first result currently rendered, go there
      const first = panel.querySelector(".gsearch-item");
      if (first && panel.querySelectorAll(".gsearch-item").length === 1){
        e.preventDefault();
        first.click();
      }
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
  document.addEventListener("click", onDocClick);
}
