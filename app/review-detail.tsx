// app/review-detail.tsx
// Manager screen for reviewing a single submitted receipt.
// Supports: Approve, Reject (with reason), Edit & Approve.

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
import { ArrowLeft, Check, X, Edit, Save, Calendar } from 'lucide-react-native';
import Svg, { Path, Rect } from 'react-native-svg';

function SwissFlag({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" fill="#DC2626" />
      <Path d="M13 9h6v5h5v4h-5v5h-6v-5H8v-4h5V9z" fill="white" />
    </Svg>
  );
}

type Mode = 'view' | 'edit' | 'reject';

export default function ReviewDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const receiptId = params.id as string;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('view');
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);

  // Editable fields (used in edit mode)
  const [supplier, setSupplier] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date());
  const [category, setCategory] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [notes, setNotes] = useState('');
  const [projectNotes, setProjectNotes] = useState('');

  // Reject mode field
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadReceipt();
    loadCategories();
  }, [receiptId]);

  async function loadCategories() {
    try {
      const { data, error } = await supabase.from('categories').select('*').eq('is_active', true);
      if (error) throw error;
      setCategories((data || []).sort((a, b) => a.name.localeCompare(b.name)));
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
      console.error('Error loading receipt for review:', error);
      Alert.alert('Error', 'Failed to load receipt');
      router.back();
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    Alert.alert('Approve Receipt', 'Mark this receipt as approved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setBanner(null);
          setSaving(true);
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const now = new Date().toISOString();
            await withRetry(async () => {
              const { error } = await supabase
                .from('receipts')
                .update({ status: 'approved', reviewed_by: user.id, reviewed_at: now })
                .eq('id', receiptId);
              if (error) throw error;
            });
            router.back();
          } catch (error) {
            console.error('Approve error:', error);
            setBanner({ type: 'error', message: getErrorMessage(error) });
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }

  async function handleConfirmReject() {
    if (!rejectionReason.trim()) {
      Alert.alert('Reason Required', 'Please enter a rejection reason before confirming.');
      return;
    }

    setBanner(null);
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const now = new Date().toISOString();
      await withRetry(async () => {
        const { error } = await supabase
          .from('receipts')
          .update({
            status: 'rejected',
            rejection_reason: rejectionReason.trim(),
            reviewed_by: user.id,
            reviewed_at: now,
          })
          .eq('id', receiptId);
        if (error) throw error;
      });
      router.back();
    } catch (error) {
      console.error('Reject error:', error);
      setBanner({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndApprove() {
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
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const now = new Date().toISOString();
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
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: now,
            edited_by: user.id,
            edited_at: now,
          })
          .eq('id', receiptId);
        if (error) throw error;
      });
      router.back();
    } catch (error) {
      console.error('Save & approve error:', error);
      setBanner({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  // ── Image ──────────────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

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
          <Text style={styles.headerTitle}>
            {mode === 'edit' ? 'Edit & Approve' : mode === 'reject' ? 'Reject Receipt' : 'Review Receipt'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {banner && (
        <ErrorBanner
          type={banner.type}
          message={banner.message}
          dismissable
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

        {/* ── View / Edit fields ───────────────────────────────────────── */}
        <View style={styles.section}>
          {mode === 'edit' ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Supplier <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  value={supplier}
                  onChangeText={setSupplier}
                  placeholder="Supplier name"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                />
              </View>

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

              <View style={styles.field}>
                <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
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
              {receipt.project_notes ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Client / Project</Text>
                  <Text style={[styles.notesValue, styles.projectNotesValue]}>{receipt.project_notes}</Text>
                </View>
              ) : null}
              {receipt.submitted_at ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Submitted</Text>
                  <Text style={styles.detailValue}>
                    {new Date(receipt.submitted_at).toLocaleDateString('en-CH', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* ── Reject reason input ──────────────────────────────────────── */}
        {mode === 'reject' && (
          <View style={styles.rejectSection}>
            <Text style={styles.rejectSectionTitle}>Rejection Reason</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Explain why this receipt is being rejected..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />
          </View>
        )}

        {/* ── Action buttons ───────────────────────────────────────────── */}
        <View style={styles.actionsSection}>
          {mode === 'view' && (
            <>
              <TouchableOpacity
                style={[styles.approveButton, saving && styles.disabledButton]}
                onPress={handleApprove}
                disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <>
                      <Check size={20} color="#ffffff" strokeWidth={2.5} />
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </>}
              </TouchableOpacity>

              <View style={styles.secondaryRow}>
                <TouchableOpacity
                  style={styles.editApproveButton}
                  onPress={() => setMode('edit')}
                  disabled={saving}>
                  <Edit size={18} color="#DC2626" strokeWidth={2.5} />
                  <Text style={styles.editApproveText}>Edit &amp; Approve</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => setMode('reject')}
                  disabled={saving}>
                  <X size={18} color="#6b7280" strokeWidth={2.5} />
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {mode === 'edit' && (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setMode('view')}
                disabled={saving}>
                <X size={18} color="#6b7280" strokeWidth={2.5} />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.approveButton, { flex: 1 }, saving && styles.disabledButton]}
                onPress={handleSaveAndApprove}
                disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <>
                      <Save size={18} color="#ffffff" strokeWidth={2.5} />
                      <Text style={styles.approveButtonText}>Save &amp; Approve</Text>
                    </>}
              </TouchableOpacity>
            </View>
          )}

          {mode === 'reject' && (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setMode('view'); setRejectionReason(''); }}
                disabled={saving}>
                <X size={18} color="#6b7280" strokeWidth={2.5} />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmRejectButton, { flex: 1 }, saving && styles.disabledButton]}
                onPress={handleConfirmReject}
                disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <>
                      <X size={18} color="#ffffff" strokeWidth={2.5} />
                      <Text style={styles.approveButtonText}>Confirm Reject</Text>
                    </>}
              </TouchableOpacity>
            </View>
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
  errorText: { fontSize: 18, color: '#6b7280' },
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
  content: { flex: 1 },
  imageContainer: {
    backgroundColor: '#fef2f2', padding: 16,
    borderBottomWidth: 2, borderBottomColor: '#DC2626',
  },
  image: { width: '100%', height: 280, borderRadius: 12, backgroundColor: '#f3f4f6' },
  section: { backgroundColor: '#ffffff', padding: 20, marginTop: 12 },
  field: { marginBottom: 20 },
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
  projectNotesValue: { color: '#DC2626', fontWeight: '600' },
  rejectSection: { backgroundColor: '#ffffff', padding: 20, marginTop: 12 },
  rejectSectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  actionsSection: { padding: 20, gap: 12 },
  approveButton: {
    backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  approveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  secondaryRow: { flexDirection: 'row', gap: 12 },
  editApproveButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, paddingVertical: 14, borderWidth: 2, borderColor: '#DC2626',
    backgroundColor: '#fef2f2', gap: 6,
  },
  editApproveText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  rejectButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, paddingVertical: 14, borderWidth: 1, borderColor: '#d1d5db',
    backgroundColor: '#f9fafb', gap: 6,
  },
  rejectButtonText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  editActions: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, paddingVertical: 14, paddingHorizontal: 20,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#f9fafb', gap: 6,
  },
  cancelButtonText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  confirmRejectButton: {
    backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  disabledButton: { opacity: 0.5 },
});
