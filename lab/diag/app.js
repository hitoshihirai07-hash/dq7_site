(() => {
  'use strict';

  const el = (id) => document.getElementById(id);
  const basicEl = el('basic');
  const screenEl = el('screen');
  const netEl = el('net');
  const storageEl = el('storage');
  const swEl = el('sw');
  const errorsEl = el('errors');

  const btnCopy = el('btnCopy');
  const btnClearLocal = el('btnClearLocal');
  const btnUnregSW = el('btnUnregSW');

  const errorLines = [];
  function logErr(line){
    errorLines.push(line);
    errorsEl.textContent = errorLines.join('\n');
  }
  window.addEventListener('error', (e) => {
    logErr(`[error] ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    logErr(`[promise] ${String(e.reason)}`);
  });

  function kv(obj){
    const rows = Object.entries(obj).map(([k,v]) => `
      <div class="k">${escapeHtml(k)}</div>
      <div class="v">${escapeHtml(v)}</div>
    `).join('');
    return `<div class="kvgrid">${rows}</div>`;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function fmtBytes(b){
    if (!Number.isFinite(b)) return '—';
    const u = ['B','KB','MB','GB','TB'];
    let i=0, v=b;
    while (v>=1024 && i<u.length-1){ v/=1024; i++; }
    return `${v.toFixed(2)} ${u[i]}`;
  }

  async function getStorage(){
    if (!navigator.storage || !navigator.storage.estimate) return null;
    try { return await navigator.storage.estimate(); } catch { return null; }
  }

  async function getSW(){
    if (!('serviceWorker' in navigator)) return { supported:false };
    const regs = await navigator.serviceWorker.getRegistrations();
    return {
      supported: true,
      registrations: regs.map(r => ({
        scope: r.scope,
        active: r.active ? r.active.scriptURL : '',
        waiting: r.waiting ? r.waiting.scriptURL : '',
        installing: r.installing ? r.installing.scriptURL : ''
      }))
    };
  }

  function getNet(){
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return { supported: false };
    return {
      supported: true,
      effectiveType: c.effectiveType || '',
      downlink: c.downlink != null ? `${c.downlink} Mbps` : '',
      rtt: c.rtt != null ? `${c.rtt} ms` : '',
      saveData: c.saveData != null ? String(c.saveData) : ''
    };
  }

  function buildSummaryText(){
    const lines = [];
    lines.push(`[DQ7 管理者ラボ 診断] ${new Date().toLocaleString()}`);
    lines.push(`URL: ${location.href}`);
    lines.push('');
    lines.push('--- 基本 ---');
    lines.push(`UA: ${navigator.userAgent}`);
    lines.push(`Lang: ${navigator.language}`);
    lines.push(`Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone || ''}`);
    lines.push(`Online: ${navigator.onLine}`);

    lines.push('');
    lines.push('--- 画面 ---');
    lines.push(`Screen: ${screen.width}x${screen.height} DPR:${window.devicePixelRatio}`);
    lines.push(`Viewport: ${window.innerWidth}x${window.innerHeight}`);
    lines.push(`Pointer: ${matchMedia('(pointer:fine)').matches ? 'fine' : (matchMedia('(pointer:coarse)').matches ? 'coarse' : 'unknown')}`);

    const net = getNet();
    lines.push('');
    lines.push('--- ネット ---');
    if (!net.supported){
      lines.push('Network API: not supported');
    } else {
      lines.push(`effectiveType: ${net.effectiveType}`);
      lines.push(`downlink: ${net.downlink}`);
      lines.push(`rtt: ${net.rtt}`);
      lines.push(`saveData: ${net.saveData}`);
    }

    lines.push('');
    lines.push('--- エラー ---');
    if (!errorLines.length) lines.push('なし');
    else lines.push(...errorLines.slice(-20));

    return lines.join('\n');
  }

  async function init(){
    basicEl.innerHTML = kv({
      'URL': location.href,
      'UserAgent': navigator.userAgent,
      '言語': navigator.language,
      'タイムゾーン': Intl.DateTimeFormat().resolvedOptions().timeZone || '—',
      'オンライン': String(navigator.onLine),
      'Cookie有効': String(navigator.cookieEnabled),
      'Secure Context': String(window.isSecureContext),
    });

    screenEl.innerHTML = kv({
      'Screen': `${screen.width} x ${screen.height}`,
      'Viewport': `${window.innerWidth} x ${window.innerHeight}`,
      'DevicePixelRatio': String(window.devicePixelRatio),
      'Pointer': matchMedia('(pointer:fine)').matches ? 'fine' : (matchMedia('(pointer:coarse)').matches ? 'coarse' : 'unknown'),
      'Touch': ('ontouchstart' in window) ? 'yes' : 'no',
    });

    const net = getNet();
    netEl.innerHTML = kv(net.supported ? {
      'Network API': 'supported',
      'effectiveType': net.effectiveType || '—',
      'downlink': net.downlink || '—',
      'rtt': net.rtt || '—',
      'saveData': net.saveData || '—',
    } : {
      'Network API': 'not supported',
      'effectiveType': '—',
      'downlink': '—',
      'rtt': '—',
      'saveData': '—',
    });

    const st = await getStorage();
    storageEl.innerHTML = kv(st ? {
      'Storage API': 'supported',
      '使用量(概算)': fmtBytes(st.usage),
      '上限(概算)': fmtBytes(st.quota),
      '使用率': (st.usage && st.quota) ? `${((st.usage/st.quota)*100).toFixed(2)} %` : '—',
      'localStorage keys': String(Object.keys(localStorage).length),
    } : {
      'Storage API': 'not supported',
      '使用量(概算)': '—',
      '上限(概算)': '—',
      '使用率': '—',
      'localStorage keys': String(Object.keys(localStorage).length),
    });

    const sw = await getSW();
    if (!sw.supported){
      swEl.innerHTML = kv({ 'Service Worker': 'not supported' });
    } else if (!sw.registrations.length){
      swEl.innerHTML = kv({ 'Service Worker': 'supported', '登録': 'なし' });
    } else {
      const lines = sw.registrations.map((r,i) => `#${i+1} scope=${r.scope}\n active=${r.active}\n waiting=${r.waiting}\n installing=${r.installing}`).join('\n\n');
      swEl.innerHTML = `<div class="pre">${escapeHtml(lines)}</div>`;
    }

    btnCopy.addEventListener('click', async () => {
      const txt = buildSummaryText();
      try {
        await navigator.clipboard.writeText(txt);
        alert('コピーしました');
      } catch {
        const ta = document.createElement('textarea');
        ta.value = txt;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        alert('コピーしました');
      }
    });

    btnClearLocal.addEventListener('click', () => {
      if (!confirm('管理者ラボ（/lab/）内の保存データを削除します。よろしいですか？')) return;
      const keys = Object.keys(localStorage);
      for (const k of keys){
        // Limit to lab keys (safe prefix)
        if (k.startsWith('dq7_lab_') || k.startsWith('dq_lab_') || k.includes('_lab_')) {
          localStorage.removeItem(k);
        }
      }
      alert('削除しました（このページは再読み込みしてください）');
    });

    btnUnregSW.addEventListener('click', async () => {
      if (!('serviceWorker' in navigator)) return alert('Service Worker 非対応');
      const regs = await navigator.serviceWorker.getRegistrations();
      if (!regs.length) return alert('登録なし');
      if (!confirm(`Service Worker を ${regs.length} 件 登録解除します。よろしいですか？`)) return;
      await Promise.all(regs.map(r => r.unregister()));
      alert('解除しました（再読み込みしてください）');
    });
  }

  init();
})();
