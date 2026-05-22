#!/usr/bin/env python3
# 実行: C:\Users\konka\AppData\Local\Programs\Python\Python313\python.exe screenshot.py
"""
X Image Generator - スライドキャプチャスクリプト

事前準備:
  python -m http.server 8080 --directory "C:\\cc-company\\.company\\playground\\projects\\x-image-generator"
  → http://localhost:8080/approach-a-canvas/playwright-tips-v2.html が開ける状態にしてから実行

使い方:
  python screenshot.py          # 全スライドを保存
  python screenshot.py 1        # スライド1だけ保存
  python screenshot.py 2 3      # スライド2・3を保存
"""
import sys
import os
from playwright.sync_api import sync_playwright

BASE_URL   = "http://localhost:8080/playwright-tips-v2.html"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")


def capture(targets: list[int] | None = None):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1200, "height": 675})

        print(f"🌐 {BASE_URL} を開いています…")
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)   # フォント・画像の読み込み待ち

        total = page.evaluate("document.querySelectorAll('.slide').length")
        indices = targets if targets else list(range(total))

        saved = []
        for i in indices:
            if i < 0 or i >= total:
                print(f"⚠️  スライド {i+1} は存在しません（全{total}枚）")
                continue

            page.evaluate(f"go({i})")
            page.wait_for_timeout(300)

            path = os.path.join(OUTPUT_DIR, f"slide-{i+1}.png")
            page.locator(".slide.active").screenshot(path=path)
            print(f"✅ slide-{i+1}.png → {path}")
            saved.append(path)

        browser.close()

    print(f"\n🎉 {len(saved)} 枚を {OUTPUT_DIR} に保存しました！")
    return saved


if __name__ == "__main__":
    args = sys.argv[1:]

    if args:
        try:
            targets = [int(a) - 1 for a in args]   # 1始まり → 0始まりに変換
        except ValueError:
            print("使い方: python screenshot.py [スライド番号 ...]")
            print("例:     python screenshot.py 1 3")
            sys.exit(1)
    else:
        targets = None   # 全スライド

    capture(targets)
