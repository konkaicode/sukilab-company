# リサーチ部署

## 役割
NotionのリサーチDBをCLI・WebFetchで読み込み、要約・星評価を付けてスキラボ内に知識を蓄積する。
こんちゃんが記事・提案・就活・案件対応をするときに自動で参照できる知識ベースを管理する。

---

## NotionDB 情報

| 項目 | 値 |
|------|-----|
| DB名 | スキラボ-リサーチ |
| database_id | `32c5d3ca-ad5b-806a-a222-c8d302c04125` |
| data_source_id | `32c5d3ca-ad5b-8053-a442-000bf5b68252` |

### プロパティ一覧

| プロパティ名 | 型 | 説明 |
|------------|-----|------|
| タイトル | title | 記事タイトル |
| URL | url | 記事URL |
| カテゴリ | multi_select | AI / Claude Code / WordPress 等 |
| 進捗度 | status | 未読 / AI評価済み / 取り込む予定 / 取り込み済み |
| Claude星評価 | select | ★1〜5（Claude が付ける） |
| Claude要約 | rich_text | 300字以内の短い要約（DBプロパティ） |
| こんちゃん星評価 | select | ★1〜5（こんちゃんが付ける） |

### 進捗度フロー

```
未読 → AI評価済み → 取り込む予定 → 取り込み済み
```

| ステータス | 操作タイミング | 操作者 |
|-----------|-------------|--------|
| 未読 | 記事登録時の初期値 | — |
| AI評価済み | 要約・星評価完了後 | Claude |
| 取り込む予定 | 「これ取り込んで」と指示したとき | こんちゃん |
| 取り込み済み | スキラボへの保存完了後 | Claude |

---

## ワークフロー

### STEP 1：未読記事の取得

`ntn` CLI で 進捗度=`未読` の記事を全件取得する。

```bash
NOTION_API_TOKEN="..." npx ntn api v1/data_sources/32c5d3ca-ad5b-8053-a442-000bf5b68252/query \
  -d '{"page_size":100}'
```

取得後、`タイトル` / `URL` / `id` の一覧を抽出する。
URLが空 or タイトルが空のレコードはスキップする。

---

### STEP 2：記事本文の取得

#### 基本：Notionページのブロックを全件読み取る

「Save to Notion」拡張機能で保存された記事はNotionページ内に全文が保存されているため、
Notionブロックを読み取ることを**唯一の標準手段**とする。

```python
# ページネーションで全ブロックを取得
cursor = None
all_blocks = []
while True:
    cmd = ["npx", "ntn", "api", f"v1/blocks/{page_id}/children"]
    if cursor:
        cmd += [f"start_cursor=={cursor}"]
    data = ntn(cmd)
    all_blocks.extend(data['results'])
    if not data['has_more']:
        break
    cursor = data['next_cursor']
```

取得したブロックから `rich_text[].plain_text` を結合してテキストを抽出する。

#### 判定：Browser Use を提案するタイミング

Notionブロックを全件取得した後、以下のいずれかに該当する場合は Browser Use の使用をこんちゃんに提案する：

| 条件 | 目安 | 提案文 |
|------|------|--------|
| テキストが明らかに少ない | **500字未満** | 「{タイトル} のNotion本文が {N}字しかありません。Browser Use でオリジナルページを開いてより多く取得できます。使いますか？」 |
| タイトルに比べて内容が薄い | タイトルが具体的なのに本文が概要・メタ情報のみ | 「本文が取得できていない可能性があります。Browser Use で確認しますか？」 |
| ページネーション後もブロック数が少ない | **10ブロック未満** | 同上 |
| URLがあるのにNotionブロックがほぼ空 | 3ブロック以下 | 同上 |

加えて、以下のケースでも Browser Use を提案する（操作が必要な場合）：
- Notionに保存されていないURLを直接取得・操作したいとき
- ログインが必要なページでブロックが空のとき
- タブ切り替え・スクロール読み込みなどインタラクティブな操作が必要なとき

---

### STEP 3：要約 + Claude星評価を付ける

#### 要約方針
- **DBプロパティ `Claude要約`**：300字以内。記事の核心を一言で伝える短い要約
- **Notionページ内ブロック**：Markdown記法で詳細にまとめる（構成は下記参照）

#### ページ内ブロックの構成（末尾に追記）

```markdown
---
## 🤖 Claude レビュー（{YYYY-MM-DD}）

### 要約
（300〜600字程度で、記事の目的・主な内容・結論を整理）

### 主なポイント
- ポイント1
- ポイント2
- ポイント3

### こんちゃんへの活用提案
（WordPress・Shopify・Web制作・就活など、こんちゃんの仕事に引きつけた活用アドバイス）

### Claude評価
★{N}/5 — {評価理由を1〜2文で}
```

#### 星評価基準（★1〜5）

| 基準 | 重視度 |
|------|--------|
| 実践的な手順がある（コード・手順書・チェックリストなど） | 高 |
| 具体的な事例・実績がある | 高 |
| こんちゃんの仕事に直結（WordPress・Shopify・Web制作・就活） | 高 |
| 公式ドキュメントである | 高 |
| 引用元・参考元が明記されている | 中 |

- ★5：高重視項目を3つ以上満たす
- ★4：高重視項目を2つ + 中重視項目あり
- ★3：高重視項目を1〜2つ満たす
- ★2：参考にはなるが直結度は低い
- ★1：情報が薄い・信頼性が低い

---

### STEP 4：Notion DBに書き戻す

以下の2つを実行する。

#### ① DBプロパティの更新

```bash
NOTION_API_TOKEN="..." npx ntn api v1/pages/{page_id} \
  -d '{
    "properties": {
      "進捗度": {"status": {"name": "AI評価済み"}},
      "Claude星評価": {"select": {"name": "★N"}},
      "Claude要約": {"rich_text": [{"text": {"content": "ここに300字以内の要約"}}]}
    }
  }'
```

#### ② ページ内にレビューブロックを追記

```bash
NOTION_API_TOKEN="..." npx ntn api v1/blocks/{page_id}/children \
  -d '{
    "children": [
      {"type": "divider", "divider": {}},
      {"type": "heading_2", "heading_2": {"rich_text": [{"text": {"content": "🤖 Claude レビュー（YYYY-MM-DD）"}}]}},
      ...（以下、STEP3のMarkdown構成をブロックで展開）
    ]
  }'
```

---

### STEP 5：こんちゃんが査読

- Notionで `AI評価済み` の記事を確認し、`こんちゃん星評価` を付ける
- 取り込むと判断したものは 進捗度を `取り込む予定` に変更する
- 「これ取り込んで」と指示があったら STEP 6へ

---

### STEP 6：スキラボ内に保存（取り込む予定 → 取り込み済み）

こんちゃんから「取り込んで」と指示があったとき実行する。

1. 進捗度=`取り込む予定` のレコードを全件取得
2. カテゴリを判断して `knowledge/` 内の該当ファイルに追記
3. `sources/log.md` にURL・日付・星評価を記録
4. Notion DBの 進捗度 を `取り込む予定` → `取り込み済み` に更新

```bash
# 進捗度を「取り込み済み」に更新
NOTION_API_TOKEN="..." npx ntn api v1/pages/{page_id} \
  -d '{"properties": {"進捗度": {"status": {"name": "取り込み済み"}}}}'
```

---

## カテゴリ判断基準

| カテゴリファイル | 対象トピック |
|----------------|-------------|
| `knowledge/ai.md` | AI・Claude・ChatGPT・自動化・プロンプト |
| `knowledge/shopify.md` | Shopify・Liquid・ECサイト |
| `knowledge/wordpress.md` | WordPress・PHP・テーマ・プラグイン |
| `knowledge/marketing.md` | 集客・SNS・LP・コピーライティング・SEO |
| `knowledge/job-hunting.md` | 就活・企業研究・ES・面接（就活部署と連携） |
| `knowledge/general.md` | 上記に当てはまらないもの |

複数カテゴリにまたがる場合は、最も関連度の高いファイルに保存し、他カテゴリへの参照を記載する。

---

## フォルダ構成
- `knowledge/` - カテゴリ別の知識ベース（記事要約・学び）
- `sources/` - 取り込んだURLと評価の記録

---

## 連携部署
- **秘書室**：取り込み指示の受付・記事執筆時の参照依頼
- **就活部署**：job-huntingカテゴリの情報を共有

---

## ntn 実行コマンド注意事項

- `ntn` は nvm 管理下のため直接実行不可。必ず `npx ntn` を使う
- `source ~/.bashrc` はトークンを正しく渡せない場合がある → トークンは直接指定する
- 詳細は `.company/accounting/CLAUDE.md` のトラブルシューティングを参照
