---
name: Notion CLI 使用前の確認ルール
description: ntn を使う前に必ず GitHub の SKILL.md を確認する
type: feedback
---

Notion CLI（`ntn`）を使う前に、必ず以下の GitHub ページを確認すること。

**Why:** `ntn api ls` のリストだけでは不完全なことがある。例えば `/v1/databases/{id}/query` は未対応に見えたが、実際は `/v1/data_sources/{id}/query` で全件取得できた。SKILL.md に最新の正しい使い方が載っている。

**How to apply:** ntn コマンドを実行する前、特に新しいエンドポイントを使おうとする前に、reference_notion_cli.md に記載の URL を WebFetch で確認してから実行する。
