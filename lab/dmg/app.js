(() => {
  'use strict';

  const LS = {
    draft: 'dq7_lab_dmg_draft_v1',
    saved: 'dq7_lab_dmg_saved_v1'
  };

  const el = (id) => document.getElementById(id);

  const enemyNameEl = el('enemyName');
  const conditionMemoEl = el('conditionMemo');
  const optIqrEl = el('optIqr');
  const optTrimHiEl = el('optTrimHi');
  const optTrimLoEl = el('optTrimLo');

  const setsEl = el('sets');
  const resultEl = el('result');
  const savedEl = el('saved');

  const btnAddSet = el('btnAddSet');
  const btnAnalyze = el('btnAnalyze');
  const btnClear = el('btnClear');
  const btnSaveSnapshot = el('btnSaveSnapshot');
  const btnExportAll = el('btnExportAll');
  const importFileEl = el('importFile');

  const setTemplate = el('setTemplate');

  /** Utilities */
  function clamp(n, lo, hi){
    n = Number(n);
    if (Number.isNaN(n)) return lo;
    return Math.min(hi, Math.max(lo, n));
  }

  function nowISO(){
    return new Date().toISOString();
  }

  function parseDamageLog(text){
    // Returns {damages:number[], missDetected:number, unknownLines:number, totalLines:number}
    const lines = String(text || '').split(/\r?\n/);
    const damages = [];
    let missDetected = 0;
    let unknownLines = 0;
    let totalLines = 0;

    for (const rawLine of lines){
      const line = (rawLine || '').trim();
      if (!line) continue;
      totalLines++;

      // If the line contains a number, treat as damage (first number found)
      const numMatch = line.match(/-?\d+/);
      if (numMatch){
        const n = Number(numMatch[0]);
        if (Number.isFinite(n)) {
          damages.push(n);
          continue;
        }
      }

      const s = line.toLowerCase();

      const isMiss =
        s === 'm' || s === 'miss' || s === 'x' || s === '×' || s === '0' ||
        s.includes('miss') || s.includes('ミス') || s.includes('かわされた') || s.includes('回避') ||
        s.includes('よけ') || s.includes('避け') || s.includes('躱') || s.includes('dodge');

      if (isMiss){
        missDetected++;
      } else {
        unknownLines++;
      }
    }

    // Also support pasted logs with numbers separated by spaces/commas on one line.
    if (totalLines <= 1 && damages.length <= 1){
      const tokens = String(text || '')
        .replace(/（.*?）/g, ' ')
        .replace(/[，、]/g, ',')
        .split(/[^0-9\-]+/g)
        .filter(Boolean);

      const nums = [];
      for (const t of tokens){
        const n = Number(t);
        if (Number.isFinite(n)) nums.push(n);
      }
      if (nums.length > damages.length){
        return { damages: nums, missDetected: 0, unknownLines: 0, totalLines: nums.length };
      }
    }

    return { damages, missDetected, unknownLines, totalLines };
  }

  function quantile(sorted, q){
    // sorted asc
    const n = sorted.length;
    if (n === 0) return NaN;
    const pos = (n - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] === undefined) return sorted[base];
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }

  function mean(arr){
    if (!arr.length) return NaN;
    let s = 0;
    for (const x of arr) s += x;
    return s / arr.length;
  }

  function stdev(arr){
    const n = arr.length;
    if (n < 2) return NaN;
    const m = mean(arr);
    let ss = 0;
    for (const x of arr){
      const d = x - m;
      ss += d * d;
    }
    return Math.sqrt(ss / (n - 1)); // sample
  }

  function iqrFilter(sorted){
    if (sorted.length < 4) return { filtered: [...sorted], low: NaN, high: NaN };
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const low = q1 - 1.5 * iqr;
    const high = q3 + 1.5 * iqr;
    const filtered = sorted.filter(x => x >= low && x <= high);
    return { filtered, low, high, q1, q3, iqr };
  }

  function trimFilter(sorted, loPct, hiPct){
    const n = sorted.length;
    if (!n) return [];
    const lo = Math.floor(n * (loPct / 100));
    const hi = Math.floor(n * (hiPct / 100));
    const start = clamp(lo, 0, n);
    const end = clamp(n - hi, 0, n);
    if (end <= start) return [];
    return sorted.slice(start, end);
  }

  function stats(arr){
    const sorted = [...arr].sort((a,b)=>a-b);
    const n = sorted.length;
    if (!n){
      return { n: 0, sorted: [], min: NaN, max: NaN, mean: NaN, median: NaN, stdev: NaN,
               q1: NaN, q3: NaN, iqr: NaN, p10: NaN, p90: NaN };
    }
    const minV = sorted[0];
    const maxV = sorted[n-1];
    const m = mean(sorted);
    const med = quantile(sorted, 0.5);
    const sd = stdev(sorted);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqrV = q3 - q1;
    const p10 = quantile(sorted, 0.10);
    const p90 = quantile(sorted, 0.90);
    return { n, sorted, min: minV, max: maxV, mean: m, median: med, stdev: sd, q1, q3, iqr: iqrV, p10, p90 };
  }

  function fmt(n, digits=2){
    if (!Number.isFinite(n)) return '—';
    return (Math.round(n * (10**digits)) / (10**digits)).toFixed(digits);
  }

  function fmtInt(n){
    if (!Number.isFinite(n)) return '—';
    return String(Math.round(n));
  }

  function linearRegression(xs, ys){
    // returns {slope, intercept, r2}
    const n = xs.length;
    if (n < 2) return { slope: NaN, intercept: NaN, r2: NaN };
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0, den = 0;
    for (let i=0;i<n;i++){
      const dx = xs[i] - mx;
      num += dx * (ys[i] - my);
      den += dx * dx;
    }
    if (den === 0) return { slope: NaN, intercept: NaN, r2: NaN };
    const slope = num / den;
    const intercept = my - slope * mx;

    // r2
    let ssTot=0, ssRes=0;
    for (let i=0;i<n;i++){
      const yi = ys[i];
      const yhat = slope * xs[i] + intercept;
      ssTot += (yi - my) ** 2;
      ssRes += (yi - yhat) ** 2;
    }
    const r2 = ssTot === 0 ? NaN : 1 - (ssRes / ssTot);
    return { slope, intercept, r2 };
  }

  function buildSetDom(){
    const node = setTemplate.content.firstElementChild.cloneNode(true);
    return node;
  }

  function setIdxRefresh(){
    const setNodes = [...setsEl.querySelectorAll('.set')];
    setNodes.forEach((node, i) => {
      node.querySelector('.set-idx').textContent = String(i + 1);
      node.querySelector('.btnRemoveSet').disabled = setNodes.length <= 1;
    });
  }

  function attachSetListeners(node){
    const logEl = node.querySelector('textarea.log');
    const infoEl = node.querySelector('.logInfo');
    const updateInfo = () => {
      const parsed = parseDamageLog(logEl.value);
      const missInput = Number(node.querySelector('input.miss')?.value || 0);
      const miss = (Number.isFinite(missInput) ? Math.max(0, Math.floor(missInput)) : 0) + parsed.missDetected;
      const hits = parsed.damages.length;
      const attempts = hits + miss;
      infoEl.textContent = `${hits}件（ヒット） / ミス${miss}件 / 試行${attempts}回`;
    };
    logEl.addEventListener('input', updateInfo);
    const missEl = node.querySelector('input.miss');
    if (missEl){
      missEl.addEventListener('input', updateInfo);
      missEl.addEventListener('change', updateInfo);
    }
    updateInfo();

    node.querySelector('.btnRemoveSet').addEventListener('click', () => {
      node.remove();
      setIdxRefresh();
      saveDraft();
    });

    node.querySelectorAll('input, textarea').forEach(inp => {
      inp.addEventListener('change', saveDraft);
      inp.addEventListener('input', saveDraft);
    });
  }

  function addSet(data){
    const node = buildSetDom();
    const atkEl = node.querySelector('input.atk');
    const missEl = node.querySelector('input.miss');
    const tagEl = node.querySelector('input.tag');
    const logEl = node.querySelector('textarea.log');

    if (data){
      atkEl.value = data.atk ?? '';
      if (missEl) missEl.value = data.miss ?? '';
      tagEl.value = data.tag ?? '';
      logEl.value = data.log ?? '';
    }

    attachSetListeners(node);
    setsEl.appendChild(node);
    setIdxRefresh();
  }

  function getCurrentInput(){
    const sets = [...setsEl.querySelectorAll('.set')].map(node => ({
      atk: Number(node.querySelector('input.atk').value),
      miss: Number(node.querySelector('input.miss')?.value || 0),
      tag: (node.querySelector('input.tag').value || '').trim(),
      log: node.querySelector('textarea.log').value || ''
    }));
    return {
      enemyName: (enemyNameEl.value || '').trim(),
      conditionMemo: (conditionMemoEl.value || '').trim(),
      options: {
        iqr: !!optIqrEl.checked,
        trimHi: clamp(optTrimHiEl.value, 0, 20),
        trimLo: clamp(optTrimLoEl.value, 0, 20)
      },
      sets
    };
  }

  function setInput(data){
    enemyNameEl.value = data.enemyName || '';
    conditionMemoEl.value = data.conditionMemo || '';
    optIqrEl.checked = !!(data.options && data.options.iqr);
    optTrimHiEl.value = (data.options && Number.isFinite(Number(data.options.trimHi))) ? String(data.options.trimHi) : '0';
    optTrimLoEl.value = (data.options && Number.isFinite(Number(data.options.trimLo))) ? String(data.options.trimLo) : '0';

    setsEl.innerHTML = '';
    const sets = (data.sets && data.sets.length) ? data.sets : [{}];
    for (const s of sets){
      addSet(s);
    }
    setIdxRefresh();
  }

  function saveDraft(){
    const data = getCurrentInput();
    localStorage.setItem(LS.draft, JSON.stringify(data));
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
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }

  function saveSaved(list){
    localStorage.setItem(LS.saved, JSON.stringify(list));
  }

  function analyze(data){
    const { enemyName, conditionMemo, options, sets } = data;
    const trimHi = clamp(options.trimHi, 0, 20);
    const trimLo = clamp(options.trimLo, 0, 20);

    const per = [];
    for (const s of sets){
      const atk = Number(s.atk);
      const parsed = parseDamageLog(s.log);
      const nums = parsed.damages;
      const rawStats = stats(nums);
      const sorted = rawStats.sorted;

      const missInput = Number.isFinite(Number(s.miss)) ? Math.max(0, Math.floor(Number(s.miss))) : 0;
      const misses = missInput + parsed.missDetected;
      const hits = nums.length;
      const attempts = hits + misses;
      const missRate = attempts > 0 ? (misses / attempts) : NaN;

      const iqr = iqrFilter(sorted);
      const iqrStats = stats(iqr.filtered);

      const trimmed = trimFilter(sorted, trimLo, trimHi);
      const trimStats = stats(trimmed);

      // Combined: if iqr+trim both requested, apply iqr then trim
      const iqrThenTrim = trimFilter(iqr.filtered, trimLo, trimHi);
      const iqrTrimStats = stats(iqrThenTrim);

      per.push({
        atk, tag: s.tag || '',
        nums,
        logMeta: { missDetected: parsed.missDetected, unknownLines: parsed.unknownLines, totalLines: parsed.totalLines, missInput },
        hits, misses, attempts, missRate,
        raw: rawStats,
        iqr: iqrStats,
        trim: trimStats,
        iqrMeta: iqr,
        iqrTrim: iqrTrimStats,
        counts: {
          raw: rawStats.n,
          iqr: iqrStats.n,
          trim: trimStats.n,
          iqrTrim: iqrTrimStats.n
        }
      });
    }

    // sort by atk for comparisons
    per.sort((a,b) => (a.atk||0) - (b.atk||0));

    // pick "main" stats to compare: iqrTrim if any cut/iqr enabled else raw
    const useIqr = !!options.iqr;
    const useTrim = (trimHi > 0 || trimLo > 0);

    const pick = (x) => {
      if (useIqr && useTrim) return x.iqrTrim;
      if (useIqr && !useTrim) return x.iqr;
      if (!useIqr && useTrim) return x.trim;
      return x.raw;
    };

    const compare = per
      .filter(x => Number.isFinite(x.atk) && x.atk > 0 && pick(x).n > 0)
      .map(x => ({ atk: x.atk, mean: pick(x).mean, median: pick(x).median, n: pick(x).n, attempts: x.attempts, misses: x.misses, missRate: x.missRate }));

    const reg = linearRegression(compare.map(x=>x.atk), compare.map(x=>x.mean));

    return {
      meta: { enemyName, conditionMemo, options: { ...options, trimHi, trimLo }, analyzedAt: nowISO() },
      per,
      compare,
      regression: reg,
      modeLabel: (useIqr || useTrim)
        ? `比較モード：${useIqr ? 'IQR除外' : ''}${useIqr && useTrim ? '＋' : ''}${useTrim ? `上下カット(${trimLo}%/${trimHi}%)` : ''}`
        : '比較モード：生ログ'
    };
  }

  function render(data, analyzed){
    const { meta, per, compare, regression, modeLabel } = analyzed;

    const heading = `
      <div class="small">
        <strong>${escapeHtml(meta.enemyName || '敵名なし')}</strong>
        <span class="badge">${escapeHtml(meta.conditionMemo || '条件メモなし')}</span>
        <span class="badge">${escapeHtml(modeLabel)}</span>
        <span class="badge">${new Date(meta.analyzedAt).toLocaleString()}</span>
      </div>
    `;

    const kpi = (() => {
      const totalHits = per.reduce((acc, x) => acc + (x.raw.n || 0), 0);
      const setCount = per.length;
      const hasCompare = compare.length >= 2 && Number.isFinite(regression.slope);
      const slope = hasCompare ? regression.slope : NaN;
      const r2 = hasCompare ? regression.r2 : NaN;
      const slopeText = hasCompare ? `${fmt(slope, 3)} / 攻撃+1` : '—';
      const r2Text = hasCompare ? fmt(r2, 3) : '—';

      return `
        <div class="kpi">
          <div class="card"><div class="k">セット数</div><div class="v">${setCount}</div></div>
          <div class="card"><div class="k">総ヒット数</div><div class="v">${totalHits}</div></div>
          <div class="card"><div class="k">平均の伸び（近似）</div><div class="v">${slopeText}</div><div class="small">※同条件・近い範囲のみ目安</div></div>
          <div class="card"><div class="k">近似の当てはまり（R²）</div><div class="v">${r2Text}</div></div>
        </div>
      `;
    })();

    const perTables = per.map((x, idx) => {
      const iqrOn = meta.options.iqr;
      const trimOn = meta.options.trimHi > 0 || meta.options.trimLo > 0;

      const label = (s) => `<span class="badge">${s}</span>`;

      const raw = x.raw;
      const iqr = x.iqr;
      const trim = x.trim;
      const iqrTrim = x.iqrTrim;

      const baseRow = (name, st, extra='') => `
        <tr>
          <td>${name} ${extra}</td>
          <td>${st.n}</td>
          <td>${fmtInt(st.min)}</td>
          <td>${fmtInt(st.max)}</td>
          <td>${fmt(st.mean, 2)}</td>
          <td>${fmt(st.median, 2)}</td>
          <td>${fmt(st.stdev, 2)}</td>
          <td>${fmt(st.p10, 2)}</td>
          <td>${fmt(st.p90, 2)}</td>
          <td>${fmt(st.iqr, 2)}</td>
        </tr>
      `;

      const iqrMeta = x.iqrMeta || {};
      const iqrExtra = Number.isFinite(iqrMeta.low) ? `<span class="badge warn">範囲 ${fmt(iqrMeta.low,2)}〜${fmt(iqrMeta.high,2)}</span>` : '';
      const trimmedExtra = (trimOn) ? `<span class="badge">${meta.options.trimLo}% / ${meta.options.trimHi}%</span>` : '';

      const warn = (raw.n < 10) ? `<span class="badge warn">n少</span>` : (raw.n >= 30 ? `<span class="badge ok">n十分</span>` : `<span class="badge">n中</span>`);

      const head = `
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0 10px">
          <div><strong>セット${idx+1}</strong>：攻撃力 <span style="font-family:var(--mono);font-weight:900">${escapeHtml(String(x.atk || '—'))}</span></div>
          ${x.tag ? `<span class="badge">${escapeHtml(x.tag)}</span>` : ''}
          ${Number.isFinite(x.missRate) ? `<span class="badge">試行${escapeHtml(String(x.attempts))}（H${escapeHtml(String(x.hits))}/M${escapeHtml(String(x.misses))}）</span>` : ''}
          ${Number.isFinite(x.missRate) ? `<span class="badge warn">ミス率 ${escapeHtml((x.missRate*100).toFixed(2))}%</span>` : ''}
          ${warn}
        </div>
      `;

      const rows = [
        baseRow('生ログ', raw, ''),
        baseRow('IQR除外', iqr, iqrExtra),
        baseRow('上下カット', trim, trimmedExtra),
        baseRow('IQR→上下カット', iqrTrim, `${iqrExtra} ${trimmedExtra}`.trim()),
      ].join('');

      return `
        ${head}
        <table class="table">
          <thead>
            <tr>
              <th>種別</th>
              <th>n</th>
              <th>min</th>
              <th>max</th>
              <th>平均</th>
              <th>中央値</th>
              <th>標準偏差</th>
              <th>P10</th>
              <th>P90</th>
              <th>IQR</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }).join('<hr class="sep" />');

    const compareTable = (() => {
      if (compare.length < 2) return `<div class="small">比較は「攻撃力が異なるセットが2つ以上」あると表示されます。</div>`;
      const rows = compare.map((x) => `
        <tr>
          <td>${x.atk}</td>
          <td>${x.n}</td>
          <td>${x.attempts ?? '—'}</td>
          <td>${x.misses ?? '—'}</td>
          <td>${Number.isFinite(x.missRate) ? (x.missRate*100).toFixed(2)+'%' : '—'}</td>
          <td>${fmt(x.mean,2)}</td>
          <td>${fmt(x.median,2)}</td>
        </tr>
      `).join('');

      const slope = regression.slope;
      const per5 = Number.isFinite(slope) ? slope * 5 : NaN;

      const note = Number.isFinite(slope)
        ? `<div class="small">近似：平均 ≒ ${fmt(slope,3)}×攻撃力 + ${fmt(regression.intercept,2)}（R²=${fmt(regression.r2,3)}）／攻撃+5で平均+${fmt(per5,2)}（目安）</div>`
        : `<div class="small">近似は計算できません（攻撃力が同じ/データ不足など）。</div>`;

      return `
        <h3 style="margin:12px 0 8px;font-size:14px">攻撃力別の比較（${escapeHtml(modeLabel)}）</h3>
        <table class="table">
          <thead>
            <tr><th>攻撃力</th><th>n(ヒット)</th><th>試行</th><th>ミス</th><th>ミス率</th><th>平均</th><th>中央値</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${note}
      `;
    })();

    resultEl.classList.remove('empty');
    resultEl.innerHTML = heading + kpi + compareTable + '<hr class="sep" />' + perTables;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
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
      const title = `${item.meta.enemyName || '敵名なし'} / ${item.meta.conditionMemo || '条件メモなし'}`;
      const when = new Date(item.meta.analyzedAt).toLocaleString();
      const sets = item.per?.length ?? 0;

      return `
        <div class="set" style="margin:10px 0">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
            <div>
              <div style="font-weight:900">${escapeHtml(title)}</div>
              <div class="small">${escapeHtml(when)} / セット${sets} / ${escapeHtml(item.modeLabel || '')}</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn ghost" data-act="load" data-idx="${idx}">入力に読み込み</button>
              <button class="btn ghost" data-act="copy" data-idx="${idx}">結果コピー</button>
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
        const savedList = loadSaved();
        const item = savedList[idx];
        if (!item) return;

        if (act === 'load'){
          // load as draft input
          const draft = item.input;
          if (draft) setInput(draft);
          saveDraft();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        if (act === 'del'){
          savedList.splice(idx, 1);
          saveSaved(savedList);
          renderSaved();
          return;
        }
        if (act === 'copy'){
          await copyResultText(item);
          return;
        }
      });
    });
  }

  async function copyToClipboard(text){
    try{
      await navigator.clipboard.writeText(text);
      toast('コピーしました');
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('コピーしました');
    }
  }

  function buildResultText(analyzed){
    const m = analyzed.meta;
    const lines = [];
    lines.push(`[DQ7 検証ラボ] ${m.enemyName || '敵名なし'} / ${m.conditionMemo || '条件メモなし'}`);
    lines.push(`解析: ${m.analyzedAt}`);
    lines.push(`${analyzed.modeLabel || ''}`);
    lines.push('');

    if (analyzed.compare && analyzed.compare.length >= 1){
      lines.push('--- 攻撃力別（平均/中央値/n） ---');
      for (const x of analyzed.compare){
        lines.push(`攻撃${x.atk}: 平均${round(x.mean)} / 中央値${round(x.median)} / ヒットn=${x.n} / 試行${x.attempts ?? '—'} / ミス${x.misses ?? '—'} / ミス率${(Number.isFinite(x.missRate)?(x.missRate*100).toFixed(2)+'%':'—')}`);
      }
      if (Number.isFinite(analyzed.regression?.slope)){
        lines.push(`近似: 攻撃+1で平均+${round(analyzed.regression.slope,3)}（R²=${round(analyzed.regression.r2,3)}）`);
      }
      lines.push('');
    }

    for (let i=0;i<analyzed.per.length;i++){
      const s = analyzed.per[i];
      lines.push(`--- セット${i+1} 攻撃${s.atk}${s.tag ? ` (${s.tag})` : ''} ---`);
      if (Number.isFinite(s.missRate)){
        lines.push(`試行${s.attempts}（ヒット${s.hits}/ミス${s.misses}） ミス率 ${(s.missRate*100).toFixed(2)}%`);
      }
      const show = (label, st) => lines.push(`${label}: n=${st.n} min=${iRound(st.min)} max=${iRound(st.max)} mean=${round(st.mean)} med=${round(st.median)} sd=${round(st.stdev)} p10=${round(st.p10)} p90=${round(st.p90)}`);
      show('生', s.raw);
      show('IQR', s.iqr);
      show('Trim', s.trim);
      show('IQR+Trim', s.iqrTrim);
      lines.push('');
    }

    return lines.join('\n');

    function round(v, d=2){ return Number.isFinite(v) ? v.toFixed(d) : '—'; }
    function iRound(v){ return Number.isFinite(v) ? Math.round(v) : '—'; }
  }

  async function copyResultText(analyzed){
    const txt = buildResultText(analyzed);
    await copyToClipboard(txt);
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

  function clearAll(){
    setInput({
      enemyName: '',
      conditionMemo: '',
      options: { iqr:false, trimHi:0, trimLo:0 },
      sets: [{}]
    });
    saveDraft();
    resultEl.classList.add('empty');
    resultEl.textContent = 'まだ解析してません。';
  }

  function saveSnapshot(){
    const input = getCurrentInput();
    const analyzed = analyze(input);
    // attach input for re-load
    analyzed.input = input;

    const saved = loadSaved();
    saved.push(analyzed);
    // limit size
    while (saved.length > 50) saved.shift();
    saveSaved(saved);
    renderSaved();
    toast('保存しました');
  }

  function exportAll(){
    const data = {
      version: 1,
      exportedAt: nowISO(),
      saved: loadSaved()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dq7_lab_dmg_saved.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importAll(file){
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); } catch {
      toast('JSONが壊れてます');
      return;
    }
    if (!data || !Array.isArray(data.saved)){
      toast('形式が違います');
      return;
    }
    saveSaved(data.saved);
    renderSaved();
    toast('読み込みました');
  }

  /** Init */
  function init(){
    // default one set
    addSet({});
    setIdxRefresh();

    // draft
    const draft = loadDraft();
    if (draft) setInput(draft);

    // persist meta/options
    [enemyNameEl, conditionMemoEl, optIqrEl, optTrimHiEl, optTrimLoEl].forEach(inp => {
      inp.addEventListener('change', saveDraft);
      inp.addEventListener('input', saveDraft);
    });

    btnAddSet.addEventListener('click', () => { addSet({}); saveDraft(); });
    btnAnalyze.addEventListener('click', () => {
      const input = getCurrentInput();
      const analyzed = analyze(input);
      render(input, analyzed);
      saveDraft();
      toast('解析しました');
    });
    btnClear.addEventListener('click', clearAll);
    btnSaveSnapshot.addEventListener('click', saveSnapshot);

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
