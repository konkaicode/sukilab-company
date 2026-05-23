# pomodoro-timer プロジェクトルール

## 概要
Claude Design で作成した「Gummy Focus」を Vite + React + PWA + Node.js API に移植したもの。
スキラボ秘書室（`.company/secretary/todos/`）と双方向連携する自分専用ポモドーロアプリ。

## 起動コマンド

```bash
cd .company/playground/projects/pomodoro-timer
npm run dev   # Vite (5173) + Express (3001) を同時起動
```

## ファイル構成のルール

| ファイル | 役割 |
|---------|------|
| `src/App.jsx` | メインアプリ。タスク管理・タイマー・セッション全部入り |
| `src/components/FocusTree.jsx` | グミ風成長ツリー (CSS only) |
| `src/components/TweaksPanel.jsx` | カスタマイズパネル + 各種コントロール |
| `src/hooks/useLocalStorage.js` | localStorage と同期する useState |
| `src/hooks/useTodos.js` | スキラボ todos API クライアント |
| `src/styles.css` | デザイントークン + レスポンシブ CSS |
| `src/styles-overrides.css` | オリジナル HTML のインライン CSS |
| `lib/md-parser.js` | MD パーサー＋シリアライザ（ローカル/Vercel 共通） |
| `lib/github-client.js` | Octokit で GitHub の .md を読み書き（Vercel 用） |
| `server.js` | ローカル Express API（ファイルシステム経由） |
| `api/health.js` | Vercel: ヘルスチェック |
| `api/todos/[date].js` | Vercel: タスク GET/POST |
| `api/todos/[date]/[id].js` | Vercel: タスク PATCH |
| `api/sessions/[date].js` | Vercel: セッション POST |
| `vercel.json` | Vercel 設定 |
| `.env.example` | 環境変数サンプル |
| `vite.config.js` | PWA 設定 + プロキシ |
| `original/` | Claude Design からの handoff bundle（変更しない） |

## 環境の使い分け

| 環境 | API | データソース |
|------|-----|--------------|
| ローカル (`npm run dev`) | server.js (Express) | ファイルシステム直 |
| Vercel (本番) | api/*.js (Serverless) | GitHub API → リポの .md |

両方とも同じ `lib/md-parser.js` を共有しているので、MD 形式は完全に一致する。

## 開発時の注意

### スキラボ連携の安全装置
- API が落ちていてもアプリは動き続ける（`useTodos` がオフライン状態でフォールバック）
- 既存の MD ファイル形式を絶対に壊さない（`server.js` の MD パーサ・シリアライザを変更する際は要テスト）
- 同日 1 ファイル原則（`.company/secretary/CLAUDE.md` のルールに準拠）

### React の癖
- `app.jsx` を移植したため、コードベースは「巨大な App.jsx + components/」スタイル
- 段階的にコンポーネントを切り出すのは OK だが、急ぐ必要はない
- TweaksPanel は `React.useState` 形式を残す（元コードに従う）

### PWA 配信
- スマホで使う場合は PC を WiFi 接続して `npm run dev` のまま IP アクセス
- 本格運用するならビルド → GitHub Pages + Railway などにデプロイ

## API エンドポイント早見表

```
GET    /api/health                  ヘルスチェック
GET    /api/todos/:date             タスク取得
POST   /api/todos/:date             タスク追加      {text, section?, priority?, genre?, due?}
PATCH  /api/todos/:date/:id         タスク更新      {checked?, text?}
POST   /api/sessions/:date          セッション追記  {type, label, durationMin, time?}
```

## Next Actions
- セッション履歴を MD から取得して `HistoryCard` 表示
- ブラウザ通知 (`Notification API`)
- 終了音
- GitHub Pages デプロイ
