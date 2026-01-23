# 管理ページ（/admin）

## 目的
- AdSense運用チェックリスト
- 既知の不具合（共通）/ 端末メモ（localStorage）
- 端末データ確認・初期化ツール

## アクセス制限
Cloudflare Pages Functions の Basic認証で /admin 以下を保護します。

Cloudflare Pages 管理画面の「Settings → Environment variables」に以下を追加してください：
- BASIC_AUTH_USER
- BASIC_AUTH_PASSWORD
