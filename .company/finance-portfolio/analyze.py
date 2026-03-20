"""
finance-portfolio 分析スクリプト
data/ フォルダ内の最新CSVを読み込み、reports/ にレポートを出力する
"""
import urllib.request
import json
import re
import time
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
REPORT_DIR = BASE_DIR / "reports"
REPORT_DIR.mkdir(exist_ok=True)


def get_latest_csv():
    csvs = sorted(DATA_DIR.glob("*.csv"), key=lambda f: f.stat().st_mtime, reverse=True)
    if not csvs:
        raise FileNotFoundError("data/ フォルダにCSVファイルがありません")
    return csvs[0]


def parse_csv(path):
    text = open(path, encoding="shift-jis").read()

    stocks = []
    section = None
    for line in text.splitlines():
        line = line.strip()
        if "特定預り" in line and "投資信託" not in line:
            section = "特定"
        elif "NISA" in line and "投資信託" not in line and "合計" not in line:
            section = "NISA"
        elif "投資信託" in line and "合計" not in line:
            section = "投信"

        m = re.match(r'"([0-9]{4}[A-Z0-9]*)\s+([^"]+)",(.+)', line)
        if m and section in ("特定", "NISA"):
            code, name, rest = m.group(1), m.group(2), m.group(3)
            parts = [p.strip().strip('"') for p in rest.split(",")]
            try:
                qty = int(parts[1])
                cost = float(parts[2])
                current = float(parts[3])
                gain_pct_str = parts[5].replace("+", "")
                gain_pct = float(gain_pct_str) if gain_pct_str != "--" else None
                total_val = float(parts[8])
                total_gain_str = parts[6].replace("+", "")
                total_gain = float(total_gain_str) if total_gain_str != "--" else None
                stocks.append({
                    "code": code, "name": name.strip(), "section": section,
                    "qty": qty, "cost": cost, "current": current,
                    "gain_pct": gain_pct, "total_val": total_val,
                    "total_gain": total_gain,
                })
            except (ValueError, IndexError):
                pass

        # 投資信託（ファンド名行）を抽出
        if section == "投信":
            fm = re.match(r'"([^"]{4,}?(?:ファンド|株式|債券|ＳＣＨＤ|Ｓｌｉｍ|インデックス|バランス)[^"]*)",(.*)', line)
            if fm:
                fname, frest = fm.group(1), fm.group(2)
                fparts = [p.strip().strip('"') for p in frest.split(",")]
                try:
                    fqty   = float(fparts[1].replace("+", ""))
                    fcost  = float(fparts[2].replace("+", ""))
                    fcurr  = float(fparts[3].replace("+", ""))
                    fgain_pct_str = fparts[5].replace("+", "")
                    fgain_pct = float(fgain_pct_str) if fgain_pct_str not in ("--", "") else None
                    fval   = float(fparts[8].replace("+", ""))
                    fgain_str = fparts[6].replace("+", "")
                    fgain  = float(fgain_str) if fgain_str not in ("--", "") else None
                    stocks.append({
                        "code": "FUND", "name": fname.strip(), "section": "投信",
                        "qty": fqty, "cost": fcost, "current": fcurr,
                        "gain_pct": fgain_pct, "total_val": fval,
                        "total_gain": fgain,
                    })
                except (ValueError, IndexError):
                    pass

    # 合計行
    totals = {}
    for m in re.finditer(r'"総合計"[^,]*\n"[^"]*","[^"]*","[^"]*","[^"]*","[^"]*"\n([0-9,.+-]+),([0-9,.+-]+),([0-9,.+-]+)', text):
        totals["total_val"] = float(m.group(1).replace(",", ""))
        totals["total_gain"] = float(m.group(2).replace(",", "").replace("+", ""))
        totals["total_gain_pct"] = float(m.group(3).replace(",", "").replace("+", ""))

    # 簡易合計フォールバック
    m2 = re.search(r'2094474|総合計', text)
    if not totals:
        nums = re.findall(r'\n([\d,]+\.?\d*),([\+\-][\d,]+\.?\d*),([\+\-][\d\.]+)', text)
        if nums:
            last = nums[-1]
            totals = {
                "total_val": float(last[0].replace(",", "")),
                "total_gain": float(last[1].replace(",", "")),
                "total_gain_pct": float(last[2]),
            }

    return stocks, totals


def get_schd_dividend_growth():
    """SCHD（米国高配当ETF）の配当増配率をYahoo Finance APIから取得（USD建て）"""
    url = "https://query1.finance.yahoo.com/v8/finance/chart/SCHD?interval=1d&range=6y&events=dividends"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read())
        dividends = data["chart"]["result"][0].get("events", {}).get("dividends", {})
        if not dividends:
            return None, None, None, {}
        by_year = {}
        for ts, v in dividends.items():
            year = datetime.fromtimestamp(int(ts)).year
            by_year[year] = round(by_year.get(year, 0) + v["amount"], 4)
        years = sorted(by_year)[-5:]
        if len(years) < 2:
            return None, None, None, {}
        first, last = by_year[years[0]], by_year[years[-1]]
        n = years[-1] - years[0]
        cagr = ((last / first) ** (1 / n) - 1) * 100 if n > 0 and first > 0 else 0
        hist = {y: by_year[y] for y in years}
        return round(cagr, 1), hist, by_year[years[-1]], {}
    except Exception:
        return None, None, None, {}


def get_dividend_growth(code):
    from html.parser import HTMLParser

    class TableParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.in_td = False
            self.data = []
            self.row = []
        def handle_starttag(self, tag, attrs):
            if tag == 'tr': self.row = []
            if tag in ('td', 'th'): self.in_td = True
        def handle_endtag(self, tag):
            if tag in ('td', 'th'): self.in_td = False
            if tag == 'tr' and self.row: self.data.append(self.row[:])
        def handle_data(self, data):
            if self.in_td:
                t = data.strip()
                if t: self.row.append(t)

    url = f"https://minkabu.jp/stock/{code}/dividend"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            html = res.read().decode('utf-8')

        parser = TableParser()
        parser.feed(html)

        # 「YYYY年3月期」実績・予想行から配当を抽出
        # 実績行: [期, 中間, 期末, 合計, 調整後合計]
        # 予想行: [期, '予想', 中間, 期末, 合計, 調整後]
        history = {}
        forecast = {}
        for row in parser.data:
            if not (len(row) >= 4 and re.match(r'\d{4}年', row[0]) and '期' in row[0]):
                continue
            if '%' in ''.join(row[1:]) or '円' in ''.join(row[1:]):
                continue
            is_forecast = '予想' in row
            try:
                fy = int(re.search(r'(\d{4})年', row[0]).group(1))
                nums = []
                for v in row[1:]:
                    v = v.replace(',', '')
                    if re.match(r'^\d+\.?\d*$', v):
                        nums.append(float(v))
                # nums = [中間, 期末, 合計, 調整後合計]
                if len(nums) >= 4:
                    val = nums[3]   # 調整後合計（株式分割を考慮）
                elif len(nums) >= 3:
                    val = nums[2]   # 合計
                else:
                    continue
                if is_forecast:
                    forecast[fy] = val
                else:
                    history[fy] = val
            except (AttributeError, ValueError):
                pass

        if len(history) < 2:
            return None, None, None, {}

        years = sorted(history)
        first, last = history[years[0]], history[years[-1]]
        n = years[-1] - years[0]
        cagr = ((last / first) ** (1 / n) - 1) * 100 if n > 0 and first > 0 else 0
        hist_sorted = {y: history[y] for y in years}
        return round(cagr, 1), hist_sorted, history[years[-1]], forecast
    except Exception:
        return None, None, None, {}


def generate_report(stocks, totals, dividend_data):
    today = datetime.now().strftime("%Y-%m-%d")
    lines = []
    lines.append(f"# ファイナンスポートフォリオ レポート {today}\n")

    # サマリー
    lines.append("## サマリー\n")
    tv = totals.get("total_val", 0)
    tg = totals.get("total_gain", 0)
    tgp = totals.get("total_gain_pct", 0)
    sign = "+" if tg >= 0 else ""
    lines.append(f"| 項目 | 金額 |")
    lines.append(f"|------|------|")
    lines.append(f"| 総評価額 | {tv:,.0f} 円 |")
    lines.append(f"| 含み損益 | {sign}{tg:,.0f} 円（{sign}{tgp:.2f}%）|")
    lines.append("")

    # 銘柄別損益
    lines.append("## 銘柄別損益\n")
    lines.append("| コード | 銘柄名 | 口座 | 数量 | 取得単価 | 現在値 | 含み損益(%) |")
    lines.append("|--------|--------|------|------|----------|--------|------------|")
    for s in sorted(stocks, key=lambda x: x["gain_pct"] or 0, reverse=True):
        gp = f"{s['gain_pct']:+.2f}%" if s["gain_pct"] is not None else "--"
        lines.append(f"| {s['code']} | {s['name']} | {s['section']} | {s['qty']} | {s['cost']:,.0f} | {s['current']:,.0f} | {gp} |")
    lines.append("")

    # 配当収入・利回り（NISA・特定別、配当なし銘柄・投信は除外）
    lines.append("## 配当収入・利回り\n")
    lines.append("| コード | 銘柄名 | 口座 | 保有株数 | 年間配当(円/株) | 年間配当収入(円) | 配当利回り |")
    lines.append("|--------|--------|------|----------|----------------|-----------------|------------|")

    total_div_income = 0
    stock_val_with_div = 0  # 配当ありの銘柄の評価額合計
    for s in stocks:
        if s["section"] == "投信":
            continue
        code = s["code"]
        cagr, history, latest, forecast = dividend_data.get(code, (None, None, None, {}))
        if latest is None:
            continue  # 配当なし銘柄はスキップ
        annual_income = latest * s["qty"]
        div_yield = (latest / s["current"] * 100) if s["current"] > 0 else 0
        total_div_income += annual_income
        stock_val_with_div += s["total_val"]
        lines.append(f"| {code} | {s['name']} | {s['section']} | {s['qty']} | {latest:.1f} | {annual_income:,.0f} | {div_yield:.2f}% |")

    lines.append("")
    total_div_yield = (total_div_income / stock_val_with_div * 100) if stock_val_with_div > 0 else 0
    lines.append(f"**年間配当収入合計：{total_div_income:,.0f} 円**　／　**配当株利回り（配当あり銘柄のみ）：{total_div_yield:.2f}%**")
    lines.append("")

    # ETF枠（SBI SCHD）
    schd_list = [s for s in stocks if s["section"] == "投信" and "高配当" in s["name"]]
    growth_funds = [s for s in stocks if s["section"] == "投信" and "高配当" not in s["name"]]

    if schd_list:
        lines.append("## ETF枠（米国高配当株式ファンド）\n")
        lines.append("| ファンド名 | 評価額(円) | 含み損益 | 含み損益(%) | 5年CAGR(USD) | 配当履歴(USD/口) |")
        lines.append("|------------|------------|----------|------------|--------------|-----------------|")
        for s in schd_list:
            gp = f"{s['gain_pct']:+.2f}%" if s["gain_pct"] is not None else "--"
            tg = f"{s['total_gain']:+,.0f}" if s["total_gain"] is not None else "--"
            cagr, history, latest, _ = dividend_data.get("FUND", (None, None, None, {}))
            cagr_str = f"{cagr:+.1f}%" if cagr is not None else "---"
            hist_str = "  ".join([f"{y}:${v:.2f}" for y, v in history.items()]) if history else "---"
            lines.append(f"| {s['name']} | {s['total_val']:,.0f} | {tg} | {gp} | {cagr_str} | {hist_str} |")
        lines.append("")
        lines.append("> ※ SCHDは年4回分配型。増配率はUSD建て（基礎ETFのSCHDベース）")
        lines.append("")

    if growth_funds:
        lines.append("## 積立枠（インデックスファンド）\n")
        lines.append("| ファンド名 | 評価額(円) | 含み損益 | 含み損益(%) |")
        lines.append("|------------|------------|----------|------------|")
        for s in growth_funds:
            gp = f"{s['gain_pct']:+.2f}%" if s["gain_pct"] is not None else "--"
            tg = f"{s['total_gain']:+,.0f}" if s["total_gain"] is not None else "--"
            lines.append(f"| {s['name']} | {s['total_val']:,.0f} | {tg} | {gp} |")
        lines.append("")
        lines.append("> ※ 配当なし（成長型）。配当利回りの計算対象外。")
        lines.append("")

    # 増配率（過去4年）- 年度別に列を展開
    lines.append("## 増配率（過去4年CAGR）\n")

    # 実績年度（直近4年）と予想年度を収集
    all_hist_years = sorted({
        y
        for code, (cagr, history, latest, forecast) in dividend_data.items()
        if history
        for y in history
    })[-4:]
    all_fore_years = sorted({
        y
        for code, (cagr, history, latest, forecast) in dividend_data.items()
        if forecast
        for y in forecast
    })
    all_years = sorted(set(all_hist_years) | set(all_fore_years))

    header = "| コード | 銘柄名 | 4年CAGR |" + "".join(
        f" {y}年(予) |" if y in all_fore_years else f" {y}年 |"
        for y in all_years
    )
    sep = "|--------|--------|---------|" + "".join("---------|" for _ in all_years)
    lines.append(header)
    lines.append(sep)

    seen = set()
    for s in stocks:
        code = s["code"]
        if code in seen:
            continue
        seen.add(code)
        if code not in dividend_data:
            continue
        cagr, history, latest, forecast = dividend_data[code]
        if cagr is None:
            sign_str = "---"
            year_cols = "".join(" --- |" for _ in all_years)
        else:
            sign_str = f"{cagr:+.1f}%"
            def cell(y):
                if y in history:
                    return f" {history[y]:.1f} |"
                if y in forecast:
                    return f" {forecast[y]:.1f}(予) |"
                return " --- |"
            year_cols = "".join(cell(y) for y in all_years)
        lines.append(f"| {code} | {s['name']} | {sign_str} |{year_cols}")
    lines.append("")
    lines.append("> (予) は minkabu 予想値")
    lines.append("")

    # 増配率ランキングと平均計算
    ranked = [(s["code"], s["name"], dividend_data[s["code"]][0], s["total_val"])
              for s in stocks
              if s["code"] in dividend_data and dividend_data[s["code"]][0] is not None and s["section"] != "投信"]
    seen2 = set()
    ranked_dedup = []
    val_by_code = {}
    for code, name, cagr, val in ranked:
        val_by_code[code] = val_by_code.get(code, 0) + val
        if code not in seen2:
            seen2.add(code)
            ranked_dedup.append((code, name, cagr))
    ranked_dedup.sort(key=lambda x: x[2], reverse=True)

    # 単純平均・加重平均
    valid = [(code, cagr) for code, name, cagr in ranked_dedup]
    simple_avg = sum(c for _, c in valid) / len(valid) if valid else 0
    total_w = sum(val_by_code.get(code, 0) for code, _ in valid)
    weighted_avg = sum(cagr * val_by_code.get(code, 0) for code, cagr in valid) / total_w if total_w > 0 else 0

    lines.append(f"**増配率 単純平均：{simple_avg:+.1f}%　／　加重平均（評価額ベース）：{weighted_avg:+.1f}%**")
    lines.append("")

    lines.append("## 増配率ランキング Top10\n")
    lines.append("| 順位 | コード | 銘柄名 | 4年CAGR |")
    lines.append("|------|--------|--------|---------|")
    for i, (code, name, cagr) in enumerate(ranked_dedup[:10], 1):
        lines.append(f"| {i} | {code} | {name} | {cagr:+.1f}% |")
    lines.append("")

    lines.append("## 要注意銘柄（減配傾向）\n")
    declining = [(c, n, r) for c, n, r in ranked_dedup if r < 0]
    if declining:
        lines.append("| コード | 銘柄名 | 4年CAGR |")
        lines.append("|--------|--------|---------|")
        for code, name, cagr in declining:
            lines.append(f"| {code} | {name} | {cagr:+.1f}% |")
    else:
        lines.append("減配傾向の銘柄はありません。")
    lines.append("")

    return "\n".join(lines)


def main():
    csv_path = get_latest_csv()
    print(f"読み込み: {csv_path.name}")

    stocks, totals = parse_csv(csv_path)
    print(f"銘柄数: {len(stocks)}")

    print("配当データ取得中...")
    dividend_data = {}
    done = set()
    for s in stocks:
        code = s["code"]
        if code in done:
            continue
        done.add(code)
        if code == "FUND" and "高配当" in s["name"]:
            cagr, history, latest, forecast = get_schd_dividend_growth()
        else:
            cagr, history, latest, forecast = get_dividend_growth(code)
        dividend_data[code] = (cagr, history, latest, forecast)
        status = f"{cagr:+.1f}%" if cagr is not None else "---"
        print(f"  {code} {s['name']}: {status}")
        time.sleep(0.3)

    report = generate_report(stocks, totals, dividend_data)

    out_path = REPORT_DIR / f"{datetime.now().strftime('%Y-%m-%d')}-report.md"
    out_path.write_text(report, encoding="utf-8")
    print(f"\nレポート出力: {out_path}")


if __name__ == "__main__":
    main()
