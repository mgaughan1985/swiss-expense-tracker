// app/(tabs)/profile.tsx
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { User, Mail, Lock, MapPin, LogOut, ChevronRight, ChevronDown, Check, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Svg, { Path, Rect } from 'react-native-svg';
import { CANADIAN_PROVINCES, getProvinceName } from '@/lib/canada';

function SwissFlag({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" fill="#DC2626" />
      <Path d="M13 9h6v5h5v4h-5v5h-6v-5H8v-4h5V9z" fill="white" />
    </Svg>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Location state
  const [country, setCountry] = useState<'Switzerland' | 'Canada'>('Switzerland');
  const [province, setProvince] = useState('');
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [canton, setCanton] = useState('');
  const [municipality, setMunicipality] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email || '');
      setFullName(user.user_metadata?.full_name || '');

      // Load location from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('country, province, canton, municipality')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        const c = profile.country === 'Canada' ? 'Canada' : 'Switzerland';
        setCountry(c);
        setProvince(profile.province ?? '');
        setCanton(profile.canton ?? user.user_metadata?.canton ?? '');
        setMunicipality(profile.municipality ?? user.user_metadata?.municipality ?? '');
      } else {
        // Fall back to user_metadata for users predating the profiles table
        setCanton(user.user_metadata?.canton ?? '');
        setMunicipality(user.user_metadata?.municipality ?? '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveLocation() {
    if (country === 'Canada' && !province) {
      Alert.alert('Required', 'Please select your province.');
      return;
    }
    setSavingLocation(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        country,
        province: country === 'Canada' ? province : null,
        canton: country === 'Switzerland' ? canton.trim() || null : null,
        municipality: country === 'Switzerland' ? municipality.trim() || null : null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;

      // Also keep canton/municipality in user_metadata for backward compat
      if (country === 'Switzerland') {
        await supabase.auth.updateUser({
          data: { canton: canton.trim() || null, municipality: municipality.trim() || null },
        });
      }
      Alert.alert('Saved', 'Location updated.');
    } catch (error) {
      Alert.alert('Error', 'Could not update location. Please try again.');
    } finally {
      setSavingLocation(false);
    }
  }

  async function handleSaveName() {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() }
      });
      if (error) throw error;
      Alert.alert('Saved', 'Your name has been updated.');
    } catch (error) {
      Alert.alert('Error', 'Could not update name. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Required', 'Please fill in both password fields.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Too Short', 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert('Success', 'Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (error) {
      Alert.alert('Error', 'Could not update password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await supabase.auth.signOut();
          } catch {
            Alert.alert('Error', 'Failed to sign out.');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronRight size={22} color="#374151" style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronRight size={22} color="#374151" style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {fullName ? fullName.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.avatarName}>{fullName || 'Your Name'}</Text>
          <Text style={styles.avatarEmail}>{email}</Text>
        </View>

        {/* Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Details</Text>

          <View style={styles.fieldCard}>
            <View style={styles.fieldHeader}>
              <View style={styles.fieldIcon}>
                <User size={18} color="#DC2626" strokeWidth={2.5} />
              </View>
              <Text style={styles.fieldLabel}>Full Name</Text>
            </View>
            <View style={styles.fieldInputRow}>
              <TextInput
                style={styles.fieldInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor="#9CA3AF"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveName}
                disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <Check size={16} color="#ffffff" strokeWidth={3} />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldCard}>
            <View style={styles.fieldHeader}>
              <View style={styles.fieldIcon}>
                <Mail size={18} color="#DC2626" strokeWidth={2.5} />
              </View>
              <Text style={styles.fieldLabel}>Email</Text>
            </View>
            <Text style={styles.fieldValue}>{email}</Text>
            <Text style={styles.fieldHint}>Email cannot be changed here. Contact support if needed.</Text>
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tax Location</Text>
          <View style={styles.fieldCard}>
            <View style={styles.fieldHeader}>
              <View style={styles.fieldIcon}>
                <MapPin size={18} color="#DC2626" strokeWidth={2.5} />
              </View>
              <Text style={styles.fieldLabel}>Country</Text>
            </View>
            <View style={[styles.countryToggle, { marginLeft: 42 }]}>
              <TouchableOpacity
                style={[styles.countryOption, country === 'Switzerland' && styles.countryOptionActive]}
                onPress={() => { setCountry('Switzerland'); setProvince(''); }}>
                <Text style={[styles.countryOptionText, country === 'Switzerland' && styles.countryOptionTextActive]}>
                  Switzerland
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.countryOption, country === 'Canada' && styles.countryOptionActive]}
                onPress={() => { setCountry('Canada'); setCanton(''); setMunicipality(''); }}>
                <Text style={[styles.countryOptionText, country === 'Canada' && styles.countryOptionTextActive]}>
                  Canada
                </Text>
              </TouchableOpacity>
            </View>

            {/* Canada: Province */}
            {country === 'Canada' && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.sublabel}>Province</Text>
                <TouchableOpacity
                  style={[styles.pickerButton, { marginLeft: 42 }]}
                  onPress={() => setShowProvincePicker(!showProvincePicker)}>
                  <Text style={[styles.pickerButtonText, !province && styles.pickerPlaceholder]}>
                    {province ? getProvinceName(province) : 'Select province'}
                  </Text>
                  <ChevronDown size={16} color="#9CA3AF" />
                </TouchableOpacity>
                {showProvincePicker && (
                  <View style={[styles.pickerDropdown, { marginLeft: 42 }]}>
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

            {/* Switzerland: Canton + Municipality */}
            {country === 'Switzerland' && (
              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={styles.fieldInputRow}>
                  <TextInput
                    style={styles.fieldInput}
                    value={canton}
                    onChangeText={setCanton}
                    placeholder="Canton (e.g. Vaud)"
                    placeholderTextColor="#9CA3AF"
                    autoCorrect={false}
                  />
                </View>
                <View style={styles.fieldInputRow}>
                  <TextInput
                    style={styles.fieldInput}
                    value={municipality}
                    onChangeText={setMunicipality}
                    placeholder="Municipality (e.g. Grandvaux)"
                    placeholderTextColor="#9CA3AF"
                    autoCorrect={false}
                  />
                </View>
              </View>
            )}

            {/* Save location button */}
            <TouchableOpacity
              style={[styles.saveLocationButton, { marginLeft: 42 }]}
              onPress={handleSaveLocation}
              disabled={savingLocation}>
              {savingLocation
                ? <ActivityIndicator size="small" color="#ffffff" />
                : <><Check size={14} color="#ffffff" strokeWidth={3} /><Text style={styles.saveLocationText}>Save Location</Text></>}
            </TouchableOpacity>

            <Text style={styles.fieldHint}>Used for tax calculations and export profiles.</Text>
          </View>
        </View>

        {/* Password */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.fieldCard}>
            <TouchableOpacity
              style={styles.fieldHeader}
              onPress={() => setShowPasswordForm(!showPasswordForm)}>
              <View style={styles.fieldIcon}>
                <Lock size={18} color="#DC2626" strokeWidth={2.5} />
              </View>
              <Text style={styles.fieldLabel}>Change Password</Text>
              <ChevronRight
                size={18}
                color="#9CA3AF"
                style={{ marginLeft: 'auto', transform: [{ rotate: showPasswordForm ? '90deg' : '0deg' }] }}
              />
            </TouchableOpacity>

            {showPasswordForm && (
              <View style={styles.passwordForm}>
                <TextInput
                  style={styles.passwordInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="New password (min. 8 characters)"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  autoCapitalize="none"
                />
                <View style={styles.passwordButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowPasswordForm(false);
                      setNewPassword('');
                      setConfirmPassword('');
                    }}>
                    <X size={16} color="#6B7280" strokeWidth={2.5} />
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.updatePasswordButton}
                    onPress={handleChangePassword}
                    disabled={changingPassword}>
                    {changingPassword
                      ? <ActivityIndicator size="small" color="#ffffff" />
                      : <Text style={styles.updatePasswordText}>Update Password</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={loggingOut}>
            {loggingOut
              ? <ActivityIndicator size="small" color="#DC2626" />
              : <LogOut size={20} color="#DC2626" strokeWidth={2.5} />}
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.swissDecoration}>
          <View style={styles.swissLine} />
          <SwissFlag size={16} />
          <View style={styles.swissLine} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827', letterSpacing: -0.3 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 60 },

  avatarSection: { alignItems: 'center', paddingVertical: 32, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#ffffff' },
  avatarName: { fontSize: 20, fontWeight: '700', color: '#111827', letterSpacing: -0.3, marginBottom: 4 },
  avatarEmail: { fontSize: 14, color: '#6B7280', fontWeight: '500' },

  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },

  fieldCard: {
    backgroundColor: '#f9fafb', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12,
  },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  fieldIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center',
  },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  fieldValue: { fontSize: 15, color: '#374151', paddingLeft: 42 },
  fieldHint: { fontSize: 12, color: '#9CA3AF', paddingLeft: 42, marginTop: 4 },

  fieldInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 42 },
  fieldInput: {
    flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827',
  },
  saveButton: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center',
  },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 42 },
  locationText: { fontSize: 15, color: '#374151', fontWeight: '500' },

  passwordForm: { paddingLeft: 42, paddingTop: 4, gap: 10 },
  passwordInput: {
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827',
  },
  passwordButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancelButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  cancelButtonText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  updatePasswordButton: {
    flex: 2, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center',
  },
  updatePasswordText: { fontSize: 14, color: '#ffffff', fontWeight: '700' },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#DC2626', backgroundColor: '#fef2f2',
  },
  logoutText: { fontSize: 16, color: '#DC2626', fontWeight: '700' },

  swissDecoration: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginTop: 32, gap: 12,
  },
  swissLine: { width: 60, height: 1, backgroundColor: '#e5e7eb' },

  sublabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginLeft: 42 },

  countryToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  countryOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  countryOptionActive: { backgroundColor: '#DC2626' },
  countryOptionText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  countryOptionTextActive: { color: '#ffffff' },

  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerButtonText: { fontSize: 15, color: '#111827' },
  pickerPlaceholder: { color: '#9CA3AF' },
  pickerDropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 220,
    overflow: 'hidden',
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pickerOptionActive: { backgroundColor: '#fef2f2' },
  pickerOptionText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  pickerOptionTextActive: { color: '#DC2626', fontWeight: '700' },

  saveLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  saveLocationText: { fontSize: 14, color: '#ffffff', fontWeight: '700' },
});