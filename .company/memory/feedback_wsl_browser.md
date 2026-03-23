---
name: WSL環境でのブラウザ起動方法
description: WSL環境でbrowser-useや外部URLを開く場合はフルパスを使う
type: feedback
---

WSL環境でブラウザを開く場合は、`cmd.exe` や `powershell.exe` はPATHにないため、フルパスで指定する。

```bash
/mnt/c/Windows/System32/cmd.exe /c start <URL>
```

**Why:** WSLのPATH設定でWindowsのSystem32が含まれていないため、`cmd.exe`単体では "command not found" になる。

**How to apply:** browser-useなどのツールでURLをWindowsブラウザで開く必要があるときは、常にこのフルパス形式を使う。`browser-use open` はWSL2のGUI未対応環境では動かないので、このコマンドが代替手段になる。
