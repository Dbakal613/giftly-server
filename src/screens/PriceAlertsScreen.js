import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius } from '../lib/theme';
import { getCurrentUser } from '../services/auth';
import { fetchAlerts, deactivateAlert } from '../services/alerts';
import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';

export default function PriceAlertsScreen({ navigation }) {
  const [alerts, setAlerts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId]   = useState(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const user = await getCurrentUser();
    setUserId(user.id);
    await loadAlerts(user.id);
  }

  async function loadAlerts(uid) {
    const { data } = await fetchAlerts(uid);
    setAlerts(data);
    setLoading(false);
  }

  async function handleDelete(id) {
    const doDelete = async () => {
      await deactivateAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    };
    if (Platform.OS === 'web') {
      if (!window.confirm('¿Eliminar esta alerta?')) return;
      doDelete();
    } else {
      Alert.alert('Eliminar alerta', '¿Estás seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Alertas de precio" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon="bell"
          title="Sin alertas activas"
          text="Abre un producto y activa una alerta para que te avisemos cuando baje de precio"
          flex
        />
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <AlertCard item={item} onDelete={() => handleDelete(item.id)} />
          )}
        />
      )}
    </View>
  );
}

function AlertCard({ item, onDelete }) {
  const p = item.products;
  return (
    <View style={styles.alertCard}>
      <View style={styles.alertIcon}>
        <Feather name="package" size={22} color={colors.muted} />
      </View>
      <View style={styles.alertInfo}>
        <Text style={styles.alertName} numberOfLines={2}>{p?.name}</Text>
        <Text style={styles.alertStore}>{p?.store}</Text>
        <View style={styles.alertPrices}>
          <Text style={styles.alertLabel}>
            Precio actual: <Text style={styles.alertCurrentPrice}>${p?.price?.toLocaleString('es-CL')}</Text>
          </Text>
          <Text style={styles.alertLabel}>
            Mi alerta: <Text style={styles.alertTargetPrice}>${item.target_price?.toLocaleString('es-CL')}</Text>
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={onDelete}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="trash-2" size={16} color={colors.accent} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:      { padding: 16, gap: 12 },

  alertCard:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border },
  alertIcon:         { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
  alertInfo:         { flex: 1 },
  alertName:         { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 2 },
  alertStore:        { fontSize: 11, color: colors.muted, marginBottom: 6 },
  alertPrices:       { gap: 2 },
  alertLabel:        { fontSize: 12, color: colors.muted },
  alertCurrentPrice: { color: colors.ink, fontWeight: '600' },
  alertTargetPrice:  { color: colors.green, fontWeight: '700' },
  deleteBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },
});
