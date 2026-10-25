/* ============ 1. CONFIGURACIÓN ============
   Única fuente de tasas, límites, deducibles y reglas.
   Origen: especificaciones_tecnicas.txt (Cotizador_de_Seguros_NUR.xlsx).
   Cambiar un valor aquí actualiza cálculo, pantalla y proforma. */
const deepFreeze = o => { Object.values(o).forEach(v => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };

export const CONFIG = deepFreeze({
  locale: 'es-BO',
  // modo: 'half-up' | 'floor' | 'ceil' | 'none'. Se aplica a cada importe derivado.
  rounding: { mode: 'half-up', decimals: 2 },
  validityDays: 30,
  financing: { surcharge: 0.10, downPct: 0.30, installments: 5 },
  validation: { maxAmount: 1e12 }, // tope técnico anti-desborde, no es una regla de negocio
  payments: [{ value: 'cash', label: 'Contado' }, { value: 'credit', label: 'Crédito' }],
  defaultPayment: 'cash',
  order: ['carnur', 'hogar', 'invenur', 'blindado'],

  // Valores de ejemplo tomados de la especificación. Son DEMOSTRATIVOS.
  example: {
    client: { name: 'Fundación Amigos de la Naturaleza', doc: '1028392021', exec: 'Carlos Mendoza' },
    payment: 'cash',
    values: {
      carnur: { value: 35000, rate: 'standard', occupants: 5 },
      hogar: { building: 120000, contents: 30000 },
      invenur: { inventory: 180000, transit: true, perishables: true },
      blindado: { funds: 75000, fidelity: true, forgery: true }
    }
  },

  products: {
    carnur: {
      name: 'CARNUR', title: 'Seguro vehicular',
      blurb: 'Pérdida total, robo parcial, responsabilidad civil y accidentes personales de ocupantes.',
      rates: { standard: 0.032, preferential: 0.029 },
      spareParts: 0.80, rcExtra: 30000, rcConseq: 3000,
      personal: { death: 3000, medical: 300, funeral: 300 },
      franchise: { amount: 1000, cur: 'Bs' },
      fields: [
        { key: 'value', type: 'money', cur: 'USD', label: 'Valor comercial del vehículo' },
        { key: 'rate', type: 'radio', label: 'Tasa de prima', options: [{ value: 'standard', label: 'Estándar' }, { value: 'preferential', label: 'Preferencial' }] },
        { key: 'occupants', type: 'int', label: 'Ocupantes según RUAT (informativo, no modifica la prima)' }
      ],
      benefits: ['Auxilio y grúa 24/7, gratuito e ilimitado', 'Extraterritorialidad limítrofe sin costo', 'Tolerancia de 30 días para licencia vencida']
    },
    hogar: {
      name: 'NUR HOGAR', title: 'Seguro de vivienda',
      blurb: 'Multirriesgo residencial para edificio y contenido, con responsabilidad civil familiar.',
      rateBuilding: 0.003, rateContents: 0.005,
      theft: { pct: 0.50, cap: 10000 }, rcFamily: { pct: 0.20, cap: 20000 },
      ded: { contents: 100, theft: 150 }, assist: { cost: 50, max: 3 },
      fields: [
        { key: 'building', type: 'money', cur: 'USD', label: 'Valor de reposición del edificio' },
        { key: 'contents', type: 'money', cur: 'USD', label: 'Valor estimado del contenido' }
      ],
      benefits: ['Asistencia de emergencia: plomería, cerrajería, electricidad y vidriería', 'Riesgos: incendio, rayo, explosión, cortocircuito, vientos fuertes, granizo, inundación, robo con fuerza y rotura de tuberías']
    },
    invenur: {
      name: 'INVENUR', title: 'Seguro de inventario y mercancías',
      blurb: 'Multirriesgo de almacén a costo de reposición, con tránsito y perecederos opcionales.',
      base: 0.004, transit: 0.001, perishables: 0.0008,
      theft: { pct: 0.25, cap: 50000 }, perish: { pct: 0.15, cap: 20000 }, rcProducts: { pct: 0.20, cap: 100000 },
      ded: { theft: 500, perish: 200 },
      fields: [
        { key: 'inventory', type: 'money', cur: 'USD', label: 'Valor de reposición del inventario' },
        { key: 'transit', type: 'check', label: 'Incluir mercancías en tránsito', rateKey: 'transit' },
        { key: 'perishables', type: 'check', label: 'Incluir deterioro de perecederos', rateKey: 'perishables' }
      ],
      benefits: ['Cláusula de variación estacional: aumento automático del inventario en temporada alta sin recargo (porcentaje y periodo según póliza)', 'Riesgos: incendio, rayo, explosión, colapso de estanterías, robo con violencia, vandalismo, lluvias, inundaciones y rotura de cadena de frío']
    },
    blindado: {
      name: 'NUR BLINDADO', title: 'Seguro de fondos monetarios',
      blurb: 'Fondos en tránsito, en caja fuerte y en manos de mensajeros, con riders opcionales.',
      base: 0.012, fidelity: 0.0025, forgery: 0.001,
      transit: { pct: 0.30, cap: 20000 }, local: { pct: 0.50, cap: 30000 }, courier: { pct: 0.15, cap: 10000 },
      fidelityCov: { pct: 0.20, cap: 15000 }, forgeryCov: { pct: 0.10, cap: 5000 },
      ded: { local: { pct: 0.10, min: 1000 }, transit: { pct: 0.05, min: 500 }, courier: { pct: 0.05 }, fidelity: { pct: 0.20 }, forgery: { pct: 0.10 } },
      fields: [
        { key: 'funds', type: 'money', cur: 'USD', label: 'Monto máximo declarado de fondos' },
        { key: 'fidelity', type: 'check', label: 'Incluir infidelidad de empleados', rateKey: 'fidelity' },
        { key: 'forgery', type: 'check', label: 'Incluir falsificación de moneda', rateKey: 'forgery' }
      ],
      benefits: ['Asistencia jurídica penal y legal especializada incluida', 'Protección contra extorsión incluida', 'Riesgos: robo y asalto a mano armada, asalto en local o caja fuerte, fraude de empleados y falsificación (riders opcionales)']
    }
  },

  decisions: [
    'Redondeo configurable (CONFIG.rounding). Por defecto: mitad hacia arriba a 2 decimales, aplicado a cada importe derivado sobre valores ya redondeados (prima, recargo, inicial, saldo, cuota, sublímites). Las cuotas no reparten diferencias de centavos: si 5 cuotas no suman el saldo exacto, la proforma muestra la diferencia.',
    'La forma de pago es única para toda la cotización y solo admite Contado o Crédito (por defecto, Contado).',
    'Los importes deben ser mayores que 0. La especificación no define rangos de negocio; el tope de 1e12 es solo técnico.',
    'La tasa de CARNUR no tiene valor por defecto: debe elegirse explícitamente. Los ocupantes RUAT son informativos.',
    'Vencimiento = fecha de emisión + 30 días calendario. No se define hora de corte ni invalidación automática de cotizaciones vencidas.',
    'Se conservan USD y Bs según el parámetro. No hay conversión cambiaria porque no existe una regla aprobada.',
    'No se agregan intereses, impuestos, comisiones ni cargos. Los beneficios «sin denuncia bajo USD 1.000» y el método PEPS/UEPS no se muestran porque requieren confirmación contractual.',
    'La suma asegurada combinada es un indicador aritmético de categorías distintas, no una suma asegurada única.',
    'Los datos de ejemplo se identifican como tales en pantalla y en la proforma. Nada se guarda ni se envía: todo ocurre en el navegador.'
  ]
});
