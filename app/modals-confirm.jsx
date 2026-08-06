// modals-confirm.jsx — Confirm dialog
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;
const { Modal, Field, inputStyle, eligible } = window;

// ---------------- Confirm dialog ----------------
function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose, danger = true }) {
  useEffectM(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(20,20,18,.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 24px 70px -20px rgba(20,20,18,.5)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: danger ? 'var(--loss-bg)' : 'var(--info-bg)', color: danger ? 'var(--loss)' : 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><window.Icon name={danger ? 'alert' : 'crown'} size={19} /></div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600 }}>{title}</h2>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.55, color: 'var(--ink-2)' }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <window.Button variant="ghost" onClick={onClose}>Annuler</window.Button>
          <window.Button variant={danger ? 'danger' : 'primary'} icon={danger ? 'trash' : 'check'} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel || 'Supprimer'}</window.Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ConfirmDialog });
