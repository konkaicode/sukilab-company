---
name: WSL環境でのブラウザ起動方法
description: WSL環境でのbrowser-use利用パターンと注意事項
type: feedback
---

## Braveで開くだけ（閲覧）

```bash
/mnt/c/Windows/System32/cmd.exe /c start brave <URL>
```

**Why:** WSLのPATHにWindowsのSystem32が含まれないためフルパスが必要。

## browser-useで操作・自動化する場合

```bash
browser-use open <URL>          # headlessで開いて操作
browser-use --headed open <URL> # ウィンドウ表示あり（WSLg経由）
```

## セッション管理の注意

- 失敗後はセッションが残留することがある → `browser-use close` で明示的に閉じてから再起動する
- headedモードはWSLgを経由するため通常のLinuxより起動が遅い場合がある

## 初回セットアップ（依存ライブラリ）

WSL環境にPlaywrightのChromium依存ライブラリが不足しているとタイムアウトになる。

```bash
python3 -m playwright install-deps chromium  # sudoが必要
```

または個別に `sudo apt-get install -y libnspr4 libasound2 ...`

**Why:** 2026-03-23に初めてbrowser-useを使った際、ライブラリ不足でタイムアウト。インストール後は正常動作。

**How to apply:** browser-useが30秒タイムアウトで失敗したらまずライブラリ確認。Braveで開くだけなら `cmd.exe /c start brave <URL>` が確実。
