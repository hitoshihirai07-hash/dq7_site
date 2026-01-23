(function(){
  const $ = (q)=>document.querySelector(q);
  const $$ = (q)=>[...document.querySelectorAll(q)];
  const esc = (s)=>String(s??"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;"," >":"&gt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]||m));
  const LS_KEY = "rqa_admin_notes_v1";

  async function loadData(){
    try{
      const r = await fetch("/admin/data.json", { cache:"no-store" });
      if(!r.ok) throw new Error("data.json fetch failed");
      return await r.json();
    }catch(e){
      return { version:"-", lastUpdated:"-", adsenseChecklist:[], knownIssues:[], incidentLog:[] };
    }
  }

  function getNotes(){ try{ return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }catch(e){ return []; } }
  function setNotes(list){ localStorage.setItem(LS_KEY, JSON.stringify(list)); }

  function fmtDate(d){ try{ return new Date(d).toLocaleString(); }catch(e){ return String(d||""); } }

  function renderHome(data){
    const el = $("#adminHome");
    if(!el) return;
    const counts = { issues:(data.knownIssues||[]).length, notes:getNotes().length };
    el.innerHTML = `
      <section class="hero">
        <div class="h1">管理トップ</div>
        <div class="p muted">運用メモ / チェックリスト / トラブル対応をここに集約。</div>
        <div style="margin-top:12px" class="small muted">data: v${esc(data.version)} / update: ${esc(data.lastUpdated)}</div>
      </section>

      <div class="adminGrid" style="margin-top:12px">
        <section class="card adminCard">
          <div class="h2">AdSense運用</div>
          <div class="small muted">審査/運用の安定化チェック。</div>
          <div style="margin-top:10px"><a class="btn primary" href="/admin/adsense.html">チェックを見る</a></div>
        </section>

        <section class="card adminCard">
          <div class="h2">不具合メモ</div>
          <div class="small muted">既知の不具合：${counts.issues}件 / 端末メモ：${counts.notes}件</div>
          <div style="margin-top:10px"><a class="btn" href="/admin/bugs.html">一覧を見る</a></div>
        </section>

        <section class="card adminCard">
          <div class="h2">管理ツール</div>
          <div class="small muted">キャッシュ/ローカルデータの確認・初期化。</div>
          <div style="margin-top:10px"><a class="btn" href="/admin/tools.html">ツールを開く</a></div>
        </section>

        <section class="card adminCard">
          <div class="h2">アクセス</div>
          <div class="small muted">URL直打ち：<span class="kbd">/admin/</span></div>
          <div class="small muted" style="margin-top:8px">※管理ページは広告を置かず、検索にも出さない運用が安全です。</div>
        </section>
      </div>
    `;
  }

  function renderAdsense(data){
    const el = $("#adminAdsense");
    if(!el) return;

    const blocks = (data.adsenseChecklist||[]).map(sec=>{
      const items = (sec.items||[]).map(t=>`<li>${esc(t)}</li>`).join("");
      return `
        <section class="card adminCard">
          <div class="row">
            <div class="h2">${esc(sec.key)}</div>
            <span class="adminTag">チェック</span>
          </div>
          <ul class="list">${items}</ul>
        </section>
      `;
    }).join("");

    el.innerHTML = `
      <section class="hero">
        <div class="h1">AdSense運用（安定化）</div>
        <div class="p muted">「薄い/未完成」「ナビゲーション問題」系の事故を防ぐための点検表。</div>
        <div class="small muted" style="margin-top:10px">
          目安：<span class="kbd">/play</span>は静的説明あり / <span class="kbd">/stats</span>に“読み込み中”を残さない
        </div>
      </section>
      <div class="adminGrid" style="margin-top:12px">
        ${blocks}
      </div>

      <section class="card" style="margin-top:12px">
        <div class="h2">落ちた時の手順（テンプレ）</div>
        <ol class="list">
          <li>落ちた理由の文言を保存</li>
          <li>該当ページ（/play / /stats / ルール / FAQ / プライバシー）を見直し</li>
          <li>“止まる表示”や“リンク切れ”をゼロにする</li>
          <li>修正後、数日置いてから再申請（連打しない）</li>
        </ol>
      </section>
    `;
  }

  function renderBugs(data){
    const el = $("#adminBugs");
    if(!el) return;

    const known = (data.knownIssues||[]).map(k=>{
      const tag = k.status==="fix" ? "対応済" : (k.status==="wip" ? "調査中" : "メモ");
      return `
        <tr>
          <td>${esc(k.id)}</td>
          <td>${esc(tag)}</td>
          <td>${esc(k.title)}</td>
          <td class="small muted">${esc(k.symptom||"")}</td>
          <td class="small">${esc(k.fix||"")}</td>
        </tr>
      `;
    }).join("");

    const notes = getNotes();
    const notesRows = notes.map((n, idx)=>`
      <tr>
        <td>${idx+1}</td>
        <td class="small muted">${esc(fmtDate(n.at))}</td>
        <td>${esc(n.title||"")}</td>
        <td class="small">${esc(n.body||"")}</td>
        <td><button class="btn" data-del="${idx}">削除</button></td>
      </tr>
    `).join("");

    el.innerHTML = `
      <section class="hero">
        <div class="h1">不具合メモ</div>
        <div class="p muted">「既知の不具合（共通）」＋「この端末だけのメモ」を分けて管理。</div>
      </section>

      <section class="card" style="margin-top:12px">
        <div class="h2">既知の不具合（共通）</div>
        <div style="overflow:auto;margin-top:10px">
          <table class="table">
            <thead><tr><th>ID</th><th>状態</th><th>概要</th><th>症状</th><th>対処</th></tr></thead>
            <tbody>${known || `<tr><td colspan="5" class="small muted">なし</td></tr>`}</tbody>
          </table>
        </div>
        <div class="small muted" style="margin-top:8px">※共通メモは <span class="kbd">/admin/data.json</span> を編集して更新します。</div>
      </section>

      <section class="card" style="margin-top:12px">
        <div class="h2">端末メモ（ローカル保存）</div>
        <div class="small muted">この端末のlocalStorageに保存します。サーバー送信なし。</div>

        <div class="hr"></div>
        <div class="row" style="gap:10px;align-items:flex-start">
          <div style="flex:1;min-width:220px">
            <div class="small muted">タイトル</div>
            <input id="noteTitle" class="input" placeholder="例）iPhoneでボタンが押しにくい">
          </div>
          <div style="flex:2;min-width:260px">
            <div class="small muted">内容</div>
            <input id="noteBody" class="input" placeholder="例）/playの選択が狭い → 余白調整で改善">
          </div>
          <div style="padding-top:20px">
            <button id="addNoteBtn" class="btn primary">追加</button>
          </div>
        </div>

        <div style="overflow:auto;margin-top:12px">
          <table class="table">
            <thead><tr><th>#</th><th>日時</th><th>タイトル</th><th>内容</th><th></th></tr></thead>
            <tbody>${notesRows || `<tr><td colspan="5" class="small muted">まだメモがありません</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    `;

    const addBtn = $("#addNoteBtn");
    if(addBtn){
      addBtn.onclick = ()=>{
        const t = ($("#noteTitle")?.value||"").trim();
        const b = ($("#noteBody")?.value||"").trim();
        if(!t && !b) return;
        const list = getNotes();
        list.unshift({ at: new Date().toISOString(), title:t, body:b });
        setNotes(list);
        renderBugs(data);
      };
    }
    $$("button[data-del]").forEach(btn=>{
      btn.onclick = ()=>{
        const idx = parseInt(btn.getAttribute("data-del"),10);
        const list = getNotes();
        if(Number.isFinite(idx)){ list.splice(idx,1); setNotes(list); renderBugs(data); }
      };
    });
  }

  function renderTools(){
    const el = $("#adminTools");
    if(!el) return;

    const keys = Object.keys(localStorage).filter(k=>k.startsWith("rqa_")).sort();
    const rows = keys.map(k=>{
      const v = localStorage.getItem(k);
      const size = (v? v.length:0);
      return `<tr><td>${esc(k)}</td><td class="small muted">${size} chars</td></tr>`;
    }).join("");

    el.innerHTML = `
      <section class="hero">
        <div class="h1">管理ツール</div>
        <div class="p muted">端末保存のデータを確認・初期化できます。</div>
      </section>

      <section class="card" style="margin-top:12px">
        <div class="h2">localStorage（rqa_*）</div>
        <div class="small muted">確認だけ。必要なら下のボタンでリセット。</div>
        <div style="overflow:auto;margin-top:10px">
          <table class="table">
            <thead><tr><th>Key</th><th>Size</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="2" class="small muted">該当キーなし</td></tr>`}</tbody>
          </table>
        </div>
        <div class="hr"></div>
        <div class="btnRow">
          <button id="resetStats" class="btn">戦績を初期化</button>
          <button id="resetAll" class="btn">rqa_* を全部初期化</button>
        </div>
        <div class="small muted" style="margin-top:8px">※初期化すると端末の戦績/進行が消えます。</div>
      </section>
    `;

    $("#resetStats").onclick = ()=>{
      ["rqa_stats_v1","rqa_rank_v1"].forEach(k=>localStorage.removeItem(k));
      location.reload();
    };
    $("#resetAll").onclick = ()=>{
      Object.keys(localStorage).forEach(k=>{ if(k.startsWith("rqa_")) localStorage.removeItem(k); });
      location.reload();
    };
  }

  document.addEventListener("DOMContentLoaded", async ()=>{
    const data = await loadData();
    renderHome(data);
    renderAdsense(data);
    renderBugs(data);
    renderTools();
  });
})();
