import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BeaconFileLogo } from '@/components/BeaconFileLogo';

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  async function handlePasswordReset() {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address first');
      return;
    }
    if (!validateEmail(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: 'expensetracker://auth/callback' }
      );
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Reset Link Sent', 'Check your email for password reset instructions.', [{ text: 'OK' }]);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Information', 'Please enter both email and password');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          Alert.alert('Login Failed', 'Invalid email or password. Please try again.');
        } else {
          Alert.alert('Login Failed', error.message);
        }
        return;
      }

      await AsyncStorage.setItem('keepSignedIn', keepSignedIn ? 'true' : 'false');
      if (!keepSignedIn) {
        await AsyncStorage.setItem('sessionExpiry', 'session_only');
      } else {
        await AsyncStorage.removeItem('sessionExpiry');
      }

    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Wordmark */}
        <View style={styles.header}>
          <BeaconFileLogo size={72} variant="dark" />
          <Text style={styles.wordmark}>
            <Text style={styles.wordmarkBeacon}>Beacon</Text>
            <Text style={styles.wordmarkFile}>File</Text>
          </Text>
          <Text style={styles.tagline}>Expenses made clear.</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}>
                {showPassword
                  ? <EyeOff size={20} color="#9CA3AF" />
                  : <Eye size={20} color="#9CA3AF" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Keep Me Signed In */}
          <View style={styles.keepSignedInRow}>
            <View style={styles.keepSignedInText}>
              <Text style={styles.keepSignedInLabel}>Keep me signed in</Text>
              <Text style={styles.keepSignedInSub}>Stay logged in between sessions</Text>
            </View>
            <Switch
              value={keepSignedIn}
              onValueChange={setKeepSignedIn}
              trackColor={{ false: '#334155', true: '#D97706' }}
              thumbColor={keepSignedIn ? '#F59E0B' : '#6B7280'}
              disabled={loading}
            />
          </View>

          <TouchableOpacity
            onPress={handlePasswordReset}
            disabled={loading}
            style={styles.forgotPasswordContainer}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#1E293B" />
              : <Text style={styles.loginButtonText}>Sign In</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signupButton}
            onPress={() => router.push('/(auth)/signup')}
            disabled={loading}>
            <Text style={styles.signupButtonText}>
              Don't have an account? <Text style={styles.signupButtonTextBold}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <BeaconFileLogo size={20} variant="dark" />
          <View style={styles.footerLine} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E293B' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },

  header: { alignItems: 'center', marginBottom: 40 },
  wordmark: { fontSize: 32, marginTop: 16, marginBottom: 6, letterSpacing: -0.5 },
  wordmarkBeacon: { color: '#FEF9EE', fontWeight: '500', fontFamily: 'DMSans_500Medium' },
  wordmarkFile:   { color: '#F59E0B', fontWeight: '400', fontFamily: 'DMSans_400Regular' },
  tagline: { fontSize: 14, color: 'rgba(254,249,238,0.6)', fontWeight: '400', fontFamily: 'DMSans_400Regular' },

  formContainer: { gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '500', color: '#FEF9EE', fontFamily: 'DMSans_500Medium' },
  input: {
    backgroundColor: '#FEF9EE',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1E293B',
    fontFamily: 'DMSans_400Regular',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9EE',
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1E293B',
    fontFamily: 'DMSans_400Regular',
  },
  eyeButton: { padding: 12, paddingRight: 16 },

  keepSignedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(254,249,238,0.12)',
  },
  keepSignedInText: { gap: 2 },
  keepSignedInLabel: { fontSize: 14, fontWeight: '500', color: '#FEF9EE', fontFamily: 'DMSans_500Medium' },
  keepSignedInSub: { fontSize: 12, color: 'rgba(254,249,238,0.5)', fontFamily: 'DMSans_400Regular' },

  forgotPasswordContainer: { alignItems: 'flex-end', marginTop: -4 },
  forgotPasswordText: { fontSize: 14, color: '#F59E0B', fontWeight: '500', fontFamily: 'DMSans_500Medium' },

  loginButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { color: '#1E293B', fontSize: 16, fontWeight: '500', fontFamily: 'DMSans_500Medium' },

  signupButton: { paddingVertical: 12, alignItems: 'center' },
  signupButtonText: { fontSize: 14, color: 'rgba(254,249,238,0.6)', fontFamily: 'DMSans_400Regular' },
  signupButtonTextBold: { fontWeight: '500', color: '#F59E0B', fontFamily: 'DMSans_500Medium' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 40, gap: 12 },
  footerLine: { width: 60, height: 1, backgroundColor: 'rgba(254,249,238,0.15)' },
});
