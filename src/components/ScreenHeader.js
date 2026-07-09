import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../lib/theme';

export default function ScreenHeader({ title, onBack, right }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color={colors.ink} />
        </TouchableOpacity>
      ) : (
        <View style={styles.slot} />
      )}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.slot}>{right ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingTop:       56,
    paddingBottom:    16,
    paddingHorizontal: 20,
    backgroundColor:  colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title:   { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink, letterSpacing: -0.2, textAlign: 'center' },
  slot:    { width: 36, alignItems: 'flex-end' },
});
