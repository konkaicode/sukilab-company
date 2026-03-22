---
name: CLI優先ルール
description: 外部ツール利用時はMCPよりCLIを優先して提案する
type: feedback
---

外部サービスを操作する際、MCP と CLI の両方が使える場合は **CLI を優先**して提案すること。

**Why:** Notion MCP のセマンティック検索では全件取得できない問題があった（43件中38件しか取れなかった）。ntn CLI に切り替えたところ全件確実に取得できた。CLI の方が API を直接叩くため信頼性が高い。

**How to apply:**
- Notion → まず `ntn`（Notion CLI）を検討する
- GitHub → まず `gh` CLI を検討する
- その他サービスも同様に、公式 CLI があれば CLI を第一候補にする
- CLI が対応していないエンドポイントの場合のみ、MCP や curl にフォールバックする
- 提案時は「CLIで試してみましょう」と伝えてから実行する
