"""
finance-portfolio 分析スクリプト
data/ フォルダ内の最新CSVを読み込み、reports/ にレポートを出力する
"""
import urllib.request
import json
import re
import time
import yfinance as yf
import yaml
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
REPORT_DIR = BASE_DIR / "reports"
REPORT_DIR.mkdir(exist_ok=True)

# 分析設定
SECTOR_WARNING_THRESHOLD = 30   # セクター集中警告閾値 (%)
TARGET_JP_RATIO = 50            # 日本株目標比率 (%)
TARGET_US_RATIO = 50            # 米国株目標比率 (%)
DIV_YIELD_THRESHOLD = 3.5       # 理想配当利回り (%)
DIV_GROWTH_THRESHOLD = 10.0     # 理想増配率CAGR (%)

# セクターマップ読み込み（GICS英語 → 日本語訳）
_sector_map_path = BASE_DIR / "config" / "sector_map.yaml"
with open(_sector_map_path, encoding="utf-8") as f:
    _sector_map_data = yaml.safe_load(f)
SECTOR_MAP: dict = {k: v for k, v in _sector_map_data.items() if not k.startswith("_")}
# 金融系セクターグループ（集中リスク判定用、GICS英語名）
FINANCE_SECTORS = set(_sector_map_data.get("_finance_sectors", ["Financial Services"]))

# 米国源泉税設定
US_WITHHOLDING_NISA    = 0.10    # NISA口座：米国源泉10%のみ（日本非課税）
US_WITHHOLDING_TAXABLE = 0.10    # 特定口座：米国源泉10%
JP_TAX_TAXABLE         = 0.20315 # 特定口座：日本配当課税20.315%
# 実質利回り = 表面利回り × (1 - 0.10)               ← NISA
# 実質利回り = 表面利回り × (1 - 0.10) × (1 - 0.20315) ← 特定

# 米国株ウォッチリスト（高配当・連続増配銘柄中心）
US_WATCHLIST = {
    "医薬品":       [("ABBV", "AbbVie"), ("JNJ", "Johnson & Johnson"), ("MRK", "Merck")],
    "生活必需品":   [("PG", "P&G"), ("KO", "Coca-Cola"), ("PEP", "PepsiCo"), ("CL", "Colgate-Palmolive")],
    "エネルギー":   [("XOM", "ExxonMobil"), ("CVX", "Chevron")],
    "通信":         [("VZ", "Verizon"), ("T", "AT&T")],
    "REIT":         [("O", "Realty Income"), ("MAIN", "Main Street Capital")],
    "IT・工業":     [("IBM", "IBM"), ("EMR", "Emerson Electric"), ("MMM", "3M")],
    "金融":         [("JPM", "JPMorgan Chase"), ("BLK", "BlackRock")],
}

# 東証スクリーニング設定（EquityQuery）
SCREEN_SIZE      = 100    # スクリーニング最大取得件数
SCREEN_MIN_YIELD = 1.5    # スクリーニング最低配当利回り（%。絞り込みはvalue_scoreで行う）

COVID_YEAR = 2020         # コロナ禍基準年（配当維持確認年）


def calc_consecutive_non_cut(by_year: dict):
    """連続非減配年数とコロナ禍サバイバルを計算する

    Returns:
        (streak, survived_covid)
        - streak: 直近年から遡って連続して「前年以上の配当を維持した」年数
        - survived_covid: 2020年に減配しなかったか（True/False/None=データなし）
    """
    if not by_year or len(by_year) < 2:
        return (1 if by_year else 0), None

    years = sorted(by_year.keys())

    streak = 0
    for i in range(len(years) - 1, 0, -1):
        curr = years[i]
        prev = years[i - 1]
        if curr - prev > 1:
            break  # 飛び年がある場合はストップ
        if by_year[curr] >= by_year[prev] * 0.99:  # 1%の誤差許容（丸め対策）
            streak += 1
        else:
            break

    # コロナ禍サバイバル（2019→2020 減配なし）
    if 2019 in by_year and 2020 in by_year:
        survived_covid = by_year[2020] >= by_year[2019] * 0.99
    else:
        survived_covid = None  # データなし

    return streak, survived_covid


def calc_stability_score(streak, survived_covid):
    """連続非減配スコア（50点満点）
    連続非減配年数(0-30点) + コロナ禍サバイバルボーナス(0-20点)
    """
    if streak is None:
        streak = 0

    if streak >= 20:       streak_pts = 30
    elif streak >= 15:     streak_pts = 26
    elif streak >= 10:     streak_pts = 22
    elif streak >= 7:      streak_pts = 16
    elif streak >= 5:      streak_pts = 11
    elif streak >= 3:      streak_pts = 6
    elif streak >= 2:      streak_pts = 3
    elif streak >= 1:      streak_pts = 1
    else:                  streak_pts = 0

    covid_pts = 20 if survived_covid is True else 0
    return streak_pts + covid_pts


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


def get_sector(code):
    """yfinanceからセクターを取得し、日本語訳を付けて返す"""
    ticker = f"{code}.T"
    try:
        info = yf.Ticker(ticker).info
        sector_en = info.get("sector") or ""
        if not sector_en:
            return "不明"
        sector_ja = SECTOR_MAP.get(sector_en)
        if sector_ja:
            return f"{sector_en}（{sector_ja}）"
        return sector_en
    except Exception:
        return "不明"


def get_usdjpy():
    """USD/JPY レートをYahoo Financeから取得"""
    url = "https://query1.finance.yahoo.com/v8/finance/chart/USDJPY=X?interval=1d&range=1d"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read())
        return data["chart"]["result"][0]["meta"]["regularMarketPrice"]
    except Exception:
        return 150.0  # 取得失敗時のフォールバック


def get_us_stock_info(ticker):
    """Yahoo FinanceからUS株の現在値・年間配当・増配率CAGRを取得"""
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?interval=1d&range=10y&events=dividends")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read())
        result = data["chart"]["result"][0]
        price = result["meta"]["regularMarketPrice"]
        dividends = result.get("events", {}).get("dividends", {})
        if not dividends:
            return price, None, None, {}

        by_year = {}
        for ts, v in dividends.items():
            year = datetime.fromtimestamp(int(ts)).year
            by_year[year] = round(by_year.get(year, 0) + v["amount"], 4)

        # 当年は途中のため除外（前年比較で50%未満なら不完全と判定）
        current_year = datetime.now().year
        if current_year in by_year:
            prev = by_year.get(current_year - 1, 0)
            if prev > 0 and by_year[current_year] < prev * 0.75:
                del by_year[current_year]

        # 連続非減配・コロナサバイバルは全履歴から計算（5年フィルタ前）
        streak, survived_covid = calc_consecutive_non_cut(by_year)

        years = sorted(by_year)[-5:]
        if len(years) < 2:
            return price, None, None, {}, streak, survived_covid

        first, last = by_year[years[0]], by_year[years[-1]]
        n = years[-1] - years[0]
        cagr = ((last / first) ** (1 / n) - 1) * 100 if n > 0 and first > 0 else 0
        return price, round(cagr, 1), by_year[years[-1]], {y: by_year[y] for y in years}, streak, survived_covid
    except Exception:
        return None, None, None, {}, None, None


def get_us_recommendations(usdjpy):
    """米国株ウォッチリストから購入候補を収集・スコアリング"""
    candidates = []
    for sector, stocks_list in US_WATCHLIST.items():
        for ticker, name in stocks_list:
            print(f"  US候補取得: {ticker} {name}")
            price_usd, cagr, annual_div_usd, history, streak, survived_covid = get_us_stock_info(ticker)
            time.sleep(0.5)
            if price_usd is None or annual_div_usd is None or price_usd == 0:
                continue

            gross_yield = annual_div_usd / price_usd * 100
            # 実質利回り（NISA想定：米国源泉10%のみ）
            net_yield_nisa = gross_yield * (1 - US_WITHHOLDING_NISA)
            # 実質利回り（特定口座：米国10% + 日本20.315%）
            net_yield_taxable = gross_yield * (1 - US_WITHHOLDING_TAXABLE) * (1 - JP_TAX_TAXABLE)

            price_jpy = price_usd * usdjpy
            annual_div_jpy = annual_div_usd * usdjpy

            meets_yield  = net_yield_nisa >= DIV_YIELD_THRESHOLD
            meets_growth = cagr is not None and cagr >= DIV_GROWTH_THRESHOLD

            stability_score = calc_stability_score(streak, survived_covid)

            # 利回りスコア（0-20点）
            if net_yield_nisa >= 5.0:        yield_pts = 20
            elif net_yield_nisa >= 4.0:      yield_pts = 16
            elif net_yield_nisa >= 3.5:      yield_pts = 13
            elif net_yield_nisa >= 3.0:      yield_pts = 9
            elif net_yield_nisa >= 2.0:      yield_pts = 4
            else:                            yield_pts = 0

            # 増配率スコア（0-15点）
            if cagr is None:                 growth_pts = 0
            elif cagr >= 15:                 growth_pts = 15
            elif cagr >= 10:                 growth_pts = 12
            elif cagr >= 5:                  growth_pts = 8
            elif cagr >= 0:                  growth_pts = 4
            else:                            growth_pts = 0

            # 総合スコア: 連続非減配 > 利回り > 増配率（3:2:1 重み）
            composite_score = stability_score * 3 + yield_pts * 2 + growth_pts

            candidates.append({
                "ticker": ticker, "name": name, "sector": sector,
                "price_usd": price_usd, "price_jpy": price_jpy,
                "gross_yield": gross_yield,
                "net_yield_nisa": net_yield_nisa,
                "net_yield_taxable": net_yield_taxable,
                "annual_div_usd": annual_div_usd,
                "cagr": cagr, "history": history,
                "streak": streak, "survived_covid": survived_covid,
                "stability_score": stability_score,
                "composite_score": composite_score,
                "meets_yield": meets_yield, "meets_growth": meets_growth,
            })

    candidates.sort(key=lambda x: x["composite_score"], reverse=True)
    return candidates


def get_stock_price(code):
    """yfinanceから現在値を取得（ウォッチリスト銘柄用）"""
    ticker = f"{code}.T"
    try:
        fast = yf.Ticker(ticker).fast_info
        price = getattr(fast, "last_price", None) or getattr(fast, "previous_close", None)
        return float(price) if price else None
    except Exception:
        return None


def calc_value_score(per, pbr, div_yield_pct, roe_pct, growth_pct):
    """バリュースコア計算（100点満点）
    PER(25点) + PBR(25点) + 配当利回り(20点) + ROE(15点) + 売上成長率(15点)
    """
    score = 0.0

    # PER (25点) — 低いほど高得点
    if per is not None and 0 < per < 200:
        if per < 10:    score += 25
        elif per < 15:  score += 20
        elif per < 20:  score += 14
        elif per < 25:  score += 8
        elif per < 30:  score += 3

    # PBR (25点) — 低いほど高得点
    if pbr is not None and pbr > 0:
        if pbr < 0.8:   score += 25
        elif pbr < 1.0: score += 21
        elif pbr < 1.5: score += 16
        elif pbr < 2.0: score += 10
        elif pbr < 3.0: score += 4

    # 配当利回り (20点) — 高いほど高得点
    if div_yield_pct is not None and div_yield_pct > 0:
        if div_yield_pct >= 5.0:   score += 20
        elif div_yield_pct >= 4.0: score += 16
        elif div_yield_pct >= 3.5: score += 13
        elif div_yield_pct >= 3.0: score += 9
        elif div_yield_pct >= 2.0: score += 4

    # ROE (15点) — 高いほど高得点
    if roe_pct is not None:
        if roe_pct >= 20:   score += 15
        elif roe_pct >= 15: score += 12
        elif roe_pct >= 10: score += 8
        elif roe_pct >= 5:  score += 4
        elif roe_pct >= 0:  score += 1

    # 売上成長率 (15点) — 高いほど高得点
    if growth_pct is not None:
        if growth_pct >= 15:   score += 15
        elif growth_pct >= 10: score += 12
        elif growth_pct >= 5:  score += 8
        elif growth_pct >= 0:  score += 4

    return round(score, 1)


def get_value_info(code):
    """yfinanceからバリュエーション指標を取得（PER・PBR・ROE・売上成長率）"""
    ticker = f"{code}.T"
    try:
        info = yf.Ticker(ticker).info
        per    = info.get("trailingPE") or info.get("forwardPE")
        pbr    = info.get("priceToBook")
        roe    = info.get("returnOnEquity")
        growth = info.get("revenueGrowth")

        if per is not None and (per <= 0 or per > 200): per = None
        if pbr is not None and pbr <= 0: pbr = None

        roe_pct    = round(roe * 100, 1)    if roe    is not None else None
        growth_pct = round(growth * 100, 1) if growth is not None else None

        return per, pbr, roe_pct, growth_pct
    except Exception:
        return None, None, None, None


def get_payout_ratio(code):
    """yfinanceから配当性向（%）を取得"""
    ticker = f"{code}.T"
    try:
        info = yf.Ticker(ticker).info
        ratio = info.get("payoutRatio")
        if ratio is not None and 0 < ratio < 5:  # 500%超は異常値として除外
            return round(ratio * 100, 1)
        return None
    except Exception:
        return None


def get_schd_dividend_growth():
    """SCHD（米国高配当ETF）の配当増配率をYahoo Finance APIから取得（USD建て）"""
    url = "https://query1.finance.yahoo.com/v8/finance/chart/SCHD?interval=1d&range=10y&events=dividends"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read())
        dividends = data["chart"]["result"][0].get("events", {}).get("dividends", {})
        if not dividends:
            return None, None, None, {}, None, None
        by_year = {}
        for ts, v in dividends.items():
            year = datetime.fromtimestamp(int(ts)).year
            by_year[year] = round(by_year.get(year, 0) + v["amount"], 4)
        streak, survived_covid = calc_consecutive_non_cut(by_year)
        years = sorted(by_year)[-5:]
        if len(years) < 2:
            return None, None, None, {}, streak, survived_covid
        first, last = by_year[years[0]], by_year[years[-1]]
        n = years[-1] - years[0]
        cagr = ((last / first) ** (1 / n) - 1) * 100 if n > 0 and first > 0 else 0
        hist = {y: by_year[y] for y in years}
        return round(cagr, 1), hist, by_year[years[-1]], {}, streak, survived_covid
    except Exception:
        return None, None, None, {}, None, None


def get_dividend_growth(code):
    """yfinanceから配当履歴を取得し、増配率CAGRと直近年間配当額を返す"""
    ticker = f"{code}.T"
    try:
        divs = yf.Ticker(ticker).dividends
        if divs.empty:
            return None, None, None, {}, None, None

        # 年ごとに合算（日本株の3月期決算対応：1-3月の配当は前年度に帰属）
        # 3月末配当（期末）をカレンダー年で翌年に計上するズレを補正する
        by_year = {}
        for dt, amount in divs.items():
            year = dt.year
            if dt.month <= 3:  # 1-3月払い（期末配当等）は前年度として集計
                year -= 1
            by_year[year] = round(by_year.get(year, 0) + float(amount), 2)

        # 当年が前年比75%未満なら途中データとして除外
        # month<=3補正後は「現在構築中の不完全年度」が current_year-1 になる場合がある
        now = datetime.now()
        fiscal_current = now.year - 1 if now.month <= 3 else now.year
        if fiscal_current in by_year:
            prev = by_year.get(fiscal_current - 1, 0)
            if prev > 0 and by_year[fiscal_current] < prev * 0.75:
                del by_year[fiscal_current]

        # 連続非減配・コロナサバイバルは全履歴から計算（5年フィルタ前）
        streak, survived_covid = calc_consecutive_non_cut(by_year)

        years = sorted(by_year)[-5:]
        if len(years) < 2:
            return None, None, None, {}, streak, survived_covid

        hist = {y: by_year[y] for y in years}
        first, last = by_year[years[0]], by_year[years[-1]]
        n = years[-1] - years[0]
        cagr = ((last / first) ** (1 / n) - 1) * 100 if n > 0 and first > 0 else 0
        return round(cagr, 1), hist, by_year[years[-1]], {}, streak, survived_covid
    except Exception:
        return None, None, None, {}, None, None


def screen_jp_candidates(held_codes: set) -> list:
    """yf.EquityQuery で東証全銘柄をスクリーニングして候補リストを返す"""
    try:
        q = yf.EquityQuery('and', [
            yf.EquityQuery('eq', ['region', 'jp']),
            yf.EquityQuery('gt', ['forward_dividend_yield', SCREEN_MIN_YIELD / 100]),
        ])
        result = yf.screen(q, sortField='forward_dividend_yield', sortAsc=False, size=SCREEN_SIZE)
        quotes = result.get('quotes', [])
    except Exception as e:
        print(f"  スクリーニング失敗: {e}")
        return []

    candidates = []
    for q_data in quotes:
        symbol = q_data.get('symbol', '')
        if not symbol.endswith('.T'):
            continue
        code = symbol.replace('.T', '')
        if len(code) != 4 or not code.isdigit():
            continue
        if code in held_codes:
            continue
        name = q_data.get('shortName') or q_data.get('longName') or symbol
        # スクリーン結果から取得できる指標（APIコール削減）
        price = q_data.get('regularMarketPrice')
        per   = q_data.get('trailingPE')
        pbr   = q_data.get('priceToBook')
        candidates.append({
            'code': code, 'name': name,
            'price': float(price) if price else None,
            'per':   float(per)   if per   else None,
            'pbr':   float(pbr)   if pbr   else None,
        })

    return candidates


def get_recommendations(held_stocks, sector_val, jp_total):
    """EquityQueryで東証をスクリーニングして購入候補銘柄を収集・スコアリング"""
    held_codes = {s["code"] for s in held_stocks if s["section"] != "投信"}
    sector_ratio = {k: v / jp_total * 100 for k, v in sector_val.items()} if jp_total > 0 else {}

    print("  東証スクリーニング中 (EquityQuery)...")
    screened = screen_jp_candidates(held_codes)
    print(f"  スクリーニング結果: {len(screened)}件")

    candidates = []
    checked = set()

    for item in screened:
        code = item['code']
        name = item['name']
        price = item.get('price')  # スクリーン結果から取得済み
        per   = item.get('per')
        pbr   = item.get('pbr')

        if code in held_codes or code in checked:
            continue
        checked.add(code)

        print(f"  候補取得: {code} {name}")
        cagr, history, latest, _, streak, survived_covid = get_dividend_growth(code)
        time.sleep(0.3)
        if latest is None:
            continue

        # priceが未取得の場合のみAPI呼び出し
        if not price:
            price = get_stock_price(code)
            time.sleep(0.3)
        if price is None or price == 0:
            continue

        # ROE・売上成長率はinfo取得が必要（PER/PBRはスクリーン値を優先）
        _, _, roe_pct, growth_pct = get_value_info(code)
        time.sleep(0.3)
        # PER/PBRのサニティチェック
        if per is not None and (per <= 0 or per > 200): per = None
        if pbr is not None and pbr <= 0: pbr = None

        # セクター情報（個別取得）
        sec = get_sector(code)
        time.sleep(0.3)

        # セクター保有状況
        ratio = sector_ratio.get(sec, 0)
        if ratio == 0:
            status = "未保有"
        elif ratio < 5:
            status = f"不足（現在{ratio:.1f}%）"
        else:
            status = f"補強（現在{ratio:.1f}%）"

        div_yield = latest / price * 100
        value_score = calc_value_score(per, pbr, div_yield, roe_pct, growth_pct)

        stability_score = calc_stability_score(streak, survived_covid)

        # 利回りスコア（0-20点）
        if div_yield >= 5.0:        yield_pts = 20
        elif div_yield >= 4.0:      yield_pts = 16
        elif div_yield >= 3.5:      yield_pts = 13
        elif div_yield >= 3.0:      yield_pts = 9
        elif div_yield >= 2.0:      yield_pts = 4
        else:                       yield_pts = 0

        # 増配率スコア（0-15点）
        if cagr is None:            growth_pts = 0
        elif cagr >= 15:            growth_pts = 15
        elif cagr >= 10:            growth_pts = 12
        elif cagr >= 5:             growth_pts = 8
        elif cagr >= 0:             growth_pts = 4
        else:                       growth_pts = 0

        # 総合スコア: 連続非減配 > 利回り > 増配率（3:2:1 重み）
        composite_score = stability_score * 3 + yield_pts * 2 + growth_pts

        candidates.append({
            "code": code, "name": name, "sector": sec,
            "status": status, "sector_ratio": ratio,
            "price": price, "div_yield": div_yield,
            "cagr": cagr, "latest_div": latest,
            "per": per, "pbr": pbr, "roe": roe_pct, "growth": growth_pct,
            "value_score": value_score,
            "streak": streak, "survived_covid": survived_covid,
            "stability_score": stability_score,
            "composite_score": composite_score,
            "meets_yield": div_yield >= DIV_YIELD_THRESHOLD,
            "meets_growth": cagr is not None and cagr >= DIV_GROWTH_THRESHOLD,
        })

    # 総合スコア降順でソート（連続非減配 > 利回り > 増配率）
    candidates.sort(key=lambda x: x["composite_score"], reverse=True)
    return candidates


def _bar(ratio, width=24):
    """テキストバーグラフ生成"""
    filled = round(ratio / 100 * width)
    filled = min(filled, width)
    return "█" * filled + "░" * (width - filled)


def generate_portfolio_report(stocks, totals, dividend_data, sector_data, today, payout_data=None, rec_filename=None):
    """ポートフォリオレポートを生成（保有状況・配当・セクター分析）"""
    lines = []
    lines.append(f"# ファイナンスポートフォリオ レポート {today}\n")
    if rec_filename:
        lines.append(f"> 📋 購入提案レポート → [{rec_filename}](./{rec_filename})\n")

    # ── サマリー ──────────────────────────────────────────
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

    # ── 銘柄別損益 ────────────────────────────────────────
    lines.append("## 銘柄別損益\n")
    lines.append("| コード | 銘柄名 | 口座 | 数量 | 取得単価 | 現在値 | 含み損益(%) |")
    lines.append("|--------|--------|------|------|----------|--------|------------|")
    for s in sorted(stocks, key=lambda x: x["gain_pct"] or 0, reverse=True):
        gp = f"{s['gain_pct']:+.2f}%" if s["gain_pct"] is not None else "--"
        code_link = f"[{s['code']}](https://finance.yahoo.co.jp/quote/{s['code']}.T)"
        lines.append(f"| {code_link} | {s['name']} | {s['section']} | {s['qty']} | {s['cost']:,.0f} | {s['current']:,.0f} | {gp} |")
    lines.append("")

    # ── 配当収入・利回り ──────────────────────────────────
    lines.append("## 配当収入・利回り\n")
    lines.append("| コード | 銘柄名 | 口座 | 保有株数 | 年間配当(円/株) | 年間配当収入(円) | 配当利回り | 連続非減配 | COVID | 配当性向 |")
    lines.append("|--------|--------|------|----------|----------------|-----------------|------------|-----------|-------|---------|")

    total_div_income = 0
    stock_val_with_div = 0
    for s in stocks:
        if s["section"] == "投信":
            continue
        code = s["code"]
        data = dividend_data.get(code, (None, None, None, {}, None, None))
        cagr, history, latest = data[0], data[1], data[2]
        streak = data[4] if len(data) > 4 else None
        survived_covid = data[5] if len(data) > 5 else None
        if latest is None:
            continue
        annual_income = latest * s["qty"]
        div_yield = (latest / s["current"] * 100) if s["current"] > 0 else 0
        total_div_income += annual_income
        stock_val_with_div += s["total_val"]
        streak_str = f"{streak}期" if streak else "---"
        covid_str  = "✅" if survived_covid is True else ("❌" if survived_covid is False else "❓")
        pr = payout_data.get(code) if payout_data else None
        pr_str = f"{pr:.1f}%" if pr is not None else "---"
        code_link = f"[{code}](https://finance.yahoo.co.jp/quote/{code}.T)"
        lines.append(f"| {code_link} | {s['name']} | {s['section']} | {s['qty']} | {latest:.1f} | {annual_income:,.0f} | {div_yield:.2f}% | {streak_str} | {covid_str} | {pr_str} |")

    lines.append("")
    total_div_yield = (total_div_income / stock_val_with_div * 100) if stock_val_with_div > 0 else 0
    lines.append(f"**年間配当収入合計：{total_div_income:,.0f} 円**　／　**配当株利回り（配当あり銘柄のみ）：{total_div_yield:.2f}%**")
    lines.append("")

    # ── ETF枠（米国高配当） ───────────────────────────────
    schd_list = [s for s in stocks if s["section"] == "投信" and "高配当" in s["name"]]
    growth_funds = [s for s in stocks if s["section"] == "投信" and "高配当" not in s["name"]]

    if schd_list:
        lines.append("## ETF枠（米国高配当株式ファンド）\n")
        lines.append("| ファンド名 | 評価額(円) | 含み損益 | 含み損益(%) | 5年CAGR(USD) | 配当履歴(USD/口) |")
        lines.append("|------------|------------|----------|------------|--------------|-----------------|")
        for s in schd_list:
            gp = f"{s['gain_pct']:+.2f}%" if s["gain_pct"] is not None else "--"
            tg_val = f"{s['total_gain']:+,.0f}" if s["total_gain"] is not None else "--"
            cagr, history, latest, *_ = dividend_data.get("FUND", (None, None, None, {}, None, None))
            cagr_str = f"{cagr:+.1f}%" if cagr is not None else "---"
            hist_str = "  ".join([f"{y}:${v:.2f}" for y, v in history.items()]) if history else "---"
            lines.append(f"| {s['name']} | {s['total_val']:,.0f} | {tg_val} | {gp} | {cagr_str} | {hist_str} |")
        lines.append("")
        lines.append("> ※ SCHDは年4回分配型。増配率はUSD建て（基礎ETFのSCHDベース）")
        lines.append("")

    if growth_funds:
        lines.append("## 積立枠（インデックスファンド）\n")
        lines.append("| ファンド名 | 評価額(円) | 含み損益 | 含み損益(%) |")
        lines.append("|------------|------------|----------|------------|")
        for s in growth_funds:
            gp = f"{s['gain_pct']:+.2f}%" if s["gain_pct"] is not None else "--"
            tg_val = f"{s['total_gain']:+,.0f}" if s["total_gain"] is not None else "--"
            lines.append(f"| {s['name']} | {s['total_val']:,.0f} | {tg_val} | {gp} |")
        lines.append("")
        lines.append("> ※ 配当なし（成長型）。配当利回りの計算対象外。")
        lines.append("")

    # ── 増配率（過去4年CAGR） ─────────────────────────────
    lines.append("## 増配率（過去4年CAGR）\n")

    all_hist_years = sorted({
        y
        for code, data in dividend_data.items()
        if data[1]
        for y in data[1]
    })[-4:]
    all_fore_years = sorted({
        y
        for code, data in dividend_data.items()
        if data[3]
        for y in data[3]
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
        cagr, history, latest, forecast, *_ = dividend_data[code]
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
    lines.append("> ※ 配当データは Yahoo Finance（yfinance）取得。予想値なし。")
    lines.append("")

    # 増配率ランキングと平均
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

    # ════════════════════════════════════════════════════════
    # ポートフォリオ分析・提案
    # ════════════════════════════════════════════════════════
    lines.append("---\n")
    lines.append("# ポートフォリオ分析・提案\n")

    # ── 1. 資産配分（日本株 vs 米国） ────────────────────
    lines.append("## 1. 資産配分\n")

    jp_val = sum(s["total_val"] for s in stocks if s["section"] in ("NISA", "特定"))
    us_val = sum(s["total_val"] for s in stocks if s["section"] == "投信")
    total_all = jp_val + us_val if (jp_val + us_val) > 0 else 1

    jp_ratio = jp_val / total_all * 100
    us_ratio = us_val / total_all * 100

    jp_flag = "⚠️" if abs(jp_ratio - TARGET_JP_RATIO) > 15 else "✅"
    us_flag = "⚠️" if abs(us_ratio - TARGET_US_RATIO) > 15 else "✅"

    lines.append(f"| 区分 | 評価額 | 現在比率 | 目標比率 | 状態 |")
    lines.append(f"|------|--------|----------|----------|------|")
    lines.append(f"| 日本株（個別） | {jp_val:,.0f} 円 | {jp_ratio:.1f}% | {TARGET_JP_RATIO}% | {jp_flag} |")
    lines.append(f"| 米国（投信計） | {us_val:,.0f} 円 | {us_ratio:.1f}% | {TARGET_US_RATIO}% | {us_flag} |")
    lines.append("")

    # 乖離コメント
    if jp_ratio > TARGET_JP_RATIO + 15:
        gap_val = (jp_ratio - TARGET_JP_RATIO) / 100 * total_all
        lines.append(f"> ⚠️ 日本株比率が目標より **{jp_ratio - TARGET_JP_RATIO:.1f}%** 過多（約 {gap_val:,.0f} 円分）")
        lines.append(f"> 　→ 米国株（SCHD / インデックス）への追加積立で調整推奨")
    elif us_ratio > TARGET_US_RATIO + 15:
        gap_val = (us_ratio - TARGET_US_RATIO) / 100 * total_all
        lines.append(f"> ⚠️ 米国比率が目標より **{us_ratio - TARGET_US_RATIO:.1f}%** 過多（約 {gap_val:,.0f} 円分）")
    else:
        lines.append(f"> ✅ 日本株 / 米国株のバランスは概ね目標範囲内です")
    lines.append("")

    # ── 2. セクター分析 ──────────────────────────────────
    lines.append("## 2. セクター分析\n")

    # セクター別評価額を集計（個別株のみ）
    sector_val = {}
    for s in stocks:
        if s["section"] == "投信":
            continue
        sec = sector_data.get(s["code"], "不明")
        sector_val[sec] = sector_val.get(sec, 0) + s["total_val"]

    jp_total = sum(sector_val.values()) or 1
    sector_sorted = sorted(sector_val.items(), key=lambda x: x[1], reverse=True)

    # 金融系合計（銀行+保険+証券+その他金融）
    finance_val = sum(v for k, v in sector_val.items() if any(fs in k for fs in FINANCE_SECTORS))
    finance_ratio = finance_val / jp_total * 100

    lines.append("| セクター | 評価額 | 比率 | バー |")
    lines.append("|---------|--------|------|------|")
    for sec, val in sector_sorted:
        ratio = val / jp_total * 100
        bar = _bar(ratio)
        warn = " ⚠️" if ratio >= SECTOR_WARNING_THRESHOLD else ""
        lines.append(f"| {sec} | {val:,.0f} 円 | {ratio:.1f}%{warn} | {bar} |")
    lines.append("")

    # 金融系合算警告
    if finance_ratio >= SECTOR_WARNING_THRESHOLD:
        lines.append(f"> ⚠️ **金融系セクター合計 {finance_ratio:.1f}%**（銀行業 + 保険業 + 証券 + その他金融）")
        lines.append(f"> 　→ {SECTOR_WARNING_THRESHOLD}%超の集中リスク。分散のため非金融セクターの追加を検討")
    else:
        lines.append(f"> ✅ 金融系セクター合計 {finance_ratio:.1f}%（集中リスクなし）")
    lines.append("")

    # ── 3. 銘柄集中度 Top10 ──────────────────────────────
    lines.append("## 3. 銘柄集中度 Top10\n")

    # コード単位で評価額を合算（NISA+特定の重複対応）
    val_by_code_all = {}
    name_by_code = {}
    for s in stocks:
        if s["section"] == "投信":
            continue
        val_by_code_all[s["code"]] = val_by_code_all.get(s["code"], 0) + s["total_val"]
        name_by_code[s["code"]] = s["name"]

    top_stocks = sorted(val_by_code_all.items(), key=lambda x: x[1], reverse=True)[:10]
    lines.append("| 順位 | コード | 銘柄名 | 評価額 | シェア | バー |")
    lines.append("|------|--------|--------|--------|--------|------|")
    for i, (code, val) in enumerate(top_stocks, 1):
        ratio = val / jp_total * 100
        bar = _bar(ratio, width=16)
        warn = " ⚠️" if ratio >= 10 else ""
        lines.append(f"| {i} | {code} | {name_by_code[code]} | {val:,.0f} 円 | {ratio:.1f}%{warn} | {bar} |")
    lines.append("")
    lines.append("> ※ 1銘柄が10%超の場合は集中リスクあり")
    lines.append("")

    # ── 4. 投資スタイル適合度マトリクス ─────────────────
    lines.append("## 4. 投資スタイル適合度マトリクス\n")
    lines.append(f"> 基準：利回り {DIV_YIELD_THRESHOLD}%+ ／ 増配率 {DIV_GROWTH_THRESHOLD:.0f}%+ CAGR\n")

    # 各銘柄の利回りと増配率を取得
    matrix = {"高利回り×高増配": [], "高利回り×低増配": [], "低利回り×高増配": [], "低利回り×低増配": []}
    seen_m = set()
    for s in stocks:
        if s["section"] == "投信":
            continue
        code = s["code"]
        if code in seen_m:
            continue
        seen_m.add(code)
        cagr, _, latest, *__ = dividend_data.get(code, (None, None, None, {}, None, None))
        if latest is None:
            continue
        div_yield = (latest / s["current"] * 100) if s["current"] > 0 else 0
        high_yield = div_yield >= DIV_YIELD_THRESHOLD
        high_growth = cagr is not None and cagr >= DIV_GROWTH_THRESHOLD
        entry = f"{s['name']}（{div_yield:.1f}% / {cagr:+.1f}%CAGR）" if cagr is not None else f"{s['name']}（{div_yield:.1f}% / ---）"

        if high_yield and high_growth:
            matrix["高利回り×高増配"].append(entry)
        elif high_yield and not high_growth:
            matrix["高利回り×低増配"].append(entry)
        elif not high_yield and high_growth:
            matrix["低利回り×高増配"].append(entry)
        else:
            matrix["低利回り×低増配"].append(entry)

    labels = {
        "高利回り×高増配": "🌟 理想ゾーン（高利回り＋高増配）",
        "高利回り×低増配": "💰 安定配当ゾーン（高利回り・増配は控えめ）",
        "低利回り×高増配": "📈 成長型ゾーン（利回り低め・増配力あり）",
        "低利回り×低増配": "⚠️ 要検討ゾーン（利回り・増配ともに基準以下）",
    }
    for key, label in labels.items():
        items = matrix[key]
        lines.append(f"### {label}（{len(items)}銘柄）\n")
        if items:
            for item in items:
                lines.append(f"- {item}")
        else:
            lines.append("- 該当なし")
        lines.append("")

    # ── 5. 要注意銘柄（詳細） ────────────────────────────
    lines.append("## 5. 要注意銘柄（詳細分析）\n")

    caution = []
    seen_c = set()
    for s in stocks:
        if s["section"] == "投信":
            continue
        code = s["code"]
        if code in seen_c:
            continue
        seen_c.add(code)
        cagr, *__ = dividend_data.get(code, (None, None, None, {}, None, None))
        reasons = []
        if cagr is not None and cagr < 0:
            reasons.append(f"減配傾向（{cagr:+.1f}%CAGR）")
        if s["gain_pct"] is not None and s["gain_pct"] < -3:
            reasons.append(f"含み損 {s['gain_pct']:+.2f}%")
        if reasons:
            caution.append((s["name"], code, reasons, cagr, s["gain_pct"]))

    if caution:
        lines.append("| 銘柄名 | コード | 懸念事項 | 対応方針 |")
        lines.append("|--------|--------|----------|----------|")
        for name, code, reasons, cagr, gain_pct in caution:
            reason_str = " + ".join(reasons)
            # 減配＋含み損ダブルで売却候補
            if cagr is not None and cagr < 0 and gain_pct is not None and gain_pct < -3:
                action = "売却検討（減配＋含み損）"
            elif cagr is not None and cagr < 0:
                action = "監視強化（減配傾向）"
            else:
                action = "様子見（含み損のみ）"
            lines.append(f"| {name} | {code} | {reason_str} | {action} |")
    else:
        lines.append("現在、要注意銘柄はありません。")
    lines.append("")

    # ── 6. 総合提案コメント ──────────────────────────────
    lines.append("## 6. 総合提案\n")

    suggestions = []

    # 日米バランス
    if jp_ratio > TARGET_JP_RATIO + 10:
        suggestions.append(
            f"📌 **米国比率を増やす**：現在 {us_ratio:.1f}% → 目標 {TARGET_US_RATIO}%。"
            f"月々の積立をSCHD or S&P500に寄せると効率的"
        )

    # セクター集中
    if finance_ratio >= SECTOR_WARNING_THRESHOLD:
        suggestions.append(
            f"📌 **金融セクターを分散**：金融系が {finance_ratio:.1f}% と集中。"
            f"情報通信・ヘルスケア・生活必需品など非金融セクターの銘柄追加を検討"
        )

    # 要注意銘柄
    sell_candidates = [name for name, code, reasons, cagr, gp in caution
                       if cagr is not None and cagr < 0 and gp is not None and gp < -3]
    if sell_candidates:
        suggestions.append(
            f"📌 **売却検討銘柄**：{', '.join(sell_candidates)}（減配傾向＋含み損）。"
            f"NISA枠の有効活用の観点からも入れ替えを検討"
        )

    # 利回り基準未達銘柄が多い場合
    low_zone_count = len(matrix["低利回り×低増配"])
    if low_zone_count >= 3:
        suggestions.append(
            f"📌 **要検討ゾーンが {low_zone_count} 銘柄**：利回り {DIV_YIELD_THRESHOLD}%・"
            f"増配率 {DIV_GROWTH_THRESHOLD:.0f}%を下回る銘柄が多め。段階的な入れ替えを検討"
        )

    if suggestions:
        for s_item in suggestions:
            lines.append(f"{s_item}\n")
    else:
        lines.append("✅ 現時点での大きな課題は見当たりません。引き続き積立を継続しましょう。")
    lines.append("")

    # フッターリンク
    if rec_filename:
        lines.append("---")
        lines.append(f"> 📋 購入提案レポート → [{rec_filename}](./{rec_filename})")

    return "\n".join(lines)


def generate_recommendation_report(recommendations, us_recommendations, usdjpy, today, portfolio_filename):
    """購入提案レポートを生成（JP・US購入候補）"""
    lines = []
    lines.append(f"# 購入提案レポート {today}\n")
    lines.append(f"> 📊 ポートフォリオレポート → [{portfolio_filename}](./{portfolio_filename})\n")

    # ── 1. 購入候補提案 ──────────────────────────────────
    if recommendations:
        lines.append("## 1. 日本株購入候補提案\n")
        lines.append(f"> **優先順位：連続非減配期数 > 利回り > 増配率** の順で重みづけした総合スコア順に表示。\n")
        lines.append(f"> 基準：利回り {DIV_YIELD_THRESHOLD}%以上 ／ 増配率 {DIV_GROWTH_THRESHOLD:.0f}%以上CAGR。未保有・不足セクターを優先提案。\n")
        lines.append(f"> 総合スコア = 安定性(0-50点)×3 ＋ 利回り(0-20点)×2 ＋ 増配率(0-15点)×1　最大205点\n")
        lines.append(f"> COVID✅ = 2020年（コロナ禍）に減配なし（+20点ボーナス）\n")

        # 理想ゾーン（両方クリア）
        ideal = [r for r in recommendations if r["meets_yield"] and r["meets_growth"]]
        ok_yield = [r for r in recommendations if r["meets_yield"] and not r["meets_growth"]]
        ok_growth = [r for r in recommendations if not r["meets_yield"] and r["meets_growth"]]
        others = [r for r in recommendations if not r["meets_yield"] and not r["meets_growth"]]

        def fmt_rec(r):
            cagr_str   = f"{r['cagr']:+.1f}%" if r["cagr"] is not None else "---"
            per_str    = f"{r['per']:.1f}"     if r["per"]  is not None else "---"
            pbr_str    = f"{r['pbr']:.2f}"     if r["pbr"]  is not None else "---"
            streak     = r.get("streak")
            streak_str = f"{streak}期" if streak is not None else "---"
            covid      = r.get("survived_covid")
            covid_str  = "✅" if covid is True else ("❌" if covid is False else "❓")
            stab_str   = f"{r.get('stability_score', 0):.0f}点"
            comp_str   = f"**{r.get('composite_score', 0):.0f}点**"
            code_link = f"[{r['code']}](https://finance.yahoo.co.jp/quote/{r['code']}.T)"
            return (f"| {code_link} | {r['name']} | {r['sector']} "
                    f"| {comp_str} | {stab_str} | {streak_str} | {covid_str} "
                    f"| {r['price']:,.0f}円 | {r['div_yield']:.2f}% | {cagr_str} "
                    f"| {per_str} | {pbr_str} |")

        header = ("| コード | 銘柄名 | セクター | 総合スコア | 安定性 | 連続非減配 | COVID | "
                  "現在値 | 利回り | 増配率 | PER | PBR |")
        sep    = ("|--------|--------|---------|-----------|--------|-----------|-------|"
                  "--------|--------|--------|-----|-----|")

        if ideal:
            lines.append(f"### 🌟 最優先候補（利回り{DIV_YIELD_THRESHOLD}%＋ 増配率{DIV_GROWTH_THRESHOLD:.0f}%＋）\n")
            lines.append(header)
            lines.append(sep)
            for r in ideal:
                lines.append(fmt_rec(r))
            lines.append("")

        if ok_yield:
            lines.append(f"### 💰 高利回り候補（増配率は基準以下）\n")
            lines.append(header)
            lines.append(sep)
            for r in ok_yield:
                lines.append(fmt_rec(r))
            lines.append("")

        if ok_growth:
            lines.append(f"### 📈 高増配候補（利回りは基準以下・将来性あり）\n")
            lines.append(header)
            lines.append(sep)
            for r in ok_growth:
                lines.append(fmt_rec(r))
            lines.append("")

        if others:
            lines.append(f"### 📌 セクター分散目的候補（利回り・増配は基準以下だが未保有セクター）\n")
            lines.append(header)
            lines.append(sep)
            for r in others:
                lines.append(fmt_rec(r))
            lines.append("")

        lines.append("> ※ 上記は参考情報です。最終的な投資判断はご自身でお願いします。")
        lines.append("")

    # ── 2. 米国株購入候補 ────────────────────────────────────
    if us_recommendations:
        lines.append("## 2. 米国株購入候補提案\n")
        lines.append(f"> 為替レート：1 USD = {usdjpy:.1f} 円（取得時点）\n")
        lines.append("> **利回りは源泉税控除後の実質値を表示**")
        lines.append(f"> - NISA口座：米国源泉税10%のみ控除（日本非課税）")
        lines.append(f"> - 特定口座：米国10% + 日本20.315% = 合計約{(1-(1-US_WITHHOLDING_TAXABLE)*(1-JP_TAX_TAXABLE))*100:.1f}%控除")
        lines.append("")

        us_ideal    = [r for r in us_recommendations if r["meets_yield"] and r["meets_growth"]]
        us_yield    = [r for r in us_recommendations if r["meets_yield"] and not r["meets_growth"]]
        us_growth   = [r for r in us_recommendations if not r["meets_yield"] and r["meets_growth"]]
        us_others   = [r for r in us_recommendations if not r["meets_yield"] and not r["meets_growth"]]

        def fmt_us(r):
            cagr_str   = f"{r['cagr']:+.1f}%CAGR" if r["cagr"] is not None else "---"
            streak     = r.get("streak")
            streak_str = f"{streak}期" if streak is not None else "---"
            covid      = r.get("survived_covid")
            covid_str  = "✅" if covid is True else ("❌" if covid is False else "❓")
            comp_str   = f"**{r.get('composite_score', 0):.0f}点**"
            ticker_link = f"[{r['ticker']}](https://finance.yahoo.co.jp/quote/{r['ticker']})"
            return (
                f"| {ticker_link} | {r['name']} | {r['sector']} "
                f"| {comp_str} | {streak_str} | {covid_str} "
                f"| ${r['price_usd']:,.2f}（約{r['price_jpy']:,.0f}円） "
                f"| {r['gross_yield']:.2f}% "
                f"| {r['net_yield_nisa']:.2f}% "
                f"| {cagr_str} |"
            )

        us_header = ("| Ticker | 銘柄名 | セクター | 総合スコア | 連続非減配 | COVID | "
                     "現在値 | 表面利回り | 実質(NISA) | 増配率 |")
        us_sep    = ("|--------|--------|---------|-----------|-----------|-------|"
                     "--------|-----------|-----------|--------|")

        if us_ideal:
            lines.append(f"### 🌟 最優先候補（実質利回り{DIV_YIELD_THRESHOLD}%＋ × 増配率{DIV_GROWTH_THRESHOLD:.0f}%＋）\n")
            lines.append(us_header)
            lines.append(us_sep)
            for r in us_ideal:
                lines.append(fmt_us(r))
            lines.append("")

        if us_yield:
            lines.append("### 💰 高利回り候補（増配率は基準以下）\n")
            lines.append(us_header)
            lines.append(us_sep)
            for r in us_yield:
                lines.append(fmt_us(r))
            lines.append("")

        if us_growth:
            lines.append("### 📈 高増配候補（利回りは基準以下・将来性あり）\n")
            lines.append(us_header)
            lines.append(us_sep)
            for r in us_growth:
                lines.append(fmt_us(r))
            lines.append("")

        if us_others:
            lines.append("### 📌 分散目的候補\n")
            lines.append(us_header)
            lines.append(us_sep)
            for r in us_others:
                lines.append(fmt_us(r))
            lines.append("")

        lines.append("> ※ 上記は参考情報です。最終的な投資判断はご自身でお願いします。")
        lines.append("")

    # フッターリンク
    lines.append("---")
    lines.append(f"> 📊 ポートフォリオレポート → [{portfolio_filename}](./{portfolio_filename})")

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
            result = get_schd_dividend_growth()
        else:
            result = get_dividend_growth(code)
        dividend_data[code] = result
        cagr = result[0]
        streak = result[4] if len(result) > 4 else None
        survived_covid = result[5] if len(result) > 5 else None
        status = f"{cagr:+.1f}%" if cagr is not None else "---"
        streak_str = f" | 連続{streak}期" if streak else ""
        covid_str = " | COVID✅" if survived_covid else (" | COVID❌" if survived_covid is False else "")
        print(f"  {code} {s['name']}: {status}{streak_str}{covid_str}")
        time.sleep(0.3)

    print("配当性向データ取得中...")
    payout_data = {}
    done_p = set()
    for s in stocks:
        code = s["code"]
        if code in done_p or s["section"] == "投信":
            continue
        done_p.add(code)
        pr = get_payout_ratio(code)
        payout_data[code] = pr
        pr_str = f"{pr:.1f}%" if pr is not None else "---"
        print(f"  {code} {s['name']}: {pr_str}")
        time.sleep(0.3)

    print("セクターデータ取得中...")
    sector_data = {}
    done_s = set()
    for s in stocks:
        code = s["code"]
        if code in done_s or s["section"] == "投信":
            continue
        done_s.add(code)
        sector = get_sector(code)
        sector_data[code] = sector
        print(f"  {code} {s['name']}: {sector}")
        time.sleep(0.3)

    # セクター比率
    sector_val = {}
    for s in stocks:
        if s["section"] == "投信":
            continue
        sec = sector_data.get(s["code"], "不明")
        sector_val[sec] = sector_val.get(sec, 0) + s["total_val"]
    jp_total = sum(sector_val.values()) or 1

    today = datetime.now().strftime("%Y-%m-%d")
    portfolio_filename = f"{today}-portfolio.md"
    rec_filename       = f"{today}-recommendations.md"

    # ── ポートフォリオレポート出力 ────────────────────────
    portfolio_report = generate_portfolio_report(
        stocks, totals, dividend_data, sector_data, today, payout_data=payout_data, rec_filename=rec_filename
    )
    portfolio_path = REPORT_DIR / portfolio_filename
    portfolio_path.write_text(portfolio_report, encoding="utf-8")
    print(f"\nポートフォリオレポート出力: {portfolio_path}")

    # ── 購入提案レポートの確認 ────────────────────────────
    print("\n購入提案レポートも作成しますか？ [y/N]: ", end="", flush=True)
    try:
        answer = input().strip().lower()
    except EOFError:
        answer = ""

    if answer == "y":
        print("\n日本株購入候補データ取得中（東証全銘柄スクリーニング）...")
        recommendations = get_recommendations(stocks, sector_val, jp_total)

        print("USD/JPY レート取得中...")
        usdjpy = get_usdjpy()
        print(f"  1 USD = {usdjpy:.1f} 円")

        print("米国株購入候補データ取得中...")
        us_recommendations = get_us_recommendations(usdjpy)

        rec_report = generate_recommendation_report(
            recommendations, us_recommendations, usdjpy, today, portfolio_filename
        )
        rec_path = REPORT_DIR / rec_filename
        rec_path.write_text(rec_report, encoding="utf-8")
        print(f"購入提案レポート出力: {rec_path}")
    else:
        print("購入提案レポートをスキップしました。")


if __name__ == "__main__":
    main()
