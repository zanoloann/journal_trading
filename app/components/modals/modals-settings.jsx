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
    types.push({
      id: 'at_' + Date.now(), label: '', size: 50000,
      ddType: 'trailing', ddAmount: 2000, ddStop: '',
      hasDll: false, dllAmount: 1000,
      hasInactivity: false, inactMinNet: 50, inactMinQualDays: 2, inactWindow: 30, inactDormantDays: '', inactCloseDays: 30,
      hasPayout: false, payoutModel: 'scale',
      payoutMinDays: 5, payoutMinNet: 250, payoutMinTradingDays: '', consistencyPct: 50,
      safetyNet: '', safetyNetMaxPayouts: '', payoutMinBalance: '', payoutMin: 500,
      maxPayouts: 6, payoutScale: [], payoutCapExpires: false, payoutSplit: 100,
      payoutPct: 50, payoutCap: '', requireOverallProfit: false,
      isEval: false, profitTarget: '', maxLossLimit: '', evalConsistencyPct: 50, sizeCapMini: '', sizeCapMicro: '',
      activationFee: '',
    });
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

  function Toggle({ label, on, onClick }) {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <button type="button" onClick={onClick}
          style={{ width: 20, height: 20, borderRadius: 6, border: '1.5px solid ' + (on ? 'var(--ink)' : 'var(--border-strong)'), background: on ? 'var(--ink)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          {on && <window.Icon name="check" size={13} stroke={3} />}
        </button>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      </label>
    );
  }

  function NumField({ label, value, onCommit, step, width }) {
    return (
      <label style={{ display: 'block' }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>{label}</div>
        <input type="number" step={step || 1} defaultValue={value} onBlur={e => onCommit(e.target.value === '' ? '' : Number(e.target.value))}
          style={{ ...inS, width: width || '100%' }} />
      </label>
    );
  }

  function TypeEditor({ firm, t }) {
    const [unlocked, setUnlocked] = useStateSet(!t.label);
    const patch = (p) => updateType(firm, t.id, p);
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
            <span style={{ fontWeight: 700, fontSize: 14 }}>{t.label || 'Sans nom'}{t.isEval && <window.Badge tone="info" style={{ fontSize: 10, marginLeft: 7 }}>Éval</window.Badge>}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <window.Button size="sm" variant="secondary" icon="edit" onClick={() => setUnlocked(true)}>Modifier</window.Button>
              <button className="tj-iconbtn tj-del" style={{ width: 34, height: 34 }} title="Supprimer ce type" onClick={() => removeType(firm, t.id)}><window.Icon name="trash" size={15} /></button>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            {summaryRow('Taille', window.fmtMoney(t.size || 0, { signed: false }))}
            {summaryRow('Drawdown', t.ddType && t.ddType !== 'none' ? ((t.ddType === 'trailing' ? 'Suiveur ' : 'Statique ') + window.fmtMoney(Number(t.ddAmount) || 0, { signed: false }) + (t.ddStop ? ' · fige à ' + window.fmtMoney(Number(t.ddStop), { signed: false }) : '')) : '—')}
            {summaryRow('Perte journalière (DLL)', t.hasDll ? window.fmtMoney(Number(t.dllAmount) || 0, { signed: false }) + '/jour' : 'Aucune')}
            {summaryRow("Règle d'inactivité", t.hasInactivity ? (t.inactMinQualDays + ' j à ' + window.fmtMoney(Number(t.inactMinNet) || 0, { signed: false }) + ' sur ' + t.inactWindow + ' j · clôture ' + t.inactCloseDays + ' j') : 'Aucune')}
            {summaryRow('Règle de payout', t.hasPayout ? (t.payoutModel === 'pctCapped'
              ? (t.payoutPct + ' % du profit, plafond ' + window.fmtMoney(Number(t.payoutCap) || 0, { signed: false }))
              : (t.payoutMinDays + ' j à ' + window.fmtMoney(Number(t.payoutMinNet) || 0, { signed: false }) + ' · solde min. ' + window.fmtMoney(Number(t.payoutMinBalance) || 0, { signed: false }))) : 'Aucune')}
            {t.isEval && summaryRow('Objectif éval.', window.fmtMoney(Number(t.profitTarget) || 0, { signed: false }) + ' (perte max ' + window.fmtMoney(Number(t.maxLossLimit) || 0, { signed: false }) + ')')}
            {t.activationFee ? summaryRow('Frais activation', window.fmtMoney(Number(t.activationFee) || 0, { signed: false }) + ' (une fois)') : null}
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: 14, borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--ink)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Nom du type</div>
            <input defaultValue={t.label} placeholder="ex. 50K EOD" onBlur={e => patch({ label: e.target.value })} style={{ ...inS, width: '100%' }} />
          </label>
          <NumField label="Taille ($)" value={t.size} step={5000} onCommit={v => patch({ size: v || 0 })} />
          <button className="tj-iconbtn tj-del" style={{ width: 34, height: 34 }} title="Supprimer ce type" onClick={() => removeType(firm, t.id)}><window.Icon name="trash" size={15} /></button>
        </div>

        {/* drawdown */}
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Drawdown maximum</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Type</div>
              <select defaultValue={t.ddType || 'none'} onChange={e => patch({ ddType: e.target.value })} style={{ ...inS, width: '100%' }}>
                <option value="none">Aucun</option>
                <option value="trailing">Suiveur</option>
                <option value="static">Statique</option>
              </select>
            </label>
            <NumField label="Montant ($)" value={t.ddAmount} step={100} onCommit={v => patch({ ddAmount: v || 0 })} />
            <NumField label="Se fige à ($, vide = illimité)" value={t.ddStop} step={100} onCommit={v => patch({ ddStop: v })} />
          </div>
        </div>

        {/* DLL */}
        <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}>
          <Toggle label="Limite de perte journalière (DLL)" on={!!t.hasDll} onClick={() => patch({ hasDll: !t.hasDll })} />
          {t.hasDll && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', marginTop: 10 }}>
              <span>Max</span>
              <input type="number" step="50" defaultValue={t.dllAmount} onBlur={e => patch({ dllAmount: Number(e.target.value) || 0 })} style={{ ...inS, width: 80, textAlign: 'center' }} />
              <span>$ de perte nette par jour · coupe la séance, reset le lendemain.</span>
            </div>
          )}
        </div>

        {/* inactivity rule */}
        <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}>
          <Toggle label="Règle d'inactivité" on={!!t.hasInactivity} onClick={() => patch({ hasInactivity: !t.hasInactivity })} />
          {t.hasInactivity && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--ink-2)' }}>
                <span>Min.</span>
                <input type="number" min="1" defaultValue={t.inactMinQualDays} onBlur={e => patch({ inactMinQualDays: Number(e.target.value) || 1 })} style={{ ...inS, width: 56, textAlign: 'center' }} />
                <span>j à</span>
                <input type="number" step="10" defaultValue={t.inactMinNet} onBlur={e => patch({ inactMinNet: Number(e.target.value) || 0 })} style={{ ...inS, width: 70, textAlign: 'center' }} />
                <span>$ net sur</span>
                <input type="number" min="1" defaultValue={t.inactWindow} onBlur={e => patch({ inactWindow: Number(e.target.value) || 1 })} style={{ ...inS, width: 56, textAlign: 'center' }} />
                <span>j glissants.</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <NumField label="Statut dormant après (j, vide = pas d'étape)" value={t.inactDormantDays} onCommit={v => patch({ inactDormantDays: v })} />
                <NumField label="Clôture définitive après (j)" value={t.inactCloseDays} onCommit={v => patch({ inactCloseDays: v || 30 })} />
              </div>
            </div>
          )}
        </div>

        {/* payout rule */}
        <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}>
          <Toggle label="Règle de payout" on={!!t.hasPayout} onClick={() => patch({ hasPayout: !t.hasPayout })} />
          {t.hasPayout && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: 2, width: 'fit-content' }}>
                {[['scale', 'Échelle progressive'], ['pctCapped', '% du profit plafonné']].map(([v, lbl]) => (
                  <button key={v} onClick={() => patch({ payoutModel: v })} style={{ border: 'none', cursor: 'pointer', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: (t.payoutModel || 'scale') === v ? 'var(--ink)' : 'transparent', color: (t.payoutModel || 'scale') === v ? '#fff' : 'var(--ink-2)' }}>{lbl}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--ink-2)' }}>
                <span>Min.</span>
                <input type="number" min="1" defaultValue={t.payoutMinDays} onBlur={e => patch({ payoutMinDays: Number(e.target.value) || 0 })} style={{ ...inS, width: 52, textAlign: 'center' }} />
                <span>jours qualifiants à</span>
                <input type="number" step="10" defaultValue={t.payoutMinNet} onBlur={e => patch({ payoutMinNet: Number(e.target.value) || 0 })} style={{ ...inS, width: 70, textAlign: 'center' }} />
                <span>$ net (depuis le dernier payout).</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <NumField label="Jours de trading min. (total, optionnel)" value={t.payoutMinTradingDays} onCommit={v => patch({ payoutMinTradingDays: v })} />
                <NumField label="Consistance (%, 0 = désactivée)" value={t.consistencyPct} step={5} onCommit={v => patch({ consistencyPct: v || 0 })} />
                <NumField label="Nombre max de payouts" value={t.maxPayouts} onCommit={v => patch({ maxPayouts: v || 0 })} />
                <NumField label="Split (%)" value={t.payoutSplit} step={5} onCommit={v => patch({ payoutSplit: v || 100 })} />
              </div>

              {(t.payoutModel || 'scale') === 'scale' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <NumField label="Filet de sécurité ($)" value={t.safetyNet} step={100} onCommit={v => patch({ safetyNet: v || 0 })} />
                    <NumField label="Filet applicable aux N premiers payouts (vide = toujours)" value={t.safetyNetMaxPayouts} onCommit={v => patch({ safetyNetMaxPayouts: v })} />
                    <NumField label="Solde min. pour demander ($)" value={t.payoutMinBalance} step={100} onCommit={v => patch({ payoutMinBalance: v || 0 })} />
                    <NumField label="Payout minimum ($)" value={t.payoutMin} step={50} onCommit={v => patch({ payoutMin: v || 0 })} />
                  </div>
                  <label style={{ display: 'block' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Échelle des plafonds ($, séparés par des virgules)</div>
                    <input defaultValue={(t.payoutScale || []).join(', ')} placeholder="ex. 1500, 1500, 2000, 2500, 2500, 3000"
                      onBlur={e => patch({ payoutScale: e.target.value.split(',').map(x => Number(x.trim())).filter(x => !isNaN(x)) })}
                      style={{ ...inS, width: '100%' }} />
                  </label>
                  <Toggle label="L'échelle expire (plus aucun plafond une fois épuisée, au lieu de répéter le dernier)" on={!!t.payoutCapExpires} onClick={() => patch({ payoutCapExpires: !t.payoutCapExpires })} />
                  <label style={{ display: 'block' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Note sur le split (optionnel, affichée telle quelle)</div>
                    <input defaultValue={t.payoutSplitNote || ''} placeholder="ex. 100 % sur les 25 000 $ premiers, puis 90 %…"
                      onBlur={e => patch({ payoutSplitNote: e.target.value })} style={{ ...inS, width: '100%' }} />
                  </label>
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <NumField label="% du profit versé" value={t.payoutPct} step={5} onCommit={v => patch({ payoutPct: v || 50 })} />
                    <NumField label="Plafond fixe ($)" value={t.payoutCap} step={100} onCommit={v => patch({ payoutCap: v || 0 })} />
                  </div>
                  <Toggle label="Exige un profit net positif sur l'ensemble du cycle" on={!!t.requireOverallProfit} onClick={() => patch({ requireOverallProfit: !t.requireOverallProfit })} />
                </>
              )}
            </div>
          )}
        </div>

        {/* eval-only fields */}
        <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}>
          <Toggle label="Compte d'évaluation (pas encore financé)" on={!!t.isEval} onClick={() => patch({ isEval: !t.isEval })} />
          {t.isEval && (
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label="Objectif de profit ($)" value={t.profitTarget} step={100} onCommit={v => patch({ profitTarget: v || 0 })} />
              <NumField label="Perte maximum ($)" value={t.maxLossLimit} step={100} onCommit={v => patch({ maxLossLimit: v || 0 })} />
              <NumField label="Consistance (%, 0 = désactivée)" value={t.evalConsistencyPct} step={5} onCommit={v => patch({ evalConsistencyPct: v || 0 })} />
              <div />
              <NumField label="Taille max (mini)" value={t.sizeCapMini} onCommit={v => patch({ sizeCapMini: v })} />
              <NumField label="Taille max (micros)" value={t.sizeCapMicro} onCommit={v => patch({ sizeCapMicro: v })} />
            </div>
          )}
        </div>

        <div style={{ marginTop: 10 }}>
          <NumField label="Frais d'activation, une fois (ex. PA Apex, optionnel)" value={t.activationFee} step={10} onCommit={v => patch({ activationFee: v })} width={180} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <window.Button size="sm" variant="primary" icon="check" onClick={() => setUnlocked(false)}>Terminé</window.Button>
        </div>
      </div>
    );
  }

  return (
    <Modal onClose={onClose} width={680} title="Paramètres" subtitle="Prop firms : frais du broker et types de comptes"
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
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>Les frais du broker ne changent pas ; les règles ci-dessous dépendent de la prop firm et peuvent évoluer. Modifier une règle met à jour tous les comptes existants de ce type.</div>
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
