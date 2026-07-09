/**
 * GIFTLY — Affiliate Link Builder
 * ─────────────────────────────────────────────────────────────────────────────
 * Para ganar comisiones por cada venta, regístrate en estos programas:
 *
 *  MercadoLibre  → https://publicidad.mercadolibre.cl      comisión ~5–8%
 *  Falabella     → https://www.awin.com  (busca "Falabella Chile")  ~3–5%
 *  Ripley        → Escribe a afiliados@ripley.cl                    ~3–4%
 *  Paris         → https://www.cj.com   (busca "Paris Cencosud")    ~3–4%
 *
 * Una vez registrado, agrega tus IDs en AFFILIATE_IDS abajo.
 * El código ya está listo para envolver los links automáticamente.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const AFFILIATE_IDS = {
  mercadolibre: null,  // e.g. 'giftly_cl'  — se agrega como ?ref=ID al permalink
  falabella: null,     // Awin publisher ID  — wraps URL in awin1.com/cread.php
  ripley: null,        // CJ publisher ID
  paris: null,         // CJ publisher ID
};

// Awin merchant IDs (se asignan cuando Falabella/Ripley aceptan tu solicitud en Awin)
const AWIN_MERCHANT_IDS = {
  falabella: null, // e.g. 12345
  ripley: null,
};

/** Build a store search URL for a given product name */
export function buildStoreSearchUrl(store, productName) {
  const q = encodeURIComponent(productName);
  switch (store) {
    case 'MercadoLibre':
      return `https://listado.mercadolibre.cl/${q}`;
    case 'Falabella':
      return `https://www.falabella.com.cl/falabella-cl/search?Ntt=${q}`;
    case 'Ripley':
      return `https://simple.ripley.cl/search?query=${q}`;
    case 'Paris':
      return `https://www.paris.cl/search?q=${q}`;
    default:
      return `https://www.google.cl/search?q=${q}+${encodeURIComponent(store)}+Chile`;
  }
}

/**
 * Build a tracked outbound URL for a store.
 * @param {string} store        Store name
 * @param {string|null} directUrl  Direct product URL (e.g. ML permalink). Null = use search.
 * @param {string} productName  Fallback product name for search URLs
 * @returns {string}
 */
export function buildProductUrl(store, directUrl, productName) {
  let url = directUrl || buildStoreSearchUrl(store, productName);

  // ── Affiliate wrapping (activates once IDs are registered) ──────────────

  if (store === 'MercadoLibre' && AFFILIATE_IDS.mercadolibre) {
    // MercadoLibre affiliate: append ref param
    url += (url.includes('?') ? '&' : '?') + `ref=${AFFILIATE_IDS.mercadolibre}`;
  }

  if (store === 'Falabella' && AFFILIATE_IDS.falabella && AWIN_MERCHANT_IDS.falabella) {
    // Awin affiliate link wrapper
    url = `https://www.awin1.com/cread.php?awinmid=${AWIN_MERCHANT_IDS.falabella}&awinaffid=${AFFILIATE_IDS.falabella}&ued=${encodeURIComponent(url)}`;
  }

  if (store === 'Ripley' && AFFILIATE_IDS.ripley && AWIN_MERCHANT_IDS.ripley) {
    url = `https://www.awin1.com/cread.php?awinmid=${AWIN_MERCHANT_IDS.ripley}&awinaffid=${AFFILIATE_IDS.ripley}&ued=${encodeURIComponent(url)}`;
  }

  if (store === 'Paris' && AFFILIATE_IDS.paris) {
    // CJ affiliate link — format varies, placeholder structure:
    url = `https://www.anrdoezrs.net/click-${AFFILIATE_IDS.paris}-MERCHANT_ID?url=${encodeURIComponent(url)}`;
  }

  return url;
}

export const STORES = [
  { name: 'MercadoLibre', dot: '#E8A020', bg: '#FEF9E8' },
  { name: 'Falabella',    dot: '#4A6FA5', bg: '#D8E4F5' },
  { name: 'Ripley',       dot: '#B85C45', bg: '#E8C4B8' },
  { name: 'Paris',        dot: '#3E7A5E', bg: '#D4EDE3' },
];
