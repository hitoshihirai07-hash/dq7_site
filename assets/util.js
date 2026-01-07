export function qs(sel, root=document){ return root.querySelector(sel); }
export function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
export function escapeHTML(s=''){
  return String(s).replace(/[&<>"']/g, (c)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
export function getParam(name){
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}
export function setActiveNav(){
  const p = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(a=>{
    const href = a.getAttribute('href');
    if (!href) return;
    const target = href.split('/').pop();
    if (target === p) a.classList.add('active');
  });
}
export function makeTable(rows, cols){
  const thead = `<thead><tr>${cols.map(c=>`<th>${escapeHTML(c.label)}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${
    rows.map(r=>`<tr>${
      cols.map(c=>`<td>${escapeHTML(r[c.key] ?? '')}</td>`).join('')
    }</tr>`).join('')
  }</tbody>`;
  return `<div class="table-wrap"><table>${thead}${tbody}</table></div>`;
}
