// app/receipt-form.tsx
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { withRetry, getErrorMessage } from '@/lib/withRetry';
import { ErrorBanner } from '@/components/ErrorBanner';
import { getActiveMembership } from '@/lib/organisation';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ArrowLeft, Calendar, Save } from 'lucide-react-native';
import type { Category } from '@/types/database';
import { BeaconFileLogo } from '@/components/BeaconFileLogo';

export default function ReceiptFormScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const imagePath = params.imagePath as string;

  const [supplier, setSupplier] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date());
  const [category, setCategory] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [notes, setNotes] = useState('');
  const [projectNotes, setProjectNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [currency, setCurrency] = useState('CHF');

  // Autocomplete state
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const supplierInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadCategories();
    loadSupplierHistory();
    loadOrg();
    loadCurrency();
    if (imagePath) loadImage();
  }, [imagePath]);

  async function loadCurrency() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user.id)
        .maybeSingle();
      setCurrency(profile?.country === 'Canada' ? 'CAD' : 'CHF');
    } catch (error) {
      console.error('Error loading currency:', error);
    }
  }

  async function loadOrg() {
    const membership = await getActiveMembership();
    if (membership) setOrgId(membership.organisation_id);
  }

  async function loadSupplierHistory() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('receipts')
        .select('supplier')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Deduplicate, preserving most-recent-first order
      const seen = new Set<string>();
      const unique: string[] = [];
      data?.forEach(r => {
        const name = r.supplier.trim();
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          unique.push(name);
        }
      });
      setAllSuppliers(unique);
    } catch (error) {
      console.error('Error loading supplier history:', error);
    }
  }

  function handleSupplierChange(text: string) {
    setSupplier(text);
    if (text.trim().length >= 1) {
      const filtered = allSuppliers.filter(s =>
        s.toLowerCase().startsWith(text.toLowerCase()) && s.toLowerCase() !== text.toLowerCase()
      );
      setSupplierSuggestions(filtered.slice(0, 5));
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
      setSupplierSuggestions([]);
    }
  }

  function handleSelectSuggestion(name: string) {
    setSupplier(name);
    setShowSuggestions(false);
    setSupplierSuggestions([]);
    supplierInputRef.current?.blur();
  }

  async function loadCategories() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const [categoriesRes, usageRes] = await Promise.all([
      supabase.from('categories').select('*').eq('is_active', true),
      user ? supabase.from('receipts').select('category').eq('user_id', user.id) : Promise.resolve({ data: [] }),
    ]);

    if (categoriesRes.error) throw categoriesRes.error;

    const cats = categoriesRes.data || [];

    // Count usage per category
    const usageCount: Record<string, number> = {};
    (usageRes.data || []).forEach(r => {
      usageCount[r.category] = (usageCount[r.category] || 0) + 1;
    });

    // Sort: most used first, then alphabetical
    const sorted = [...cats].sort((a, b) => {
      const aCount = usageCount[a.name] || 0;
      const bCount = usageCount[b.name] || 0;
      if (bCount !== aCount) return bCount - aCount;
      return a.name.localeCompare(b.name);
    });

    setCategories(sorted);
    if (sorted.length > 0) setCategory(sorted[0].name);
  } catch (error) {
    console.error('Error loading categories:', error);
    Alert.alert('Error', 'Failed to load categories');
  } finally {
    setIsLoadingCategories(false);
  }
}

  async function loadImage() {
    try {
      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(imagePath, 3600);
      if (error) throw error;
      setImageUrl(data.signedUrl);
    } catch (error) {
      console.error('Error loading image:', error);
    }
  }

  async function handleSave() {
    if (!supplier.trim()) {
      Alert.alert('Missing Information', 'Please enter the supplier name');
      return;
    }

    // Use current category state, fall back to first category if somehow empty
    const categoryToSave = category || (categories.length > 0 ? categories[0].name : '');
    if (!categoryToSave) {
      Alert.alert('Missing Information', 'Please select a category');
      return;
    }

    const cost = parseFloat(totalCost);
    if (isNaN(cost) || cost <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0');
      return;
    }

    setBanner(null);
    setIsSaving(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setBanner({ type: 'error', message: 'Your session has expired. Please sign in again.' });
        return;
      }

      await withRetry(async () => {
        const { error } = await supabase.from('receipts').insert({
          user_id: user.id,
          supplier: supplier.trim(),
          receipt_date: receiptDate.toISOString().split('T')[0],
          category: categoryToSave,
          total_cost: cost,
          image_path: imagePath || null,
          notes: notes.trim() || null,
          project_notes: projectNotes.trim() || null,
          organisation_id: orgId,
        });
        if (error) throw error;
      });

      setBanner({ type: 'success', message: 'Receipt saved successfully!' });
      setTimeout(() => router.push('/(tabs)/home'), 2000);
    } catch (error) {
      console.error('Error saving receipt:', error);
      setBanner({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCancel() {
    Alert.alert(
      'Discard Receipt?',
      'Are you sure you want to discard this receipt? The photo will be deleted.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            if (imagePath) {
              try {
                await supabase.storage.from('receipts').remove([imagePath]);
              } catch (error) {
                console.error('Error deleting image:', error);
              }
            }
            router.back();
          },
        },
      ]
    );
  }

  if (isLoadingCategories) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <BeaconFileLogo size={48} variant="dark" />
        <ActivityIndicator size="large" color="#F59E0B" style={{ marginTop: 16 }} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <ArrowLeft size={24} color="#FEF9EE" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <BeaconFileLogo size={28} variant="light" />
          <Text style={styles.headerTitle}>Add Receipt</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {banner && (
        <ErrorBanner
          type={banner.type}
          message={banner.message}
          onRetry={banner.type === 'error' ? handleSave : undefined}
          dismissable={banner.type !== 'success'}
        />
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Receipt Image */}
        {imageUrl && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUrl }} style={styles.image} />
          </View>
        )}

        <View style={styles.form}>

          {/* Supplier with autocomplete */}
          <View style={styles.field}>
            <Text style={styles.label}>Supplier <Text style={styles.required}>*</Text></Text>
            <TextInput
              ref={supplierInputRef}
              style={styles.input}
              value={supplier}
              onChangeText={handleSupplierChange}
              placeholder="e.g., Coop, Migros, SBB, Elvetino"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => {
                if (supplier.length >= 1 && supplierSuggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
            />
            {showSuggestions && (
              <View style={styles.suggestionsContainer}>
                {supplierSuggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectSuggestion(suggestion)}>
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Date */}
          <View style={styles.field}>
            <Text style={styles.label}>Date <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}>
              <Calendar size={20} color="#F59E0B" strokeWidth={2.5} />
              <Text style={styles.dateButtonText}>
                {receiptDate.toLocaleDateString('en-CH', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={receiptDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (date) setReceiptDate(date);
                }}
                maximumDate={new Date()}
              />
            )}
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}>
              <View style={styles.categoryGrid}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryChip, category === cat.name && styles.categoryChipActive]}
                    onPress={() => setCategory(cat.name)}>
                    <Text style={[styles.categoryChipText, category === cat.name && styles.categoryChipTextActive]}>
                      {cat.name}
                    </Text>
                    {cat.tax_deductible && (
                      <View style={styles.taxBadge}>
                        <Text style={styles.taxBadgeText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {categories.find((c) => c.name === category)?.tax_deductible && (
              <Text style={styles.hint}>✓ This category is tax-deductible</Text>
            )}
          </View>

          {/* Total Amount */}
          <View style={styles.field}>
            <Text style={styles.label}>Total Amount <Text style={styles.required}>*</Text></Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>{currency}</Text>
              <TextInput
                style={styles.amountInput}
                value={totalCost}
                onChangeText={setTotalCost}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Notes */}
          <View style={styles.field}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any additional details..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Client / Project */}
          <View style={styles.field}>
            <Text style={styles.label}>Client / Project (Optional)</Text>
            <TextInput
              style={styles.input}
              value={projectNotes}
              onChangeText={setProjectNotes}
              placeholder="e.g., Acme Corp Q1, Project Phoenix"
              placeholderTextColor="#9ca3af"
              autoCapitalize="sentences"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#1E293B" />
            ) : (
              <>
                <Save size={20} color="#1E293B" strokeWidth={2.5} />
                <Text style={styles.saveButtonText}>Save Receipt</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280', fontWeight: '500' },
  header: {
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FEF9EE', letterSpacing: -0.3 },
  placeholder: { width: 40 },
  content: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  imageContainer: {
    backgroundColor: '#FFFBEB', padding: 16,
    borderBottomWidth: 2, borderBottomColor: '#F59E0B',
  },
  image: {
    width: '100%', height: 200, borderRadius: 12,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb',
  },
  form: { padding: 20 },
  field: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8, letterSpacing: -0.2 },
  required: { color: '#DC2626' },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 12, fontSize: 16, color: '#111827', backgroundColor: '#ffffff',
  },
  textArea: { height: 100, paddingTop: 12 },

  // Autocomplete
  suggestionsContainer: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
    backgroundColor: '#ffffff', marginTop: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
    zIndex: 100,
  },
  suggestionItem: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  suggestionText: { fontSize: 16, color: '#111827', fontWeight: '500' },

  hint: { fontSize: 12, color: '#16a34a', marginTop: 6, fontWeight: '600' },
  dateButton: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 12, backgroundColor: '#ffffff', gap: 8,
  },
  dateButtonText: { fontSize: 16, color: '#111827', fontWeight: '500' },
  categoryScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  categoryGrid: { flexDirection: 'row', gap: 8 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: '#d1d5db',
    backgroundColor: '#ffffff', gap: 6,
  },
  categoryChipActive: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  categoryChipText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  categoryChipTextActive: { color: '#ffffff', fontWeight: '700' },
  taxBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center',
  },
  taxBadgeText: { fontSize: 10, color: '#16a34a', fontWeight: '700' },
  amountInputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    backgroundColor: '#ffffff', overflow: 'hidden',
  },
  currencySymbol: { fontSize: 16, fontWeight: '700', color: '#F59E0B', paddingLeft: 12, paddingRight: 8 },
  amountInput: { flex: 1, padding: 12, paddingLeft: 0, fontSize: 16, color: '#111827', fontWeight: '600' },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F59E0B', padding: 16, borderRadius: 8, marginTop: 8, gap: 8,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#1E293B', fontSize: 16, fontWeight: '700', letterSpacing: -0.2, fontFamily: 'DMSans_500Medium' },
});