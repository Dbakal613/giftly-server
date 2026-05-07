export const colors = {
  accent:   '#D94F3D',
  ink:      '#1A1A18',
  muted:    '#8A8A82',
  bg:       '#FAFAF7',
  surface:  '#FFFFFF',
  border:   '#E8E8E2',
  tagBg:    '#F0EFE8',
  green:    '#2D8C5E',
  greenBg:  '#DCF5EB',
  blue:     '#3D7DD9',
  blueBg:   '#E8F0FE',
  redBg:    '#FDE8E5',
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
  h2:        { fontSize: 22, fontWeight: '700', color: colors.ink },
  h3:        { fontSize: 17, fontWeight: '700', color: colors.ink },
  body:      { fontSize: 15, color: colors.ink },
  small:     { fontSize: 13, color: colors.muted },
  tiny:      { fontSize: 11, color: colors.muted },
  label:     { fontSize: 11, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  price:     { fontSize: 18, fontWeight: '800', color: colors.accent },
  priceLg:   { fontSize: 32, fontWeight: '800', color: colors.accent },
};
