// app/(auth)/signup.tsx - Complete version with all features
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, ArrowLeft, ChevronDown } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/theme';
import { CANADIAN_PROVINCES } from '@/lib/canada';
import { BeaconFileLogo } from '@/components/BeaconFileLogo';

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Location fields
  const [country, setCountry] = useState<'Switzerland' | 'Canada'>('Switzerland');
  const [province, setProvince] = useState('');
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [canton, setCanton] = useState('');
  const [municipality, setMunicipality] = useState('');

  async function handleSignup() {
    // Validation
    if (!name.trim()) {
      Alert.alert('Missing Information', 'Please enter your name');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Missing Information', 'Please enter your email');
      return;
    }

    if (!validateEmail(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (!password) {
      Alert.alert('Missing Information', 'Please enter a password');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return;
    }

    if (country === 'Canada' && !province) {
      Alert.alert('Missing Information', 'Please select your province');
      return;
    }

    setLoading(true);
    try {
      const locationData = country === 'Canada'
        ? { country, province }
        : { country, canton: canton.trim() || undefined, municipality: municipality.trim() || undefined };

      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            full_name: name.trim(),
            ...locationData,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          Alert.alert(
            'Account Exists',
            'This email is already registered. Please sign in instead.',
            [
              { text: 'OK' },
              { text: 'Go to Login', onPress: () => router.push('/(auth)/login') },
            ]
          );
        } else {
          Alert.alert('Signup Failed', error.message);
        }
        return;
      }

      // Check if email confirmation is required
      Alert.alert(
        'Account Created! 🎉',
        'Please check your email to confirm your account, then sign in.',
        [
          {
            text: 'Go to Login',
            onPress: () => router.push('/(auth)/login'),
          },
        ]
      );
    } catch (error) {
      console.error('Signup error:', error);
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
        
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={loading}>
          <ArrowLeft size={24} color="#FEF9EE" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <BeaconFileLogo size={72} variant="dark" />
          <Text style={styles.wordmark}>
            <Text style={styles.wordmarkBeacon}>Beacon</Text>
            <Text style={styles.wordmarkFile}>File</Text>
          </Text>
          <Text style={styles.tagline}>Expenses made clear.</Text>
        </View>

        {/* Signup Form */}
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor={colors.gray400}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              editable={!loading}
            />
          </View>

          {/* Country */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Country</Text>
            <View style={styles.countryToggle}>
              <TouchableOpacity
                style={[styles.countryOption, country === 'Switzerland' && styles.countryOptionActive]}
                onPress={() => { setCountry('Switzerland'); setProvince(''); }}
                disabled={loading}>
                <Text style={[styles.countryOptionText, country === 'Switzerland' && styles.countryOptionTextActive]}>
                  Switzerland
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.countryOption, country === 'Canada' && styles.countryOptionActive]}
                onPress={() => { setCountry('Canada'); setCanton(''); setMunicipality(''); }}
                disabled={loading}>
                <Text style={[styles.countryOptionText, country === 'Canada' && styles.countryOptionTextActive]}>
                  Canada
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Canada: Province */}
          {country === 'Canada' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Province</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowProvincePicker(!showProvincePicker)}
                disabled={loading}>
                <Text style={[styles.pickerButtonText, !province && styles.pickerPlaceholder]}>
                  {province
                    ? CANADIAN_PROVINCES.find(p => p.code === province)?.name ?? province
                    : 'Select province'}
                </Text>
                <ChevronDown size={18} color={colors.gray500} />
              </TouchableOpacity>
              {showProvincePicker && (
                <View style={styles.pickerDropdown}>
                  {CANADIAN_PROVINCES.map(p => (
                    <TouchableOpacity
                      key={p.code}
                      style={[styles.pickerOption, province === p.code && styles.pickerOptionActive]}
                      onPress={() => { setProvince(p.code); setShowProvincePicker(false); }}>
                      <Text style={[styles.pickerOptionText, province === p.code && styles.pickerOptionTextActive]}>
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Switzerland: Canton + Municipality (optional) */}
          {country === 'Switzerland' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Canton (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Vaud"
                  placeholderTextColor={colors.gray400}
                  value={canton}
                  onChangeText={setCanton}
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Municipality (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Grandvaux"
                  placeholderTextColor={colors.gray400}
                  value={municipality}
                  onChangeText={setMunicipality}
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
            </>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.gray400}
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
                placeholder="At least 8 characters"
                placeholderTextColor={colors.gray400}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}>
                {showPassword ? (
                  <EyeOff size={20} color={colors.gray500} />
                ) : (
                  <Eye size={20} color={colors.gray500} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Re-enter password"
                placeholderTextColor={colors.gray400}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}>
                {showConfirmPassword ? (
                  <EyeOff size={20} color={colors.gray500} />
                ) : (
                  <Eye size={20} color={colors.gray500} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.signupButton, loading && styles.signupButtonDisabled]}
            onPress={handleSignup}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.signupButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/(auth)/login')}
            disabled={loading}>
            <Text style={styles.loginButtonText}>
              Already have an account? <Text style={styles.loginButtonTextBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          By creating an account, you agree to store your receipt data securely for tax purposes.
        </Text>

        {/* Footer Decoration */}
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
  container: {
    flex: 1,
    backgroundColor: '#1E293B',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  title: {
    ...typography.title,
    fontSize: 28,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.subtitle,
    fontSize: 14,
  },
  formContainer: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FEF9EE',
    fontFamily: 'DMSans_500Medium',
  },
  input: {
    backgroundColor: '#FEF9EE',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1E293B',
    fontFamily: 'DMSans_400Regular',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9EE',
    borderRadius: borderRadius.md,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1E293B',
    fontFamily: 'DMSans_400Regular',
  },
  eyeButton: {
    padding: spacing.md,
    paddingRight: spacing.lg,
  },
  signupButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'DMSans_500Medium',
  },
  loginButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 14,
    color: 'rgba(254,249,238,0.6)',
    fontFamily: 'DMSans_400Regular',
  },
  loginButtonTextBold: {
    fontWeight: '500',
    color: '#F59E0B',
    fontFamily: 'DMSans_500Medium',
  },

  countryToggle: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(254,249,238,0.2)',
    overflow: 'hidden',
  },
  countryOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  countryOptionActive: {
    backgroundColor: '#F59E0B',
  },
  countryOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(254,249,238,0.6)',
    fontFamily: 'DMSans_500Medium',
  },
  countryOptionTextActive: {
    color: '#1E293B',
  },

  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF9EE',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#1E293B',
    fontFamily: 'DMSans_400Regular',
  },
  pickerPlaceholder: {
    color: '#9CA3AF',
  },
  pickerDropdown: {
    backgroundColor: '#FEF9EE',
    borderRadius: borderRadius.md,
    marginTop: 4,
    maxHeight: 240,
    overflow: 'hidden',
  },
  pickerOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,41,59,0.08)',
  },
  pickerOptionActive: {
    backgroundColor: '#FFFBEB',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '400',
    fontFamily: 'DMSans_400Regular',
  },
  pickerOptionTextActive: {
    color: '#D97706',
    fontWeight: '500',
    fontFamily: 'DMSans_500Medium',
  },
  terms: {
    fontSize: 12,
    color: 'rgba(254,249,238,0.4)',
    textAlign: 'center',
    marginTop: spacing.xxl,
    lineHeight: 18,
    fontFamily: 'DMSans_400Regular',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  footerLine: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(254,249,238,0.15)',
  },
});
