import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius } from '../lib/theme';
import { getCurrentUser } from '../services/auth';
import {
  createRecipient, updateRecipient,
  RELATIONSHIP_OPTIONS, GENDER_OPTIONS, RECIPIENT_INTERESTS,
} from '../services/recipients';
import { OCCASIONS, BUDGET_RANGES } from '../services/recommendations';
import ScreenHeader from '../components/ScreenHeader';

export default function RecipientFormScreen({ route, navigation }) {
  const { mode = 'create', recipient = null, returnTo = 'RecipientPicker' } = route.params || {};
  const isEdit = mode === 'edit';

  const [name, setName]             = useState(recipient?.name || '');
  const [relationship, setRel]      = useState(recipient?.relationship || 'amigo');
  const [age, setAge]               = useState(recipient?.age ? String(recipient.age) : '');
  const [gender, setGender]         = useState(recipient?.gender || '');
  const [interests, setInterests]   = useState(new Set(recipient?.interests || []));
  const [occasion, setOccasion]     = useState(recipient?.default_occasion || '');
  const [budget, setBudget]         = useState(() => {
    if (!recipient?.budget_max) return 'any';
    return BUDGET_RANGES.find(r => r.max === recipient.budget_max)?.key || 'any';
  });
  const [notes, setNotes]           = useState(recipient?.notes || '');
  const [saving, setSaving]         = useState(false);

  function toggleInterest(label) {
    setInterests(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const budgetRange = BUDGET_RANGES.find(r => r.key === budget);
      const payload = {
        user_id:          user.id,
        name:             name.trim(),
        relationship,
        age:              age ? parseInt(age, 10) : null,
        gender:           gender || null,
        interests:        [...interests],
        default_occasion: occasion || null,
        budget_max:       budgetRange?.max ?? null,
        notes:            notes.trim() || null,
      };

      if (isEdit) {
        const { data, error } = await updateRecipient(recipient.id, payload);
        if (error) throw error;
        navigation.navigate(returnTo, { recipient: data || { ...recipient, ...payload } });
      } else {
        const { data, error } = await createRecipient(payload);
        if (error) throw error;
        navigation.navigate('RecipientPicker', { returnTo });
      }
    } catch (e) {
      console.error('RecipientForm save error:', e);
      const msg = 'No se pudo guardar. Verifica que la migración SQL de gift_recipients esté aplicada.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={isEdit ? 'Editar destinatario' : 'Nuevo destinatario'}
        onBack={() => navigation.goBack()}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Name */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Nombre *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ej: Valentina, Papá, Mi jefe..."
            placeholderTextColor={colors.muted}
            maxLength={60}
            autoFocus={!isEdit}
          />
        </View>

        {/* Relationship */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Relación</Text>
          <View style={styles.chipRow}>
            {RELATIONSHIP_OPTIONS.map(opt => {
              const active = relationship === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setRel(opt.key)}
                >
                  <Feather name={opt.icon} size={12} color={active ? 'white' : colors.muted} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Optional: age + gender */}
        <View style={styles.rowFields}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Edad (opcional)</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={v => setAge(v.replace(/\D/g, ''))}
              placeholder="Ej: 28"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Género (opcional)</Text>
          <View style={styles.chipRow}>
            {GENDER_OPTIONS.map(opt => {
              const active = gender === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setGender(prev => prev === opt.key ? '' : opt.key)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Interests */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Intereses y gustos</Text>
          <Text style={styles.fieldSub}>Selecciona todo lo que aplique — esto personaliza los regalos</Text>
          <View style={styles.interestGrid}>
            {RECIPIENT_INTERESTS.map(label => {
              const active = interests.has(label);
              return (
                <TouchableOpacity
                  key={label}
                  style={[styles.interestChip, active && styles.interestChipActive]}
                  onPress={() => toggleInterest(label)}
                >
                  {active && <Feather name="check" size={11} color="white" />}
                  <Text style={[styles.interestText, active && styles.interestTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Default occasion */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Ocasión habitual (opcional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {OCCASIONS.map(occ => {
              const active = occasion === occ.key;
              return (
                <TouchableOpacity
                  key={occ.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setOccasion(prev => prev === occ.key ? '' : occ.key)}
                >
                  <Feather name={occ.icon} size={12} color={active ? 'white' : colors.muted} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{occ.key}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Budget */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Presupuesto habitual para regalos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {BUDGET_RANGES.map(r => {
              const active = budget === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setBudget(r.key)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Notas adicionales (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Ej: Le gustan los colores neutros, es vegetariana, colecciona libros..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            maxLength={300}
          />
        </View>

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <Feather name="shield" size={14} color={colors.muted} />
          <Text style={styles.privacyText}>
            Esta información solo es visible para ti y se usa para personalizar recomendaciones. No se comparte con nadie.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Save button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!name.trim() || saving}
        >
          {saving
            ? <ActivityIndicator color="white" />
            : (
              <View style={styles.saveBtnContent}>
                <Feather name={isEdit ? 'check' : 'user-plus'} size={16} color="white" />
                <Text style={styles.saveBtnText}>{isEdit ? 'Guardar cambios' : 'Crear destinatario'}</Text>
              </View>
            )
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  scroll:       { padding: 20, paddingBottom: 8 },

  field:        { marginBottom: 22 },
  fieldLabel:   { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  fieldSub:     { fontSize: 12, color: colors.muted, marginBottom: 10, marginTop: -4 },
  rowFields:    { flexDirection: 'row', gap: 12 },
  input:        { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.surface },
  textarea:     { height: 90, textAlignVertical: 'top', paddingTop: 12 },

  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive:   { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText:     { fontSize: 13, color: colors.muted, fontWeight: '500' },
  chipTextActive: { color: 'white', fontWeight: '600' },

  interestGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  interestChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  interestText:      { fontSize: 13, color: colors.muted, fontWeight: '500' },
  interestTextActive: { color: 'white', fontWeight: '600' },

  privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.tagBg, borderRadius: radius.md, padding: 14 },
  privacyText: { flex: 1, fontSize: 12, color: colors.muted, lineHeight: 18 },

  footer:          { padding: 20, paddingBottom: 36, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  saveBtn:         { backgroundColor: colors.accent, borderRadius: radius.lg, padding: 16, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnContent:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtnText:     { color: 'white', fontSize: 16, fontWeight: '700' },
});
