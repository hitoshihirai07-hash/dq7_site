(() => {
  'use strict';

  const el = (id) => document.getElementById(id);

  const fileEl = el('file');
  const dropEl = el('drop');

  const keyColEl = el('keyCol');
  const reqColsEl = el('reqCols');
  const nullWarnEl = el('nullWarn');
  const nameColEl = el('nameCol');

  const btnRun = el('btnRun');
  const btnClear = el('btnClear');
  const btnCopyReport = el('btnCopyReport');

  const outEl = el('out');

  let currentFile = null;
  let lastReportText = '';

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function parseCSV(text){
    // Minimal CSV parser supporting quoted fields.
    const rows = [];
    let row = [];
    let cur = '';
    let inQ = false;
    for (let i=0;i<text.length;i++){
      const ch = text[i];
      const nxt = text[i+1];
      if (inQ){
        if (ch === '"' && nxt === '"'){
          cur += '"'; i++;
        } else if (ch === '"'){
          inQ = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"'){
          inQ = true;
        } else if (ch === ','){
          row.push(cur); cur = '';
        } else if (ch === '\n'){
          row.push(cur); rows.push(row); row = []; cur = '';
        } else if (ch === '\r'){
          // ignore
        } else {
          cur += ch;
        }
      }
    }
    row.push(cur);
    rows.push(row);
    // Trim trailing empty rows
    while (rows.length && rows[rows.length-1].every(x => (x||'').trim()==='')) rows.pop();
    return rows;
  }

  function toObjectsFromCSV(rows){
    if (!rows.length) return { header: [], data: [] };
    const header = rows[0].map(h => (h||'').trim());
    const data = [];
    for (let i=1;i<rows.length;i++){
      const r = rows[i];
      const o = {};
      for (let j=0;j<header.length;j++){
        o[header[j]] = (r[j] ?? '').trim();
      }
      data.push(o);
    }
    return { header, data };
  }

  function toObjectsFromJSON(text){
    const v = JSON.parse(text);
    if (Array.isArray(v)) return { data: v, header: collectKeys(v) };
    if (v && typeof v === 'object'){
      // common patterns: {items:[...]} or {data:[...]}
      const arr = v.items || v.data || v.rows || null;
      if (Array.isArray(arr)) return { data: arr, header: collectKeys(arr) };
      // object map
      const arr2 = Object.values(v);
      if (arr2.every(x => x && typeof x === 'object')) return { data: arr2, header: collectKeys(arr2) };
    }
    throw new Error('JSON形式が想定外です（配列または items/data を含むオブジェクトを想定）');
  }

  function collectKeys(arr){
    const s = new Set();
    for (const o of arr){
      if (!o || typeof o !== 'object') continue;
      Object.keys(o).forEach(k => s.add(k));
    }
    return [...s];
  }

  function guessKeyCol(header){
    const cand = ['id','ID','Id','uid','UID','key','Key','slug'];
    for (const c of cand){
      if (header.includes(c)) return c;
    }
    // try case-insensitive
    const lower = header.map(h => h.toLowerCase());
    const idx = lower.indexOf('id');
    if (idx >= 0) return header[idx];
    return '';
  }

  function guessNameCol(header){
    const cand = ['name','title','名前','名称'];
    for (const c of cand){
      if (header.includes(c)) return c;
    }
    const lower = header.map(h => h.toLowerCase());
    const idx = lower.indexOf('name');
    if (idx >= 0) return header[idx];
    return '';
  }

  function normName(s){
    if (s == null) return '';
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/[\s\u3000]+/g, '') // spaces (half/full)
      .replace(/[‐‑‒–—―ー]/g, '-') // dash variants
      .replace(/[！!]/g, '!')
      .replace(/[？?]/g, '?')
      .replace(/[（）()]/g, '') // parens
      .replace(/[【】\[\]]/g, '');
  }

  function analyze({ header, data }){
    const total = data.length;

    const keyCol = (keyColEl.value || '').trim() || guessKeyCol(header);
    const reqCols = (reqColsEl.value || '').split(',').map(s => s.trim()).filter(Boolean);
    const required = reqCols.length ? reqCols : (keyCol ? [keyCol] : []);
    const nullWarn = Math.max(0, Math.min(100, Number(nullWarnEl.value || 60)));

    // Missing required cols
    const missingReq = required.filter(c => !header.includes(c));

    // Key checks
    const keyMissing = [];
    const keyDup = new Map();
    const seen = new Set();
    if (keyCol && header.includes(keyCol)){
      for (let i=0;i<data.length;i++){
        const v = (data[i][keyCol] ?? '').toString().trim();
        if (!v){
          keyMissing.push(i+1);
          continue;
        }
        if (seen.has(v)){
          if (!keyDup.has(v)) keyDup.set(v, []);
          keyDup.get(v).push(i+1);
        } else {
          seen.add(v);
        }
      }
    }

    // Null/blank rates per column
    const blankCounts = {};
    for (const h of header){
      blankCounts[h] = 0;
    }
    for (const row of data){
      for (const h of header){
        const v = row[h];
        if (v == null || String(v).trim() === '') blankCounts[h]++;
      }
    }

    const blankRates = header.map(h => ({
      col: h,
      blanks: blankCounts[h],
      rate: total ? (blankCounts[h]/total*100) : 0
    })).sort((a,b)=>b.rate-a.rate);

    // Name variants
    let nameCol = nameColEl.value || '';
    if (!nameCol) nameCol = guessNameCol(header);
    const nameIssues = [];
    if (nameCol && header.includes(nameCol)){
      const map = new Map(); // norm -> {examples:Set, rows:[]}
      for (let i=0;i<data.length;i++){
        const raw = (data[i][nameCol] ?? '').toString().trim();
        if (!raw) continue;
        const norm = normName(raw);
        if (!norm) continue;
        if (!map.has(norm)) map.set(norm, { examples: new Set(), rows: [] });
        const e = map.get(norm);
        e.examples.add(raw);
        e.rows.push(i+1);
      }
      for (const [norm, e] of map.entries()){
        const ex = [...e.examples];
        if (ex.length >= 2){
          // only keep if examples differ materially
          nameIssues.push({ norm, examples: ex.slice(0, 8), rows: e.rows.slice(0, 12) });
        }
      }
      nameIssues.sort((a,b)=>b.examples.length - a.examples.length);
    }

    // Build report
    const report = {
      totalRows: total,
      headerCount: header.length,
      keyCol,
      required,
      missingRequiredColumns: missingReq,
      keyMissingRows: keyMissing.slice(0, 50),
      keyDuplicateSamples: [...keyDup.entries()].slice(0, 30).map(([k, rows]) => ({ key: k, rows: rows.slice(0, 12) })),
      blankRatesTop: blankRates.slice(0, 20),
      blankWarnThreshold: nullWarn,
      blankWarnColumns: blankRates.filter(x => x.rate >= nullWarn).slice(0, 50),
      nameCol,
      nameVariantIssues: nameIssues.slice(0, 30)
    };

    return report;
  }

  function reportToText(rep){
    const lines = [];
    lines.push(`[DQ7 管理者ラボ データ検品] ${new Date().toLocaleString()}`);
    lines.push(`Rows: ${rep.totalRows} / Cols: ${rep.headerCount}`);
    lines.push(`Key: ${rep.keyCol || '—'} / Required: ${rep.required.length ? rep.required.join(', ') : '—'}`);
    lines.push('');

    if (rep.missingRequiredColumns.length){
      lines.push('--- 必須列が見つからない ---');
      lines.push(rep.missingRequiredColumns.join(', '));
      lines.push('');
    }

    if (rep.keyCol){
      lines.push('--- ID（主キー） ---');
      lines.push(`空欄行（最大50件表示）: ${rep.keyMissingRows.length ? rep.keyMissingRows.join(', ') : 'なし'}`);
      if (rep.keyDuplicateSamples.length){
        lines.push('重複（最大30キー表示）:');
        for (const d of rep.keyDuplicateSamples){
          lines.push(`- ${d.key} : rows ${d.rows.join(', ')}`);
        }
      } else {
        lines.push('重複: なし');
      }
      lines.push('');
    }

    lines.push(`--- 空欄率（警告しきい値 ${rep.blankWarnThreshold}%） ---`);
    if (rep.blankWarnColumns.length){
      for (const c of rep.blankWarnColumns){
        lines.push(`- ${c.col}: ${c.rate.toFixed(1)}% (${c.blanks}/${rep.totalRows})`);
      }
    } else {
      lines.push('警告対象: なし');
    }
    lines.push('');

    if (rep.nameCol){
      lines.push(`--- 表記ゆれ候補（${rep.nameCol}） ---`);
      if (rep.nameVariantIssues.length){
        for (const it of rep.nameVariantIssues){
          lines.push(`- ${it.examples.join(' / ')} (rows ${it.rows.join(', ')})`);
        }
      } else {
        lines.push('候補: なし');
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  function renderReport(rep){
    lastReportText = reportToText(rep);

    const section = (title, inner) => `
      <div class="card">
        <div class="card-title">${escapeHtml(title)}</div>
        <div class="card-body">${inner}</div>
      </div>
    `;

    const chips = (arr, cls='') => arr.map(x => `<span class="chip ${cls}">${escapeHtml(x)}</span>`).join(' ');

    const missReq = rep.missingRequiredColumns.length
      ? section('必須列（不足）', chips(rep.missingRequiredColumns, 'bad'))
      : section('必須列', `<span class="chip ok">不足なし</span>`);

    const keyPart = rep.keyCol
      ? section('主キー（ID）', `
          <div class="small">主キー列：<code>${escapeHtml(rep.keyCol)}</code></div>
          <div style="margin-top:8px">
            <div class="small">空欄行（最大50）</div>
            ${rep.keyMissingRows.length ? `<div class="pre">${escapeHtml(rep.keyMissingRows.join(', '))}</div>` : `<span class="chip ok">なし</span>`}
          </div>
          <div style="margin-top:10px">
            <div class="small">重複（最大30キー）</div>
            ${rep.keyDuplicateSamples.length ? `<div class="pre">${escapeHtml(rep.keyDuplicateSamples.map(d => `${d.key}: ${d.rows.join(', ')}`).join('\n'))}</div>` : `<span class="chip ok">なし</span>`}
          </div>
        `)
      : section('主キー（ID）', `<span class="chip warn">推定できませんでした</span>（key列名を指定してください）`);

    const blankWarn = section('空欄率（警告）', rep.blankWarnColumns.length
      ? `<div class="pre">${escapeHtml(rep.blankWarnColumns.map(c => `${c.col}: ${c.rate.toFixed(1)}% (${c.blanks}/${rep.totalRows})`).join('\n'))}</div>`
      : `<span class="chip ok">警告対象なし</span>`
    );

    const blankTop = section('空欄率Top20', `<div class="pre">${escapeHtml(rep.blankRatesTop.map(c => `${c.col}: ${c.rate.toFixed(1)}%`).join('\n'))}</div>`);

    const namePart = rep.nameCol
      ? section('表記ゆれ候補', rep.nameVariantIssues.length
        ? `<div class="pre">${escapeHtml(rep.nameVariantIssues.map(it => `${it.examples.join(' / ')} (rows ${it.rows.join(', ')})`).join('\n'))}</div>`
        : `<span class="chip ok">候補なし</span>`
      )
      : section('表記ゆれ候補', `<span class="chip warn">name列が見つかりませんでした</span>`);

    outEl.classList.remove('empty');
    outEl.innerHTML = `
      <div class="small"><strong>${escapeHtml(currentFile?.name || '')}</strong> / rows ${rep.totalRows} / cols ${rep.headerCount}</div>
      <div class="cards">
        ${missReq}
        ${keyPart}
        ${blankWarn}
        ${blankTop}
        ${namePart}
      </div>
      <div class="card" style="margin-top:12px">
        <div class="card-title">テキストレポート</div>
        <pre class="pre">${escapeHtml(lastReportText)}</pre>
      </div>
    `;
  }

  async function readFile(file){
    const text = await file.text();
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')){
      const rows = parseCSV(text);
      return toObjectsFromCSV(rows);
    }
    if (name.endsWith('.json')){
      return toObjectsFromJSON(text);
    }
    // fallback by mime
    if (file.type.includes('json')) return toObjectsFromJSON(text);
    return toObjectsFromCSV(parseCSV(text));
  }

  function clearAll(){
    currentFile = null;
    fileEl.value = '';
    outEl.classList.add('empty');
    outEl.textContent = 'まだ検品してません。';
    lastReportText = '';
  }

  async function run(){
    const f = currentFile || fileEl.files?.[0];
    if (!f){
      alert('ファイルを選択してください');
      return;
    }
    currentFile = f;

    let obj;
    try{
      obj = await readFile(f);
    } catch (e){
      outEl.classList.remove('empty');
      outEl.innerHTML = `<div class="pre">読み込み失敗: ${escapeHtml(String(e.message || e))}</div>`;
      return;
    }

    const header = obj.header || collectKeys(obj.data || []);
    const data = obj.data || [];

    // Normalize non-string values
    for (const row of data){
      if (!row || typeof row !== 'object') continue;
      for (const k of Object.keys(row)){
        const v = row[k];
        if (v == null) row[k] = '';
        else if (typeof v === 'string') row[k] = v.trim();
        else row[k] = String(v);
      }
    }

    const rep = analyze({ header, data });
    renderReport(rep);
  }

  function collectKeys(arr){
    const s = new Set();
    for (const o of arr){
      if (!o || typeof o !== 'object') continue;
      Object.keys(o).forEach(k => s.add(k));
    }
    return [...s];
  }

  // drag drop
  dropEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropEl.classList.add('on');
  });
  dropEl.addEventListener('dragleave', () => dropEl.classList.remove('on'));
  dropEl.addEventListener('drop', (e) => {
    e.preventDefault();
    dropEl.classList.remove('on');
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    currentFile = f;
    run();
  });

  fileEl.addEventListener('change', () => {
    currentFile = fileEl.files?.[0] || null;
  });

  btnRun.addEventListener('click', run);
  btnClear.addEventListener('click', clearAll);

  btnCopyReport.addEventListener('click', async () => {
    if (!lastReportText){
      alert('まだレポートがありません');
      return;
    }
    try{
      await navigator.clipboard.writeText(lastReportText);
      alert('コピーしました');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = lastReportText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      alert('コピーしました');
    }
  });

})();
