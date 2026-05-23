/* Gummy Focus — main app */

import { useState, useEffect, useRef, useMemo } from 'react';
import FocusTree from './components/FocusTree.jsx';
import {
  useTweaks, TweaksPanel, TweakSection, TweakRow,
  TweakSlider, TweakToggle, TweakRadio, TweakSelect,
  TweakText, TweakNumber, TweakColor, TweakButton
} from './components/TweaksPanel.jsx';
import useLocalStorage from './hooks/useLocalStorage.js';
import useTodos from './hooks/useTodos.js';

/* ============== Default tweaks (persisted) ============== */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "primaryGradient": "mintSky",
  "background": "warmCream",
  "treeStyle": "fullScene",
  "showHistory": true,
  "showParticles": true,
  "cardOpacity": 72,
  "stopDigitStyle": "ink",
  "ringPreset": "auto"
} /*EDITMODE-END*/;

const RING_PRESETS = {
  auto: { label: "メインに合わせる", stops: null },
  coral: { label: "コーラル", stops: ["#ffb89a", "#ff7a8a"] },
  lavender: { label: "ラベンダー", stops: ["#cdbcff", "#8d6dff"] },
  aurora: { label: "オーロラ", stops: ["#7fd3b0", "#82b6ef"] },
  sunset: { label: "サンセット", stops: ["#f7d36c", "#ff7a8a"] },
  ocean: { label: "オーシャン", stops: ["#82c8ef", "#3b6fcc"] },
  forest: { label: "フォレスト", stops: ["#a8e0c4", "#2f8a64"] },
  mono: { label: "モノインク", stops: ["#7a85a8", "#1f2748"] }
};

const GRADIENTS = {
  mintSky: { stops: ["#d9f5e6", "#a9e3c9", "#8fd0e7"], ring: ["#7fd3b0", "#82b6ef"], label: "Mint → Sky" },
  pinkPeach: { stops: ["#ffe2ea", "#ffc2c2", "#ffb18a"], ring: ["#ff9eb5", "#ff9072"], label: "Pink → Peach" },
  lavMint: { stops: ["#e2d8ff", "#c9d8ff", "#b8ebd0"], ring: ["#b29eff", "#7fd3b0"], label: "Lavender → Mint" },
  lemonSky: { stops: ["#fff1b5", "#dfe8c0", "#b8d9f6"], ring: ["#f7d36c", "#82b6ef"], label: "Lemon → Sky" }
};

const BACKGROUNDS = {
  warmCream: {
    label: "Warm cream",
    bg: `radial-gradient(1200px 700px at 8% -10%, #ffe6ec 0%, transparent 55%),
         radial-gradient(1000px 700px at 100% 0%, #e3f0ff 0%, transparent 55%),
         radial-gradient(900px 700px at 80% 110%, #e7f8ed 0%, transparent 55%),
         radial-gradient(800px 700px at -10% 90%, #fff2c9 0%, transparent 55%),
         linear-gradient(180deg, #fff8ee 0%, #fdf6ec 100%)`
  },
  softSky: {
    label: "Soft sky",
    bg: `radial-gradient(1100px 700px at 12% 0%, #e3f0ff 0%, transparent 55%),
         radial-gradient(1100px 700px at 100% 100%, #ffe6f0 0%, transparent 55%),
         radial-gradient(900px 700px at 50% 110%, #ddf2e8 0%, transparent 55%),
         linear-gradient(180deg, #f4f8ff 0%, #fdf6ff 100%)`
  },
  candy: {
    label: "Candy",
    bg: `radial-gradient(900px 600px at 10% 0%, #ffd8e3 0%, transparent 55%),
         radial-gradient(900px 600px at 100% 0%, #d8e6ff 0%, transparent 55%),
         radial-gradient(900px 600px at 50% 110%, #ffeec6 0%, transparent 55%),
         linear-gradient(180deg, #fff2f6 0%, #f6f3ff 100%)`
  }
};

/* ============== Helpers ============== */
const pad = (n) => String(n).padStart(2, "0");

/* useViewport — listens to window resize, returns width (debounced via rAF) */
function useViewport() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    let raf = null;
    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setW(window.innerWidth));
    };
    window.addEventListener("resize", onResize);
    return () => {window.removeEventListener("resize", onResize);if (raf) cancelAnimationFrame(raf);};
  }, []);
  return w;
}

/* ===== Stopwatch digit style presets =====
   Caller spreads returned style onto the digit div.
*/
function getStopDigitStyle(kind, gradient) {
  const [c1, c2] = gradient.ring;
  switch (kind) {
    case "ink":
      return {
        color: "var(--ink)",
        textShadow:
        "0 1px 0 rgba(255,255,255,0.9), 0 4px 0 rgba(255,255,255,0.6), 0 8px 14px rgba(31,39,72,0.18)"
      };
    case "duotone":
      return {
        background: `linear-gradient(180deg, ${c1} 0%, ${c2} 100%)`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        filter: "drop-shadow(0 3px 0 rgba(255,255,255,0.7)) drop-shadow(0 6px 10px rgba(31,39,72,0.18))"
      };
    case "embossed":
      return {
        color: "#f7efe2",
        textShadow:
        "0 1px 0 rgba(255,255,255,0.9), 0 -1px 0 rgba(31,39,72,0.35), 0 6px 0 rgba(31,39,72,0.10), 0 14px 22px rgba(31,39,72,0.25)"
      };
    case "outline":
      return {
        color: "transparent",
        WebkitTextStroke: `2.5px ${c2}`,
        textShadow: "0 6px 16px rgba(31,39,72,0.10)"
      };
    case "neonChip":
      return {
        color: c2,
        textShadow:
        `0 1px 0 rgba(255,255,255,0.9), 0 3px 0 rgba(255,255,255,0.45), 0 0 24px ${c1}88, 0 10px 22px ${c2}55`
      };
    case "gradient":
    default:
      return {
        color: "var(--ink)",
        textShadow: "0 4px 0 rgba(255,255,255,0.85)",
        background: `linear-gradient(180deg, ${c1} 0%, ${c2} 100%)`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text"
      };
  }
}
const fmtMMSS = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const fmtHMS = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  const ss = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(ss)}`;
};

/* ============== Icons (minimal, gummy-friendly) ============== */
const I = {
  Play: (p) => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" {...p}><path d="M8 5.5v13c0 1.1 1.2 1.78 2.1 1.2l10.5-6.5a1.4 1.4 0 0 0 0-2.4L10.1 4.3C9.2 3.72 8 4.4 8 5.5z" /></svg>,
  Pause: (p) => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" {...p}><rect x="6.5" y="5" width="4.5" height="14" rx="1.8" /><rect x="13" y="5" width="4.5" height="14" rx="1.8" /></svg>,
  Reset: (p) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>,
  Settings: (p) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  Sun: (p) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>,
  Plus: (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14" /></svg>,
  Check: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12.5l4 4L19 7" /></svg>,
  List: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none" /></svg>,
  Chart: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 20V8M10 20V4M16 20v-7M22 20H2" /></svg>,
  Tree: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...p}><circle cx="12" cy="9" r="6" /><rect x="10.5" y="13" width="3" height="8" rx="1" /></svg>,
  Flame: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...p}><path d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-2-1-3-2-4 0 2-1 3-2 3 0-2 0-4-2-6zM6 14a6 6 0 1 0 12 0c0-3-3-4-3-7-2 2-3 3-3 5-2-1-3-1-3 0-1 0-3 0-3 2z" /></svg>,
  Clock: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
};

/* ============== Header ============== */
function Header({ tab, setTab }) {
  return (
    <header className="app-header" style={hStyles.wrap}>
      <div className="app-brand" style={hStyles.brand}>
        <div className="app-brand-logo" style={hStyles.logo}>
          <div style={hStyles.logoBall} />
          <div style={hStyles.logoBall2} />
        </div>
        <div className="col" style={{ gap: 2 }}>
          <div className="app-brand-name" style={hStyles.brandName}>Gummy Focus</div>
          <div className="app-brand-sub" style={hStyles.brandSub}>集中の時間を、すこしずつ育てよう。</div>
        </div>
      </div>

      <div className="app-tabwrap" style={hStyles.tabWrap}>
        <div style={hStyles.tabPill} data-comment-anchor="40bca555b8-div-166-9">
          <button
            className={`tab-btn ${tab === "pomo" ? "tab-btn--active" : ""}`}
            onClick={() => setTab("pomo")}>
            
            <I.Tree style={{ marginRight: 6, opacity: 0.85 }} />
            ポモドーロ
          </button>
          <button
            className={`tab-btn ${tab === "stop" ? "tab-btn--active" : ""}`}
            onClick={() => setTab("stop")}>
            
            <I.Clock style={{ marginRight: 6, opacity: 0.85 }} />
            ストップウォッチ
          </button>
        </div>
      </div>

      <div className="app-actions" style={hStyles.actions}>
        <button className="icon-btn" title="Theme"><I.Sun /></button>
        <button className="icon-btn" title="Settings"><I.Settings /></button>
        <div className="app-avatar" style={hStyles.avatar}>M</div>
      </div>
    </header>);

}

const hStyles = {
  wrap: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    padding: "20px 36px",
    gap: 24,
    position: "relative",
    zIndex: 5
  },
  brand: { display: "flex", alignItems: "center", gap: 14 },
  logo: {
    position: "relative",
    width: 52, height: 52,
    borderRadius: 20,
    background: "linear-gradient(180deg, #d9f5e6 0%, #a9e3c9 60%, #8fd0e7 100%)",
    boxShadow:
    "inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -3px 0 rgba(54,128,160,0.18), 0 8px 16px -6px rgba(80,180,180,0.45)",
    overflow: "hidden"
  },
  logoBall: {
    position: "absolute", top: 8, left: 8,
    width: 22, height: 22, borderRadius: "50%",
    background: "radial-gradient(circle at 30% 30%, #ffffff, #ffd2dc 60%, #ff9eb5)",
    boxShadow: "inset 0 2px 0 rgba(255,255,255,0.8), 0 4px 8px -3px rgba(0,0,0,0.2)"
  },
  logoBall2: {
    position: "absolute", bottom: 8, right: 8,
    width: 18, height: 18, borderRadius: "50%",
    background: "radial-gradient(circle at 30% 30%, #ffffff, #ffe585 60%, #e7c046)",
    boxShadow: "inset 0 2px 0 rgba(255,255,255,0.8), 0 4px 8px -3px rgba(0,0,0,0.2)"
  },
  brandName: {
    fontFamily: "var(--font-ui)",
    fontWeight: 800,
    fontSize: 22,
    letterSpacing: "-0.01em",
    color: "var(--ink)"
  },
  brandSub: {
    fontSize: 12,
    color: "var(--ink-mute)",
    fontWeight: 600
  },
  tabWrap: { display: "flex", justifyContent: "center" },
  tabPill: {
    display: "flex",
    padding: 6,
    background: "rgba(255,255,255,0.65)",
    borderRadius: 999,
    boxShadow:
    "inset 0 2px 4px rgba(31,39,72,0.06), inset 0 -1px 0 rgba(255,255,255,0.8), 0 2px 6px rgba(31,39,72,0.05)",
    backdropFilter: "blur(10px)"
  },
  actions: { display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" },
  avatar: {
    width: 40, height: 40, borderRadius: "50%",
    background: "linear-gradient(180deg, #ffe2ea 0%, #ffb6c8 60%, #ef82a0 100%)",
    color: "#7a2c44",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    fontFamily: "var(--font-ui)",
    boxShadow:
    "inset 0 2px 0 rgba(255,255,255,0.85), inset 0 -3px 0 rgba(120,40,60,0.18), 0 6px 12px -4px rgba(200,80,110,0.35)"
  }
};

/* ============== Pomodoro Timer ring ============== */
function TimerRing({ progress, gradient, children, size = 360, strokeWidth = 28 }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - progress);

  return (
    <div style={{ position: "relative", width: size, height: size, overflow: "visible" }}>
      {/* outer soft halo */}
      <div style={{
        position: "absolute", inset: -10,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${gradient.ring[0]}22, transparent 70%)`,
        filter: "blur(8px)"
      }} />
      <svg width={size} height={size} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={gradient.ring[0]} />
            <stop offset="100%" stopColor={gradient.ring[1]} />
          </linearGradient>
          <linearGradient id="ringGloss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <filter id="ringShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
            <feOffset dy="4" />
            <feComponentTransfer><feFuncA type="linear" slope="0.25" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* outer faint shadow disc */}
        <circle cx={size / 2} cy={size / 2} r={r + 4} fill="rgba(31,39,72,0.05)" />

        {/* track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="#dff3ea"
          strokeWidth={strokeWidth} />
        
        {/* track inner shadow */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(31,39,72,0.06)"
          strokeWidth={strokeWidth}
          style={{ filter: "blur(2px)" }} />
        

        {/* progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dash}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          filter="url(#ringShadow)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
        

        {/* glossy half-ring overlay */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="url(#ringGloss)"
          strokeWidth={strokeWidth - 14}
          strokeLinecap="round"
          strokeDasharray={`${c * 0.45} ${c}`}
          strokeDashoffset={c * 0.05}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          opacity="0.55"
          style={{ pointerEvents: "none" }} />
        
      </svg>

      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column"
      }}>
        {children}
      </div>
    </div>);

}

/* ============== Bottom Nav (mobile only) ============== */
function BottomNav({ active, setActive }) {
  const items = [
  { id: "tasks", label: "タスク", Icon: I.List },
  { id: "pomo", label: "ポモドーロ", Icon: I.Tree },
  { id: "stop", label: "ストップ", Icon: I.Clock },
  { id: "stats", label: "記録", Icon: I.Chart }];

  return (
    <nav className="bottom-nav" aria-label="モバイルナビゲーション">
      <div className="bottom-nav-mask" aria-hidden="true" />
      <div className="bottom-nav-inner">
        {items.map((it) =>
        <button
          key={it.id}
          className={`bn-item ${active === it.id ? "bn-item--active" : ""}`}
          onClick={() => setActive(it.id)}
          type="button"
          aria-current={active === it.id ? "page" : undefined}>
            <span className="bn-icon"><it.Icon /></span>
            <span className="bn-label">{it.label}</span>
          </button>
        )}
      </div>
    </nav>);

}

/* ============== App ============== */
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const gradient = GRADIENTS[tweaks.primaryGradient] || GRADIENTS.mintSky;
  const ringOverride = (RING_PRESETS[tweaks.ringPreset] || RING_PRESETS.auto).stops;
  const ringGradient = ringOverride ? { ...gradient, ring: ringOverride } : gradient;
  const bg = BACKGROUNDS[tweaks.background] || BACKGROUNDS.warmCream;

  /* Apply theme to body */
  useEffect(() => {
    document.body.style.background = bg.bg;
  }, [tweaks.background]);

  useEffect(() => {
    document.documentElement.style.setProperty("--surface", `rgba(255,255,255,${tweaks.cardOpacity / 100})`);
  }, [tweaks.cardOpacity]);

  useEffect(() => {
    document.body.dataset.bubbles = tweaks.showParticles ? "on" : "off";
  }, [tweaks.showParticles]);

  const [tab, setTab] = useState("pomo");
  // mobile-only nav state — keeps tasks/stats reachable when columns stack
  const [mobileSection, setMobileSection] = useState("pomo");
  const onMobileNav = (s) => {
    setMobileSection(s);
    if (s === "pomo" || s === "stop") setTab(s);
  };
  const [mode, setMode] = useState("focus"); // focus | short | long
  const [modeDurations, setModeDurations] = useLocalStorage("gf_modeDurations", { focus: 25 * 60, short: 5 * 60, long: 15 * 60 });
  const [secsLeft, setSecsLeft] = useState(modeDurations.focus);
  const [running, setRunning] = useState(false);
  // 完了ポモドーロは「日付つき」で保存し、日付が変わったらリセット
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const [completedRecord, setCompletedRecord] = useLocalStorage("gf_completed", { date: todayStr, count: 0 });
  const completed = completedRecord.date === todayStr ? completedRecord.count : 0;
  const setCompleted = (updater) => {
    setCompletedRecord((prev) => {
      const base = prev.date === todayStr ? prev.count : 0;
      const next = typeof updater === 'function' ? updater(base) : updater;
      return { date: todayStr, count: next };
    });
  };

  /* スキラボ秘書室との連携 */
  const todos = useTodos(todayStr);

  /* Stopwatch state */
  const [swSecs, setSwSecs] = useState(0);
  const [swRunning, setSwRunning] = useState(false);

  /* Templates */
  const [templates, setTemplates] = useState([
  { id: "quick", name: "クイック", focus: 15, brk: 3, accent: "lemon" },
  { id: "classic", name: "クラシック", focus: 25, brk: 5, accent: "mint" },
  { id: "deep", name: "ディープワーク", focus: 50, brk: 10, accent: "lavender" },
  { id: "long", name: "ロングフォーカス", focus: 90, brk: 15, accent: "pink" }]
  );
  const [activeTpl, setActiveTpl] = useState("classic");
  const addTemplate = (tpl) => {
    const accents = ["mint", "lemon", "lavender", "pink"];
    const newTpl = {
      id: `tpl-${Date.now()}`,
      name: tpl.name || `${tpl.focus}/${tpl.brk}`,
      focus: tpl.focus,
      brk: tpl.brk,
      accent: accents[templates.length % accents.length],
      custom: true
    };
    setTemplates([...templates, newTpl]);
    setActiveTpl(newTpl.id);
    const newDur = { focus: newTpl.focus * 60, short: newTpl.brk * 60, long: newTpl.brk * 3 * 60 };
    setModeDurations(newDur);
    setMode("focus");
    setSecsLeft(newDur.focus);
    setRunning(false);
  };
  const removeTemplate = (id) => {
    setTemplates(templates.filter((t) => t.id !== id));
    if (activeTpl === id) setActiveTpl("classic");
  };

  /* Tasks — localStorage で永続化 */
  const [tasks, setTasks] = useLocalStorage("gf_tasks", [
    { id: 1, title: "タイマー画面のデザイン", done: false, active: true }
  ]);
  const [newTask, setNewTask] = useState("");
  const activeTask = tasks.find((t) => t.active) || tasks[0];

  /* スキラボ todos から取得したタスクをマージ (片方向: 秘書室 → アプリ) */
  useEffect(() => {
    if (!todos.data) return;
    const remoteTasks = [];
    for (const sec of ['最優先', '通常', '余裕があれば']) {
      for (const t of todos.data.sections[sec] || []) {
        if (t.kind !== 'task') continue;
        remoteTasks.push({
          id: `sk-${t.id}`,
          title: t.text,
          done: t.checked,
          active: false,
          remote: true,
          remoteId: t.id,
          section: sec
        });
      }
    }
    setTasks((prev) => {
      const remoteTitles = new Set(remoteTasks.map((t) => t.title));
      // ローカルタスクのうち、すでに remote に同じタイトルがあるものは除去（楽観更新の dedup）
      const localOnly = prev.filter((t) => !t.remote && !remoteTitles.has(t.title));
      // アクティブだったタスクを保持するために、前回 active な remote タスクを覚えておく
      const prevActiveTitle = prev.find((t) => t.active)?.title;
      const merged = [...remoteTasks, ...localOnly];
      if (prevActiveTitle) {
        const restore = merged.find((t) => t.title === prevActiveTitle);
        if (restore) {
          merged.forEach((t) => { t.active = (t === restore); });
        }
      }
      if (!merged.some((t) => t.active) && merged[0]) merged[0].active = true;
      return merged;
    });
  }, [todos.data]);

  /* Timer tick */
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          if (mode === "focus") {
            setCompleted((c) => c + 1);
            // スキラボのメモ欄に「集中セッション完了」を追記
            todos.logSession({
              type: 'focus',
              label: activeTask?.title || '',
              durationMin: Math.round(modeDurations.focus / 60)
            });
          } else {
            todos.logSession({
              type: 'break',
              label: mode === 'short' ? 'ショート休憩' : 'ロング休憩',
              durationMin: Math.round(modeDurations[mode] / 60)
            });
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, mode, activeTask, modeDurations, todos]);

  useEffect(() => {
    if (!swRunning) return;
    const id = setInterval(() => setSwSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [swRunning]);

  /* Switching mode resets to that mode's duration */
  useEffect(() => {
    setSecsLeft(modeDurations[mode]);
    setRunning(false);
  }, [mode]);

  const totalForMode = modeDurations[mode];
  const progress = (totalForMode - secsLeft) / totalForMode;

  const addTask = () => {
    const v = newTask.trim();
    if (!v) return;
    // ローカル即時反映
    setTasks([...tasks, { id: Date.now(), title: v, done: false, active: false }]);
    setNewTask("");
    // スキラボ todos にも書き込み（非同期、失敗しても無視）
    todos.addTask(v, { section: '通常', priority: '通常' });
  };
  const toggleDone = (id) => {
    const target = tasks.find((t) => t.id === id);
    setTasks(tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t));
    // スキラボ側のタスクなら API でも切替
    if (target && target.remote && target.remoteId) {
      todos.toggleTask(target.remoteId, !target.done);
    }
  };
  const selectTask = (id) => setTasks(tasks.map((t) => ({ ...t, active: t.id === id })));

  /* Sessions */
  const sessions = [
  { time: "09:30", type: "集中", task: "タイマー画面のデザイン", dur: "25分", tone: "mint" },
  { time: "09:55", type: "休憩", task: "ショート休憩", dur: "5分", tone: "lemon" },
  { time: "10:00", type: "集中", task: "タイマー画面のデザイン", dur: "25分", tone: "mint" },
  { time: "10:25", type: "休憩", task: "ショート休憩", dur: "5分", tone: "lemon" },
  { time: "10:30", type: "集中", task: "Figmaレイアウトのレビュー", dur: "25分", tone: "mint" },
  { time: "10:55", type: "休憩", task: "ロング休憩", dur: "15分", tone: "lavender" },
  { time: "11:10", type: "集中", task: "ランディングページのコピー", dur: "25分", tone: "mint" }];


  const treeStage = Math.min(4, Math.floor(completed / 1.5));
  const nextProgress = completed % 2 / 2 + 0.2;

  return (
    <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", paddingBottom: 36 }} data-mobile-section={mobileSection}>
      <Header tab={tab} setTab={setTab} />

      <main className="app-grid" data-mobile-section={mobileSection} style={appStyles.grid}>
        {/* LEFT COLUMN */}
        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <TasksCard
            tasks={tasks}
            newTask={newTask}
            setNewTask={setNewTask}
            addTask={addTask}
            toggleDone={toggleDone}
            selectTask={selectTask} />
          
          <TemplatesCard
            templates={templates}
            active={activeTpl}
            addTemplate={addTemplate}
            removeTemplate={removeTemplate}
            setActive={(id) => {
              setActiveTpl(id);
              const tpl = templates.find((t) => t.id === id);
              if (tpl) {
                const newDur = { focus: tpl.focus * 60, short: tpl.brk * 60, long: tpl.brk * 3 * 60 };
                setModeDurations(newDur);
                setMode("focus");
                setSecsLeft(newDur.focus);
                setRunning(false);
              }
            }} />
          
        </section>

        {/* CENTER COLUMN */}
        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {tab === "pomo" ?
          <PomodoroPanel
            mode={mode}
            setMode={setMode}
            secsLeft={secsLeft}
            progress={progress}
            running={running}
            setRunning={setRunning}
            resetTimer={() => {setSecsLeft(modeDurations[mode]);setRunning(false);}}
            gradient={ringGradient}
            activeTask={activeTask}
            completed={completed} /> :


          <StopwatchPanel
            secs={swSecs}
            running={swRunning}
            setRunning={setSwRunning}
            reset={() => {setSwSecs(0);setSwRunning(false);}}
            gradient={gradient}
            digitStyleKey={tweaks.stopDigitStyle}
            activeTask={activeTask} />

          }
          {tweaks.showHistory && <HistoryCard sessions={sessions} tab={tab} />}
        </section>

        {/* RIGHT COLUMN */}
        <section className="app-col-right" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <FocusTreeCard
            stage={treeStage}
            progress={nextProgress}
            completed={completed}
            focusMinutes={completed * 25} />
          
          <StatsGrid completed={completed} focusMinutes={completed * 25} />
        </section>
      </main>

      <BottomNav active={mobileSection} setActive={onMobileNav} />

      <TweaksPanel title="カスタマイズ">
        <TweakSection label="メインカラー" />
        <TweakRadio
          label="パレット"
          value={tweaks.primaryGradient}
          onChange={(v) => setTweak("primaryGradient", v)}
          options={[
          { value: "mintSky", label: "ミント" },
          { value: "pinkPeach", label: "ピンク" },
          { value: "lavMint", label: "ラベンダー" },
          { value: "lemonSky", label: "レモン" }]
          } />
        
        <TweakSection label="背景" />
        <TweakRadio
          label="カラー"
          value={tweaks.background}
          onChange={(v) => setTweak("background", v)}
          options={[
          { value: "warmCream", label: "クリーム" },
          { value: "softSky", label: "スカイ" },
          { value: "candy", label: "キャンディ" }]
          } />
        
        <TweakSection label="カードの質感" />
        <TweakSlider
          label="不透明度"
          value={tweaks.cardOpacity}
          onChange={(v) => setTweak("cardOpacity", v)}
          min={40} max={95} step={1} unit="%" />
        
        <TweakToggle
          label="履歴を表示"
          value={tweaks.showHistory}
          onChange={(v) => setTweak("showHistory", v)} />
        
        <TweakToggle
          label="ふわふわグミ"
          value={tweaks.showParticles}
          onChange={(v) => setTweak("showParticles", v)} />
        
        <TweakSection label="リングカラー" />
        <TweakSelect
          label="プリセット"
          value={tweaks.ringPreset}
          onChange={(v) => setTweak("ringPreset", v)}
          options={Object.entries(RING_PRESETS).map(([value, p]) => ({ value, label: p.label }))} />
        
        <TweakSection label="ストップウォッチ数字" />
        <TweakSelect
          label="スタイル"
          value={tweaks.stopDigitStyle}
          onChange={(v) => setTweak("stopDigitStyle", v)}
          options={[
          { value: "ink", label: "ソリッド (くっきり)" },
          { value: "duotone", label: "デュオトーン (濃いめ)" },
          { value: "embossed", label: "エンボス (彫り込み)" },
          { value: "outline", label: "アウトライン (中抜き)" },
          { value: "neonChip", label: "ネオン (発光)" },
          { value: "gradient", label: "グラデーション (現行)" }]
          } />
        
      </TweaksPanel>
    </div>);

}

/* ============== Panels ============== */

function PomodoroPanel({ mode, setMode, secsLeft, progress, running, setRunning, resetTimer, gradient, activeTask, completed }) {
  const vw = useViewport();
  const ringSize = vw < 380 ? 260 : vw < 768 ? 300 : vw < 1100 ? 320 : 360;
  const ringStroke = vw < 768 ? 24 : 28;
  return (
    <div className="gummy-card pomo-panel card-pomo" data-mob="pomo" style={{ padding: "32px 32px 36px", position: "relative" }}>
      {/* mode chips */}
      <div className="mode-chips" style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 18 }}>
        {[
        { id: "focus", label: "集中" },
        { id: "short", label: "ショート休憩" },
        { id: "long", label: "ロング休憩" }].
        map((m) =>
        <button
          key={m.id}
          className={`gummy-chip ${mode === m.id ? "gummy-chip--active" : ""}`}
          onClick={() => setMode(m.id)}
          style={{ fontSize: 13 }}>
          
            {m.label}
          </button>
        )}
      </div>

      {/* ring + time */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 8, marginBottom: 24 }}>
        <TimerRing progress={progress} gradient={gradient} size={ringSize} strokeWidth={ringStroke}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>
            {mode === "focus" ? "集中タイム" : mode === "short" ? "ショート休憩" : "ロング休憩"}
          </div>
          <div className="mono-num pomo-digits" style={{
            fontFamily: "var(--font-num)",
            fontWeight: 800,
            fontSize: 86,
            letterSpacing: "-0.04em",
            color: "var(--ink)",
            lineHeight: 1,
            textShadow: "0 2px 0 rgba(255,255,255,0.8)"
          }}>
            {fmtMMSS(secsLeft)}
          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: "var(--ink-soft)", fontWeight: 600 }}>
            <span style={{ opacity: 0.6 }}>TASK： </span>
            <span style={{ color: "var(--ink)", fontWeight: 800 }}>{activeTask?.title || "—"}</span>
          </div>
        </TimerRing>
      </div>

      {/* controls */}
      <div className="timer-controls" style={{ display: "flex", justifyContent: "center", gap: 14, alignItems: "center" }}>
        <button className="gummy-btn gummy-btn--ghost" onClick={resetTimer} style={{ padding: "14px 18px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <I.Reset /> リセット
          </span>
        </button>
        <button
          className="gummy-btn gummy-btn--primary"
          onClick={() => setRunning(!running)}
          style={{ padding: "18px 36px", fontSize: 17 }}>
          
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            {running ? <I.Pause /> : <I.Play />}
            {running ? "一時停止" : "スタート"}
          </span>
        </button>
        <button className="gummy-btn gummy-btn--ghost ghost-2" onClick={() => setRunning(false)} style={{ padding: "14px 18px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <I.Pause /> 一時停止
          </span>
        </button>
      </div>

      {/* footer */}
      <div style={{
        marginTop: 26, display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingTop: 22, borderTop: "1px dashed rgba(31,39,72,0.08)"
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2, 3].map((i) =>
            <div key={i} style={{
              width: 12, height: 12, borderRadius: "50%",
              background: i < completed % 4 ?
              "linear-gradient(180deg, #d9f5e6 0%, #a9e3c9 50%, #8fd0e7 100%)" :
              "rgba(31,39,72,0.08)",
              boxShadow: i < completed % 4 ?
              "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 4px -2px rgba(80,180,180,0.6)" :
              "inset 0 1px 2px rgba(31,39,72,0.08)"
            }} />
            )}
          </div>
          <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 700, marginLeft: 6 }}>
            4セット中 {completed % 4 + 1} 回目
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 700 }}>
          今日 <span style={{ color: "var(--ink)", fontWeight: 800 }}>{completed}</span> ポモドーロ
        </div>
      </div>
    </div>);

}

function StopwatchPanel({ secs, running, setRunning, reset, gradient, activeTask, digitStyleKey }) {
  const digitStyle = getStopDigitStyle(digitStyleKey, gradient);
  return (
    <div className="gummy-card stop-panel card-stop" data-mob="stop" style={{ padding: "40px 32px 36px", position: "relative" }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "rgb(138, 145, 173)" }}>
          フリー集中タイマー
        </div>
      </div>

      {/* big time */}
      <div style={{ textAlign: "center", padding: "32px 0 12px" }}>
        <div className="mono-num stop-digits" style={{
          fontFamily: "var(--font-num)",
          fontWeight: 800,
          fontSize: 132,
          letterSpacing: "-0.05em",
          lineHeight: 1,
          ...digitStyle
        }}>
          {fmtHMS(secs)}
        </div>
        <div style={{ marginTop: 18, fontSize: 14, color: "var(--ink-soft)", fontWeight: 600 }}>
          <span style={{ opacity: 0.6 }}>計測中 </span>
          <span style={{ color: "var(--ink)", fontWeight: 800 }}>{activeTask?.title || "—"}</span>
        </div>
      </div>

      {/* segment ticks */}
      <div className="stop-ticks" style={{ display: "flex", justifyContent: "center", gap: 4, margin: "14px 0 24px" }}>
        {Array.from({ length: 32 }).map((_, i) =>
        <div key={i} style={{
          width: 4, height: i % 4 === 0 ? 16 : 10,
          borderRadius: 4,
          background: i < secs / 60 % 32 ?
          `linear-gradient(180deg, ${gradient.ring[0]}, ${gradient.ring[1]})` :
          "rgba(31,39,72,0.08)",
          boxShadow: i < secs / 60 % 32 ? "0 2px 4px -2px rgba(80,180,180,0.6)" : "none"
        }} />
        )}
      </div>

      <div className="timer-controls" style={{ display: "flex", justifyContent: "center", gap: 14 }}>
        <button className="gummy-btn gummy-btn--ghost" onClick={reset} style={{ padding: "14px 18px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><I.Reset /> リセット</span>
        </button>
        <button
          className="gummy-btn gummy-btn--primary"
          onClick={() => setRunning(!running)}
          style={{ padding: "18px 36px", fontSize: 17 }}>
          
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            {running ? <I.Pause /> : <I.Play />}
            {running ? "一時停止" : "スタート"}
          </span>
        </button>
      </div>

      <div style={{
        marginTop: 28, paddingTop: 22, borderTop: "1px dashed rgba(31,39,72,0.08)",
        display: "flex", justifyContent: "space-between"
      }}>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 700 }}>
          今日の合計 <span style={{ color: "var(--ink)", fontWeight: 800, marginLeft: 4 }}>2時間18分</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 700 }}>
          最長記録 <span style={{ color: "var(--ink)", fontWeight: 800, marginLeft: 4 }}>52分</span>
        </div>
      </div>
    </div>);

}

function TasksCard({ tasks, newTask, setNewTask, addTask, toggleDone, selectTask }) {
  return (
    <div className="gummy-card card-tasks" data-mob="tasks" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <h3 style={cardStyles.h3}>今日のタスク</h3>
        <span style={cardStyles.count}>未完了 {tasks.filter((t) => !t.done).length} 件</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={cardStyles.inputWrap}>
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="今日は何に集中しますか？"
            style={cardStyles.input} />
          
        </div>
        <button
          className="gummy-btn gummy-btn--primary"
          onClick={addTask}
          style={{ padding: "10px 16px", fontSize: 14 }}>
          
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <I.Plus /> 追加
          </span>
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.map((task) =>
        <TaskRow key={task.id} task={task} toggleDone={toggleDone} selectTask={selectTask} />
        )}
      </div>
    </div>);

}

function TaskRow({ task, toggleDone, selectTask }) {
  return (
    <div
      onClick={() => selectTask(task.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 18,
        background: task.active ?
        "linear-gradient(180deg, #e9f9ef 0%, #d4f1e5 100%)" :
        "rgba(255,255,255,0.45)",
        boxShadow: task.active ?
        "inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(80,160,120,0.15), 0 4px 8px -4px rgba(80,180,140,0.30)" :
        "inset 0 1px 0 rgba(255,255,255,0.7)",
        cursor: "pointer",
        transition: "transform 0.15s ease"
      }}>
      
      <button
        onClick={(e) => {e.stopPropagation();toggleDone(task.id);}}
        style={{
          width: 22, height: 22, borderRadius: 8,
          background: task.done ?
          "linear-gradient(180deg, #d9f5e6 0%, #a9e3c9 50%, #8fd0e7 100%)" :
          "rgba(255,255,255,0.9)",
          boxShadow: task.done ?
          "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(54,128,160,0.18), 0 3px 6px -2px rgba(80,180,180,0.4)" :
          "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(31,39,72,0.06), 0 2px 4px -2px rgba(31,39,72,0.15)",
          border: "none",
          cursor: "pointer",
          display: "grid", placeItems: "center",
          color: "#103848",
          flexShrink: 0
        }}>
        
        {task.done && <I.Check />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 14,
          color: task.done ? "var(--ink-mute)" : "var(--ink)",
          textDecoration: task.done ? "line-through" : "none",
          textDecorationColor: "rgba(31,39,72,0.3)",
          textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap"
        }}>
          {task.title}
        </div>
      </div>
      {task.active &&
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
        color: "#0f6a4e",
        padding: "4px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.7)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 4px -2px rgba(80,180,140,0.4)"
      }}>選択中

      </div>
      }
    </div>);

}

function TemplatesCard({ templates, active, setActive, addTemplate, removeTemplate }) {
  const [adding, setAdding] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplFocus, setTplFocus] = useState(30);
  const [tplBreak, setTplBreak] = useState(7);
  const accents = {
    mint: { a: "#d9f5e6", b: "#a9e3c9", c: "#8fd0e7", text: "#0f5a48" },
    lemon: { a: "#fff6c5", b: "#ffe585", c: "#f7d36c", text: "#7a5b16" },
    lavender: { a: "#e9e0ff", b: "#cdbcff", c: "#b29eff", text: "#3e2a82" },
    pink: { a: "#ffe2ea", b: "#ffb6c8", c: "#ef82a0", text: "#7a2c44" }
  };

  const submit = () => {
    if (tplFocus < 1 || tplBreak < 0) return;
    addTemplate({ name: tplName.trim(), focus: tplFocus, brk: tplBreak });
    setTplName("");
    setTplFocus(30);
    setTplBreak(7);
    setAdding(false);
  };

  return (
    <div className="gummy-card card-templates" data-mob="pomo" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <h3 style={cardStyles.h3}>時間テンプレート</h3>
        <button
          onClick={() => setAdding((a) => !a)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 800,
            color: adding ? "var(--ink-mute)" : "#0f5a48",
            background: adding ?
            "rgba(255,255,255,0.6)" :
            "linear-gradient(180deg, #e9f9ef 0%, #d4f1e5 100%)",
            border: "none",
            padding: "5px 11px",
            borderRadius: 999,
            cursor: "pointer",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 4px -2px rgba(80,180,140,0.3)"
          }}>
          
          {adding ? "閉じる" : "＋ 追加"}
        </button>
      </div>

      {adding &&
      <div style={{
        padding: 14,
        marginBottom: 12,
        borderRadius: 18,
        background: "rgba(255,255,255,0.7)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(31,39,72,0.05), 0 4px 10px -4px rgba(31,39,72,0.10)"
      }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={addStyles.label}>名前 <span style={{ color: "var(--ink-faint)", fontWeight: 600 }}>(任意)</span></div>
              <div style={addStyles.inputWrap}>
                <input
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="例：深い集中"
                style={addStyles.input}
                maxLength={16} />
              
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={addStyles.label}>集中 <span style={{ color: "var(--ink-faint)", fontWeight: 600 }}>分</span></div>
                <Stepper value={tplFocus} setValue={setTplFocus} min={1} max={180} accent="mint" accents={accents} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={addStyles.label}>休憩 <span style={{ color: "var(--ink-faint)", fontWeight: 600 }}>分</span></div>
                <Stepper value={tplBreak} setValue={setTplBreak} min={0} max={60} accent="lemon" accents={accents} />
              </div>
            </div>
            {/* preset chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
            { f: 20, b: 5 }, { f: 30, b: 7 }, { f: 45, b: 10 }, { f: 60, b: 12 }].
            map((p, i) =>
            <button
              key={i}
              onClick={() => {setTplFocus(p.f);setTplBreak(p.b);}}
              style={{
                fontSize: 11, fontWeight: 700,
                padding: "5px 10px", borderRadius: 999,
                border: "none", cursor: "pointer",
                background: "rgba(255,255,255,0.7)",
                color: "var(--ink-soft)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 4px -2px rgba(31,39,72,0.10)"
              }}>
              
                  {p.f}/{p.b}分
                </button>
            )}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 2 }}>
              <button
              onClick={() => setAdding(false)}
              className="gummy-btn gummy-btn--ghost"
              style={{ padding: "8px 14px", fontSize: 12 }}>
              
                キャンセル
              </button>
              <button
              onClick={submit}
              className="gummy-btn gummy-btn--primary"
              style={{ padding: "8px 16px", fontSize: 12 }}>
              
                テンプレートを追加
              </button>
            </div>
          </div>
        </div>
      }

      <div className="templates-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {templates.map((tpl) => {
          const ac = accents[tpl.accent];
          const isActive = active === tpl.id;
          return (
            <div
              key={tpl.id}
              onClick={() => setActive(tpl.id)}
              style={{
                position: "relative",
                textAlign: "left",
                padding: "14px 14px 13px",
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                background: isActive ?
                `linear-gradient(180deg, ${ac.a} 0%, ${ac.b} 60%, ${ac.c} 100%)` :
                "rgba(255,255,255,0.6)",
                boxShadow: isActive ?
                `inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 0 rgba(31,39,72,0.10), 0 8px 16px -6px ${ac.c}88` :
                "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(31,39,72,0.05), 0 4px 10px -4px rgba(31,39,72,0.12)",
                color: isActive ? ac.text : "var(--ink-soft)",
                transition: "transform 0.15s ease",
                overflow: "hidden"
              }}>
              
              <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: "-0.005em", display: "flex", alignItems: "center", gap: 6 }}>
                {tpl.name}
                {tpl.custom &&
                <span style={{
                  fontSize: 9, fontWeight: 800,
                  padding: "2px 6px", borderRadius: 999,
                  background: "rgba(255,255,255,0.7)",
                  color: isActive ? ac.text : "var(--ink-mute)",
                  letterSpacing: "0.03em"
                }}>カスタム</span>
                }
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, opacity: 0.78 }}>
                集中 {tpl.focus}分 · 休憩 {tpl.brk}分
              </div>
              {tpl.custom &&
              <button
                onClick={(e) => {e.stopPropagation();removeTemplate(tpl.id);}}
                title="削除"
                style={{
                  position: "absolute", top: 8, right: 8,
                  width: 20, height: 20, borderRadius: "50%",
                  border: "none", cursor: "pointer",
                  background: "rgba(255,255,255,0.8)",
                  color: "var(--ink-mute)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 4px -2px rgba(31,39,72,0.15)",
                  fontSize: 14, fontWeight: 800, lineHeight: 1,
                  display: "grid", placeItems: "center"
                }}>
                ×</button>
              }
              <div style={{
                position: "absolute", right: -10, top: -10, width: 36, height: 36, borderRadius: "50%",
                background: `radial-gradient(circle at 35% 30%, ${ac.a} 0%, ${ac.b} 60%, ${ac.c} 100%)`,
                opacity: tpl.custom ? 0 : 0.7,
                boxShadow: "inset 0 2px 0 rgba(255,255,255,0.7)",
                pointerEvents: "none"
              }} />
            </div>);

        })}
      </div>
    </div>);

}

function Stepper({ value, setValue, min, max, accent, accents }) {
  const ac = accents[accent];
  const [draft, setDraft] = useState(String(value));
  // keep input in sync when value changes from outside (preset chips, +/− buttons)
  useEffect(() => {setDraft(String(value));}, [value]);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (isNaN(n)) {setDraft(String(value));return;}
    const clamped = Math.max(min, Math.min(max, n));
    setValue(clamped);
    setDraft(String(clamped));
  };

  const onKey = (e) => {
    if (e.key === "Enter") {e.target.blur();} else
    if (e.key === "ArrowUp") {e.preventDefault();setValue(Math.min(max, value + (value >= 60 ? 5 : 1)));} else
    if (e.key === "ArrowDown") {e.preventDefault();setValue(Math.max(min, value - (value > 60 ? 5 : 1)));} else
    if (e.key === "Escape") {setDraft(String(value));e.target.blur();}
  };

  const btnBase = {
    width: 28, height: 28, borderRadius: 10,
    border: "none", cursor: "pointer",
    background: `linear-gradient(180deg, ${ac.a} 0%, ${ac.b} 100%)`,
    color: ac.text,
    fontSize: 16, fontWeight: 800, lineHeight: 1,
    display: "grid", placeItems: "center",
    boxShadow: "inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(31,39,72,0.10), 0 3px 6px -2px rgba(31,39,72,0.15)",
    flexShrink: 0
  };
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "5px 8px",
      background: "rgba(255,255,255,0.85)",
      borderRadius: 14,
      boxShadow: "inset 0 1px 2px rgba(31,39,72,0.08), inset 0 -1px 0 rgba(255,255,255,0.8)",
      gap: 4,
      minWidth: 0,
      width: "100%"
    }}>
      <button
        onClick={() => setValue(Math.max(min, value - (value > 60 ? 5 : 1)))}
        style={btnBase}
        aria-label="decrease">
        −</button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        size={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
        onBlur={commit}
        onKeyDown={onKey}
        onFocus={(e) => e.target.select()}
        className="mono-num"
        style={{
          flex: "1 1 0",
          width: 0,
          minWidth: 0,
          textAlign: "center",
          fontSize: 18, fontWeight: 800, color: "var(--ink)",
          fontFamily: "var(--font-num)",
          border: "none", outline: "none",
          background: "transparent",
          padding: "4px 0",
          borderRadius: 8,
          cursor: "text",
          boxSizing: "border-box"
        }}
        onMouseDown={(e) => e.stopPropagation()} />
      <button
        onClick={() => setValue(Math.min(max, value + (value >= 60 ? 5 : 1)))}
        style={btnBase}
        aria-label="increase">
        ＋</button>
    </div>);

}

const addStyles = {
  label: {
    fontSize: 11, fontWeight: 700,
    color: "var(--ink-soft)",
    marginBottom: 4
  },
  inputWrap: {
    padding: "7px 12px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.85)",
    boxShadow: "inset 0 1px 2px rgba(31,39,72,0.08), inset 0 -1px 0 rgba(255,255,255,0.8)"
  },
  input: {
    width: "100%", border: "none", outline: "none", background: "transparent",
    fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, color: "var(--ink)"
  }
};

function FocusTreeCard({ stage, progress, completed, focusMinutes }) {
  const stageNames = ["たね", "芽が出た", "若木", "育っている木", "花が咲いた"];
  return (
    <div className="gummy-card card-tree" data-mob="stats" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <h3 style={cardStyles.h3}>集中の木</h3>
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: "0.04em",
          color: "#0f5a48",
          padding: "4px 10px", borderRadius: 999,
          background: "linear-gradient(180deg, #e9f9ef 0%, #d4f1e5 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 4px -2px rgba(80,180,140,0.3)"
        }}>{stage + 1} / 5 ステージ</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 600, marginBottom: 14 }}>
        {stageNames[stage]}
      </div>

      <FocusTree stage={stage} progress={progress} />

      {/* progress to next stage */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.02em" }}>
            次のステージまで
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ink)" }}>
            {Math.round(progress * 100)}%
          </span>
        </div>
        <div style={{
          height: 12,
          borderRadius: 999,
          background: "rgba(31,39,72,0.06)",
          boxShadow: "inset 0 2px 4px rgba(31,39,72,0.08)",
          overflow: "hidden",
          position: "relative"
        }}>
          <div style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: "linear-gradient(180deg, #d9f5e6 0%, #a9e3c9 50%, #8fd0e7 100%)",
            borderRadius: 999,
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.85), inset 0 -2px 0 rgba(54,128,160,0.18)",
            transition: "width 0.6s ease"
          }} />
        </div>
      </div>

      {/* mini-stats inline */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, gap: 10 }}>
        <div style={treeStatStyles.cell}>
          <div style={treeStatStyles.label}>今日の集中</div>
          <div style={treeStatStyles.value}>
            {Math.floor(focusMinutes / 60)}時間 {focusMinutes % 60}分
          </div>
        </div>
        <div style={treeStatStyles.cell}>
          <div style={treeStatStyles.label}>ポモドーロ</div>
          <div style={treeStatStyles.value}>{completed}</div>
        </div>
      </div>
    </div>);

}

const treeStatStyles = {
  cell: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.6)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 4px -2px rgba(31,39,72,0.08)"
  },
  label: { fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.02em" },
  value: { fontSize: 18, fontWeight: 800, color: "var(--ink)", marginTop: 2, fontFamily: "var(--font-num)" }
};

function StatsGrid({ completed, focusMinutes }) {
  const items = [
  { label: "完了したポモドーロ", value: completed, sub: "昨日より +2", tone: "mint", icon: <I.Tree /> },
  { label: "集中時間", value: `${Math.floor(focusMinutes / 60)}時間${focusMinutes % 60}分`, sub: "目標 3時間", tone: "sky", icon: <I.Clock /> },
  { label: "連続記録", value: "3", sub: "日連続", tone: "coral", icon: <I.Flame /> },
  { label: "木のステージ", value: "育成中", sub: "4 / 5", tone: "lemon", icon: <I.Tree /> }];

  const tones = {
    mint: { a: "#d9f5e6", b: "#a9e3c9", c: "#8fd0e7", txt: "#0f5a48" },
    sky: { a: "#e1eeff", b: "#b8d9f6", c: "#82b6ef", txt: "#1b3e74" },
    coral: { a: "#ffe2d6", b: "#ffb89a", c: "#ff9072", txt: "#7a3520" },
    lemon: { a: "#fff6c5", b: "#ffe585", c: "#f7d36c", txt: "#7a5b16" }
  };

  return (
    <div className="gummy-card card-stats" data-mob="stats" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <h3 style={cardStyles.h3}>今日の集中</h3>
        <span style={cardStyles.count}>5月23日</span>
      </div>
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {items.map((it, i) => {
          const t = tones[it.tone];
          return (
            <div key={i} style={{
              padding: 14,
              borderRadius: 20,
              background: `linear-gradient(180deg, ${t.a} 0%, ${t.b}cc 100%)`,
              boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -3px 0 rgba(31,39,72,0.08), 0 6px 12px -6px rgba(31,39,72,0.15)",
              position: "relative",
              overflow: "hidden"
            }}>
              <div style={{
                position: "absolute", top: -12, right: -12,
                width: 50, height: 50, borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, #ffffff, ${t.b} 55%, ${t.c} 100%)`,
                boxShadow: "inset 0 2px 0 rgba(255,255,255,0.7), 0 4px 10px -4px rgba(31,39,72,0.25)",
                color: t.txt,
                display: "grid", placeItems: "center",
                paddingTop: 14, paddingRight: 14
              }}>
                <div style={{ color: t.txt, opacity: 0.85 }}>{it.icon}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.txt, opacity: 0.8, letterSpacing: "0.02em" }}>
                {it.label}
              </div>
              <div className="mono-num" style={{
                fontWeight: 800, color: t.txt, marginTop: 4, letterSpacing: "-0.02em", fontSize: "25px"
              }}>
                {it.value}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.txt, opacity: 0.7, marginTop: 2 }}>
                {it.sub}
              </div>
            </div>);

        })}
      </div>
    </div>);

}

function HistoryCard({ sessions, tab }) {
  const tones = {
    mint: { a: "#d9f5e6", b: "#a9e3c9", c: "#5fbf90", txt: "#0f5a48" },
    lemon: { a: "#fff6c5", b: "#ffe585", c: "#e7c046", txt: "#7a5b16" },
    lavender: { a: "#e9e0ff", b: "#cdbcff", c: "#b29eff", txt: "#3e2a82" }
  };
  return (
    <div className="gummy-card card-history" data-mob="stats" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <h3 style={cardStyles.h3}>最近のセッション</h3>
        <span style={cardStyles.count}>直近 7 件 · 今日</span>
      </div>
      <div style={{
        display: "flex",
        gap: 10,
        overflowX: "auto",
        paddingBottom: 4
      }}>
        {sessions.map((s, i) => {
          const t = tones[s.tone] || tones.mint;
          return (
            <div key={i} style={{
              flex: "0 0 auto",
              minWidth: 200,
              padding: "14px 16px",
              borderRadius: 22,
              background: "rgba(255,255,255,0.7)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(31,39,72,0.04), 0 4px 10px -4px rgba(31,39,72,0.12)",
              display: "flex", flexDirection: "column", gap: 6
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
                  padding: "3px 9px", borderRadius: 999,
                  background: `linear-gradient(180deg, ${t.a} 0%, ${t.b} 100%)`,
                  color: t.txt,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)"
                }}>{s.type}</span>
                <span className="mono-num" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)" }}>
                  {s.time}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.005em" }}>
                {s.task}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>
                {s.dur}
              </div>
            </div>);

        })}
      </div>
    </div>);

}

const appStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "320px minmax(0, 1fr) 340px",
    gap: 22,
    padding: "8px 36px 0",
    maxWidth: 1500,
    margin: "0 auto",
    alignItems: "start"
  }
};

const cardStyles = {
  h3: {
    margin: 0, fontFamily: "var(--font-ui)", fontWeight: 800,
    fontSize: 16, color: "var(--ink)", letterSpacing: "-0.005em"
  },
  count: {
    fontSize: 11, fontWeight: 700, color: "var(--ink-mute)",
    textTransform: "uppercase", letterSpacing: "0.08em"
  },
  inputWrap: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.75)",
    boxShadow: "inset 0 2px 4px rgba(31,39,72,0.08), inset 0 -1px 0 rgba(255,255,255,0.8)"
  },
  input: {
    width: "100%", border: "none", outline: "none", background: "transparent",
    fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, color: "var(--ink)"
  }
};

export default App;