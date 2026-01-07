import { setActiveNav, escapeHTML } from "./util.js";

export function renderHeader({title="DQ7R データベース（雛形）", subtitle="CSV差し替えで更新できる最小構成", active=""} = {}){
  const header = document.createElement('header');
  header.innerHTML = `
    <div class="header-inner">
      <div class="brand">
        <div class="title">${escapeHTML(title)}</div>
        <div class="sub">${escapeHTML(subtitle)}</div>
      </div>
      <nav>
        <a href="./index.html">トップ</a>
        <a href="./story.html">ストーリー</a>
        <a href="./characters.html">キャラクター</a>
        <a href="./bosses.html">ボス</a>
        <a href="./jobs.html">職業</a>
      </nav>
    </div>
  `;
  document.body.prepend(header);
  setActiveNav();
}
