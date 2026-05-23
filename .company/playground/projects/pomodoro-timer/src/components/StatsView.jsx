import { useMemo } from 'react';
import useStatsRange from '../hooks/useStatsRange.js';

/* ============== Helpers ============== */
const HEAT_LEVELS = [
  { min: 0, bg: 'rgba(31,39,72,0.06)' },
  { min: 1, bg: '#dff3ea' },
  { min: 30, bg: '#a9e3c9' },
  { min: 90, bg: '#7fd3b0' },
  { min: 180, bg: '#5fbf90' }
];

function heatColor(min) {
  let last = HEAT_LEVELS[0];
  for (const lvl of HEAT_LEVELS) {
    if (min >= lvl.min) last = lvl;
  }
  return last.bg;
}

function fmtHM(min) {
  if (min < 60) return `${min}分`;
  return `${Math.floor(min / 60)}時間${min % 60}分`;
}

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // 日曜始まり
  return x;
}

function isoOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/* ============== Aggregations ============== */
function aggregate(days) {
  if (!days || !days.length) return null;
  const byDate = new Map(days.map((d) => [d.date, d]));

  // Totals
  let totalPomos = 0;
  let totalFocusMin = 0;
  let activeDays = 0;
  for (const d of days) {
    totalPomos += d.completed;
    totalFocusMin += d.focusMinutes;
    if (d.focusMinutes > 0) activeDays++;
  }

  // Streak — 今日から遡って 1 日以上集中した日が続いた数
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].focusMinutes > 0) streak++;
    else break;
  }

  // 今日・今週・先週・今月・先月
  const today = new Date();
  const todayStr = isoOf(today);
  const todayMin = (byDate.get(todayStr) || { focusMinutes: 0 }).focusMinutes;

  const weekStart = startOfWeek(today);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(weekStart.getDate() - 7);
  const lastWeekEnd = new Date(weekStart);
  lastWeekEnd.setDate(weekStart.getDate() - 1);

  let thisWeek = 0;
  let lastWeek = 0;
  for (const d of days) {
    const dt = new Date(d.date + 'T00:00:00');
    if (dt >= weekStart && dt <= today) thisWeek += d.focusMinutes;
    else if (dt >= lastWeekStart && dt <= lastWeekEnd) lastWeek += d.focusMinutes;
  }

  const monthKey = today.toISOString().slice(0, 7);
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthKey = lastMonthDate.toISOString().slice(0, 7);
  let thisMonth = 0;
  let lastMonth = 0;
  for (const d of days) {
    if (d.date.startsWith(monthKey)) thisMonth += d.focusMinutes;
    else if (d.date.startsWith(lastMonthKey)) lastMonth += d.focusMinutes;
  }

  return {
    totalPomos, totalFocusMin, activeDays, streak,
    todayMin, thisWeek, lastWeek, thisMonth, lastMonth
  };
}

/* ============== Sub-components ============== */
function TotalsCards({ agg }) {
  const items = [
    { label: '累計ポモドーロ', value: agg.totalPomos, sub: '回', tone: 'mint' },
    { label: '累計集中時間', value: fmtHM(agg.totalFocusMin), sub: '', tone: 'sky' },
    { label: '連続記録', value: agg.streak, sub: '日連続', tone: 'coral' },
    { label: 'アクティブ日数', value: agg.activeDays, sub: '日', tone: 'lemon' }
  ];
  const tones = {
    mint: { a: '#d9f5e6', b: '#a9e3c9', txt: '#0f5a48' },
    sky: { a: '#e1eeff', b: '#b8d9f6', txt: '#1b3e74' },
    coral: { a: '#ffe2d6', b: '#ffb89a', txt: '#7a3520' },
    lemon: { a: '#fff6c5', b: '#ffe585', txt: '#7a5b16' }
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
      {items.map((it, i) => {
        const t = tones[it.tone];
        return (
          <div key={i} style={{
            padding: 14,
            borderRadius: 20,
            background: `linear-gradient(180deg, ${t.a} 0%, ${t.b}cc 100%)`,
            boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -3px 0 rgba(31,39,72,0.08), 0 6px 12px -6px rgba(31,39,72,0.15)'
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.txt, opacity: 0.8 }}>{it.label}</div>
            <div className="mono-num" style={{ fontWeight: 800, color: t.txt, fontSize: 26, marginTop: 4, letterSpacing: '-0.02em' }}>
              {it.value}
            </div>
            {it.sub && <div style={{ fontSize: 11, fontWeight: 700, color: t.txt, opacity: 0.7 }}>{it.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}

function DailyBarChart({ days }) {
  const last30 = days.slice(-30);
  const max = Math.max(60, ...last30.map((d) => d.focusMinutes));
  return (
    <div className="gummy-card" style={{ padding: 22 }}>
      <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: 'var(--ink)', marginBottom: 14 }}>
        過去30日の集中時間
      </h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
        {last30.map((d) => {
          const h = (d.focusMinutes / max) * 100;
          const date = new Date(d.date + 'T00:00:00');
          return (
            <div key={d.date}
              title={`${d.date}: ${fmtHM(d.focusMinutes)} / ${d.completed}ポモ`}
              style={{
                flex: 1,
                minWidth: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 4
              }}>
              <div style={{
                width: '100%',
                height: `${Math.max(2, h)}%`,
                background: d.focusMinutes > 0
                  ? 'linear-gradient(180deg, #a9e3c9 0%, #5fbf90 100%)'
                  : 'rgba(31,39,72,0.08)',
                borderRadius: 6,
                boxShadow: d.focusMinutes > 0
                  ? 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 4px -2px rgba(80,180,140,0.4)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.5)',
                transition: 'height 0.4s ease'
              }} />
              <div style={{ fontSize: 9, color: 'var(--ink-mute)', fontWeight: 700 }}>
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Heatmap({ days }) {
  // 53週 × 7曜日。最終日が今日。
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startWeek = startOfWeek(today);
  // 53週前
  const gridStart = new Date(startWeek);
  gridStart.setDate(gridStart.getDate() - 52 * 7);

  const byDate = new Map(days.map((d) => [d.date, d]));
  const weeks = [];
  for (let w = 0; w < 53; w++) {
    const col = [];
    for (let dow = 0; dow < 7; dow++) {
      const cell = new Date(gridStart);
      cell.setDate(gridStart.getDate() + w * 7 + dow);
      const k = isoOf(cell);
      const stats = byDate.get(k);
      const isFuture = cell > today;
      col.push({
        date: k,
        focusMinutes: stats ? stats.focusMinutes : 0,
        isFuture
      });
    }
    weeks.push(col);
  }

  // 月ラベル位置
  const monthLabels = [];
  let prevMonth = -1;
  weeks.forEach((col, i) => {
    const first = new Date(col[0].date + 'T00:00:00');
    if (first.getMonth() !== prevMonth) {
      monthLabels.push({ i, label: `${first.getMonth() + 1}月` });
      prevMonth = first.getMonth();
    }
  });

  const CELL = 10;
  const GAP = 2;

  return (
    <div className="gummy-card" style={{ padding: 22 }}>
      <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: 'var(--ink)', marginBottom: 14 }}>
        この1年の集中量
      </h3>
      <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{ display: 'inline-block', minWidth: '100%' }}>
          {/* month labels */}
          <div style={{ position: 'relative', height: 14, marginLeft: 18 }}>
            {monthLabels.map((m) => (
              <div key={m.i} style={{
                position: 'absolute',
                left: m.i * (CELL + GAP),
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--ink-mute)'
              }}>{m.label}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: GAP, alignItems: 'flex-start' }}>
            {/* day-of-week labels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, marginRight: 6 }}>
              {['日', '', '火', '', '木', '', '土'].map((d, i) => (
                <div key={i} style={{ height: CELL, fontSize: 8, color: 'var(--ink-mute)', fontWeight: 700, lineHeight: `${CELL}px` }}>
                  {d}
                </div>
              ))}
            </div>
            {weeks.map((col, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                {col.map((cell) => (
                  <div
                    key={cell.date}
                    title={cell.isFuture ? cell.date : `${cell.date}: ${fmtHM(cell.focusMinutes)}`}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 2,
                      background: cell.isFuture ? 'transparent' : heatColor(cell.focusMinutes),
                      boxShadow: cell.isFuture ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.4)'
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 10, alignItems: 'center', fontSize: 10, color: 'var(--ink-mute)' }}>
        <span>少</span>
        {HEAT_LEVELS.map((l, i) => (
          <div key={i} style={{ width: CELL, height: CELL, borderRadius: 2, background: l.bg }} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}

function PeriodSummary({ agg }) {
  const weekDiff = agg.thisWeek - agg.lastWeek;
  const monthDiff = agg.thisMonth - agg.lastMonth;
  const Row = ({ label, value, diff }) => (
    <div style={{
      padding: '14px 18px',
      borderRadius: 18,
      background: 'rgba(255,255,255,0.7)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 6px -2px rgba(31,39,72,0.10)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>{label}</div>
      <div style={{ textAlign: 'right' }}>
        <div className="mono-num" style={{ fontWeight: 800, fontSize: 20, color: 'var(--ink)' }}>
          {fmtHM(value)}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: diff >= 0 ? '#0f6a4e' : '#a04050' }}>
          {diff >= 0 ? '▲' : '▼'} {fmtHM(Math.abs(diff))}
        </div>
      </div>
    </div>
  );
  return (
    <div className="gummy-card" style={{ padding: 22 }}>
      <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: 'var(--ink)', marginBottom: 14 }}>
        週・月のサマリー
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Row label="今週の集中時間" value={agg.thisWeek} diff={weekDiff} />
        <Row label="今月の集中時間" value={agg.thisMonth} diff={monthDiff} />
      </div>
    </div>
  );
}

/* ============== Root ============== */
export default function StatsView() {
  const { data, status } = useStatsRange({ days: 365 });
  const agg = useMemo(() => (data ? aggregate(data.days) : null), [data]);

  if (status === 'loading' && !data) {
    return (
      <div className="gummy-card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-mute)' }}>
        読み込み中…
      </div>
    );
  }
  if (status === 'offline' && !data) {
    return (
      <div className="gummy-card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-mute)' }}>
        オフラインのため記録を取得できませんでした。
      </div>
    );
  }
  if (!data || !agg) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TotalsCards agg={agg} />
      <DailyBarChart days={data.days} />
      <Heatmap days={data.days} />
      <PeriodSummary agg={agg} />
    </div>
  );
}
