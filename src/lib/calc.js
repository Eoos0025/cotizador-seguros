/* ============ 3. LÓGICA DE CÁLCULO (funciones puras, sin DOM) ============ */
export const Calc = (() => {
  const clean = x => Number(Number(x).toPrecision(15)); // elimina ruido binario (1120.0000000000002)

  const round = (x, { mode, decimals }) => {
    if (mode === 'none') return clean(x);
    const fn = { 'half-up': Math.round, floor: Math.floor, ceil: Math.ceil }[mode];
    if (!fn) throw new RangeError('Modo de redondeo no válido: ' + mode);
    const f = 10 ** decimals;
    return fn(clean(x * f)) / f;
  };

  /* Importes: coma = decimal. Con solo punto, «35.000» se lee como miles y «35000.50» como decimal.
     Devuelve null (vacío), NaN (inválido) o un número. */
  const parseAmount = s => {
    let t = String(s ?? '').replace(/\s/g, '');
    if (t === '') return null;
    if (!/^[0-9.,]+$/.test(t)) return NaN;
    const c = t.lastIndexOf(','), d = t.lastIndexOf('.');
    if (c >= 0 && d >= 0) {
      const dec = c > d ? ',' : '.', mil = dec === ',' ? '.' : ',';
      t = t.split(mil).join('').replace(dec, '.');
    } else if (c >= 0) {
      if (t.indexOf(',') !== c) return NaN;
      t = t.replace(',', '.');
    } else if (d >= 0 && /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
  };

  const parseISO = s => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
  };
  const addDays = (iso, n) => {
    const d = parseISO(iso);
    if (!d) return null;
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const validate = (fields, vals, cfg) => {
    const err = {};
    for (const f of fields) {
      const v = vals[f.key], empty = v === null || v === undefined;
      if (f.type === 'money') {
        if (empty) err[f.key] = 'Campo obligatorio.';
        else if (!Number.isFinite(v)) err[f.key] = 'Importe no válido. Usa números y coma para decimales.';
        else if (v <= 0) err[f.key] = 'Ingresa un importe mayor que 0.';
        else if (v > cfg.validation.maxAmount) err[f.key] = 'El importe es demasiado grande.';
      } else if (f.type === 'int') {
        if (empty) err[f.key] = 'Campo obligatorio.';
        else if (!Number.isInteger(v) || v < 1) err[f.key] = 'Ingresa un número entero de 1 o más.';
      } else if (f.type === 'radio') {
        if (!f.options.some(o => o.value === v)) err[f.key] = 'Selecciona una opción.';
      } else if (f.type === 'check' && typeof v !== 'boolean') err[f.key] = 'Valor no válido.';
    }
    return err;
  };

  const financing = (cash, cfg) => {
    const f = cfg.financing, r = x => round(x, cfg.rounding);
    const credit = r(cash * (1 + f.surcharge)), down = r(credit * f.downPct), balance = r(credit - down);
    return { cash, credit, surcharge: r(credit - cash), down, balance, installment: r(balance / f.installments), installments: f.installments };
  };

  // Constructores de cobertura
  const full = (amount, of, r) => ({ amount: r(amount), cur: 'USD', pct: 1, of });
  const capped = (base, c, of, r, per) => ({ amount: r(Math.min(base * c.pct, c.cap)), cur: 'USD', pct: c.pct, of, cap: c.cap, per });
  const fixed = (v, note, cur = 'USD') => ({ fixed: v, cur, note });
  const NA = { text: 'No indicado' };
  const cov = (name, limit, ded, incl = true) => ({ name, incl, limit, ded });

  const builders = {
    carnur: (v, p, r) => ({
      insured: v.value,
      parts: [{ label: 'Valor comercial del vehículo', base: v.value, rate: p.rates[v.rate] }],
      coverages: [
        cov('Pérdida total por accidente o robo', full(v.value, 'del valor comercial', r), NA),
        cov('Robo parcial de repuestos', { pct: p.spareParts, of: 'del valor de partes/piezas' }, NA),
        cov('Responsabilidad civil extracontractual', { amount: p.rcExtra, cur: 'USD', per: 'por evento' }, NA),
        cov('Responsabilidad civil consecuencial', { amount: p.rcConseq, cur: 'USD', per: 'por evento' }, NA),
        cov('Accidentes personales: muerte o invalidez', { amount: p.personal.death, cur: 'USD', per: `por ocupante (${v.occupants} según RUAT)` }, NA),
        cov('Accidentes personales: gastos médicos', { amount: p.personal.medical, cur: 'USD', per: 'por ocupante' }, NA),
        cov('Accidentes personales: gastos de sepelio', { amount: p.personal.funeral, cur: 'USD', per: 'por ocupante' }, NA),
        cov('Franquicia mínima en siniestros', { text: 'No aplica' }, fixed(p.franchise.amount, null, p.franchise.cur))
      ]
    }),
    hogar: (v, p, r) => ({
      insured: v.building + v.contents,
      parts: [
        { label: 'Edificio', base: v.building, rate: p.rateBuilding },
        { label: 'Contenido', base: v.contents, rate: p.rateContents }
      ],
      coverages: [
        cov('Edificio: incendio, rayo y catástrofes', full(v.building, 'del valor declarado', r), fixed(0)),
        cov('Contenido: incendio, rayo y catástrofes', full(v.contents, 'del valor declarado', r), fixed(p.ded.contents, 'por evento')),
        cov('Robo de contenido', capped(v.contents, p.theft, 'del contenido', r), fixed(p.ded.theft, 'por evento')),
        cov('Responsabilidad civil familiar', capped(v.building, p.rcFamily, 'del edificio', r), fixed(0)),
        cov('Daños por agua e inundación', { text: 'Incluido, sin límite separado' }, NA),
        cov('Asistencia en el hogar', { text: `Hasta ${p.assist.max} intervenciones al año` }, fixed(p.assist.cost, 'por intervención'))
      ]
    }),
    invenur: (v, p, r) => ({
      insured: v.inventory,
      parts: [
        { label: 'Almacén (tasa base)', base: v.inventory, rate: p.base },
        ...(v.transit ? [{ label: 'Mercancías en tránsito', base: v.inventory, rate: p.transit }] : []),
        ...(v.perishables ? [{ label: 'Deterioro de perecederos', base: v.inventory, rate: p.perishables }] : [])
      ],
      coverages: [
        cov('Multirriesgo de almacén', full(v.inventory, 'del valor declarado', r), fixed(0)),
        cov('Robo con violencia en almacén', capped(v.inventory, p.theft, 'del inventario', r), fixed(p.ded.theft)),
        cov('Mercancías en tránsito (opcional)', { text: 'Límite específico no indicado' }, NA, v.transit),
        cov('Deterioro de perecederos por frío (opcional)', capped(v.inventory, p.perish, 'del inventario', r), fixed(p.ded.perish), v.perishables),
        cov('Responsabilidad civil de productos', capped(v.inventory, p.rcProducts, 'del inventario', r), fixed(0))
      ]
    }),
    blindado: (v, p, r) => ({
      insured: v.funds,
      parts: [
        { label: 'Fondos (tasa base)', base: v.funds, rate: p.base },
        ...(v.fidelity ? [{ label: 'Rider de infidelidad', base: v.funds, rate: p.fidelity }] : []),
        ...(v.forgery ? [{ label: 'Rider de falsificación', base: v.funds, rate: p.forgery }] : [])
      ],
      coverages: [
        cov('Dinero en local o caja fuerte', capped(v.funds, p.local, 'de los fondos', r, 'acumulado local'), p.ded.local),
        cov('Dinero en tránsito', capped(v.funds, p.transit, 'de los fondos', r, 'por viaje'), p.ded.transit),
        cov('Dinero en manos de mensajero o cajero', capped(v.funds, p.courier, 'de los fondos', r, 'acumulado'), p.ded.courier),
        cov('Infidelidad de empleados (rider)', capped(v.funds, p.fidelityCov, 'de los fondos', r, 'anual acumulado'), p.ded.fidelity, v.fidelity),
        cov('Falsificación de moneda (rider)', capped(v.funds, p.forgeryCov, 'de los fondos', r, 'anual acumulado'), p.ded.forgery, v.forgery),
        cov('Asistencia jurídica especializada', { text: 'Incluida' }, { text: 'Sin deducible' }),
        cov('Protección contra extorsión', { text: 'Incluida, sin sublímite indicado' }, NA)
      ]
    })
  };

  const quote = (id, vals, cfg) => {
    const p = cfg.products[id], errors = validate(p.fields, vals, cfg);
    if (Object.keys(errors).length) return { id, name: p.name, valid: false, errors };
    const r = x => round(x, cfg.rounding), b = builders[id](vals, p, r);
    const premium = r(b.parts.reduce((s, x) => s + x.base * x.rate, 0));
    return { id, name: p.name, title: p.title, benefits: p.benefits, valid: true, errors: {}, ...b, premium, fin: financing(premium, cfg) };
  };

  const consolidate = (qs, payment, cfg) => {
    const r = x => round(x, cfg.rounding), sum = f => r(qs.reduce((s, q) => s + f(q), 0));
    const cash = sum(q => q.fin.cash), credit = sum(q => q.fin.credit);
    return {
      count: qs.length, insured: sum(q => q.insured), cash, credit, surcharge: r(credit - cash),
      down: sum(q => q.fin.down), balance: sum(q => q.fin.balance), installment: sum(q => q.fin.installment),
      installments: cfg.financing.installments, payable: payment === 'credit' ? credit : cash
    };
  };

  /* state = { payment, products: { id: { active, values } } } */
  const run = (state, cfg) => {
    if (!cfg.payments.some(x => x.value === state.payment)) throw new RangeError('Forma de pago no válida.');
    const quotes = cfg.order.filter(id => state.products[id].active).map(id => quote(id, state.products[id].values, cfg));
    return { quotes, totals: consolidate(quotes.filter(q => q.valid), state.payment, cfg) };
  };

  return { round, parseAmount, parseISO, addDays, validate, financing, quote, consolidate, run };
})();
