import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput } from 'react-native';
import { supabase } from '../lib/supabase';

export default function PriceAlertsScreen({ navigation }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAlerts(); }, []);

  async function fetchAlerts() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('price_alerts')
      .select('*, products(name, image_emoji, store, price)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setAlerts(data || []);
    setLoading(false);
  }

  async function deleteAlert(id) {
    await supabase.from('price_alerts').update({ is_active: false }).eq('id', id);
    fetchAlerts();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alertas de precio</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#D94F3D" /></View>
      ) : alerts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>Sin alertas activas</Text>
          <Text style={styles.emptyText}>Abre un producto y activa una alerta para que te avisemos cuando baje de precio</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.alertCard}>
              <View style={styles.alertEmoji}>
                <Text style={styles.alertEmojiText}>{item.products?.image_emoji || '📦'}</Text>
              </View>
              <View style={styles.alertInfo}>
                <Text style={styles.alertName} numberOfLines={2}>{item.products?.name}</Text>
                <Text style={styles.alertStore}>{item.products?.store}</Text>
                <View style={styles.alertPrices}>
                  <Text style={styles.alertCurrent}>Precio actual: <Text style={styles.alertCurrentPrice}>${item.products?.price?.toLocaleString('es-CL')}</Text></Text>
                  <Text style={styles.alertTarget}>Mi alerta: <Text style={styles.alertTargetPrice}>${item.target_price?.toLocaleString('es-CL')}</Text></Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => Alert.alert('Eliminar alerta', '¿Estás segura?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: () => deleteAlert(item.id) }
              ])}>
                <Text style={styles.deleteBtn}>🗑️</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E2' },
  backBtn: { padding: 4 },
  backText: { fontSize: 22, color: '#1A1A18' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A18' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A18', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#8A8A82', textAlign: 'center', lineHeight: 22 },
  list: { padding: 16, gap: 12 },
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E8E8E2' },
  alertEmoji: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#F0EFE8', alignItems: 'center', justifyContent: 'center' },
  alertEmojiText: { fontSize: 26 },
  alertInfo: { flex: 1 },
  alertName: { fontSize: 13, fontWeight: '600', color: '#1A1A18', marginBottom: 2 },
  alertStore: { fontSize: 11, color: '#8A8A82', marginBottom: 6 },
  alertPrices: { gap: 2 },
  alertCurrent: { fontSize: 12, color: '#8A8A82' },
  alertCurrentPrice: { color: '#1A1A18', fontWeight: '600' },
  alertTarget: { fontSize: 12, color: '#8A8A82' },
  alertTargetPrice: { color: '#2D8C5E', fontWeight: '700' },
  deleteBtn: { fontSize: 20, padding: 4 },
});
