import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadow } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../services/auth';
import { fetchRecipients, deleteRecipient, RELATIONSHIP_OPTIONS, relationshipIcon, relationshipLabel } from '../services/recipients';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';

export default function RecipientPickerScreen({ route, navigation }) {
  const returnTo = route.params?.returnTo || 'GiftRecommendations';

  const [recipients, setRecipients] = useState([]);
  const [friends, setFriends]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [userId, setUserId]         = useState(null);
  const [dbReady, setDbReady]       = useState(true);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) return;
      setUserId(user.id);
      await Promise.all([loadRecipients(user.id), loadFriends(user.id)]);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecipients(uid) {
    const { data, error } = await fetchRecipients(uid);
    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation')) {
        setDbReady(false);
      }
      setRecipients([]);
    } else {
      setRecipients(data || []);
    }
  }

  async function loadFriends(uid) {
    try {
      const { data } = await supabase
        .from('friendships')
        .select('friend_id, profiles!friend_id(id, name, username)')
        .eq('user_id', uid)
        .eq('status', 'accepted');
      setFriends((data || []).map(f => f.profiles).filter(Boolean));
    } catch {
      setFriends([]);
    }
  }

  function selectRecipient(recipient) {
    navigation.navigate(returnTo, { recipient });
  }

  function selectFriend(profile) {
    selectRecipient({
      id:           profile.id,
      name:         profile.name || profile.username || 'Usuario',
      relationship: 'amigo',
      interests:    [],
      isGiftlyFriend: true,
    });
  }

  async function handleDelete(id) {
    await deleteRecipient(id);
    setRecipients(prev => prev.filter(r => r.id !== id));
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="¿Para quién es el regalo?" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="¿Para quién es el regalo?" onBack={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {!dbReady && (
          <View style={styles.dbBanner}>
            <Feather name="info" size={14} color={colors.blue} />
            <Text style={styles.dbBannerText}>
              Activa los perfiles de destinatarios ejecutando la migración SQL de gift_recipients.
            </Text>
          </View>
        )}

        {/* Saved recipients */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Destinatarios guardados</Text>
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => navigation.navigate('RecipientForm', { mode: 'create', returnTo })}
            >
              <Feather name="plus" size={13} color="white" />
              <Text style={styles.createBtnText}>Nuevo</Text>
            </TouchableOpacity>
          </View>

          {recipients.length === 0 ? (
            <View style={styles.inlineEmpty}>
              <Feather name="user-plus" size={22} color={colors.muted} />
              <Text style={styles.inlineEmptyTitle}>Sin destinatarios aún</Text>
              <Text style={styles.inlineEmptyText}>Crea un perfil para personalizar las recomendaciones</Text>
              <TouchableOpacity
                style={styles.inlineCta}
                onPress={() => navigation.navigate('RecipientForm', { mode: 'create', returnTo })}
              >
                <Text style={styles.inlineCtaText}>Crear primer destinatario</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.list}>
              {recipients.map(r => (
                <RecipientCard
                  key={r.id}
                  recipient={r}
                  onSelect={() => selectRecipient(r)}
                  onEdit={() => navigation.navigate('RecipientForm', { mode: 'edit', recipient: r, returnTo })}
                  onDelete={() => handleDelete(r.id)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Giftly friends */}
        {friends.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amigos en Giftly</Text>
            <View style={styles.list}>
              {friends.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={styles.friendCard}
                  onPress={() => selectFriend(f)}
                  activeOpacity={0.8}
                >
                  <View style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>
                      {(f.name || f.username || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{f.name || f.username}</Text>
                    <Text style={styles.friendSub}>Amigo en Giftly</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.muted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function RecipientCard({ recipient, onSelect, onEdit, onDelete }) {
  const icon = relationshipIcon(recipient.relationship);
  const label = relationshipLabel(recipient.relationship);
  const interestCount = recipient.interests?.length || 0;

  return (
    <TouchableOpacity style={styles.recCard} onPress={onSelect} activeOpacity={0.85}>
      <View style={styles.recAvatar}>
        <Feather name={icon} size={18} color={colors.accent} />
      </View>
      <View style={styles.recInfo}>
        <Text style={styles.recName}>{recipient.name}</Text>
        <View style={styles.recMeta}>
          <Text style={styles.recRelation}>{label}</Text>
          {interestCount > 0 && (
            <Text style={styles.recInterests}>{interestCount} interés{interestCount !== 1 ? 'es' : ''}</Text>
          )}
          {recipient.default_occasion && (
            <Text style={styles.recOccasion}>{recipient.default_occasion}</Text>
          )}
        </View>
      </View>
      <View style={styles.recActions}>
        <TouchableOpacity
          onPress={onEdit}
          style={styles.recAction}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="edit-2" size={14} color={colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          style={styles.recAction}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="trash-2" size={14} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { padding: 16 },

  dbBanner:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.blueBg, borderRadius: radius.md, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.blue + '30' },
  dbBannerText: { flex: 1, fontSize: 12, color: colors.blue, lineHeight: 17 },

  section:       { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle:  { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.7 },
  createBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7 },
  createBtnText: { color: 'white', fontWeight: '700', fontSize: 12 },

  inlineEmpty:      { alignItems: 'center', paddingVertical: 32, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, gap: 6 },
  inlineEmptyTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  inlineEmptyText:  { fontSize: 13, color: colors.muted, textAlign: 'center', paddingHorizontal: 24 },
  inlineCta:        { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.accent },
  inlineCtaText:    { fontSize: 13, fontWeight: '600', color: colors.accent },

  list:      { gap: 10 },

  recCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  recAvatar:  { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  recInfo:    { flex: 1 },
  recName:    { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  recMeta:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  recRelation:  { fontSize: 12, color: colors.muted },
  recInterests: { fontSize: 12, color: colors.blue },
  recOccasion:  { fontSize: 12, color: colors.green },
  recActions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  recAction:  { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.tagBg, alignItems: 'center', justifyContent: 'center' },

  friendCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border },
  friendAvatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  friendAvatarText: { color: 'white', fontWeight: '700', fontSize: 17 },
  friendInfo:       { flex: 1 },
  friendName:       { fontSize: 15, fontWeight: '600', color: colors.ink },
  friendSub:        { fontSize: 12, color: colors.muted, marginTop: 2 },
});
