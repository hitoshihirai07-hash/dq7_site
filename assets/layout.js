import { setActiveNav, escapeHTML } from "./util.js";

export function renderHeader({title="DQ7R データベース", subtitle=""} = {}){
  const header = document.createElement('header');

  const subHtml = subtitle ? `<div class="sub">${escapeHTML(subtitle)}</div>` : ``;

  header.innerHTML = `
    <div class="header-inner">
      <div class="brand">
        <img class="brand-icon" src="./assets/icon.svg" alt="" width="32" height="32">
        <div class="brand-text">
          <div class="title">${escapeHTML(title)}</div>
          ${subHtml}
        </div>
      </div>

      <div class="gsearch">
        <input id="globalSearchInput" type="search" placeholder="用語検索（ボス/職業/キャラ/アイテム/呪文/特技/メダル/ストーリー）" autocomplete="off" />
        <div id="globalSearchPanel" class="gsearch-panel" hidden></div>
      </div>

      <nav>
        <a href="./index.html">トップ</a>
        <a href="./story.html">ストーリー</a>
        <a href="./bosses.html">ボス</a>
        <a href="./characters.html">キャラクター</a>
        <a href="./jobs.html">職業</a>
        <a href="./items.html">アイテム</a>
        <a href="./medals.html">ちいさなメダル</a>
        <a href="./spells.html">呪文</a>
        <a href="./skills.html">特技</a>
      </nav>
    </div>
  `;
  document.body.prepend(header);
  setActiveNav();
}
