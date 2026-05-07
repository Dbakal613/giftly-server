import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [isLogin, setIsLogin]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  async function handleAuth() {
    setError('');
    setSuccess('');
    if (!email || !password) {
      setError('Por favor ingresa tu email y contraseña');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('¡Revisa tu email para confirmar tu cuenta!');
      }
    } catch (e) {
      setError(e.message || 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>gift<Text style={styles.logoBlack}>ly</Text></Text>
          <Text style={styles.tagline}>Compra mejor. Regala mejor.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>{isLogin ? 'Iniciar sesión' : 'Crear cuenta'}</Text>

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          {success ? <View style={styles.successBox}><Text style={styles.successText}>{success}</Text></View> : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            value={email}
            onChangeText={t => { setEmail(t); setError(''); }}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            value={password}
            onChangeText={t => { setPassword(t); setError(''); }}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={styles.btnText}>
              {loading ? 'Cargando...' : isLogin ? 'Entrar' : 'Crear cuenta'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }} style={styles.switchWrap}>
            <Text style={styles.switchText}>
              {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
              <Text style={styles.switchLink}>{isLogin ? 'Regístrate' : 'Inicia sesión'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#FAFAF7' },
  scroll:       { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrap:     { alignItems: 'center', marginBottom: 40 },
  logo:         { fontSize: 48, fontWeight: '700', color: '#D94F3D' },
  logoBlack:    { color: '#1A1A18' },
  tagline:      { fontSize: 15, color: '#8A8A82', marginTop: 6 },
  card:         { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  title:        { fontSize: 22, fontWeight: '700', color: '#1A1A18', marginBottom: 20 },
  errorBox:     { backgroundColor: '#FDE8E5', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText:    { color: '#D94F3D', fontSize: 14, fontWeight: '500' },
  successBox:   { backgroundColor: '#DCF5EB', borderRadius: 10, padding: 12, marginBottom: 16 },
  successText:  { color: '#2D8C5E', fontSize: 14, fontWeight: '500' },
  label:        { fontSize: 12, fontWeight: '600', color: '#8A8A82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input:        { borderWidth: 1.5, borderColor: '#E8E8E2', borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1A18', marginBottom: 16, backgroundColor: '#FAFAF7' },
  btn:          { backgroundColor: '#D94F3D', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: 'white', fontSize: 16, fontWeight: '700' },
  switchWrap:   { alignItems: 'center', marginTop: 16 },
  switchText:   { fontSize: 14, color: '#8A8A82' },
  switchLink:   { color: '#D94F3D', fontWeight: '600' },
});
