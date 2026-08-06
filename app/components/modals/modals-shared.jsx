// modals.jsx — add trade, trade detail, account editor
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;

function Modal({ children, onClose, width = 560, title, subtitle, footer }) {
  useEffectM(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, []);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(20,20,18,.42)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 20px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} className="tj-modal" style={{ background: 'var(--surface)', borderRadius: 18, width: '100%', maxWidth: width, boxShadow: '0 24px 70px -20px rgba(20,20,18,.45)', border: '1px solid var(--border)' }}>
        {title && (
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>{title}</h2>
              {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--ink-3)' }}>{subtitle}</p>}
            </div>
            <button className="tj-iconbtn" onClick={onClose}><window.Icon name="close" size={18} /></button>
          </div>
        )}
        <div style={{ padding: 24 }}>{children}</div>
        {footer && <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label style={{ display: 'block' }}>
      {label && <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>{label}</div>}
      {children}
      {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{hint}</div>}
    </label>
  );
}
const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', background: 'var(--surface-2)', color: 'var(--ink)', boxSizing: 'border-box' };

function eligible(a, symbol) {
  if (a.role === 'master') return true;
  return symbol === 'MES' ? a.instrument === 'MES' : a.instrument === 'ES';
}

Object.assign(window, { Modal, Field, inputStyle, eligible });
