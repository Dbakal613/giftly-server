import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius } from '../lib/theme';

export default function Toast({ message }) {
  if (!message) return null;
  return (
    <View style={styles.toast}>
      <Feather name="check" size={14} color="white" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    margin:         16,
    backgroundColor: colors.ink,
    borderRadius:   radius.md,
    padding:        14,
  },
  text: {
    color:      'white',
    fontWeight: '600',
    fontSize:   14,
    flex:       1,
  },
});
