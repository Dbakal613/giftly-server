import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius, shadow } from '../lib/theme';
import { VISIBILITY_OPTIONS, visibilityColor, visibilityIcon } from '../constants';
import EmptyState from '../components/EmptyState';

export default function FriendProfileScreen({ route, navigation }) {
  const { profile } = route.params;
  const [wishlists, setWishlists]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [friendProfile, setFriendProfile] = useState(profile);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, name, username, profile_visibility')
      .eq('id', profile.id)
      .maybeSingle();
    if (profileData) setFriendProfile(profileData);

    const { data: wls } = await supabase
      .from('wishlists')
      .select('id, title, visibility, created_at, wishlist_items(count)')
      .eq('user_id', profile.id)
      .in('visibility', ['public', 'friends'])
      .order('created_at', { ascending: false });

    setWishlists(wls || []);
    setLoading(false);
  }

  const displayName = friendProfile?.name || friendProfile?.username || 'Usuario';

  return (
    <View style={styles.container}>
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.7)" />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
        <View style={styles.profileTop}>
          <View style={styles.avatarLg}>
            <Text style={styles.avatarLgText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileHandle}>@{friendProfile?.username || 'usuario'}</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statN}>{wishlists.length}</Text>
                <Text style={styles.statL}>wishlists</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Wishlists</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : wishlists.length === 0 ? (
        <EmptyState
          icon="list"
          title="Sin wishlists públicas"
          text={`${displayName} no tiene listas compartidas por ahora`}
          flex
        />
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {wishlists.map(wl => (
            <WishlistCard
              key={wl.id}
              wl={wl}
              onPress={() => navigation.navigate('WishlistDetail', {
                wishlistId: wl.id,
                title: wl.title,
                readOnly: true,
              })}
            />
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function WishlistCard({ wl, onPress }) {
  const count  = wl.wishlist_items?.[0]?.count ?? 0;
  const vc     = visibilityColor(wl.visibility);
  const visOpt = VISIBILITY_OPTIONS.find(v => v.key === wl.visibility);

  return (
    <TouchableOpacity style={styles.wlCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.wlIconWrap}>
        <Feather name="list" size={18} color={colors.accent} />
      </View>
      <View style={styles.wlInfo}>
        <Text style={styles.wlTitle}>{wl.title}</Text>
        <View style={styles.wlMeta}>
          <Text style={styles.wlCount}>{count} producto{count !== 1 ? 's' : ''}</Text>
          <View style={[styles.visBadge, { backgroundColor: vc.bg }]}>
            <Feather name={visibilityIcon(wl.visibility)} size={9} color={vc.fg} />
            <Text style={[styles.visText, { color: vc.fg }]}>{visOpt?.label ?? wl.visibility}</Text>
          </View>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },

  profileHeader:  { backgroundColor: colors.ink, paddingTop: 56, paddingBottom: 28, paddingHorizontal: 24 },
  backBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  backText:       { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  profileTop:     { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarLg:       { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)' },
  avatarLgText:   { color: 'white', fontSize: 26, fontWeight: '700' },
  profileInfo:    { flex: 1 },
  profileName:    { fontSize: 22, fontWeight: '700', color: 'white', marginBottom: 2 },
  profileHandle:  { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 10 },
  statsRow:       { flexDirection: 'row', gap: 16 },
  stat:           { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  statN:          { fontSize: 18, fontWeight: '700', color: 'white' },
  statL:          { fontSize: 12, color: 'rgba(255,255,255,0.5)' },

  sectionHeader:  { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  sectionTitle:   { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },

  listContainer:  { padding: 16, paddingTop: 4, gap: 10 },
  wlCard:         { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  wlIconWrap:     { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  wlInfo:         { flex: 1 },
  wlTitle:        { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  wlMeta:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wlCount:        { fontSize: 12, color: colors.muted },
  visBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  visText:        { fontSize: 10, fontWeight: '600' },
});
