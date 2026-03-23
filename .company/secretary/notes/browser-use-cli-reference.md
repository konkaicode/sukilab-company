---
created: "2026-03-23"
topic: "Browser Use CLI 日本語仕様書"
type: reference
tags: ["browser-use", "cli", "automation", "reference"]
---

# Browser Use CLI 日本語仕様書

## グローバルオプション（全コマンド共通）

```bash
browser-use [オプション] <コマンド>
```

| オプション | 説明 |
|-----------|------|
| `--headed` | ブラウザウィンドウを表示して実行 |
| `--profile [NAME]` | ログイン済みのChromeプロファイルを使用 |
| `--connect` | 実行中のChromeに自動接続 |
| `--cdp-url <url>` | CDP URLを指定して接続 |
| `--session NAME` | セッション名を指定（複数セッション管理用） |
| `--json` | 出力をJSON形式にする |
| `--mcp` | MCPサーバーとして起動 |

---

## ナビゲーション

```bash
browser-use open <URL>                     # URLを開く
browser-use back                           # ひとつ前のページへ戻る
browser-use scroll down                    # 下にスクロール
browser-use scroll up                      # 上にスクロール
browser-use scroll down --amount 1000      # ピクセル数を指定してスクロール
```

---

## ページの状態確認・スクリーンショット

```bash
browser-use state                          # URL・タイトル・操作可能な要素を番号付きで表示
browser-use screenshot                     # スクリーンショット（base64で出力）
browser-use screenshot output.png          # ファイルに保存
browser-use screenshot --full output.png   # ページ全体をキャプチャ
```

---

## 操作系

```bash
browser-use click <index>                  # 番号で要素をクリック
browser-use click <x> <y>                  # 座標指定でクリック
browser-use dblclick <index>               # ダブルクリック
browser-use rightclick <index>             # 右クリック
browser-use hover <index>                  # ホバー（マウスオーバー）

browser-use type "テキスト"                # フォーカス中の要素に入力
browser-use input <index> "テキスト"       # クリック＋入力を一度に
browser-use keys "Enter"                   # キーボード操作（Enter、Tab等）
browser-use select <index> "value"         # ドロップダウンから選択
browser-use upload <index> <path>          # ファイルをアップロード
```

---

## 情報取得

```bash
browser-use get title                      # ページタイトルを取得
browser-use get html                       # ページ全体のHTMLを取得
browser-use get text <index>               # 指定要素のテキストを取得
browser-use get value <index>              # input要素の値を取得
browser-use get bbox <index>               # 要素の座標・サイズを取得
```

---

## 待機

```bash
browser-use wait selector ".class"                   # 要素が表示されるまで待つ
browser-use wait text "完了"                         # 特定テキストが出るまで待つ
browser-use wait selector ".loading" --state hidden  # 要素が消えるまで待つ
```

---

## JavaScript実行

```bash
browser-use eval "document.title"                          # JSを実行して結果を返す
browser-use eval "document.querySelectorAll('a').length"   # リンク数など取得
```

---

## Pythonスクリプト（複雑な自動化）

```bash
browser-use python "x = 42"           # Python式を実行（セッション維持）
browser-use python --vars              # 変数の状態を確認
browser-use python --file script.py   # Pythonファイルを実行
```

---

## Cookie操作

```bash
browser-use cookies get               # 全Cookieを表示
browser-use cookies set name value    # Cookieをセット
browser-use cookies clear             # Cookieを全削除
browser-use cookies export file.json  # JSONに書き出す
browser-use cookies import file.json  # JSONから読み込む
```

---

## タブ管理

```bash
browser-use switch <タブ番号>          # タブを切り替える
browser-use close-tab                  # 現在のタブを閉じる
browser-use close-tab <タブ番号>       # 指定タブを閉じる
```

---

## セッション管理

```bash
browser-use sessions                   # 起動中のセッション一覧
browser-use close                      # 現在のセッションを閉じる
browser-use close --all                # 全セッションを閉じる
```

---

## トンネル（ローカルサーバーを外部公開）

```bash
browser-use tunnel <ポート番号>        # トンネル開始
browser-use tunnel list                # 有効なトンネル一覧
browser-use tunnel stop <ポート番号>   # トンネル停止
```

---

## ブラウザ起動モードまとめ

| モード | コマンド例 |
|--------|-----------|
| ヘッドレス（デフォルト） | `browser-use open https://...` |
| ウィンドウ表示 | `browser-use --headed open https://...` |
| ログイン済みChromeを使う | `browser-use --profile "Default" open https://...` |
| 既存のChromeに接続 | `browser-use --connect open https://...` |
| 複数セッションを並行 | `browser-use --session session1 open https://...` |

---

## 関連
- notes/2026-03-23-research-automation.md（情報収集自動化の設計方針）
- 公式ドキュメント: https://docs.browser-use.com/open-source/browser-use-cli
