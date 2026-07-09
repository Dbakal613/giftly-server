import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius } from '../lib/theme';

export default function EmptyState({ icon, title, text, cta, flex = false }) {
  return (
    <View style={[styles.wrap, flex && styles.flex]}>
      <View style={styles.iconWrap}>
        <Feather name={icon} size={28} color={colors.muted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {text ? <Text style={styles.text}>{text}</Text> : null}
      {cta ? (
        <TouchableOpacity style={styles.btn} onPress={cta.onPress}>
          <Text style={styles.btnText}>{cta.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 32 },
  flex:    { flex: 1, justifyContent: 'center' },
  iconWrap: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title:   { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 8, textAlign: 'center', letterSpacing: -0.2 },
  text:    { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 22 },
  btn:     { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 22, paddingVertical: 13 },
  btnText: { color: 'white', fontWeight: '700', fontSize: 14 },
});
