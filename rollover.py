#!/usr/bin/env python3
"""
スキラボ TODO ロールオーバースクリプト
前日の未完了タスクを今日のTODOファイルの「引き継ぎ（未完了）」に自動追記する。

使い方:
  python rollover.py              # 昨日 → 今日
  python rollover.py --date 2026-04-07  # 指定日のファイルに前日分を追記
"""

import re
import sys
import argparse
from datetime import date, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).parent
TODOS_DIR = BASE_DIR / ".company" / "secretary" / "todos"

WEEKDAY_JA = ["月", "火", "水", "木", "金", "土", "日"]

# ─── TODO パース ─────────────────────────────────────────────────────────────

def extract_uncompleted(file_path: Path) -> list[str]:
    """ファイルから未完了タスク行を取得（生の行テキストで返す）"""
    if not file_path.exists():
        return []

    content = file_path.read_text(encoding="utf-8")
    lines = []

    for line in content.splitlines():
        # `- [ ]` で始まる行のみ（完了 `[x]` は除外）
        if re.match(r"^- \[ \] ", line):
            lines.append(line.strip())

    return lines


def extract_carryover_tasks(file_path: Path) -> list[str]:
    """引き継ぎセクションにすでにある未完了タスクを取得"""
    if not file_path.exists():
        return []

    content = file_path.read_text(encoding="utf-8")
    in_carryover = False
    tasks = []

    for line in content.splitlines():
        if re.match(r"^### 引き継ぎ", line):
            in_carryover = True
            continue
        if in_carryover:
            if line.startswith("###") or line.startswith("##"):
                break
            if re.match(r"^- \[ \] ", line):
                tasks.append(line.strip())

    return tasks

# ─── ファイル操作 ─────────────────────────────────────────────────────────────

def ensure_today_file(today: date) -> Path:
    """今日のTODOファイルが存在しない場合は作成する"""
    file_path = TODOS_DIR / f"{today.isoformat()}.md"

    if file_path.exists():
        return file_path

    wd = WEEKDAY_JA[today.weekday()]
    content = f"""---
date: "{today.isoformat()}"
type: daily
---

# {today.isoformat()} ({wd})

## 予定

## TODO

### 引き継ぎ（未完了）

### 今日

## メモ・振り返り
"""
    file_path.write_text(content, encoding="utf-8")
    print(f"📄 今日のTODOファイルを作成しました: {file_path.name}")
    return file_path


def insert_carryover(file_path: Path, new_tasks: list[str]):
    """「引き継ぎ（未完了）」セクションに新しいタスクを追記する"""
    content = file_path.read_text(encoding="utf-8")

    # 「### 引き継ぎ（未完了）」セクションを探して追記
    pattern = re.compile(r"(### 引き継ぎ（未完了）\n)")
    match = pattern.search(content)

    if not match:
        # セクションがない場合は「## TODO」の直後に追加
        insert_block = "### 引き継ぎ（未完了）\n" + "\n".join(new_tasks) + "\n\n"
        content = content.replace("## TODO\n", f"## TODO\n\n{insert_block}", 1)
    else:
        insert_pos = match.end()
        insert_text = "\n".join(new_tasks) + "\n"
        content = content[:insert_pos] + insert_text + content[insert_pos:]

    file_path.write_text(content, encoding="utf-8")

# ─── メイン処理 ──────────────────────────────────────────────────────────────

def rollover(today: date):
    yesterday = today - timedelta(days=1)

    print(f"🔄 ロールオーバー: {yesterday} → {today}")
    print()

    yesterday_file = TODOS_DIR / f"{yesterday.isoformat()}.md"

    if not yesterday_file.exists():
        print(f"⚠️  {yesterday_file.name} が見つかりません。スキップします。")
        return

    # 前日の未完了タスクを取得
    uncompleted = extract_uncompleted(yesterday_file)

    if not uncompleted:
        print(f"✅ {yesterday_file.name} に未完了タスクはありませんでした。")
        return

    print(f"📋 前日の未完了タスク: {len(uncompleted)} 件")
    for t in uncompleted:
        print(f"   {t}")
    print()

    # 今日のファイルを確保
    today_file = ensure_today_file(today)

    # 今日の引き継ぎセクションにすでにあるタスクを確認（重複防止）
    existing = extract_carryover_tasks(today_file)
    existing_titles = set()
    for line in existing:
        # タイトル部分だけ抽出して比較
        m = re.match(r"^- \[ \] (.+?)(?:\s*\|.*)?$", line)
        if m:
            existing_titles.add(m.group(1).strip())

    new_tasks = []
    skipped = []
    for line in uncompleted:
        m = re.match(r"^- \[ \] (.+?)(?:\s*\|.*)?$", line)
        title = m.group(1).strip() if m else line
        if title in existing_titles:
            skipped.append(title)
        else:
            new_tasks.append(line)

    if skipped:
        print(f"⏭️  すでに引き継ぎ済み（スキップ）: {len(skipped)} 件")
        for t in skipped:
            print(f"   - {t}")
        print()

    if not new_tasks:
        print("ℹ️  追加すべき新しいタスクはありませんでした。")
        return

    # 今日のファイルに追記
    insert_carryover(today_file, new_tasks)

    print(f"✅ {len(new_tasks)} 件を {today_file.name} の「引き継ぎ（未完了）」に追記しました：")
    for t in new_tasks:
        print(f"   {t}")
    print()
    print("💡 ヒント: その後 `python sync_gcal.py` を実行するとカレンダーにも反映されます。")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="前日の未完了TODOを今日に引き継ぐ")
    parser.add_argument("--date", type=str, help="引き継ぎ先の日付 YYYY-MM-DD（省略時は今日）")
    args = parser.parse_args()

    if args.date:
        try:
            today = date.fromisoformat(args.date)
        except ValueError:
            print(f"❌ 日付の形式が正しくありません: {args.date}")
            sys.exit(1)
    else:
        today = date.today()

    rollover(today)
