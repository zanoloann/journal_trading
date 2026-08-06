// ui.jsx — shared UI primitives, icons, charts
const { useState, useRef, useEffect, useMemo } = React;

// ---------------- Icons (simple stroke set) ----------------
const ICONS = {
  dashboard: 'M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z',
  journal: 'M4 4h13l3 3v13H4zM8 9h8M8 13h8M8 17h5',
  calendar: 'M3 5h18v16H3zM3 9h18M8 3v4M16 3v4',
  stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  accounts: 'M3 7h18v12H3zM3 11h18M7 15h4',
  plus: 'M12 5v14M5 12h14',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  chevR: 'M9 6l6 6-6 6',
  chevL: 'M15 6l-6 6 6 6',
  chevD: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  link: 'M9 15l6-6M10 6h4a4 4 0 0 1 0 8M14 18h-4a4 4 0 0 1 0-8',
  alert: 'M12 3l9 16H3zM12 10v4M12 17h.01',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v4l3 2',
  check: 'M4 12l5 5L20 6',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  image: 'M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6',
  dot: 'M12 12h.01',
  flame: 'M12 3c1 4 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 1 2 2 1 2-5z',
  wallet: 'M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1zM16 12h4M3 7V5a1 1 0 0 1 1-1h12',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff: 'M2 12s3.5-7 10-7c2 0 3.8.6 5.3 1.5M22 12s-3.5 7-10 7c-2 0-3.8-.6-5.3-1.5M9.5 9.5a3 3 0 0 0 4 4M3 3l18 18',
  trash: 'M5 7h14M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  crown: 'M4 18h16M4 18l-1-9 5 4 4-7 4 7 5-4-1 9'
};
function Icon({ name, size = 18, stroke = 2, style, className }) {
  const d = ICONS[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
    style={style} className={className} aria-hidden="true">
      {d.split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
    </svg>);

}

// ---------------- Card ----------------
function Card({ children, style, className, pad = 20, onClick, hover }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick}
    onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
    className={'tj-card ' + (className || '')}
    style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: pad, cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow .18s ease, transform .18s ease, border-color .18s ease',
      boxShadow: hover && h ? '0 8px 28px -12px rgba(20,20,18,.18)' : '0 1px 2px rgba(20,20,18,.03)',
      transform: hover && h ? 'translateY(-2px)' : 'none',
      borderColor: hover && h ? 'var(--border-strong)' : 'var(--border)',
      ...style
    }}>
      {children}
    </div>);

}

// ---------------- Value (P&L colored) ----------------
function PnL({ value, children, dec = null, signed = true, style, abbr }) {
  const c = value > 0 ? 'var(--profit)' : value < 0 ? 'var(--loss)' : 'var(--ink-2)';
  return <span style={{ color: c, fontVariantNumeric: 'tabular-nums', ...style }}>
    {children != null ? children : fmtMoney(value, { dec, signed })}
  </span>;
}

// ---------------- Badge / Pill ----------------
function Badge({ children, tone = 'neutral', style }) {
  const tones = {
    neutral: ['var(--surface-2)', 'var(--ink-2)', 'var(--border)'],
    profit: ['var(--profit-bg)', 'var(--profit)', 'transparent'],
    loss: ['var(--loss-bg)', 'var(--loss)', 'transparent'],
    warn: ['var(--warn-bg)', 'var(--warn)', 'transparent'],
    long: ['var(--profit-bg)', 'var(--profit)', 'transparent'],
    short: ['var(--info-bg)', 'var(--info)', 'transparent'],
    info: ['var(--info-bg)', 'var(--info)', 'transparent'],
    ink: ['#222', '#fff', 'transparent']
  };
  const [bg, fg, bd] = tones[tone] || tones.neutral;
  return <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, background: bg, color: fg,
      border: '1px solid ' + bd, padding: '3px 9px', borderRadius: 999, fontSize: 12,
      fontWeight: 600, letterSpacing: '.01em', whiteSpace: 'nowrap', ...style
    }}>{children}</span>;
}

function DirBadge({ dir }) {
  return <Badge tone={dir === 'long' ? 'long' : 'short'} style={{ textTransform: 'capitalize' }}>
    <Icon name={dir === 'long' ? 'arrowUp' : 'arrowDown'} size={12} stroke={2.6} />
    {dir === 'long' ? 'Long' : 'Short'}
  </Badge>;
}

function MindsetBadge({ value, showLabel }) {
  const tone = value === 3 ? 'profit' : value === 2 ? 'neutral' : 'warn';
  const col = value === 3 ? 'var(--profit)' : value === 2 ? 'var(--ink-2)' : 'var(--warn)';
  return (
    <Badge tone={tone} style={{ gap: 6 }}>
      <span style={{ display: 'inline-flex', gap: 2 }}>
        {[1, 2, 3].map((i) =>
        <span key={i} style={{ width: 5, height: 5, borderRadius: 999, background: i <= value ? col : 'currentColor', opacity: i <= value ? 1 : 0.28 }} />
        )}
      </span>
      {showLabel ? window.MINDSET_LABEL[value] : value + '/3'}
    </Badge>);

}

// ---------------- Account chip ----------------
function AccountDot({ color, size = 8 }) {
  return <span style={{ width: size, height: size, borderRadius: 999, background: color, display: 'inline-block', flexShrink: 0 }} />;
}

// ---------------- Sparkline ----------------
function Sparkline({ points, width = 120, height = 36, color = 'var(--profit)', fill }) {
  if (!points || points.length < 2) return <svg width={width} height={height} />;
  const vals = points.map((p) => typeof p === 'number' ? p : p.value);
  const min = Math.min(...vals),max = Math.max(...vals);
  const range = max - min || 1;
  const stepX = width / (vals.length - 1);
  const y = (v) => height - 4 - (v - min) / range * (height - 8);
  const d = vals.map((v, i) => (i === 0 ? 'M' : 'L') + (i * stepX).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = d + ' L' + width + ' ' + height + ' L0 ' + height + ' Z';
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {fill && <path d={area} fill={color} opacity={0.08} />}
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>);

}

// ---------------- Equity area chart ----------------
function EquityChart({ data, height = 240, color = 'var(--profit)' }) {
  const ref = useRef(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals),max = Math.max(...vals);
  const range = max - min || 1;
  const padTop = 16,padBot = 26,padL = 0;
  const innerH = height - padTop - padBot;
  const stepX = (w - padL) / Math.max(1, data.length - 1);
  const y = (v) => padTop + innerH - (v - min) / range * innerH;
  const line = data.map((d, i) => (i === 0 ? 'M' : 'L') + (padL + i * stepX).toFixed(1) + ' ' + y(d.value).toFixed(1)).join(' ');
  const area = line + ' L' + (padL + (data.length - 1) * stepX).toFixed(1) + ' ' + (padTop + innerH) + ' L' + padL + ' ' + (padTop + innerH) + ' Z';
  const startVal = data[0].value,endVal = data[data.length - 1].value;
  const up = endVal >= startVal;
  const col = up ? 'var(--profit)' : 'var(--loss)';
  const gid = 'eqg_' + Math.round(min);
  function onMove(e) {
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = Math.max(0, Math.min(data.length - 1, Math.round((x - padL) / stepX)));
    setHover(i);
  }
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}
    onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg width={w} height={height} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={col} stopOpacity="0.16" />
            <stop offset="100%" stopColor={col} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) =>
        <line key={g} x1="0" x2={w} y1={padTop + innerH * g} y2={padTop + innerH * g}
        stroke="var(--border)" strokeDasharray="2 5" />
        )}
        <path d={area} fill={'url(#' + gid + ')'} />
        <path d={line} fill="none" stroke={col} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
        {hover != null &&
        <g>
            <line x1={padL + hover * stepX} x2={padL + hover * stepX} y1={padTop} y2={padTop + innerH}
          stroke="var(--ink-3)" strokeWidth="1" />
            <circle cx={padL + hover * stepX} cy={y(data[hover].value)} r="4.5" fill={col} stroke="#fff" strokeWidth="2" />
          </g>
        }
      </svg>
      {hover != null &&
      <div style={{
        position: 'absolute', top: 0, pointerEvents: 'none',
        left: Math.min(w - 150, Math.max(0, padL + hover * stepX - 60)),
        background: 'var(--ink)', color: '#fff', borderRadius: 10, padding: '7px 10px',
        fontSize: 12, lineHeight: 1.35, boxShadow: '0 6px 18px -6px rgba(0,0,0,.4)'
      }}>
          <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(data[hover].value, { signed: false })}</div>
          <div style={{ opacity: .65, fontSize: 11 }}>{new Date(data[hover].date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
        </div>
      }
    </div>);

}

// ---------------- Bars (mini) ----------------
function MiniBars({ data, height = 60, gap = 3 }) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, height, width: '100%' }}>
      {data.map((d, i) => {
        const pos = d.value >= 0;
        const h = Math.abs(d.value) / max * (height / 2 - 2);
        return (
          <div key={i} title={d.label + ': ' + fmtMoney(d.value)} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              {pos && <div style={{ width: '100%', height: h, background: 'var(--profit)', borderRadius: '3px 3px 0 0' }} />}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
              {!pos && <div style={{ width: '100%', height: h, background: 'var(--loss)', borderRadius: '0 0 3px 3px' }} />}
            </div>
          </div>);

      })}
    </div>);

}

// ---------------- Stat label ----------------
function Kpi({ label, value, sub, accent, icon }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ink-2)', fontSize: 13, fontWeight: 600 }}>
        {icon && <Icon name={icon} size={15} stroke={2} />}{label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, marginTop: 8, color: accent || 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>
        {value}
      </div>
      {sub && <div style={{ marginTop: 4, fontSize: 13 }}>{sub}</div>}
    </div>);

}

// ---------------- Chart placeholder (for trade screenshots) ----------------
function ChartPlaceholder({ height = 180, label = 'capture du graphique' }) {
  return (
    <div style={{
      height, borderRadius: 12, border: '1px dashed var(--border-strong)',
      background: 'repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 10px, transparent 10px, transparent 20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--ink-3)'
    }}>
      <Icon name="image" size={16} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{label}</span>
    </div>);

}

// ---------------- Segmented control ----------------
function Segmented({ options, value, onChange, size = 'md' }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const lbl = typeof o === 'string' ? o : o.label;
        const active = v === value;
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            border: 'none', cursor: 'pointer', borderRadius: 7,
            padding: size === 'sm' ? '5px 10px' : '7px 13px', fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit',
            background: active ? 'var(--surface)' : 'transparent',
            color: active ? 'var(--ink)' : 'var(--ink-2)',
            boxShadow: active ? '0 1px 3px rgba(20,20,18,.12)' : 'none',
            transition: 'all .15s'
          }}>{lbl}</button>);

      })}
    </div>);

}

// ---------------- Button ----------------
function Button({ children, onClick, variant = 'primary', icon, size = 'md', style, type }) {
  const [h, setH] = useState(false);
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    border: '1px solid transparent', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
    fontWeight: 600, fontSize: size === 'sm' ? 13 : 14, padding: size === 'sm' ? '8px 13px' : '11px 17px',
    transition: 'all .15s', whiteSpace: 'nowrap'
  };
  const variants = {
    primary: { background: h ? '#000' : 'var(--ink)', color: '#fff' },
    secondary: { background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--border-strong)', boxShadow: h ? '0 2px 8px -3px rgba(0,0,0,.12)' : 'none' },
    ghost: { background: h ? 'var(--surface-2)' : 'transparent', color: 'var(--ink-2)' },
    profit: { background: h ? '#1a7a4f' : 'var(--profit)', color: '#fff' },
    danger: { background: h ? '#c23c3a' : 'var(--loss)', color: '#fff' }
  };
  return (
    <button type={type || 'button'} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
    style={{ ...base, ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} stroke={2.2} />}
      {children}
    </button>);

}

Object.assign(window, {
  Icon, Card, PnL, Badge, DirBadge, MindsetBadge, AccountDot, Sparkline,
  EquityChart, MiniBars, Kpi, ChartPlaceholder, Segmented, Button
});