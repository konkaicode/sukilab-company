#!/usr/bin/env python3
"""
過去TODOファイルへの「ジャンル」一括タギングスクリプト（使い捨て）
セクション見出しの文脈 + キーワードでジャンルを判定し | ジャンル: 仕事/個人 を追記する。
すでに ジャンル: が書いてある行はスキップ。
"""

import re
from pathlib import Path

BASE_DIR = Path(__file__).parent
TODOS_DIR = BASE_DIR / ".company" / "secretary" / "todos"

# ─── 判定ルール ───────────────────────────────────────────────────────────────

# セクション見出し（## / ###）にこれらが含まれていたら、以下のタスクは「仕事」
WORK_SECTION_KEYWORDS = [
    "ドローン", "やま幸", "TechDrone", "テックドローン", "JAL",
    "TAYOL", "Craftify", "まちたけ", "Tak ",
]

# タスク本文にこれらが含まれていたら「仕事」
WORK_TASK_KEYWORDS = [
    "ドローン塾", "ドローン合宿", "TechDrone", "テックドローン",
    "やま幸", "JAL", "TAYOL", "Craftify", "まちたけ",
    "Shopify", "shopify", "WordPress", "wordpress",
    "LP", "バナー", "請求書", "見積書", "提案書", "案件",
    "クライアント", "納品", "本番環境", "デプロイ", "打ち合わせ",
    "リデザイン", "リニューアル", "FBやる", "FB ",
]

# タスク本文にこれらが含まれていたら「個人」（仕事キーワードより優先度低）
PERSONAL_TASK_KEYWORDS = [
    "スキラボ", "デイトラ6周年", "before", "Before",
    "WESTERポイント", "ICOCA",
    "Dev Tools", "Codex",
    "コードルール", "Takさんのコーディング情報",
    "AI勉強", "100個の目標", "壁打ち",
    "ファイナンス部署", "リサーチ部署", "Notion MCP",
    "Claude Code", "WSL", "PowerShell",
    "履修登録", "休学届", "散髪",
    "note 公開", "サムネイル",
]


def detect_genre(title: str, section_header: str) -> str:
    # セクション見出しが仕事系なら仕事
    for kw in WORK_SECTION_KEYWORDS:
        if kw in section_header:
            return "仕事"

    # タスク本文で個人キーワードが先にマッチしたら個人
    for kw in PERSONAL_TASK_KEYWORDS:
        if kw in title:
            return "個人"

    # タスク本文で仕事キーワードがマッチしたら仕事
    for kw in WORK_TASK_KEYWORDS:
        if kw in title:
            return "仕事"

    return "個人"  # デフォルト


def tag_file(file_path: Path) -> int:
    content = file_path.read_text(encoding="utf-8")
    lines = content.splitlines()
    new_lines = []
    current_section = ""
    tagged_count = 0

    for line in lines:
        # セクション見出しを追跡
        if re.match(r"^#{1,3} ", line):
            current_section = line

        # TODO行かチェック（[ ] または [x]）
        todo_match = re.match(r"^(- \[[ x]\] .+)", line)
        if todo_match:
            # すでにジャンルが付いている場合はスキップ
            if "ジャンル:" in line or "ジャンル：" in line:
                new_lines.append(line)
                continue

            # 優先度・期限・その他パイプ以降を除いたタイトル部分を取得
            title_match = re.match(r"^- \[[ x]\] ([^|\n]+)", line)
            title = title_match.group(1).strip() if title_match else line

            genre = detect_genre(title, current_section)

            # 行末の余分なスペースを除去してから追記
            new_line = line.rstrip()

            # パイプ区切りのフィールドが既にあるか？
            if "|" in new_line:
                new_line = new_line + f" | ジャンル: {genre}"
            else:
                new_line = new_line + f" | ジャンル: {genre}"

            new_lines.append(new_line)
            tagged_count += 1
        else:
            new_lines.append(line)

    if tagged_count > 0:
        file_path.write_text("\n".join(new_lines), encoding="utf-8")

    return tagged_count


def main():
    files = sorted(TODOS_DIR.glob("2026-*.md"))
    total = 0

    print("🏷️  TODO ジャンルタギング開始")
    print()

    for f in files:
        count = tag_file(f)
        if count > 0:
            print(f"  ✅ {f.name}  +{count} 件タグ付け")
        else:
            print(f"  ⏭️  {f.name}  スキップ（タグ済みまたはTODOなし）")
        total += count

    print()
    print(f"🎉 完了！  合計 {total} 件にジャンルを付けました。")


if __name__ == "__main__":
    main()
