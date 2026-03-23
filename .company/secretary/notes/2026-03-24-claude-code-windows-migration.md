# Claude Code を WSL → PowerShell（Windows Native）に移行する

> 調査日: 2026-03-23
> 参照: https://code.claude.com/docs/en/quickstart / setup / troubleshooting

---

## 前提条件

- **Git for Windows が必須**（Claude Code は内部で Git Bash を使って動く）
  - インストール時に「Add to PATH」を選択すること
  - Git Bash が見つからない場合は settings.json で手動指定：
    ```json
    {
      "env": {
        "CLAUDE_CODE_GIT_BASH_PATH": "C:\\Program Files\\Git\\bin\\bash.exe"
      }
    }
    ```

---

## インストール手順

### Option A: PowerShell（推奨・自動更新あり）
```powershell
irm https://claude.ai/install.ps1 | iex
```

### Option B: WinGet（自動更新なし）
```powershell
winget install Anthropic.ClaudeCode
# 更新時: winget upgrade Anthropic.ClaudeCode
```

### TLSエラーが出た場合
```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
irm https://claude.ai/install.ps1 | iex
```

### PATH が通っていない場合
```powershell
$currentPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
[Environment]::SetEnvironmentVariable('PATH', "$currentPath;$env:USERPROFILE\.local\bin", 'User')
# → ターミナル再起動後に `claude --version` で確認
```

---

## メリット

| 項目 | 内容 |
|------|------|
| ファイルアクセス速度 | プロジェクトが `/mnt/c/cc-company`（Windowsファイルシステム）なので、WSL経由の `/mnt/c/` クロスアクセスの遅延がなくなる |
| WSL固有トラブルの解消 | nvm/Node.jsのパス競合・JetBrains IDE検出失敗・OAuth Browserの問題がなくなる |
| 起動の手間 | WSL起動不要。PowerShellから直接 `claude` が使える |

---

## 弊害・リスク

### 1. サンドボックス機能が使えない可能性
- `/sandbox` コマンドは **WSL2のみ明記**。Windows nativeでの対応は公式ドキュメントに記載なし。

### 2. 設定ファイルの場所が変わる → 再設定が必要
```
WSL:     ~/.claude/settings.json  /  ~/.claude.json
Windows: %USERPROFILE%\.claude\settings.json  /  %USERPROFILE%\.claude.json
         （例: C:\Users\konkai\.claude\）
```
- MCP設定・パーミッション・スキル設定はそのまま引き継げない
- WSL側の設定とは別管理になる

### 3. Claude Desktop（古いバージョン）との競合
- 古い Claude Desktop が `Claude.exe` を PATH に登録していると `claude` コマンドがDesktopアプリを開いてしまう
- → Claude Desktop を最新版に更新すれば解消

### 4. WinGet使用時は自動更新なし
- `install.ps1` 経由なら自動更新あり
- WinGet は手動更新が必要（`winget upgrade Anthropic.ClaudeCode`）

---

## 移行チェックリスト

- [ ] Git for Windows がインストールされているか確認（`git --version`）
- [ ] `irm https://claude.ai/install.ps1 | iex` を実行
- [ ] `claude --version` で動作確認
- [ ] ログイン（`claude` → `/login`）
- [ ] MCP設定を再設定（Notion CLI など）
- [ ] スキル・パーミッション設定を再設定
- [ ] Claude Desktop が最新版かどうか確認
