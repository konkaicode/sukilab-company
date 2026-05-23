# Pomodoro Timer (Gummy Focus) — Playground 配置・PWA 化・スキラボ連携プラン

> 作成日: 2026-05-23  
> ステータス: **未着手（プラン確定済み）**  
> 実装タイミング: 次回「実装して！」と言ったらスタート

---

## Context

Claude Design で作成した「Gummy Focus」ポモドーロタイマーを playground 部署に配置。

- **PC**: ブラウザで使用
- **SP**: 「ホーム画面に追加」で PWA アプリとして使用（自分専用）
- **スキラボ連携**: 集中時間・タスクを `.company/secretary/todos/YYYY-MM-DD.md` と双方向同期。

---

## 技術スタック


| 用途         | 選択                        | 理由                                        |
| ---------- | ------------------------- | ----------------------------------------- |
| フロントエンド    | Vite + React 18           | CDN 版の JSX をほぼそのまま流用可能                    |
| バックエンド API | Node.js + Express         | ローカルの `.md` ファイルを読み書きするために必要              |
| PWA        | vite-plugin-pwa (Workbox) | iOS/Android のホーム画面追加・オフライン対応              |
| 状態永続化      | localStorage + API        | タスク・設定・履歴の保持                              |
| 同時起動       | concurrently              | `npm run dev` 1コマンドで Vite + Express を同時起動 |


---

## ディレクトリ構成（完成形）

```
.company/playground/projects/pomodoro-timer/
├── README.md
├── CLAUDE.md
├── package.json
├── vite.config.js               ← PWA 設定
├── server.js                    ← Express API (todos 読み書き)
├── index.html
├── public/
│   ├── icon-192.png
│   └── icon-512.png
└── src/
    ├── main.jsx
    ├── App.jsx                  ← app.jsx を移植
    ├── components/
    │   ├── FocusTree.jsx        ← tree.jsx を移植
    │   └── TweaksPanel.jsx      ← tweaks-panel.jsx を移植
    ├── hooks/
    │   ├── useLocalStorage.js   ← 永続化フック
    │   └── useTodos.js          ← スキラボ連携フック
    └── styles.css
```

---

## デザインバンドルから取得するファイル

Claude Design の handoff bundle (gzip tar) から展開：


| ファイル               | 内容                    |
| ------------------ | --------------------- |
| `Gummy Focus.html` | HTML エントリポイント         |
| `app.jsx`          | メインアプリ (~1700行)       |
| `tree.jsx`         | FocusTree コンポーネント     |
| `tweaks-panel.jsx` | カスタマイズパネル             |
| `styles.css`       | デザイントークン + レスポンシブ CSS |


アーカイブ保存先: `C:\Users\konka\.claude\projects\C--cc-company\886ed0a7-7abe-4a9e-92d6-a561f7c0dc7a\tool-results\webfetch-1779524153016-xwehup.bin`

---

## 実装ステップ

### Step 1: デザインバンドルの展開と動作確認

1. gzip tar を PowerShell で展開 → `original/` フォルダに配置
2. `python -m http.server 8080` で CDN 版動作確認

### Step 2: Vite + Express プロジェクト初期化

```bash
npm create vite@latest . -- --template react
npm install express cors
npm install -D vite-plugin-pwa concurrently
```

**package.json scripts:**

```json
{
  "dev": "concurrently \"vite\" \"node server.js\"",
  "build": "vite build",
  "preview": "vite preview"
}
```

### Step 3: スキラボ連携 API (server.js)

```
GET  /api/todos/:date        ← YYYY-MM-DD のタスク一覧を取得 (MD を解析)
POST /api/todos/:date        ← タスクを追加 (MD に追記)
PATCH /api/todos/:date/:id   ← タスクを完了/未完了に更新
POST /api/sessions/:date     ← セッション記録をメモ欄に追記
```

ポイント:

- 既存の `- [ ] タスク | 優先度: 高/通常/低 | ジャンル: 仕事/個人` 形式をパース
- 今日のファイルがない場合は `_template.md` から新規作成
- メモ欄末尾に `- [ポモドーロ] HH:MM 集中 Xmin：タスク名` 追記

### Step 4: React コード移植（最小変更）

- `window.App = App;` → `export default App;`
- CDN の `React.useState` → `import { useState, ... } from 'react';`
- `useLocalStorage` フックで状態永続化
- `useTodos` フックで API 連携

### Step 5: localStorage 永続化

永続化対象: `gf_tasks` / `gf_tweaks` / `gf_sessions` / `gf_completed`

### Step 6: PWA 設定

`vite-plugin-pwa` で manifest + Service Worker 自動生成。  
iOS「ホーム画面に追加」/ Android「アプリとしてインストール」対応。

### Step 7: PWA アイコン生成

mint → sky グラデーションのグミ風円形アイコン（192px / 512px）。

### Step 8: ドキュメント整備

README.md / CLAUDE.md / playground/CLAUDE.md 更新

---

## スキラボ連携のイメージ

```markdown
## メモ・振り返り
- [ポモドーロ] 14:30 集中 25min：Design timer screen
- [ポモドーロ] 15:00 休憩 5min
```

```markdown
## 通常
- [ ] Design timer screen | 優先度: 通常 | ジャンル: 個人
```

---

## 検証方法

1. `npm run dev` → `http://localhost:5173` でアプリ確認
2. タスク追加 → `.company/secretary/todos/YYYY-MM-DD.md` に書き込まれるか確認
3. ポモドーロ完了 → メモ欄に自動追記されるか確認
4. Chrome DevTools → Application → PWA インストール確認
5. iPhone Safari でホーム画面に追加

---

## 将来の Next Actions

- ブラウザ通知: タイマー終了時に `Notification API`
- BGM/サウンド: ポモドーロ終了音
- GitHub Pages デプロイ (フロントのみ) + Railway で API デプロイ
- データエクスポート: 集中記録を CSV でダウンロード

---

## Claude Code モデル設定変更

実装と別で `/config` コマンドから変更できる。