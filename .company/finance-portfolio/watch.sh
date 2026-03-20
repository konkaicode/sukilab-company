#!/bin/bash
# finance-portfolio 自動更新スクリプト
# 新しいCSVが data/ に追加されたら自動で analyze.py を実行する

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
REPORT_DIR="$SCRIPT_DIR/reports"
LOCK_FILE="$SCRIPT_DIR/.analyzing"

run_analyze() {
    if [ -f "$LOCK_FILE" ]; then
        return  # 実行中はスキップ
    fi
    touch "$LOCK_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 新しいCSVを検出 → 分析開始"
    python3 "$SCRIPT_DIR/analyze.py"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 分析完了"
    rm -f "$LOCK_FILE"
}

needs_update() {
    # 最新CSVのタイムスタンプ
    latest_csv=$(ls -t "$DATA_DIR"/*.csv 2>/dev/null | head -1)
    [ -z "$latest_csv" ] && return 1

    # 最新レポートのタイムスタンプ
    latest_report=$(ls -t "$REPORT_DIR"/*.md 2>/dev/null | head -1)

    # レポートがない or CSVがレポートより新しければ更新が必要
    if [ -z "$latest_report" ]; then
        return 0
    fi
    [ "$latest_csv" -nt "$latest_report" ]
}

echo "=== finance-portfolio ファイル監視開始 ==="
echo "  監視対象: $DATA_DIR"
echo "  Ctrl+C で停止"
echo ""

# 起動時に一度チェック
if needs_update; then
    run_analyze
fi

# ポーリングループ（30秒ごと）
while true; do
    sleep 30
    if needs_update; then
        run_analyze
    fi
done
