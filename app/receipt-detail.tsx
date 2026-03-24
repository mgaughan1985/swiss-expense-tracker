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
import { withRetry, getErrorMessage } from '@/lib/withRetry';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Receipt } from '@/types/database';
import type { Category } from '@/types/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ArrowLeft, Edit, Trash2, Save, X, Calendar, Send, RotateCcw } from 'lucide-react-native';
import { BeaconFileLogo } from '@/components/BeaconFileLogo';

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string }> = {
  draft:     { label: 'Draft',     bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' },
  submitted: { label: 'Submitted', bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  approved:  { label: 'Approved',  bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  rejected:  { label: 'Rejected',  bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
};

export default function ReceiptDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const receiptId = params.id as string;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);

  // Editable fields
  const [supplier, setSupplier] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date());
  const [category, setCategory] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [notes, setNotes] = useState('');
  const [projectNotes, setProjectNotes] = useState('');

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
        setProjectNotes(data.project_notes || '');
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

    setBanner(null);
    setIsSaving(true);
    try {
      await withRetry(async () => {
        const { error } = await supabase
          .from('receipts')
          .update({
            supplier: supplier.trim(),
            receipt_date: receiptDate.toISOString().split('T')[0],
            category: categoryToSave,
            total_cost: cost,
            notes: notes.trim() || null,
            project_notes: projectNotes.trim() || null,
          })
          .eq('id', receiptId);
        if (error) throw error;
      });

      setBanner({ type: 'success', message: 'Receipt updated successfully.' });
      setIsEditing(false);
      await loadReceipt();
    } catch (error) {
      console.error('Error updating receipt:', error);
      setBanner({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit() {
    Alert.alert(
      'Submit for Review',
      'Submit this receipt for manager review? You won\'t be able to edit it while it\'s under review.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setBanner(null);
            setIsSubmitting(true);
            try {
              await withRetry(async () => {
                const { error } = await supabase
                  .from('receipts')
                  .update({
                    status: 'submitted',
                    submitted_at: new Date().toISOString(),
                  })
                  .eq('id', receiptId);
                if (error) throw error;
              });
              await loadReceipt();
              setBanner({ type: 'success', message: 'Receipt submitted for review.' });
            } catch (error) {
              console.error('Error submitting receipt:', error);
              setBanner({ type: 'error', message: getErrorMessage(error) });
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  }

  async function handleResubmit() {
    Alert.alert(
      'Resubmit Receipt',
      'This will reset the receipt to draft so you can edit and resubmit it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset to Draft',
          onPress: async () => {
            setBanner(null);
            setIsSubmitting(true);
            try {
              await withRetry(async () => {
                const { error } = await supabase
                  .from('receipts')
                  .update({
                    status: 'draft',
                    rejection_reason: null,
                  })
                  .eq('id', receiptId);
                if (error) throw error;
              });
              await loadReceipt();
            } catch (error) {
              console.error('Error resubmitting receipt:', error);
              setBanner({ type: 'error', message: getErrorMessage(error) });
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
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
    setProjectNotes(receipt.project_notes || '');
    setBanner(null);
    setIsEditing(false);
  }

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
        <ActivityIndicator size="large" color="#F59E0B" />
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

  const status = receipt.status || 'draft';
  const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const canEdit = status === 'draft' || status === 'rejected';
  const canSubmit = status === 'draft' && !!receipt.organisation_id;
  const canResubmit = status === 'rejected';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#FEF9EE" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <BeaconFileLogo size={28} variant="light" />
          <Text style={styles.headerTitle}>Receipt Details</Text>
        </View>
        <View style={styles.headerActions}>
          {!isEditing && canEdit && (
            <>
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.iconButton}>
                <Edit size={22} color="#F59E0B" strokeWidth={2.5} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.iconButton}>
                <Trash2 size={22} color="#6b7280" strokeWidth={2.5} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {banner && (
        <ErrorBanner
          type={banner.type}
          message={banner.message}
          onRetry={banner.type === 'error' ? handleSave : undefined}
          dismissable={banner.type !== 'success'}
        />
      )}

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
                  <Calendar size={20} color="#F59E0B" strokeWidth={2.5} />
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

              {/* Category */}
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
                        <Save size={18} color="#1E293B" strokeWidth={2.5} />
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                      </>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* Status pill */}
              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }]}>
                  <Text style={[styles.statusText, { color: statusConfig.text }]}>{statusConfig.label}</Text>
                </View>
              </View>

              {/* Rejection reason banner */}
              {status === 'rejected' && receipt.rejection_reason ? (
                <View style={styles.rejectionCard}>
                  <Text style={styles.rejectionTitle}>Rejection Reason</Text>
                  <Text style={styles.rejectionText}>{receipt.rejection_reason}</Text>
                </View>
              ) : null}

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

              {receipt.project_notes ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Client / Project</Text>
                  <Text style={styles.notesValue}>{receipt.project_notes}</Text>
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

              {/* Submit / Resubmit actions */}
              {canSubmit && (
                <TouchableOpacity
                  style={[styles.submitButton, isSubmitting && styles.saveButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}>
                  {isSubmitting
                    ? <ActivityIndicator size="small" color="#ffffff" />
                    : <>
                        <Send size={18} color="#1E293B" strokeWidth={2.5} />
                        <Text style={styles.submitButtonText}>Submit for Review</Text>
                      </>}
                </TouchableOpacity>
              )}

              {canResubmit && (
                <TouchableOpacity
                  style={[styles.resubmitButton, isSubmitting && styles.saveButtonDisabled]}
                  onPress={handleResubmit}
                  disabled={isSubmitting}>
                  {isSubmitting
                    ? <ActivityIndicator size="small" color="#92400e" />
                    : <>
                        <RotateCcw size={18} color="#92400e" strokeWidth={2.5} />
                        <Text style={styles.resubmitButtonText}>Reset to Draft &amp; Edit</Text>
                      </>}
                </TouchableOpacity>
              )}
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
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginLeft: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FEF9EE', letterSpacing: -0.3 },
  headerActions: { flexDirection: 'row', gap: 4 },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  imageContainer: {
    backgroundColor: '#FFFBEB', padding: 16,
    borderBottomWidth: 2, borderBottomColor: '#F59E0B',
  },
  image: { width: '100%', height: 280, borderRadius: 12, backgroundColor: '#f3f4f6' },
  section: { backgroundColor: '#ffffff', padding: 20, marginTop: 12 },
  statusRow: { marginBottom: 16 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  statusText: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  rejectionCard: {
    backgroundColor: '#fef2f2', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#fecaca', marginBottom: 16,
  },
  rejectionTitle: { fontSize: 12, fontWeight: '700', color: '#991b1b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  rejectionText: { fontSize: 15, color: '#7f1d1d', lineHeight: 22 },
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
  categoryChipActive: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  categoryChipText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  categoryChipTextActive: { color: '#ffffff', fontWeight: '700' },
  amountInputContainer: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderColor: '#d1d5db', borderRadius: 8, backgroundColor: '#ffffff', overflow: 'hidden',
  },
  currencySymbol: { fontSize: 16, fontWeight: '700', color: '#F59E0B', paddingLeft: 12, paddingRight: 8 },
  amountInput: { flex: 1, padding: 12, paddingLeft: 0, fontSize: 16, color: '#111827', fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 14, borderRadius: 8, gap: 8,
  },
  cancelButton: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db' },
  cancelButtonText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  saveButton: { backgroundColor: '#F59E0B' },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontSize: 15, fontWeight: '700', color: '#1E293B', fontFamily: 'DMSans_500Medium' },
  detailRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  detailLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  detailValue: { fontSize: 16, color: '#111827', fontWeight: '500' },
  amountValue: { fontSize: 22, color: '#1E293B', fontWeight: '700', letterSpacing: -0.5 },
  categoryBadge: {
    alignSelf: 'flex-start', backgroundColor: '#FFFBEB',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    borderWidth: 1, borderColor: '#FCD34D',
  },
  categoryBadgeText: { fontSize: 14, color: '#D97706', fontWeight: '600' },
  notesValue: { fontSize: 16, color: '#374151', lineHeight: 24 },
  submitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F59E0B', borderRadius: 8, paddingVertical: 14, marginTop: 20, gap: 8,
  },
  submitButtonText: { fontSize: 15, fontWeight: '700', color: '#1E293B', fontFamily: 'DMSans_500Medium' },
  resubmitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fffbeb', borderRadius: 8, paddingVertical: 14, marginTop: 20,
    borderWidth: 1, borderColor: '#fde68a', gap: 8,
  },
  resubmitButtonText: { fontSize: 15, fontWeight: '700', color: '#92400e' },
  errorText: { fontSize: 18, color: '#6b7280', marginBottom: 20 },
  button: { backgroundColor: '#F59E0B', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#1E293B', fontSize: 16, fontWeight: '600' },
});
