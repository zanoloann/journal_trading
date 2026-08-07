// modals-account.jsx — Account editor modal
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;
const { Modal, Field, inputStyle, eligible } = window;

// ---------------- Account editor ----------------
function AccountModal({ accountId, onClose }) {
  const ctx = React.useContext(window.AppCtx);
  const editing = accountId !== 'new';
  const existing = editing ? ctx.accounts.find(a => a.id === accountId) : null;
  const [f, setF] = useStateM(existing || {
    name: '', firm: '', accountTypeId: '', size: 50000, role: 'slave', coef: 2, status: 'funded',
    color: '#1f8a5b', opened: window.todayIso(),
    ddType: 'none', ddAmount: 0,
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [reval, setReval] = useStateM('');
  // Applying a firm's account type pulls its ENTIRE rule set (drawdown, DLL, inactivity, payout,
  // eval fields — whatever the type carries) into the form as a flat spread, so new rule fields
  // added to a type later show up here automatically. Only firm/accountTypeId are set otherwise.
  function applyType(firm, typeId) {
    const t = window.firmAccountTypes(firm).find(x => x.id === typeId);
    setF(p => {
      if (!t) return { ...p, firm, accountTypeId: typeId };
      const { id, label, ...rules } = t;
      return { ...p, firm, accountTypeId: typeId, ...rules };
    });
  }
  const palette = ['#1f8a5b', '#2a6fdb', '#9b6dff', '#b9802a', '#d4504e', '#1b1a17'];
  const isMaster = f.role === 'master';
  function save() {
    const instrument = isMaster ? 'MES+ES' : (f.instrument || 'MES');
    const base = { ...f, size: Number(f.size), coef: Math.max(1, Math.round(Number(f.coef)) || 1), instrument };
    base.ddType = f.ddType || 'none';
    if (base.ddType !== 'none') {
      base.ddAmount = Number(f.ddAmount) || 0;
      if (base.ddType === 'trailing') base.ddStop = (f.ddStop === '' || f.ddStop == null) ? '' : Number(f.ddStop);
    }
    base.hasDll = !!f.hasDll;
    if (f.hasDll) base.dllAmount = Number(f.dllAmount) || 0;
    base.opened = f.opened || window.todayIso();
    base.hasInactivity = !!f.hasInactivity;
    if (f.hasInactivity) {
      base.inactMinNet = Number(f.inactMinNet) || 0;
      base.inactMinQualDays = Math.max(1, Number(f.inactMinQualDays) || 1);
      base.inactWindow = Math.max(1, Number(f.inactWindow) || 1);
      base.inactCloseDays = Math.max(1, Number(f.inactCloseDays) || 30);
      base.inactDormantDays = (f.inactDormantDays === '' || f.inactDormantDays == null) ? null : Number(f.inactDormantDays);
    }
    base.hasPayout = !!f.hasPayout;
    if (f.hasPayout) {
      base.payoutModel = f.payoutModel || 'scale';
      base.payoutMinDays = Number(f.payoutMinDays) || 0;
      base.payoutMinNet = Number(f.payoutMinNet) || 0;
      if (f.payoutMinTradingDays != null) base.payoutMinTradingDays = Number(f.payoutMinTradingDays) || 0;
      base.consistencyPct = Number(f.consistencyPct) || 0;
      if (base.payoutModel === 'scale') {
        base.safetyNet = Number(f.safetyNet) || 0;
        if (f.safetyNetMaxPayouts != null) base.safetyNetMaxPayouts = Number(f.safetyNetMaxPayouts) || 0;
        base.payoutMinBalance = Number(f.payoutMinBalance) || 0;
        base.payoutMin = Number(f.payoutMin) || 0;
        base.payoutScale = Array.isArray(f.payoutScale) ? f.payoutScale : [];
        base.payoutCapExpires = !!f.payoutCapExpires;
      } else {
        base.payoutPct = Number(f.payoutPct) || 50;
        base.payoutCap = Number(f.payoutCap) || 0;
        base.requireOverallProfit = !!f.requireOverallProfit;
      }
      base.maxPayouts = Number(f.maxPayouts) || 0;
      base.payoutSplit = Number(f.payoutSplit) || 100;
      if (!editing || !existing || !existing.payouts) base.payouts = [];
    }
    base.isEval = !!f.isEval;
    if (f.isEval) {
      base.profitTarget = Number(f.profitTarget) || 0;
      base.maxLossLimit = Number(f.maxLossLimit) || 0;
      base.evalConsistencyPct = Number(f.evalConsistencyPct) || 0;
    }
    if (editing) ctx.updateAccount(accountId, base);
    else ctx.addAccount({ ...base, lastTrade: f.opened || window.todayIso() });
    onClose();
  }
  return (
    <Modal onClose={onClose} width={540}
      title={editing ? 'Modifier le compte' : 'Nouveau compte'}
      subtitle={editing ? f.name : 'Ajoutez un compte pour commencer à enregistrer vos trades'}
      footer={<><window.Button variant="ghost" onClick={onClose}>Annuler</window.Button><window.Button variant="primary" icon="check" onClick={save}>{editing ? 'Enregistrer' : 'Créer le compte'}</window.Button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Nom du compte"><input style={inputStyle} value={f.name} onChange={e => set('name', e.target.value)} placeholder="ex. PA-04" /></Field>
        <Field label="Prop firm" hint={f.firm ? ('Frais : ' + window.fmtNum(window.feeFor(f.firm, 'MES'), 2) + ' $/contrat') : 'Gérées dans Paramètres'}>
          <select style={inputStyle} value={f.firm || ''} onChange={e => applyType(e.target.value, '')}>
            <option value="" disabled>Choisir une prop firm…</option>
            {window.listPropfirms().map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Type de compte" hint={f.firm ? "Définit taille, drawdown, DLL, inactivité et payout" : 'Choisissez d\'abord la prop firm'}>
          {(() => {
            const types = f.firm ? window.firmAccountTypes(f.firm) : [];
            return (
              <select style={inputStyle} value={f.accountTypeId || ''} disabled={!f.firm} onChange={e => applyType(f.firm, e.target.value)}>
                <option value="">{types.length ? 'Choisir un type…' : 'Aucun type défini'}</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.label || 'Sans nom'} · {window.fmtMoney(t.size || 0, { signed: false })}</option>)}
              </select>
            );
          })()}
        </Field>
        {!isMaster && (
          <Field label="Coefficient de copie" hint="Entier — multiplie les positions du maître">
            <input type="number" step="1" min="1" style={inputStyle} value={f.coef} onChange={e => set('coef', e.target.value)} />
          </Field>
        )}
        <Field label="Taille du compte ($)"><input type="number" step="5000" style={inputStyle} value={f.size} onChange={e => set('size', e.target.value)} /></Field>
        <Field label="Date d'ouverture" hint="Point de départ de la règle d'inactivité"><input type="date" style={inputStyle} value={f.opened || ''} onChange={e => set('opened', e.target.value)} /></Field>
      </div>

      {/* Account-level drawdown — read-only summary (configured in Paramètres, per account type) */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}><window.Icon name="stats" size={16} /> Drawdown maximum</div>
        {(f.ddType === 'trailing') ? (
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.6 }}>
            Suiveur · {window.fmtMoney(Number(f.ddAmount) || 0, { signed: false })} sous le pic{f.ddStop ? ', se fige à ' + window.fmtMoney(Number(f.ddStop), { signed: false }) : ''}.
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>Défini par le type de compte (modifiable dans Paramètres).</div>
          </div>
        ) : (f.ddType === 'static') ? (
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.6 }}>
            Statique · {window.fmtMoney(Number(f.ddAmount) || 0, { signed: false })} sous le capital initial.
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>Défini par le type de compte (modifiable dans Paramètres).</div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8 }}>Aucun drawdown maximum pour ce type de compte.</div>
        )}
      </div>

      {/* daily loss limit — read-only summary */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}><window.Icon name="alert" size={16} /> Perte journalière max. (DLL)</div>
        {f.hasDll ? (
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.6 }}>
            {window.fmtMoney(Number(f.dllAmount) || 0, { signed: false })} net par jour · coupe la séance en cours, reset le lendemain.
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>Défini par le type de compte (modifiable dans Paramètres).</div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8 }}>Aucune limite de perte journalière pour ce type de compte.</div>
        )}
      </div>

      {/* inactivity rule — read-only summary (configured in Paramètres, per account type) */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
          <window.Icon name="calendar" size={16} /> Règle d'inactivité
        </div>
        {f.hasInactivity ? (
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.6 }}>
            Minimum <strong>{f.inactMinQualDays}</strong> journée(s) à <strong>{window.fmtMoney(Number(f.inactMinNet) || 0, { signed: false })}</strong> net sur <strong>{f.inactWindow}</strong> jours glissants.
            {f.inactDormantDays ? <> Statut dormant dès <strong>{f.inactDormantDays} j</strong> sans activité qualifiante,</> : ''} clôture après <strong>{f.inactCloseDays} j</strong>.
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>Définie par le type de compte (modifiable dans Paramètres).</div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8 }}>Aucune règle d'inactivité pour ce type de compte.</div>
        )}
      </div>

      {f.isEval && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: 'var(--info-bg)', border: '1px solid color-mix(in oklab, var(--info) 25%, transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5, color: 'var(--info)' }}><window.Icon name="target" size={16} /> Compte d'évaluation</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.6 }}>
            Objectif de profit <strong>{window.fmtMoney(Number(f.profitTarget) || 0, { signed: false })}</strong> · perte max <strong>{window.fmtMoney(Number(f.maxLossLimit) || 0, { signed: false })}</strong> · consistance &lt; <strong>{f.evalConsistencyPct} %</strong>.
            {(f.sizeCapMini || f.sizeCapMicro) && <div style={{ marginTop: 4 }}>Taille max : {f.sizeCapMini ? f.sizeCapMini + ' mini' : ''}{f.sizeCapMini && f.sizeCapMicro ? ' / ' : ''}{f.sizeCapMicro ? f.sizeCapMicro + ' micros' : ''}</div>}
          </div>
        </div>
      )}

      {editing && existing && (() => {
        const currentBal = window.accountBalance(existing, ctx.trades);
        const adjustments = (existing.adjustments || []).slice().reverse();
        const newBal = reval === '' ? null : Number(reval);
        const delta = newBal == null || isNaN(newBal) ? 0 : +(newBal - currentBal).toFixed(2);
        function doReval() {
          if (newBal == null || isNaN(newBal) || delta === 0) return;
          ctx.confirm({
            title: 'Réévaluer le capital ?',
            message: 'Le solde de « ' + (existing.name || 'ce compte') + ' » passera de ' + window.fmtMoney(currentBal, { signed: false }) + ' à ' + window.fmtMoney(newBal, { signed: false }) + ' (ajustement de ' + window.fmtMoney(delta) + '). Un mouvement « Réévaluation capital » sera ajouté à l\'historique.',
            confirmLabel: 'Réévaluer', danger: false,
            onConfirm: () => { ctx.adjustAccount(accountId, { id: 'adj' + Date.now(), date: window.todayIso(), label: 'Réévaluation capital', delta, target: +newBal.toFixed(2), pnlAt: +window.accountTradePnl(existing, ctx.trades).toFixed(2), balanceAfter: +newBal.toFixed(2) }); setReval(''); },
          });
        }
        return (
          <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}><window.Icon name="wallet" size={16} /> Capital du compte</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Solde actuel <strong style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>{window.fmtMoney(currentBal, { signed: false })}</strong></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
              <Field label="Nouveau solde réel ($)" hint="Pour coller au montant exact affiché par la prop firm">
                <input type="number" step="0.01" style={inputStyle} value={reval} onChange={e => setReval(e.target.value)} placeholder={String(Math.round(currentBal))} />
              </Field>
              <window.Button variant="secondary" icon="edit" onClick={doReval} style={{ opacity: (newBal != null && !isNaN(newBal) && delta !== 0) ? 1 : .5, pointerEvents: (newBal != null && !isNaN(newBal) && delta !== 0) ? 'auto' : 'none', height: 42 }}>Réévaluer</window.Button>
            </div>
            {newBal != null && !isNaN(newBal) && delta !== 0 && (
              <div style={{ fontSize: 12, marginTop: 8, color: 'var(--ink-2)' }}>Ajustement : <window.PnL value={delta} dec={2} style={{ fontWeight: 700 }} /></div>
            )}

            {adjustments.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>Historique des réévaluations</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {adjustments.map(adj => (
                    <div key={adj.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 10, alignItems: 'center', padding: '8px 12px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{window.fmtDateFR(adj.date)}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{adj.label}</span>
                      <window.PnL value={adj.delta} dec={2} style={{ fontSize: 12.5, fontWeight: 700 }} />
                      <button className="tj-iconbtn tj-del" style={{ width: 26, height: 26 }} title="Supprimer" onClick={() => ctx.confirm({ title: 'Supprimer cet ajustement ?', message: 'Le mouvement de ' + window.fmtMoney(adj.delta) + ' du ' + window.fmtDateFR(adj.date) + ' sera retiré du solde.', confirmLabel: 'Supprimer', onConfirm: () => ctx.deleteAdjustment(accountId, adj.id) })}><window.Icon name="trash" size={13} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>Couleur</div>
        <div style={{ display: 'flex', gap: 9 }}>
          {palette.map(c => (
            <button key={c} onClick={() => set('color', c)} style={{ width: 30, height: 30, borderRadius: 9, background: c, border: f.color === c ? '2px solid var(--ink)' : '2px solid transparent', outline: f.color === c ? '2px solid var(--surface)' : 'none', cursor: 'pointer' }} />
          ))}
        </div>
      </div>
    </Modal>
  );
}

Object.assign(window, { AccountModal });
