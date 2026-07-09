export const colors = {
  accent:      '#B85C45',
  accentDark:  '#9A4A36',
  accentLight: '#E8C4B8',
  ink:         '#1C1916',
  muted:       '#6E6860',
  bg:          '#F8F5F0',
  surface:     '#FFFFFF',
  border:      '#E2DDD5',
  tagBg:       '#F2EDE6',
  green:       '#3E7A5E',
  greenBg:     '#D4EDE3',
  blue:        '#4A6FA5',
  blueBg:      '#D8E4F5',
  redBg:       '#E8C4B8',
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  full: 100,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
};

export const text = {
  logo:      { fontSize: 26, fontWeight: '800', color: colors.accent, letterSpacing: -0.5 },
  h1:        { fontSize: 28, fontWeight: '700', color: colors.ink, letterSpacing: -0.5 },
  h2:        { fontSize: 22, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  h3:        { fontSize: 17, fontWeight: '700', color: colors.ink },
  body:      { fontSize: 15, color: colors.ink, lineHeight: 22 },
  small:     { fontSize: 13, color: colors.muted, lineHeight: 19 },
  tiny:      { fontSize: 11, color: colors.muted },
  label:     { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  price:     { fontSize: 18, fontWeight: '800', color: colors.accent },
  priceLg:   { fontSize: 32, fontWeight: '800', color: colors.accent, letterSpacing: -1 },
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};
