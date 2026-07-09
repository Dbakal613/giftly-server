import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../lib/theme';

const ITEMS = [
  { icon: 'home',    label: 'Inicio',   screen: 'Home' },
  { icon: 'compass', label: 'Explorar', screen: 'Explore' },
  { icon: 'users',   label: 'Amigos',   screen: 'Friends' },
  { icon: 'user',    label: 'Perfil',   screen: 'Profile' },
];

export default function BottomNav({ navigation, active }) {
  return (
    <View style={styles.nav}>
      {ITEMS.map(item => {
        const isActive = item.screen === active;
        return (
          <TouchableOpacity
            key={item.screen}
            style={styles.item}
            onPress={() => !isActive && navigation.navigate(item.screen)}
            activeOpacity={0.7}
          >
            <Feather name={item.icon} size={22} color={isActive ? colors.accent : colors.muted} />
            <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav:         { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: 28, paddingTop: 10 },
  item:        { flex: 1, alignItems: 'center', gap: 3 },
  label:       { fontSize: 10, color: colors.muted, fontWeight: '500', marginTop: 1 },
  labelActive: { color: colors.accent, fontWeight: '700' },
});
