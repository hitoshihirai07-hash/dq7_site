(() => {
  'use strict';

  const LS = {
    draft: 'dq7_lab_evade_draft_v1',
    saved: 'dq7_lab_evade_saved_v1'
  };

  const el = (id) => document.getElementById(id);

  const enemyNameEl = el('enemyName');
  const moveNameEl = el('moveName');
  const memoEl = el('memo');
  const attemptsEl = el('attempts');
  const evadesEl = el('evades');
  const resultLogEl = el('resultLog');
  const logInfoEl = el('logInfo');

  const btnCalc = el('btnCalc');
  const btnSave = el('btnSave');
  const btnCopy = el('btnCopy');
  const btnClear = el('btnClear');

  const btnExportAll = el('btnExportAll');
  const importFileEl = el('importFile');

  const outEl = el('out');
  const savedEl = el('saved');

  let lastAnalyzed = null;

  function clamp(n, lo, hi){
    n = Number(n);
    if (Number.isNaN(n)) return lo;
    return Math.min(hi, Math.max(lo, n));
  }

  function nowISO(){ return new Date().toISOString(); }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function parseOutcomeLog(text){
    // Returns {attempts, evades, hits, unknownLines}
    const lines = (text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    let a=0, e=0, h=0;
    let unknown = 0;
    for (const line of lines){
      const s = line.toLowerCase();
      if (!s) continue;

      const isEvade =
        s === 'm' || s === 'miss' || s === 'x' || s === '×' || s === '0' ||
        s.includes('miss') || s.includes('ミス') || s.includes('かわされた') || s.includes('回避') || s.includes('避け') ||
        s.includes('よけ') || s.includes('躱') || s.includes('miss!');

      const isHit =
        s === 'h' || s === 'hit' || s === 'o' || s === '○' || s === '1' ||
        s.includes('hit') || s.includes('命中') || s.includes('当た') || s.includes('あた') || s.includes('ヒット');

      if (isEvade && !isHit){
        a++; e++;
      } else if (isHit && !isEvade){
        a++; h++;
      } else {
        // ambiguous / unknown
        unknown++;
      }
    }
    return { attempts: a, evades: e, hits: h, unknownLines: unknown, totalLines: lines.length };
  }

  // Wilson score interval for binomial proportion
  function wilson(pHat, n, z=1.96){
    if (n <= 0) return { lo: NaN, hi: NaN };
    const denom = 1 + (z*z)/n;
    const center = (pHat + (z*z)/(2*n)) / denom;
    const half = (z * Math.sqrt((pHat*(1-pHat) + (z*z)/(4*n)) / n)) / denom;
    return { lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
  }

  function fmtPct(x, d=2){
    if (!Number.isFinite(x)) return '—';
    return (x*100).toFixed(d) + '%';
  }

  function fmtInt(x){
    if (!Number.isFinite(x)) return '—';
    return String(Math.round(x));
  }

  function suggestN(p=0.1, moe=0.05, z=1.96){
    // n ≈ z^2 * p(1-p) / moe^2
    const n = (z*z) * p * (1-p) / (moe*moe);
    return Math.ceil(n);
  }

  function getInput(){
    const parsed = parseOutcomeLog(resultLogEl.value || '');
    const aNum = Number(attemptsEl.value);
    const eNum = Number(evadesEl.value);

    // Prefer log-derived if it has at least one counted attempt
    let attempts, evades, source;
    if (parsed.attempts > 0){
      attempts = parsed.attempts;
      evades = parsed.evades;
      source = `ログ（判定できた ${parsed.attempts}/${parsed.totalLines} 行）`;
    } else {
      attempts = Number.isFinite(aNum) ? aNum : 0;
      evades = Number.isFinite(eNum) ? eNum : 0;
      source = '数字入力';
    }

    attempts = Math.max(0, Math.floor(attempts));
    evades = Math.max(0, Math.floor(evades));

    return {
      enemyName: (enemyNameEl.value || '').trim(),
      moveName: (moveNameEl.value || '').trim(),
      memo: (memoEl.value || '').trim(),
      attempts,
      evades,
      logMeta: parsed,
      source
    };
  }

  function validate(input){
    if (input.attempts <= 0) return '攻撃回数が 1 以上必要です。';
    if (input.evades < 0) return '回避回数が不正です。';
    if (input.evades > input.attempts) return '回避回数が攻撃回数を超えています。';
    return '';
  }

  function analyze(input){
    const p = input.evades / input.attempts;
    const ci95 = wilson(p, input.attempts, 1.96);

    // simple "quality" badge by n
    const n = input.attempts;
    const quality = n >= 200 ? '高' : (n >= 80 ? '中' : '低');

    // Suggested trial counts for common margins (using p-hat and worst-case p=0.5)
    const pHat = clamp(p, 0.001, 0.999);
    const sugg = {
      '±5%': { est: suggestN(pHat, 0.05), worst: suggestN(0.5, 0.05) },
      '±2%': { est: suggestN(pHat, 0.02), worst: suggestN(0.5, 0.02) },
      '±1%': { est: suggestN(pHat, 0.01), worst: suggestN(0.5, 0.01) }
    };

    return {
      meta: {
        enemyName: input.enemyName,
        moveName: input.moveName,
        memo: input.memo,
        source: input.source,
        analyzedAt: nowISO()
      },
      attempts: input.attempts,
      evades: input.evades,
      hits: input.attempts - input.evades,
      evadeRate: p,
      hitRate: 1 - p,
      ci95,
      quality,
      suggestions: sugg,
      input
    };
  }

  function render(an){
    const m = an.meta;

    const title = `
      <div class="small">
        <strong>${escapeHtml(m.enemyName || '敵名なし')}</strong>
        ${m.moveName ? `<span class="chip">${escapeHtml(m.moveName)}</span>` : ''}
        ${m.memo ? `<span class="chip">${escapeHtml(m.memo)}</span>` : ''}
        <span class="chip">${escapeHtml(m.source)}</span>
        <span class="chip">${new Date(m.analyzedAt).toLocaleString()}</span>
      </div>
    `;

    const kpi = `
      <div class="cards">
        <div class="card">
          <div class="card-title">実測 回避率（ミス率）</div>
          <div class="pre" style="font-size:18px;font-weight:900">${escapeHtml(fmtPct(an.evadeRate, 2))}</div>
          <div class="small">95%CI（Wilson）: ${escapeHtml(fmtPct(an.ci95.lo,2))} 〜 ${escapeHtml(fmtPct(an.ci95.hi,2))}</div>
        </div>
        <div class="card">
          <div class="card-title">回数</div>
          <div class="pre">攻撃: ${fmtInt(an.attempts)} / 回避: ${fmtInt(an.evades)} / ヒット: ${fmtInt(an.hits)}</div>
          <div class="small">サンプルの強さ: ${escapeHtml(an.quality)}（ざっくり）</div>
        </div>
      </div>
    `;

    const suggRows = Object.entries(an.suggestions).map(([k,v]) => `
      <tr>
        <td>${escapeHtml(k)}</td>
        <td>${escapeHtml(String(v.est))}</td>
        <td>${escapeHtml(String(v.worst))}</td>
      </tr>
    `).join('');

    const suggestions = `
      <div class="card" style="margin-top:12px">
        <div class="card-title">必要試行回数の目安（95% / ざっくり）</div>
        <div class="small">±は「誤差幅（片側ではなく両側）」のイメージです。</div>
        <table class="pre" style="width:100%;padding:0;border-radius:12px;overflow:hidden">
          <thead>
            <tr style="background:rgba(255,255,255,.04)">
              <th style="padding:10px;text-align:left">目標</th>
              <th style="padding:10px;text-align:left">推定p基準</th>
              <th style="padding:10px;text-align:left">最悪(p=0.5)</th>
            </tr>
          </thead>
          <tbody>
            ${suggRows.replaceAll('<tr>', '<tr style="border-top:1px solid rgba(255,255,255,.06)">')}
          </tbody>
        </table>
      </div>
    `;

    const note = `
      <div class="card" style="margin-top:12px">
        <div class="card-title">注意</div>
        <div class="small">
          ここでの回避率（ミス率）は「その条件での実測」です。<br>
          攻撃側の命中補正、状態異常、技固有の命中判定などがあると、ボス固有の回避と分離できません。<br>
          ボス詳細ページに載せる場合は、<strong>条件メモ</strong>と<strong>試行数</strong>も一緒に残すのが安全です。
        </div>
      </div>
    `;

    outEl.classList.remove('empty');
    outEl.innerHTML = title + kpi + suggestions + note;
  }

  function buildCopyText(an){
    const m = an.meta;
    const lines = [];
    lines.push(`[DQ7 実測 回避率] ${m.enemyName || '敵名なし'}${m.moveName ? ` / ${m.moveName}` : ''}`);
    if (m.memo) lines.push(`条件: ${m.memo}`);
    lines.push(`攻撃 ${an.attempts} 回 / 回避(ミス) ${an.evades} 回`);
    lines.push(`回避率: ${(an.evadeRate*100).toFixed(2)}% （95%CI ${ (an.ci95.lo*100).toFixed(2)}%〜${ (an.ci95.hi*100).toFixed(2)}%）`);
    lines.push(`解析: ${m.analyzedAt} / 入力: ${m.source}`);
    return lines.join('\n');
  }

  async function copyToClipboard(text){
    try{
      await navigator.clipboard.writeText(text);
      toast('コピーしました');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('コピーしました');
    }
  }

  function toast(msg){
    let t = document.getElementById('toast');
    if (!t){
      t = document.createElement('div');
      t.id = 'toast';
      t.style.position = 'fixed';
      t.style.bottom = '18px';
      t.style.left = '50%';
      t.style.transform = 'translateX(-50%)';
      t.style.padding = '10px 12px';
      t.style.background = 'rgba(0,0,0,.8)';
      t.style.border = '1px solid rgba(255,255,255,.14)';
      t.style.color = '#fff';
      t.style.borderRadius = '999px';
      t.style.fontSize = '12px';
      t.style.zIndex = '9999';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(()=>{ t.style.opacity='0'; }, 1400);
  }

  function saveDraft(){
    const d = {
      enemyName: enemyNameEl.value || '',
      moveName: moveNameEl.value || '',
      memo: memoEl.value || '',
      attempts: attemptsEl.value || '',
      evades: evadesEl.value || '',
      resultLog: resultLogEl.value || ''
    };
    localStorage.setItem(LS.draft, JSON.stringify(d));
  }

  function loadDraft(){
    const raw = localStorage.getItem(LS.draft);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function loadSaved(){
    const raw = localStorage.getItem(LS.saved);
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }

  function saveSaved(list){
    localStorage.setItem(LS.saved, JSON.stringify(list));
  }

  function renderSaved(){
    const saved = loadSaved();
    if (!saved.length){
      savedEl.classList.add('empty');
      savedEl.textContent = 'まだ保存がありません。';
      return;
    }
    savedEl.classList.remove('empty');

    const items = saved.slice().reverse().map((item, idxFromEnd) => {
      const idx = saved.length - 1 - idxFromEnd;
      const title = `${item.meta.enemyName || '敵名なし'}${item.meta.moveName ? ' / ' + item.meta.moveName : ''}`;
      const when = new Date(item.meta.analyzedAt).toLocaleString();
      const rate = (item.evadeRate*100).toFixed(2) + '%';
      const n = item.attempts;

      return `
        <div class="card" style="margin:10px 0">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
            <div>
              <div style="font-weight:900">${escapeHtml(title)} <span class="chip">${escapeHtml(rate)}</span></div>
              <div class="small">${escapeHtml(when)} / n=${escapeHtml(String(n))} / ${escapeHtml(item.meta.source || '')}</div>
              ${item.meta.memo ? `<div class="small">条件: ${escapeHtml(item.meta.memo)}</div>` : ''}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn ghost" data-act="load" data-idx="${idx}">入力に戻す</button>
              <button class="btn ghost" data-act="copy" data-idx="${idx}">コピー</button>
              <button class="btn danger" data-act="del" data-idx="${idx}">削除</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    savedEl.innerHTML = items;

    savedEl.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const act = btn.dataset.act;
        const idx = Number(btn.dataset.idx);
        const list = loadSaved();
        const item = list[idx];
        if (!item) return;

        if (act === 'del'){
          list.splice(idx, 1);
          saveSaved(list);
          renderSaved();
          return;
        }
        if (act === 'copy'){
          await copyToClipboard(buildCopyText(item));
          return;
        }
        if (act === 'load'){
          const d = item.input;
          if (d){
            enemyNameEl.value = d.enemyName || '';
            moveNameEl.value = d.moveName || '';
            memoEl.value = d.memo || '';
            attemptsEl.value = d.attempts ?? '';
            evadesEl.value = d.evades ?? '';
            resultLogEl.value = d.resultLog || '';
            updateLogInfo();
            saveDraft();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          return;
        }
      });
    });
  }

  function clearAll(){
    enemyNameEl.value = '';
    moveNameEl.value = '';
    memoEl.value = '';
    attemptsEl.value = '';
    evadesEl.value = '';
    resultLogEl.value = '';
    updateLogInfo();
    saveDraft();
    outEl.classList.add('empty');
    outEl.textContent = 'まだ計算してません。';
    lastAnalyzed = null;
  }

  function exportAll(){
    const data = { version: 1, exportedAt: nowISO(), saved: loadSaved() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dq7_lab_evade_saved.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importAll(file){
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); } catch { toast('JSONが壊れてます'); return; }
    if (!data || !Array.isArray(data.saved)){ toast('形式が違います'); return; }
    saveSaved(data.saved);
    renderSaved();
    toast('読み込みました');
  }

  function updateLogInfo(){
    const p = parseOutcomeLog(resultLogEl.value || '');
    logInfoEl.textContent = `${p.attempts}件（判定できた） / 全${p.totalLines}行`;
  }

  function init(){
    // restore draft
    const d = loadDraft();
    if (d){
      enemyNameEl.value = d.enemyName || '';
      moveNameEl.value = d.moveName || '';
      memoEl.value = d.memo || '';
      attemptsEl.value = d.attempts ?? '';
      evadesEl.value = d.evades ?? '';
      resultLogEl.value = d.resultLog || '';
    }
    updateLogInfo();

    [enemyNameEl, moveNameEl, memoEl, attemptsEl, evadesEl, resultLogEl].forEach(x => {
      x.addEventListener('input', () => { updateLogInfo(); saveDraft(); });
      x.addEventListener('change', () => { updateLogInfo(); saveDraft(); });
    });

    btnCalc.addEventListener('click', () => {
      const input = getInput();
      const err = validate(input);
      if (err){
        alert(err);
        return;
      }
      lastAnalyzed = analyze(input);
      render(lastAnalyzed);
      saveDraft();
      toast('計算しました');
    });

    btnSave.addEventListener('click', () => {
      if (!lastAnalyzed){
        // compute first
        const input = getInput();
        const err = validate(input);
        if (err){ alert(err); return; }
        lastAnalyzed = analyze(input);
        render(lastAnalyzed);
      }
      const list = loadSaved();
      list.push(lastAnalyzed);
      while (list.length > 80) list.shift();
      saveSaved(list);
      renderSaved();
      toast('保存しました');
    });

    btnCopy.addEventListener('click', async () => {
      if (!lastAnalyzed){
        alert('まだ計算してません');
        return;
      }
      await copyToClipboard(buildCopyText(lastAnalyzed));
    });

    btnClear.addEventListener('click', clearAll);

    btnExportAll.addEventListener('click', exportAll);
    importFileEl.addEventListener('change', async () => {
      const f = importFileEl.files?.[0];
      if (!f) return;
      await importAll(f);
      importFileEl.value = '';
    });

    renderSaved();
  }

  init();
})();
