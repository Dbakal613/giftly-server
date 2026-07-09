import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { supabase } from '../lib/supabase';

// Valid username: 3-20 chars, lowercase letters, digits, underscores only
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading]   = useState(false);
  const [mode, setMode]         = useState('login'); // 'login' | 'signup' | 'forgot'
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  function clearMessages() { setError(''); setSuccess(''); }

  async function handleAuth() {
    clearMessages();

    if (mode === 'forgot') {
      if (!email.trim()) { setError('Ingresa tu email'); return; }
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) throw error;
        setSuccess('Te enviamos un link para restablecer tu contraseña. Revisa tu email.');
      } catch (e) {
        setError(e.message || 'Ocurrió un error');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setError('Por favor ingresa tu email y contraseña');
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Ingresa tu nombre');
        return;
      }
      if (!USERNAME_RE.test(username)) {
        setError('El usuario debe tener 3–20 caracteres: solo letras minúsculas, números y guión bajo (_)');
        return;
      }

      // Check username availability before creating the account
      const { data: taken } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      if (taken) {
        setError('Ese nombre de usuario ya está en uso. Prueba con otro.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          if (error.message.toLowerCase().includes('invalid login') ||
              error.message.toLowerCase().includes('invalid credentials')) {
            setError('Email o contraseña incorrectos');
          } else {
            setError(error.message || 'Ocurrió un error');
          }
          return;
        }
      } else {
        const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : undefined;

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim(), username },
            ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
          },
        });
        if (error) {
          if (error.message.toLowerCase().includes('already registered') ||
              error.message.toLowerCase().includes('already been registered')) {
            setError('Este email ya está registrado. Intenta iniciar sesión.');
          } else {
            setError(error.message || 'Ocurrió un error');
          }
          return;
        }
        // Supabase obfuscates duplicate emails — empty identities array is the tell
        if (data.user?.identities?.length === 0) {
          setError('Este email ya está registrado. Intenta iniciar sesión.');
          return;
        }
        setSuccess('¡Revisa tu email para confirmar tu cuenta!');
      }
    } catch (e) {
      setError(e.message || 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  }

  const isLogin  = mode === 'login';
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.logoWrap}>
          <Text style={styles.logo}>gift<Text style={styles.logoBlack}>ly</Text></Text>
          <Text style={styles.tagline}>Compra mejor. Regala mejor.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>
            {isLogin ? 'Iniciar sesión' : isSignup ? 'Crear cuenta' : 'Recuperar contraseña'}
          </Text>

          {error   ? <View style={styles.errorBox}  ><Text style={styles.errorText}  >{error}  </Text></View> : null}
          {success ? <View style={styles.successBox}><Text style={styles.successText}>{success}</Text></View> : null}

          {/* ── Signup-only fields ── */}
          {isSignup && (
            <>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                style={styles.input}
                placeholder="Tu nombre completo"
                value={name}
                onChangeText={t => { setName(t); clearMessages(); }}
              />

              <Text style={styles.label}>Usuario</Text>
              <View style={styles.usernameWrap}>
                <Text style={styles.usernameAt}>@</Text>
                <TextInput
                  style={styles.usernameInput}
                  placeholder="tu_usuario"
                  value={username}
                  onChangeText={t => {
                    // Strip invalid chars in real-time and enforce lowercase
                    setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                    clearMessages();
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Text style={styles.hint}>3–20 caracteres · solo letras, números y _</Text>
            </>
          )}

          {/* ── Email (always visible) ── */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            value={email}
            onChangeText={t => { setEmail(t); clearMessages(); }}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {/* ── Password (login + signup) ── */}
          {!isForgot && (
            <>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={password}
                onChangeText={t => { setPassword(t); clearMessages(); }}
                secureTextEntry
              />
            </>
          )}

          {/* ── Forgot password link (login only) ── */}
          {isLogin && (
            <TouchableOpacity
              onPress={() => { setMode('forgot'); clearMessages(); }}
              style={styles.forgotWrap}
            >
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={styles.btnText}>
              {loading
                ? 'Cargando...'
                : isLogin  ? 'Entrar'
                : isSignup ? 'Crear cuenta'
                : 'Enviar link'}
            </Text>
          </TouchableOpacity>

          {/* ── Mode switches ── */}
          {!isForgot && (
            <TouchableOpacity
              onPress={() => { setMode(isLogin ? 'signup' : 'login'); clearMessages(); }}
              style={styles.switchWrap}
            >
              <Text style={styles.switchText}>
                {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
                <Text style={styles.switchLink}>{isLogin ? 'Regístrate' : 'Inicia sesión'}</Text>
              </Text>
            </TouchableOpacity>
          )}

          {isForgot && (
            <TouchableOpacity
              onPress={() => { setMode('login'); clearMessages(); }}
              style={styles.switchWrap}
            >
              <Text style={styles.switchText}>
                <Text style={styles.switchLink}>← Volver al inicio de sesión</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F8F5F0' },
  scroll:        { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrap:      { alignItems: 'center', marginBottom: 40 },
  logo:          { fontSize: 48, fontWeight: '700', color: '#B85C45' },
  logoBlack:     { color: '#1C1916' },
  tagline:       { fontSize: 15, color: '#6E6860', marginTop: 6 },
  card:          { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  title:         { fontSize: 22, fontWeight: '700', color: '#1C1916', marginBottom: 20 },
  errorBox:      { backgroundColor: '#E8C4B8', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText:     { color: '#B85C45', fontSize: 14, fontWeight: '500' },
  successBox:    { backgroundColor: '#D4EDE3', borderRadius: 10, padding: 12, marginBottom: 16 },
  successText:   { color: '#3E7A5E', fontSize: 14, fontWeight: '500' },
  label:         { fontSize: 12, fontWeight: '600', color: '#6E6860', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input:         { borderWidth: 1.5, borderColor: '#E2DDD5', borderRadius: 12, padding: 14, fontSize: 15, color: '#1C1916', marginBottom: 16, backgroundColor: '#F8F5F0' },
  usernameWrap:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2DDD5', borderRadius: 12, backgroundColor: '#F8F5F0', marginBottom: 6 },
  usernameAt:    { paddingLeft: 14, fontSize: 15, color: '#6E6860', fontWeight: '600' },
  usernameInput: { flex: 1, padding: 14, paddingLeft: 6, fontSize: 15, color: '#1C1916' },
  hint:          { fontSize: 11, color: '#B0AFA8', marginBottom: 16 },
  forgotWrap:    { alignItems: 'flex-end', marginTop: -8, marginBottom: 16 },
  forgotText:    { fontSize: 13, color: '#B85C45', fontWeight: '500' },
  btn:           { backgroundColor: '#B85C45', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled:   { opacity: 0.6 },
  btnText:       { color: 'white', fontSize: 16, fontWeight: '700' },
  switchWrap:    { alignItems: 'center', marginTop: 16 },
  switchText:    { fontSize: 14, color: '#6E6860' },
  switchLink:    { color: '#B85C45', fontWeight: '600' },
});
