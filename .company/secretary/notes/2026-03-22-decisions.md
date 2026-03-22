# 意思決定ログ - 2026-03-22

---

## 収益データ取得方法の変更：Notion MCP → ntn CLI

### 決定内容
Notion MCP（`mcp__claude_ai_Notion__notion-fetch` など）による収益DB取得を廃止し、
今後は **ntn CLI（Notion 公式コマンドラインツール）** で取得する。

### 背景・理由
- Notion MCP のセマンティック検索には限界がある（43件中38件しか取得できない問題が発生）
- ntn CLI は Public API を直接叩くため、全件確実に取得できる
- `makenotion/skills` をインストールし、ntn が使える環境が整った
- 認証は `~/.bashrc` の `NOTION_API_TOKEN` で設定済み

### 新しい同期方法
```bash
# 収益DBのページを全件取得（page_size=100）
ntn api v1/databases/{database_id}/query -d '{"page_size":100}'
```

### 関連ファイル
- 収益DB: `https://www.notion.so/f99953008ba346fabff94f4cac205ae5`
- ローカルミラー: `.company/accounting/revenue.csv`
- 同期ログ: `.company/accounting/sync.md`

### ステータス
- [x] ntn インストール済み（`npm i -g ntn@latest`）
- [x] NOTION_API_TOKEN を `~/.bashrc` に設定済み
- [x] テストページ作成で疎通確認済み
- [x] 収益DB 全43件取得・revenue.csv に保存済み（Notionと完全一致）

---

## ntn 使用ルール

ntn（Notion CLI）を使う前は、必ず以下の公式 SKILL.md を確認する。

- https://github.com/makenotion/skills/blob/main/skills/notion-cli/SKILL.md

**理由:** `ntn api ls` のリストだけでは不完全なことがある。正しいエンドポイントは SKILL.md または GitHub を参照すること。
