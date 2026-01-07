# DQ7R データベース（雛形）

静的サイト（HTML/JS/CSS）＋CSV だけで動く「雛形」です。  
運用は **`data/current/` のCSVを差し替えるだけ** を想定しています。

## 使い方（最短）
1. このフォルダごと GitHub リポジトリに置く
2. GitHub Pages / Cloudflare Pages で公開（静的配信）
3. `data/current/*.csv` を編集して更新

> ローカル（file://）で直接開くと fetch が動かないため、公開環境で確認してください。

## ページ構成
- `index.html`：トップ
- `story.html`：ストーリー（チャート）
- `characters.html`：キャラクター一覧
- `bosses.html`：ボス一覧
- `boss.html?id=boss_001`：ボス詳細（耐性カテゴリ表示）
- `jobs.html`：職業一覧
- `job.html?id=job_001`：職業詳細（習得一覧）

## データ（CSV）
すべて `data/current/` を参照参照します。

- `story_steps.csv`
- `characters.csv`
- `bosses.csv`
- `resist_types.csv`
- `boss_resists.csv`
- `jobs.csv`
- `skills.csv`
- `job_skills.csv`

### 大事なルール
- **ID列（boss_id / job_id ...）は固定**：名前が変わってもIDは変えない
- 列（ヘッダー）は **消さずに増やす**（UIが壊れにくい）
- 耐性は `boss_resists.csv` に分離（ボス詳細ページで結合表示）

## カスタムしたくなったら
- 色：`assets/style.css` の `--accent` などを調整
- 表の列：各HTMLの `cols` を変更
