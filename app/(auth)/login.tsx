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
import Svg, { Path, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

function SwissFlag({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" fill="#DC2626" />
      <Path d="M13 9h6v5h5v4h-5v5h-6v-5H8v-4h5V9z" fill="white" />
    </Svg>
  );
}

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

      // Store the keep signed in preference
      await AsyncStorage.setItem('keepSignedIn', keepSignedIn ? 'true' : 'false');

      // If not keeping signed in, register a listener to sign out when app closes
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

        <View style={styles.header}>
          <SwissFlag size={56} />
          <Text style={styles.title}>Expense Tracker</Text>
          <Text style={styles.subtitle}>Out-of-canton work expenses</Text>
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
                  ? <EyeOff size={20} color="#6B7280" />
                  : <Eye size={20} color="#6B7280" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Keep Me Signed In Toggle */}
          <View style={styles.keepSignedInRow}>
            <View style={styles.keepSignedInText}>
              <Text style={styles.keepSignedInLabel}>Keep me signed in</Text>
              <Text style={styles.keepSignedInSub}>Stay logged in between sessions</Text>
            </View>
            <Switch
              value={keepSignedIn}
              onValueChange={setKeepSignedIn}
              trackColor={{ false: '#E5E7EB', true: '#fecaca' }}
              thumbColor={keepSignedIn ? '#DC2626' : '#9CA3AF'}
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
              ? <ActivityIndicator size="small" color="#FFFFFF" />
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
          <SwissFlag size={16} />
          <View style={styles.footerLine} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 80, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', letterSpacing: -0.5, marginTop: 16, marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  formContainer: { gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827',
  },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
  },
  passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827' },
  eyeButton: { padding: 12, paddingRight: 16 },

  keepSignedInRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  keepSignedInText: { gap: 2 },
  keepSignedInLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  keepSignedInSub: { fontSize: 12, color: '#9CA3AF' },

  forgotPasswordContainer: { alignItems: 'flex-end', marginTop: -4 },
  forgotPasswordText: { fontSize: 14, color: '#DC2626', fontWeight: '500' },
  loginButton: {
    backgroundColor: '#DC2626', borderRadius: 8,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  signupButton: { paddingVertical: 12, alignItems: 'center' },
  signupButtonText: { fontSize: 14, color: '#6B7280' },
  signupButtonTextBold: { fontWeight: '600', color: '#DC2626' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 40, gap: 12 },
  footerLine: { width: 60, height: 1, backgroundColor: '#E5E7EB' },
});
