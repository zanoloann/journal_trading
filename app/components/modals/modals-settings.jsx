// modals-settings.jsx — Paramètres : prop firms + their account types & rules
const { useState: useStateSet } = React;

function SettingsModal({ onClose }) {
  const ctx = React.useContext(window.AppCtx);
  const [firms, setFirms] = useStateSet(() => window.getPropfirms());
  const [expanded, setExpanded] = useStateSet(null); // firm name whose account types are open
  const [adding, setAdding] = useStateSet(false);
  const [nf, setNf] = useStateSet({ name: '', fee: '' });

  const refresh = () => setFirms(window.getPropfirms());
  const inS = { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)', boxSizing: 'border-box' };

  function commitFee(name, val) { window.setFirmFee(name, 'MES', val); refresh(); }
  function addFirm() {
    const nm = nf.name.trim(); const fee = Number(nf.fee);
    if (!nm || isNaN(fee)) return;
    window.addPropfirm(nm, { MES: fee }, []);
    setNf({ name: '', fee: '' }); setAdding(false); setExpanded(nm); refresh();
  }
  function removeFirm(name) {
    ctx.confirm({ title: 'Supprimer « ' + name + ' » ?', message: 'La prop firm et ses types de comptes seront retirés. Vos comptes et trades existants ne sont pas modifiés.', confirmLabel: 'Supprimer', danger: true,
      onConfirm: () => { window.removePropfirm(name); refresh(); } });
  }

  // ---- account types ----
  function addType(firm) {
    const types = window.firmAccountTypes(firm).slice();
    types.push({ id: 'at_' + Date.now(), label: '', size: 50000, eod: '', target: '', ddType: 'trailing', ddAmount: '', ddStop: '', hasInactivity: false, inactMinDays: 2, inactMinNet: 50, inactWindow: 30,
      hasPayout: false, payoutMinDays: 5, payoutMinNet: 250, safetyNet: '', payoutMinBalance: '', payoutMin: 500, consistencyPct: 50, maxPayouts: 6, payoutScale: [], payoutSplit: 100 });
    window.setFirmAccountTypes(firm, types); refresh();
  }
  function updateType(firm, id, patch) {
    const types = window.firmAccountTypes(firm).map(t => t.id === id ? { ...t, ...patch } : t);
    window.setFirmAccountTypes(firm, types); refresh();
    ctx.resyncAccountsToType(firm, id);
  }
  function removeType(firm, id) {
    window.setFirmAccountTypes(firm, window.firmAccountTypes(firm).filter(t => t.id !== id)); refresh();
  }

  function TypeEditor({ firm, t }) {
    const [unlocked, setUnlocked] = useStateSet(!t.label);
    const summaryRow = (label, value) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', fontSize: 12.5 }}>
        <span style={{ color: 'var(--ink-3)' }}>{label}</span>
        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{value}</span>
      </div>
    );

    if (!unlocked) {
      return (
        <div style={{ padding: 14, borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{t.label || 'Sans nom'}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <window.Button size="sm" variant="secondary" icon="edit" onClick={() => setUnlocked(true)}>Modifier</window.Button>
              <button className="tj-iconbtn tj-del" style={{ width: 34, height: 34 }} title="Supprimer ce type" onClick={() => removeType(firm, t.id)}><window.Icon name="trash" size={15} /></button>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            {summaryRow('Taille', window.fmtMoney(t.size || 0, { signed: false }))}
            {summaryRow('EOD / DD jour', t.eod !== '' && t.eod != null ? window.fmtMoney(Number(t.eod), { signed: false }) + (t.ddStop ? ' · fige à ' + window.fmtMoney(Number(t.ddStop), { signed: false }) : '') : '—')}
            {summaryRow('Objectif', t.target !== '' && t.target != null ? window.fmtMoney(Number(t.target), { signed: false }) : '—')}
            {summaryRow("Règle d'inactivité", t.hasInactivity ? (t.inactMinDays + ' j à ' + window.fmtMoney(Number(t.inactMinNet) || 0, { signed: false }) + ' sur ' + t.inactWindow + ' j') : 'Aucune')}
            {summaryRow('Règle de payout', t.hasPayout ? (t.payoutMinDays + ' j à ' + window.fmtMoney(Number(t.payoutMinNet) || 0, { signed: false }) + ' · min. solde ' + window.fmtMoney(Number(t.payoutMinBalance) || 0, { signed: false }) + (t.safetyNetMaxPayouts ? ' · filet 1ers ' + t.safetyNetMaxPayouts + ' payouts' : '')) : 'Aucune')}
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: 14, borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--ink)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Nom du type</div>
            <input defaultValue={t.label} placeholder="ex. 50K" onBlur={e => updateType(firm, t.id, { label: e.target.value })} style={{ ...inS, width: '100%' }} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Taille ($)</div>
            <input type="number" step="5000" defaultValue={t.size} onBlur={e => updateType(firm, t.id, { size: Number(e.target.value) })} style={{ ...inS, width: '100%' }} />
          </label>
          <button className="tj-iconbtn tj-del" style={{ width: 34, height: 34 }} title="Supprimer ce type" onClick={() => removeType(firm, t.id)}><window.Icon name="trash" size={15} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>EOD / DD jour ($)</div>
            <input type="number" step="100" defaultValue={t.eod} onBlur={e => updateType(firm, t.id, { eod: Number(e.target.value), ddAmount: Number(e.target.value) })} style={{ ...inS, width: '100%' }} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>DD se fige à ($)</div>
            <input type="number" step="100" defaultValue={t.ddStop} onBlur={e => updateType(firm, t.id, { ddStop: Number(e.target.value) })} style={{ ...inS, width: '100%' }} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Objectif ($)</div>
            <input type="number" step="500" defaultValue={t.target} onBlur={e => updateType(firm, t.id, { target: Number(e.target.value) })} style={{ ...inS, width: '100%' }} />
          </label>
        </div>

        {/* inactivity rule */}
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <button type="button" onClick={() => updateType(firm, t.id, { hasInactivity: !t.hasInactivity })}
              style={{ width: 20, height: 20, borderRadius: 6, border: '1.5px solid ' + (t.hasInactivity ? 'var(--ink)' : 'var(--border-strong)'), background: t.hasInactivity ? 'var(--ink)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              {t.hasInactivity && <window.Icon name="check" size={13} stroke={3} />}
            </button>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Règle d'inactivité</span>
          </label>
          {t.hasInactivity && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--ink-2)', marginTop: 10 }}>
              <span>Min.</span>
              <input type="number" min="1" defaultValue={t.inactMinDays} onBlur={e => updateType(firm, t.id, { inactMinDays: Number(e.target.value) })} style={{ ...inS, width: 56, textAlign: 'center' }} />
              <span>j à</span>
              <input type="number" step="10" defaultValue={t.inactMinNet} onBlur={e => updateType(firm, t.id, { inactMinNet: Number(e.target.value) })} style={{ ...inS, width: 70, textAlign: 'center' }} />
              <span>$ net sur</span>
              <input type="number" min="1" defaultValue={t.inactWindow} onBlur={e => updateType(firm, t.id, { inactWindow: Number(e.target.value) })} style={{ ...inS, width: 56, textAlign: 'center' }} />
              <span>j glissants.</span>
            </div>
          )}
        </div>

        {/* payout rule */}
        <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <button type="button" onClick={() => updateType(firm, t.id, { hasPayout: !t.hasPayout })}
              style={{ width: 20, height: 20, borderRadius: 6, border: '1.5px solid ' + (t.hasPayout ? 'var(--ink)' : 'var(--border-strong)'), background: t.hasPayout ? 'var(--ink)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              {t.hasPayout && <window.Icon name="check" size={13} stroke={3} />}
            </button>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Règle de payout</span>
          </label>
          {t.hasPayout && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--ink-2)' }}>
                <span>Min.</span>
                <input type="number" min="1" defaultValue={t.payoutMinDays} onBlur={e => updateType(firm, t.id, { payoutMinDays: Number(e.target.value) })} style={{ ...inS, width: 52, textAlign: 'center' }} />
                <span>jours qualifiants à</span>
                <input type="number" step="10" defaultValue={t.payoutMinNet} onBlur={e => updateType(firm, t.id, { payoutMinNet: Number(e.target.value) })} style={{ ...inS, width: 70, textAlign: 'center' }} />
                <span>$ net (depuis le dernier payout).</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Filet de sécurité ($)</div>
                  <input type="number" step="100" defaultValue={t.safetyNet} onBlur={e => updateType(firm, t.id, { safetyNet: Number(e.target.value) })} style={{ ...inS, width: '100%' }} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Filet applicable aux N premiers payouts</div>
                  <input type="number" step="1" min="0" placeholder="ex. 3 (vide = toujours)" defaultValue={t.safetyNetMaxPayouts} onBlur={e => updateType(firm, t.id, { safetyNetMaxPayouts: e.target.value === '' ? '' : Number(e.target.value) })} style={{ ...inS, width: '100%' }} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Solde min. pour demander ($)</div>
                  <input type="number" step="100" defaultValue={t.payoutMinBalance} onBlur={e => updateType(firm, t.id, { payoutMinBalance: Number(e.target.value) })} style={{ ...inS, width: '100%' }} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Payout minimum ($)</div>
                  <input type="number" step="50" defaultValue={t.payoutMin} onBlur={e => updateType(firm, t.id, { payoutMin: Number(e.target.value) })} style={{ ...inS, width: '100%' }} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Consistance (%)</div>
                  <input type="number" step="5" defaultValue={t.consistencyPct} onBlur={e => updateType(firm, t.id, { consistencyPct: Number(e.target.value) })} style={{ ...inS, width: '100%' }} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Nombre max de payouts</div>
                  <input type="number" step="1" defaultValue={t.maxPayouts} onBlur={e => updateType(firm, t.id, { maxPayouts: Number(e.target.value) })} style={{ ...inS, width: '100%' }} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Split (%)</div>
                  <input type="number" step="5" defaultValue={t.payoutSplit} onBlur={e => updateType(firm, t.id, { payoutSplit: Number(e.target.value) })} style={{ ...inS, width: '100%' }} />
                </label>
              </div>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Échelle des plafonds ($, séparés par des virgules)</div>
                <input defaultValue={(t.payoutScale || []).join(', ')} placeholder="ex. 1500, 1500, 2000, 2500, 2500, 3000"
                  onBlur={e => updateType(firm, t.id, { payoutScale: e.target.value.split(',').map(x => Number(x.trim())).filter(x => !isNaN(x)) })}
                  style={{ ...inS, width: '100%' }} />
              </label>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <window.Button size="sm" variant="primary" icon="check" onClick={() => setUnlocked(false)}>Terminé</window.Button>
        </div>
      </div>
    );
  }

  return (
    <Modal onClose={onClose} width={620} title="Paramètres" subtitle="Prop firms : frais du broker et types de comptes"
      footer={<window.Button variant="secondary" onClick={onClose}>Fermer</window.Button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {firms.map(fm => {
          const open = expanded === fm.name;
          return (
            <div key={fm.name} style={{ borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'center', padding: '12px 14px' }}>
                <button onClick={() => setExpanded(open ? null : fm.name)} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left', minWidth: 0 }}>
                  <window.Icon name={open ? 'chevD' : 'chevR'} size={15} style={{ color: 'var(--ink-3)' }} />
                  <span style={{ fontWeight: 700, fontSize: 14.5 }}>{fm.name}</span>
                  {window.isDefaultFirm(fm.name) && <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}>par défaut</span>}
                  <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>· {(fm.accountTypes || []).length} type{(fm.accountTypes || []).length > 1 ? 's' : ''}</span>
                </button>
                <input type="number" step="0.01" min="0" defaultValue={fm.fees.MES != null ? fm.fees.MES : ''} onBlur={e => commitFee(fm.name, e.target.value)}
                  style={{ ...inS, width: 84, textAlign: 'right' }} title="Frais broker par contrat (aller-retour)" />
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>$/contrat</span>
                {window.isDefaultFirm(fm.name)
                  ? <span style={{ width: 30 }} />
                  : <button className="tj-iconbtn tj-del" style={{ width: 30, height: 30 }} title="Supprimer" onClick={() => removeFirm(fm.name)}><window.Icon name="trash" size={14} /></button>}
              </div>

              {open && (
                <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>Les frais du broker ne changent pas ; les règles ci-dessous dépendent de la prop firm et peuvent évoluer.</div>
                  {(fm.accountTypes || []).map(t => <TypeEditor key={t.id} firm={fm.name} t={t} />)}
                  <button className="tj-addslave" onClick={() => addType(fm.name)}><window.Icon name="plus" size={15} /> Ajouter un type de compte</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!adding ? (
        <button className="tj-addslave" style={{ marginTop: 12 }} onClick={() => setAdding(true)}><window.Icon name="plus" size={15} /> Ajouter une prop firm</button>
      ) : (
        <div style={{ marginTop: 12, padding: 14, borderRadius: 11, border: '1px dashed var(--border-strong)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>Nouvelle prop firm</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto auto', gap: 10, alignItems: 'center' }}>
            <input placeholder="Nom (ex. Topstep)" value={nf.name} onChange={e => setNf(p => ({ ...p, name: e.target.value }))} style={{ ...inS }} />
            <input type="number" step="0.01" min="0" placeholder="$/contrat" value={nf.fee} onChange={e => setNf(p => ({ ...p, fee: e.target.value }))} style={{ ...inS, textAlign: 'right' }} />
            <window.Button size="sm" icon="check" onClick={addFirm} style={{ opacity: (nf.name.trim() && nf.fee !== '' && !isNaN(Number(nf.fee))) ? 1 : .5, pointerEvents: (nf.name.trim() && nf.fee !== '' && !isNaN(Number(nf.fee))) ? 'auto' : 'none' }}>Créer</window.Button>
            <window.Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNf({ name: '', fee: '' }); }}>Annuler</window.Button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8 }}>Vous pourrez ensuite ajouter ses types de comptes et leurs règles.</div>
        </div>
      )}
    </Modal>
  );
}

window.SettingsModal = SettingsModal;
