import { colors } from '../lib/theme';

export const VISIBILITY_OPTIONS = [
  { key: 'public',  label: 'Pública', icon: 'globe',  desc: 'Cualquiera con el link puede verla' },
  { key: 'friends', label: 'Amigos',  icon: 'users',  desc: 'Solo tus amigos en Giftly' },
  { key: 'private', label: 'Privada', icon: 'lock',   desc: 'Solo tú' },
];

export const PRESET_WISHLIST_NAMES = [
  'Mi cumpleaños', 'Deseos', 'Para casa',
  'Ropa', 'Tech', 'Outdoor', 'Libros', 'Para mí',
];

export const DB_ERROR = {
  TABLE_NOT_FOUND: '42P01',
};

export function visibilityColor(vis) {
  if (vis === 'public')  return { bg: colors.greenBg, fg: colors.green };
  if (vis === 'friends') return { bg: colors.blueBg,  fg: colors.blue };
  return { bg: colors.tagBg, fg: colors.muted };
}

export function visibilityIcon(vis) {
  if (vis === 'public')  return 'globe';
  if (vis === 'friends') return 'users';
  return 'lock';
}
