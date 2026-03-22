---
name: Notion CLI スキルリファレンス
description: ntn（Notion CLI）を使う前に必ず確認すべき公式SKILLドキュメントのURL
type: reference
---

Notion CLI（`ntn`）を使用する際は、必ず以下の公式 SKILL.md を確認してから使うこと。

- **URL**: https://github.com/makenotion/skills/blob/main/skills/notion-cli/SKILL.md

## 確認すべき理由
- `ntn api ls` のエンドポイント一覧だけでは不完全な場合がある
- 例: `/v1/databases/{id}/query` は未対応だが `/v1/data_sources/{id}/query` は対応済み
- GitHub の SKILL.md が最新の使い方・注意事項を反映している

## 主な確認ポイント
- 使いたいエンドポイントが `ntn api ls` に存在するか
- 認証方法（`NOTION_API_TOKEN` の設定）
- `ntn api`・`ntn files`・`ntn workers` それぞれの使い方
