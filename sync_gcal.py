#!/usr/bin/env python3
"""
スキラボ TODO → Google Calendar 同期スクリプト

使い方:
  python sync_gcal.py              # 今日のTODOを同期
  python sync_gcal.py --date 2026-04-10  # 指定日のTODOを同期

カレンダーの色ルール:
  背景色 → ジャンル   🔴赤=仕事  🟡黄=個人
  絵文字 → 優先度     🔴高  🔵通常  🟢低
  完了時 → ✅を先頭に  例: ✅🔴 タスク名

時間指定:
  時間: HH:MM~HH:MM  → 指定時間帯のイベント（30分前リマインダーあり）
  時間: HH:MM        → 開始のみ指定（終了は+1時間）
  時間未指定         → 終日イベント（リマインダーなし）
"""

import re
import sys
import argparse
from datetime import date, datetime, timedelta
from pathlib import Path

try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
except ImportError:
    print("❌ 依存パッケージが不足しています。以下を実行してください：")
    print("   pip install google-api-python-client google-auth-oauthlib google-auth-httplib2")
    sys.exit(1)

# ─── 設定 ────────────────────────────────────────────────────────────────────

SCOPES = ["https://www.googleapis.com/auth/calendar"]

BASE_DIR = Path(__file__).parent
TODOS_DIR = BASE_DIR / ".company" / "secretary" / "todos"
CREDENTIALS_FILE = BASE_DIR / "credentials.json"
TOKEN_FILE = BASE_DIR / "token.json"

CALENDAR_ID = "primary"
SOURCE_TAG = "sukilab"

# ─── ジャンル判定 ─────────────────────────────────────────────────────────────
# ここにキーワードを追加するだけで判定を拡張できます

WORK_KEYWORDS = [
    "ドローン塾", "やま幸", "Shopify", "shopify", "WordPress", "wordpress",
    "LP", "バナー", "案件", "クライアント", "納品", "請求", "制作",
    "JAL", "まちたけ", "Craftify", "コーディング", "コード",
    "プロトタイプ", "ページ作成", "パララックス", "モーダル", "リダイレクト",
    "フッター", "アクセス", "スライド", "お問い合わせ", "分校", "講師",
]

def detect_genre(title: str) -> str:
    for kw in WORK_KEYWORDS:
        if kw in title:
            return "仕事"
    return "個人"

# ─── カラー設定 ───────────────────────────────────────────────────────────────

# ジャンル → Google Calendar カラーID（背景色）
GENRE_COLOR = {
    "仕事": "11",  # Tomato（赤）
    "個人": "5",   # Banana（黄）
}

# 優先度 → 絵文字
PRIORITY_EMOJI = {
    "高": "🔴",
    "通常": "🔵",
    "低": "🟢",
}

# ─── 認証 ────────────────────────────────────────────────────────────────────

def get_service():
    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CREDENTIALS_FILE.exists():
                print("❌ credentials.json が見つかりません。")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)
        TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")
    return build("calendar", "v3", credentials=creds)

# ─── TODOパース ──────────────────────────────────────────────────────────────

def parse_todos(file_path: Path, file_date: date) -> list[dict]:
    """未完了・完了両方のタスクを取得"""
    if not file_path.exists():
        return []

    content = file_path.read_text(encoding="utf-8")
    tasks = []

    # [ ] = 未完了、[x] = 完了 の両方をパース（1行ずつ処理してジャンルを確実に取得）
    line_pattern = re.compile(
        r"^- \[([ x])\] ([^|\n]+)(?:\s*\|\s*優先度:\s*(高|通常|低))?(?:\s*\|\s*期限:\s*(\d{4}-\d{2}-\d{2}))?",
    )

    for line in content.splitlines():
        m = line_pattern.match(line)
        if not m:
            continue

        done = m.group(1) == "x"
        title = m.group(2).strip().split("|")[0].strip()
        priority = m.group(3) or "通常"
        deadline_str = m.group(4)
        deadline = date.fromisoformat(deadline_str) if deadline_str else None

        # ジャンルは行全体から検索（明示指定を優先、なければキーワード推定）
        genre_match = re.search(r"ジャンル[:：]\s*(仕事|個人)", line)
        genre = genre_match.group(1) if genre_match else detect_genre(title)

        # 時間指定: 時間: HH:MM~HH:MM または 時間: HH:MM
        time_match = re.search(r"時間:\s*(\d{2}:\d{2})(?:~(\d{2}:\d{2}))?", line)
        start_time = time_match.group(1) if time_match else None
        end_time = time_match.group(2) if time_match else None

        tasks.append({
            "title": title,
            "priority": priority,
            "done": done,
            "file_date": file_date,
            "deadline": deadline,
            "genre": genre,
            "start_time": start_time,
            "end_time": end_time,
        })

    return tasks

# ─── イベントタイトル生成 ─────────────────────────────────────────────────────

def build_title(task: dict) -> str:
    emoji = PRIORITY_EMOJI.get(task["priority"], "🔵")
    if task["done"]:
        return f"✅{emoji} {task['title']}"
    return f"{emoji} {task['title']}"

# ─── カレンダー操作 ──────────────────────────────────────────────────────────

def list_sukilab_events(service, target_date: date) -> list:
    time_min = f"{target_date.isoformat()}T00:00:00Z"
    time_max = f"{(target_date + timedelta(days=1)).isoformat()}T00:00:00Z"
    result = service.events().list(
        calendarId=CALENDAR_ID,
        timeMin=time_min,
        timeMax=time_max,
        privateExtendedProperty=f"source={SOURCE_TAG}",
        singleEvents=True,
    ).execute()
    return result.get("items", [])


def clear_sukilab_events(service, target_date: date, cleared: set):
    if target_date in cleared:
        return
    events = list_sukilab_events(service, target_date)
    for ev in events:
        service.events().delete(calendarId=CALENDAR_ID, eventId=ev["id"]).execute()
    if events:
        print(f"  🗑️  既存スキラボイベント削除: {target_date} （{len(events)} 件）")
    cleared.add(target_date)


def create_event(service, task: dict, target_date: date, description: str = ""):
    summary = build_title(task)
    color_id = GENRE_COLOR.get(task["genre"], "5")
    start_time = task.get("start_time")
    end_time = task.get("end_time")

    if start_time:
        # 時間指定あり → timed イベント + 30分前リマインダー
        start_dt = datetime.fromisoformat(f"{target_date.isoformat()}T{start_time}:00")
        if end_time:
            end_dt = datetime.fromisoformat(f"{target_date.isoformat()}T{end_time}:00")
        else:
            end_dt = start_dt + timedelta(hours=1)

        event = {
            "summary": summary,
            "description": description,
            "colorId": color_id,
            "start": {"dateTime": start_dt.isoformat(), "timeZone": "Asia/Tokyo"},
            "end": {"dateTime": end_dt.isoformat(), "timeZone": "Asia/Tokyo"},
            "extendedProperties": {"private": {"source": SOURCE_TAG}},
            "reminders": {
                "useDefault": False,
                "overrides": [{"method": "popup", "minutes": 30}],
            },
        }
    else:
        # 時間指定なし → 終日イベント・リマインダーなし
        event = {
            "summary": summary,
            "description": description,
            "colorId": color_id,
            "start": {"date": target_date.isoformat()},
            "end": {"date": (target_date + timedelta(days=1)).isoformat()},
            "extendedProperties": {"private": {"source": SOURCE_TAG}},
            "reminders": {
                "useDefault": False,
                "overrides": [],
            },
        }

    service.events().insert(calendarId=CALENDAR_ID, body=event).execute()

# ─── メイン処理 ──────────────────────────────────────────────────────────────

def sync(target_date: date):
    print(f"📅 スキラボ TODO → Google Calendar 同期")
    print(f"   対象日: {target_date}")
    print()

    todo_file = TODOS_DIR / f"{target_date.isoformat()}.md"
    tasks = parse_todos(todo_file, target_date)

    if not tasks:
        print(f"⚠️  {todo_file.name} にTODOが見つかりませんでした。")
        return

    active = [t for t in tasks if not t["done"]]
    done   = [t for t in tasks if t["done"]]
    print(f"📋 未完了: {len(active)} 件 / 完了: {len(done)} 件")

    service = get_service()
    cleared_dates: set[date] = set()

    clear_sukilab_events(service, target_date, cleared_dates)

    for task in tasks:
        genre_icon = "🔴" if task["genre"] == "仕事" else "🟡"
        status = "✅" if task["done"] else "  "
        print(f"  {status} {genre_icon}[{task['genre']}] {build_title(task)} → {target_date}")

        create_event(
            service, task, target_date,
            description=f"スキラボ TODO（{target_date}）"
        )

        # 期限日にも登録（未完了のみ・今日と異なる場合）
        if not task["done"] and task["deadline"] and task["deadline"] != target_date:
            dl = task["deadline"]
            clear_sukilab_events(service, dl, cleared_dates)
            deadline_task = dict(task, title=f"⚠️期限 {task['title']}")
            create_event(
                service, deadline_task, dl,
                description=f"スキラボ TODO 期限日\n作成日: {target_date}"
            )
            print(f"       └─ 期限イベントも登録 → {dl}")

    print()
    print(f"🎉 同期完了！  未完了: {len(active)} 件 / 完了: {len(done)} 件")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="スキラボ TODO → Google Calendar 同期")
    parser.add_argument("--date", type=str, help="対象日付 YYYY-MM-DD（省略時は今日）")
    args = parser.parse_args()

    if args.date:
        try:
            target = date.fromisoformat(args.date)
        except ValueError:
            print(f"❌ 日付の形式が正しくありません: {args.date}")
            sys.exit(1)
    else:
        target = date.today()

    sync(target)
