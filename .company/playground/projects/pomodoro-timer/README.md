# Gummy Focus

> グミのようなぷにっとした立体感のポモドーロ＆ストップウォッチ。  
> 集中すると木が育つ、自分専用の生産性アプリ。

Claude Design で作成したプロトタイプを Vite + React + PWA に移植したもの。
スキラボ秘書室（`.company/secretary/todos/`）と双方向連携する。

---

## 主な機能

- **ポモドーロタイマー** — Focus / Short Break / Long Break のモード切替・進捗リング
- **ストップウォッチ** — 自由集中タイマー、5種の数字スタイル
- **タスク管理** — 秘書室 todos と双方向同期（追加・完了・取得）
- **時間テンプレート** — クイック / クラシック / ディープワーク / ロングフォーカス・カスタム追加可
- **Focus Tree** — 5段階の成長 (たね → 芽 → 若木 → 木 → 花咲き)
- **統計** — 今日の集中時間・連続日数・木のステージ
- **カスタマイズパネル** — パレット・背景・カード透明度・リングカラー等
- **レスポンシブ** — PC（3カラム）/ タブレット（2カラム）/ スマホ（下部4タブナビ）
- **PWA** — スマホに「ホーム画面に追加」でアプリとしてインストール可能

---

## 技術スタック

| 用途 | ライブラリ |
|------|------|
| フロント | Vite + React 18 |
| バックエンド API | Node.js + Express |
| PWA | vite-plugin-pwa (Workbox) |
| 状態永続化 | localStorage + スキラボ MD ファイル |

---

## ディレクトリ構成

```
pomodoro-timer/
├── README.md                ← このファイル
├── CLAUDE.md                ← Claude Code 用ルール
├── package.json
├── vite.config.js           ← PWA 設定
├── server.js                ← スキラボ連携 API
├── index.html
├── public/
│   ├── favicon.svg
│   ├── icon-192.png
│   └── icon-512.png
├── src/
│   ├── main.jsx
│   ├── App.jsx              ← メインアプリ
│   ├── styles.css
│   ├── styles-overrides.css
│   ├── components/
│   │   ├── FocusTree.jsx
│   │   └── TweaksPanel.jsx
│   └── hooks/
│       ├── useLocalStorage.js
│       └── useTodos.js
├── scripts/
│   └── gen-icons.mjs        ← アイコン PNG 生成
└── original/                ← Claude Design からの handoff bundle
    └── demo/...
```

---

## 起動方法

### 開発モード（Vite + API を同時起動）

```bash
cd .company/playground/projects/pomodoro-timer
npm run dev
```

- フロント: http://localhost:5173
- API: http://localhost:3001
- Vite が `/api` を API サーバーへプロキシ

### プロダクションビルド

```bash
npm run build       # dist/ にビルド
npm run preview     # localhost で配信して動作確認
```

### API だけ起動 / フロントだけ起動

```bash
npm run dev:vite    # フロントのみ
npm run dev:api     # API のみ
```

---

## PWA としてインストール

### PC (Chrome / Edge)

1. http://localhost:5173 を開く（or `npm run preview` で 4173）
2. アドレスバー右端の「インストール」アイコン → クリック
3. アプリとして独立ウィンドウで起動

### iPhone (Safari)

1. PC と同じ WiFi で iPhone Safari を開く
2. `http://<PCのローカルIP>:5173` にアクセス（例: `http://192.168.1.10:5173`）
3. 共有ボタン → 「ホーム画面に追加」
4. ホーム画面のアイコンから起動（standalone モード）

> ⚠️ iOS Safari の PWA は localhost を直接インストールできない。PC からの配信が必須。

### Android (Chrome)

1. ブラウザで開く
2. メニュー → 「アプリをインストール」または「ホーム画面に追加」

---

## スキラボ秘書室との連携

`.company/secretary/todos/YYYY-MM-DD.md` と双方向同期する。

### アプリ → スキラボ
- **タスク追加**: アプリで追加 → `## 通常` セクションに `- [ ] タスク名 | 優先度: 通常 | ジャンル: ...` を追記
- **タスク完了**: アプリでチェック → `## 完了` セクションへ移動
- **ポモドーロ完了**: タイマー終了 → `## メモ・振り返り` に `- [ポモドーロ] HH:MM 集中 25min：タスク名` を追記

### スキラボ → アプリ
- アプリ起動時、`## 最優先 / 通常 / 余裕があれば` のタスクを読み込んで一覧表示
- 起動中に MD が変わっても自動再読み込み（要リフレッシュ）

### API エンドポイント

| Method | Path | 内容 |
|--------|------|------|
| GET | `/api/todos/:date` | YYYY-MM-DD の todos を取得 |
| POST | `/api/todos/:date` | タスクを追加 |
| PATCH | `/api/todos/:date/:id` | タスクを完了/未完了に切替 |
| POST | `/api/sessions/:date` | セッション記録をメモ欄に追記 |
| GET | `/api/health` | ヘルスチェック |

---

## ローカル永続化（localStorage）

| Key | 内容 |
|-----|------|
| `gf_tasks` | タスク一覧 |
| `gf_tweaks` | カスタマイズ設定（パレット・背景等） |
| `gf_modeDurations` | ポモドーロ・短休憩・長休憩の時間 |
| `gf_completed` | `{date, count}` 今日の完了ポモドーロ数 |

---

## Vercel デプロイ手順

本番環境では Vercel Serverless Functions が GitHub API 経由で `.company/secretary/todos/*.md` を読み書きする。

### 1. GitHub Personal Access Token 作成

1. https://github.com/settings/tokens にアクセス
2. **Fine-grained personal access token** を作成
   - Repository access: **Only select repositories** → `sukilab-company`
   - Permissions: **Contents** → **Read and write**
3. 生成されたトークンをコピー（`github_pat_...`）

### 2. Vercel プロジェクト作成

```bash
cd .company/playground/projects/pomodoro-timer
npx vercel
# プロジェクト名: gummy-focus (任意)
# Build/Output 設定はそのまま (Vite/dist が自動検出される)
```

### 3. 環境変数を設定

Vercel ダッシュボード → Project → Settings → Environment Variables で以下を追加:

| Key | Value |
|-----|-------|
| `GITHUB_TOKEN` | (上で作成したトークン) |
| `GITHUB_OWNER` | `konkaicode` |
| `GITHUB_REPO` | `sukilab-company` |
| `GITHUB_BRANCH` | `main` |
| `TODOS_PATH` | `.company/secretary/todos` |

### 4. デプロイ

```bash
npx vercel --prod
```

完了後、`https://gummy-focus.vercel.app` のような URL でアクセスできる。

### 5. 動作確認

- `/api/health` で GitHub 接続を確認
- アプリでタスク追加 → GitHub の `sukilab-company` リポに `chore(secretary): ...` というコミットが自動で push される

### 同期の流れ

```
[アプリ] →fetch→ [Vercel Function] →Octokit→ [GitHub API]
                                                    ↓
                                        .company/secretary/todos/YYYY-MM-DD.md 更新
                                                    ↓
                                        (こんちゃんが git pull すればローカルにも反映)
```

> 💡 ローカル開発時は `npm run dev` で server.js が直接ファイルを読み書きする（GitHub 経由ではない）

---

## Next Actions

- [ ] ブラウザ通知（タイマー終了時 `Notification API`）
- [ ] BGM / 終了音
- [ ] セッション履歴を MD から取得して `HistoryCard` に表示
- [ ] データエクスポート（CSV）
- [ ] Vercel デプロイ → カスタムドメイン設定
