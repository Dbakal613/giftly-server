import { PRODUCTS, CATEGORIES } from '../data/products';

export const INTEREST_TO_CATEGORIES = {
  'Tecnología':     ['tech'],
  'Moda':           ['ropa', 'accesorios'],
  'Hogar':          ['decoracion', 'utiles'],
  'Deportes':       ['outdoor', 'utiles', 'ropa'],
  'Belleza':        ['lifestyle', 'accesorios'],
  'Cocina':         ['utiles', 'decoracion'],
  'Libros':         ['utiles', 'lifestyle'],
  'Viajes':         ['outdoor', 'accesorios', 'botellas'],
  'Gaming':         ['tech'],
  'Música':         ['tech', 'lifestyle', 'accesorios'],
  'Arte':           ['decoracion', 'utiles', 'lifestyle'],
  'Fotografía':     ['tech', 'accesorios'],
  'Naturaleza':     ['outdoor', 'botellas'],
  'Fitness':        ['outdoor', 'botellas', 'ropa'],
  'Mascotas':       ['utiles', 'lifestyle'],
  'Películas':      ['tech', 'lifestyle'],
  'Podcast':        ['tech'],
  'Yoga':           ['ropa', 'lifestyle'],
  'Café':           ['botellas', 'utiles'],
  'Sostenibilidad': ['botellas', 'outdoor', 'lifestyle'],
};

const OCCASION_BOOSTS = {
  'Cumpleaños':  ['lifestyle', 'accesorios', 'premium', 'utiles', 'botellas'],
  'Navidad':     ['premium', 'tech', 'lifestyle', 'decoracion'],
  'Aniversario': ['premium', 'accesorios', 'lifestyle'],
  'Graduación':  ['tech', 'utiles', 'premium', 'accesorios'],
  'Nuevo hogar': ['decoracion', 'utiles', 'botellas', 'lifestyle'],
  'Otro':        ['lifestyle', 'accesorios', 'utiles'],
};

function buildWhy(product, { preferredCategories, occasion, mode }) {
  const catLabel = CATEGORIES.find(c => c.id === product.category)?.label?.toLowerCase() || product.category;

  if (occasion && OCCASION_BOOSTS[occasion]?.includes(product.category)) {
    return `Ideal para ${occasion}`;
  }
  if (preferredCategories?.includes(product.category)) {
    return `Coincide con tus intereses en ${catLabel}`;
  }
  if (mode === 'gift' && product.category === 'premium') {
    return 'Un regalo que impresiona';
  }
  if (product.tags?.includes('regalo práctico')) {
    return 'Se usa todos los días';
  }
  if (product.category === 'tech') {
    return 'Siempre es un buen regalo';
  }
  return 'Popular en regalos';
}

export function getRecommendations({
  preferredCategories = [],
  categoryFilter = null,
  occasion = null,
  budgetMin = 0,
  budgetMax = null,
  mode = 'self',
  exclude = new Set(),
} = {}) {
  let products = PRODUCTS.filter(p => p.available !== false && !exclude.has(p.id));

  if (categoryFilter) {
    products = products.filter(p => p.category === categoryFilter);
  }
  if (budgetMax !== null) {
    products = products.filter(p => p.price >= budgetMin && p.price <= budgetMax);
  } else if (budgetMin > 0) {
    products = products.filter(p => p.price >= budgetMin);
  }

  const scored = products.map(p => {
    let score = 40;

    if (preferredCategories.includes(p.category))                          score += 30;
    if (occasion && OCCASION_BOOSTS[occasion]?.includes(p.category))       score += 20;
    if (mode === 'gift' && ['premium', 'accesorios'].includes(p.category)) score += 15;
    if (mode === 'self' && ['lifestyle', 'utiles'].includes(p.category))   score += 10;
    score += Math.random() * 12;

    return {
      product: p,
      score,
      why: buildWhy(p, { preferredCategories, occasion, mode }),
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 20);
}

export const BUDGET_RANGES = [
  { key: 'any',    label: 'Sin límite',   min: 0,      max: null   },
  { key: 'low',    label: 'Hasta $20K',   min: 0,      max: 20000  },
  { key: 'mid',    label: '$20K–$50K',    min: 20000,  max: 50000  },
  { key: 'high',   label: '$50K–$100K',   min: 50000,  max: 100000 },
  { key: 'luxury', label: '+$100K',       min: 100000, max: null   },
];

export const OCCASIONS = [
  { key: 'Cumpleaños',  icon: 'calendar' },
  { key: 'Navidad',     icon: 'gift' },
  { key: 'Aniversario', icon: 'heart' },
  { key: 'Graduación',  icon: 'award' },
  { key: 'Nuevo hogar', icon: 'home' },
  { key: 'Otro',        icon: 'more-horizontal' },
];

function buildRecipientWhy(product, { recipient, preferredCategories, occasion }) {
  const name = recipient?.name || 'tu destinatario';
  const catLabel = CATEGORIES.find(c => c.id === product.category)?.label?.toLowerCase() || '';

  if (occasion && OCCASION_BOOSTS[occasion]?.includes(product.category)) {
    return `Ideal para el ${occasion} de ${name}`;
  }
  if (preferredCategories.includes(product.category)) {
    const matchingInterest = Object.entries(INTEREST_TO_CATEGORIES)
      .find(([interest, cats]) =>
        cats.includes(product.category) && recipient?.interests?.includes(interest)
      )?.[0];
    if (matchingInterest) {
      return `Recomendado para ${name} porque le gusta ${matchingInterest.toLowerCase()}`;
    }
    return `Coincide con los intereses de ${name}`;
  }
  if (product.category === 'premium') return `Un regalo que va a impresionar a ${name}`;
  if (product.tags?.includes('regalo práctico')) return `Un regalo práctico que ${name} va a usar`;
  return `Buena opción para ${name}`;
}

export function getGiftRecommendations({
  recipient = null,
  categoryFilter = null,
  occasionOverride = null,
  budgetMin = 0,
  budgetMax = null,
  exclude = new Set(),
} = {}) {
  const occasion = occasionOverride || recipient?.default_occasion || null;
  const maxBudget = budgetMax !== null ? budgetMax : (recipient?.budget_max ?? null);

  const preferredCategories = (recipient?.interests || [])
    .flatMap(i => INTEREST_TO_CATEGORIES[i] || [])
    .filter((c, idx, arr) => arr.indexOf(c) === idx);

  let products = PRODUCTS.filter(p => p.available !== false && !exclude.has(p.id));

  if (categoryFilter) products = products.filter(p => p.category === categoryFilter);
  if (maxBudget !== null) products = products.filter(p => p.price <= maxBudget);
  if (budgetMin > 0)      products = products.filter(p => p.price >= budgetMin);

  const scored = products.map(p => {
    let score = 40;
    if (preferredCategories.includes(p.category))                     score += 40;
    if (occasion && OCCASION_BOOSTS[occasion]?.includes(p.category))  score += 20;
    if (['premium', 'accesorios'].includes(p.category))               score += 10;
    score += Math.random() * 10;

    return {
      product: p,
      score,
      why: buildRecipientWhy(p, { recipient, preferredCategories, occasion }),
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 20);
}

export const FEEDBACK_OPTIONS = [
  { key: 'like',      label: 'Me gusta',     icon: 'thumbs-up'    },
  { key: 'dislike',   label: 'No me gusta',  icon: 'thumbs-down'  },
  { key: 'expensive', label: 'Muy caro',     icon: 'dollar-sign'  },
  { key: 'original',  label: 'Más original', icon: 'zap'          },
  { key: 'elegant',   label: 'Más elegante', icon: 'star'         },
  { key: 'useful',    label: 'Más útil',     icon: 'tool'         },
  { key: 'emotional', label: 'Más emotivo',  icon: 'sun'          },
];
