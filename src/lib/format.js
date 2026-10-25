/* ============ 2. FORMATO Y VISTAS COMPARTIDAS (pantalla y proforma) ============ */
import { CONFIG } from './config.js';

export const Fmt = (() => {
  const L = CONFIG.locale, d = CONFIG.rounding.decimals;
  const nf = new Intl.NumberFormat(L, { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
  const rate = new Intl.NumberFormat(L, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const free = new Intl.NumberFormat(L, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return {
    num: n => nf.format(n),
    money: (n, cur = 'USD') => `${cur}\u00a0${nf.format(n)}`,
    rate: x => rate.format(x * 100) + '%',
    pct: x => free.format(x * 100) + '%',
    date: iso => (iso ? iso.split('-').reverse().join('/') : '—'),
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c])
  };
})();

