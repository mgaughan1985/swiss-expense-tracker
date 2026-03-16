// app/receipt-detail.tsx
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Receipt } from '@/types/database';
import type { Category } from '@/types/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ArrowLeft, Edit, Trash2, Save, X, Calendar } from 'lucide-react-native';
import Svg, { Path, Rect } from 'react-native-svg';

function SwissFlag({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" fill="#DC2626" />
      <Path d="M13 9h6v5h5v4h-5v5h-6v-5H8v-4h5V9z" fill="white" />
    </Svg>
  );
}

export default function ReceiptDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const receiptId = params.id as string;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Categories loaded from DB (same source as receipt-form)
  const [categories, setCategories] = useState<Category[]>([]);

  // Editable fields
  const [supplier, setSupplier] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date());
  const [category, setCategory] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadReceipt();
    loadCategories();
  }, [receiptId]);

  async function loadCategories() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const [categoriesRes, usageRes] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true),
        user
          ? supabase.from('receipts').select('category').eq('user_id', user.id)
          : Promise.resolve({ data: [] }),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;

      const cats = categoriesRes.data || [];
      const usageCount: Record<string, number> = {};
      (usageRes.data || []).forEach((r) => {
        usageCount[r.category] = (usageCount[r.category] || 0) + 1;
      });

      const sorted = [...cats].sort((a, b) => {
        const aCount = usageCount[a.name] || 0;
        const bCount = usageCount[b.name] || 0;
        if (bCount !== aCount) return bCount - aCount;
        return a.name.localeCompare(b.name);
      });

      setCategories(sorted);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  async function loadReceipt() {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('id', receiptId)
        .single();

      if (error) throw error;

      if (data) {
        setReceipt(data);
        setSupplier(data.supplier);
        const [ry, rm, rd] = data.receipt_date.split('-').map(Number);
        setReceiptDate(new Date(ry, rm - 1, rd));
        setCategory(data.category);
        setTotalCost(data.total_cost.toString());
        setNotes(data.notes || '');
      }
    } catch (error) {
      console.error('Error loading receipt:', error);
      Alert.alert('Error', 'Failed to load receipt details');
      router.back();
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!supplier.trim()) {
      Alert.alert('Error', 'Please enter a supplier name');
      return;
    }

    const cost = parseFloat(totalCost);
    if (isNaN(cost) || cost <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const categoryToSave = category || (categories.length > 0 ? categories[0].name : '');
    if (!categoryToSave) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('receipts')
        .update({
          supplier: supplier.trim(),
          receipt_date: receiptDate.toISOString().split('T')[0],
          category: categoryToSave,
          total_cost: cost,
          notes: notes.trim() || null,
        })
        .eq('id', receiptId);

      if (error) throw error;

      Alert.alert('Success', 'Receipt updated successfully');
      setIsEditing(false);
      await loadReceipt();
    } catch (error) {
      console.error('Error updating receipt:', error);
      Alert.alert('Error', 'Failed to update receipt');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    Alert.alert(
      'Delete Receipt',
      'Are you sure you want to delete this receipt? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (receipt?.image_path) {
                await supabase.storage.from('receipts').remove([receipt.image_path]);
              }
              const { error } = await supabase.from('receipts').delete().eq('id', receiptId);
              if (error) throw error;
              router.back();
            } catch (error) {
              console.error('Error deleting receipt:', error);
              Alert.alert('Error', 'Failed to delete receipt');
            }
          },
        },
      ]
    );
  }

  function handleCancel() {
    if (!receipt) return;
    setSupplier(receipt.supplier);
    const [cy, cm, cd] = receipt.receipt_date.split('-').map(Number);
    setReceiptDate(new Date(cy, cm - 1, cd));
    setCategory(receipt.category);
    setTotalCost(receipt.total_cost.toString());
    setNotes(receipt.notes || '');
    setIsEditing(false);
  }

  // Use signed URL for private storage
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    async function loadImage() {
      if (!receipt?.image_path) return;
      try {
        const { data, error } = await supabase.storage
          .from('receipts')
          .createSignedUrl(receipt.image_path, 3600);
        if (!error) setImageUrl(data.signedUrl);
      } catch (e) {
        console.error('Error loading image:', e);
      }
    }
    loadImage();
  }, [receipt?.image_path]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  if (!receipt) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Receipt not found</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <SwissFlag size={28} />
          <Text style={styles.headerTitle}>Receipt Details</Text>
        </View>
        <View style={styles.headerActions}>
          {!isEditing && (
            <>
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.iconButton}>
                <Edit size={22} color="#DC2626" strokeWidth={2.5} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.iconButton}>
                <Trash2 size={22} color="#6b7280" strokeWidth={2.5} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Receipt Image */}
        {imageUrl && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUrl }} style={styles.image} />
          </View>
        )}

        <View style={styles.section}>
          {isEditing ? (
            <>
              {/* Supplier */}
              <View style={styles.field}>
                <Text style={styles.label}>Supplier <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  value={supplier}
                  onChangeText={setSupplier}
                  placeholder="e.g., Coop, Migros, SBB"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                />
              </View>

              {/* Date */}
              <View style={styles.field}>
                <Text style={styles.label}>Date <Text style={styles.required}>*</Text></Text>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                  <Calendar size={20} color="#DC2626" strokeWidth={2.5} />
                  <Text style={styles.dateButtonText}>
                    {receiptDate.toLocaleDateString('en-CH', { day: '2-digit', month: 'long', year: 'numeric' })}
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

              {/* Category — loaded from DB, same as receipt-form */}
              <View style={styles.field}>
                <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
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
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Amount */}
              <View style={styles.field}>
                <Text style={styles.label}>Total Amount <Text style={styles.required}>*</Text></Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>CHF</Text>
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

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={handleCancel}>
                  <X size={18} color="#6b7280" strokeWidth={2.5} />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton, isSaving && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={isSaving}>
                  {isSaving
                    ? <ActivityIndicator size="small" color="#ffffff" />
                    : <>
                        <Save size={18} color="#ffffff" strokeWidth={2.5} />
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                      </>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Supplier</Text>
                <Text style={styles.detailValue}>{receipt.supplier}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>
                  {(() => { const [y,m,d] = receipt.receipt_date.split('-').map(Number); return new Date(y, m-1, d).toLocaleDateString('en-CH', { day: '2-digit', month: 'long', year: 'numeric' }); })()}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Category</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{receipt.category}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Amount</Text>
                <Text style={styles.amountValue}>CHF {receipt.total_cost.toFixed(2)}</Text>
              </View>

              {receipt.notes ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.notesValue}>{receipt.notes}</Text>
                </View>
              ) : null}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Created</Text>
                <Text style={styles.detailValue}>
                  {new Date(receipt.created_at).toLocaleDateString('en-CH', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </Text>
              </View>
            </>
          )}
        </View>
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginLeft: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827', letterSpacing: -0.3 },
  headerActions: { flexDirection: 'row', gap: 4 },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  imageContainer: {
    backgroundColor: '#fef2f2', padding: 16,
    borderBottomWidth: 2, borderBottomColor: '#DC2626',
  },
  image: { width: '100%', height: 280, borderRadius: 12, backgroundColor: '#f3f4f6' },
  section: { backgroundColor: '#ffffff', padding: 20, marginTop: 12 },
  field: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8, letterSpacing: -0.2 },
  required: { color: '#DC2626' },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 12, fontSize: 16, color: '#111827', backgroundColor: '#ffffff',
  },
  textArea: { height: 100, paddingTop: 12 },
  dateButton: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderColor: '#d1d5db', borderRadius: 8, padding: 12, backgroundColor: '#ffffff', gap: 8,
  },
  dateButtonText: { fontSize: 16, color: '#111827', fontWeight: '500' },
  categoryScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  categoryGrid: { flexDirection: 'row', gap: 8 },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff',
  },
  categoryChipActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  categoryChipText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  categoryChipTextActive: { color: '#ffffff', fontWeight: '700' },
  amountInputContainer: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderColor: '#d1d5db', borderRadius: 8, backgroundColor: '#ffffff', overflow: 'hidden',
  },
  currencySymbol: { fontSize: 16, fontWeight: '700', color: '#DC2626', paddingLeft: 12, paddingRight: 8 },
  amountInput: { flex: 1, padding: 12, paddingLeft: 0, fontSize: 16, color: '#111827', fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 14, borderRadius: 8, gap: 8,
  },
  cancelButton: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db' },
  cancelButtonText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  saveButton: { backgroundColor: '#DC2626' },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  detailRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  detailLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  detailValue: { fontSize: 16, color: '#111827', fontWeight: '500' },
  amountValue: { fontSize: 22, color: '#DC2626', fontWeight: '700', letterSpacing: -0.5 },
  categoryBadge: {
    alignSelf: 'flex-start', backgroundColor: '#fef2f2',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    borderWidth: 1, borderColor: '#fecaca',
  },
  categoryBadgeText: { fontSize: 14, color: '#DC2626', fontWeight: '600' },
  notesValue: { fontSize: 16, color: '#374151', lineHeight: 24 },
  errorText: { fontSize: 18, color: '#6b7280', marginBottom: 20 },
  button: { backgroundColor: '#DC2626', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});