// app/(tabs)/export.tsx
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Download, Calendar, ChevronDown } from 'lucide-react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

function SwissFlag({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" fill="#DC2626" />
      <Path d="M13 9h6v5h5v4h-5v5h-6v-5H8v-4h5V9z" fill="white" />
    </Svg>
  );
}

interface ReceiptData {
  id: string;
  supplier: string;
  receipt_date: string;
  category: string;
  total_cost: number;
  notes: string | null;
  image_path: string | null;
  created_at: string;
}

interface MonthOption {
  label: string;
  value: string;
}

export default function ExportScreen() {
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [monthOptions, setMonthOptions] = useState<MonthOption[]>([]);

  useEffect(() => {
    loadReceipts();
  }, []);

  async function loadReceipts() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      const { data, error } = await supabase
        .from('receipts')
        .select('id, supplier, receipt_date, category, total_cost, notes, image_path, created_at')
        .eq('user_id', user.id)
        .order('receipt_date', { ascending: false });

      if (error) throw error;

      const loaded = data || [];
      setReceipts(loaded);

      const seen = new Set<string>();
      const options: MonthOption[] = [{ label: 'All Time', value: 'all' }];
      loaded.forEach(r => {
        const d = new Date(r.receipt_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!seen.has(key)) {
          seen.add(key);
          options.push({
            label: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
            value: key,
          });
        }
      });
      setMonthOptions(options);
    } catch (error) {
      console.error('Error loading receipts:', error);
    } finally {
      setLoading(false);
    }
  }

  function getFilteredReceipts(): ReceiptData[] {
    if (selectedMonth === 'all') return receipts;
    return receipts.filter(r => {
      const d = new Date(r.receipt_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });
  }

  function getStats(data: ReceiptData[]) {
    const total = data.reduce((sum, r) => sum + r.total_cost, 0);
    const taxDeductibleCategories = ['Meals', 'Transport', 'Accommodation', 'Office Supplies', 'Communication', 'Parking', 'Fuel'];
    const taxDeductible = data
      .filter(r => taxDeductibleCategories.includes(r.category))
      .reduce((sum, r) => sum + r.total_cost, 0);
    return { total, taxDeductible, count: data.length };
  }

  async function handleExportCSV() {
    const filtered = getFilteredReceipts();
    if (filtered.length === 0) {
      Alert.alert('No Data', 'No receipts found for the selected period.');
      return;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Not Available', 'Sharing is not available on this device.');
      return;
    }

    setExporting(true);
    try {
      const rowsWithUrls = await Promise.all(
        filtered.map(async r => {
          let imageUrl = '';
          if (r.image_path) {
            const { data } = await supabase.storage
              .from('receipts')
              .createSignedUrl(r.image_path, 60 * 60 * 24 * 365);
            imageUrl = data?.signedUrl || '';
          }
          return { ...r, imageUrl };
        })
      );

      const headers = ['Date', 'Supplier', 'Category', 'Amount (CHF)', 'Notes', 'Receipt Image'];
      const rows = rowsWithUrls.map(r => [
        r.receipt_date,
        r.supplier.replace(/"/g, '""'),
        r.category,
        r.total_cost.toFixed(2),
        (r.notes || '').replace(/"/g, '""'),
        r.imageUrl,
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      const periodLabel = selectedMonth === 'all'
        ? 'all-time'
        : (monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth)
            .replace(' ', '-').toLowerCase();
      const fileName = `expenses-${periodLabel}.csv`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csvContent, {
        encoding: 'utf8',
      });

      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Expenses',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'Could not export receipts. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const filtered = getFilteredReceipts();
  const stats = getStats(filtered);
  const selectedLabel = monthOptions.find(m => m.value === selectedMonth)?.label || 'All Time';

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SwissFlag size={32} />
          <Text style={styles.headerTitle}>Export Data</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Loading data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <SwissFlag size={32} />
          <Text style={styles.headerTitle}>Export Data</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Period</Text>
          <TouchableOpacity
            style={styles.monthSelector}
            onPress={() => setShowMonthPicker(!showMonthPicker)}>
            <Calendar size={18} color="#DC2626" strokeWidth={2.5} />
            <Text style={styles.monthSelectorText}>{selectedLabel}</Text>
            <ChevronDown size={18} color="#6b7280" strokeWidth={2.5} />
          </TouchableOpacity>

          {showMonthPicker && (
            <View style={styles.monthDropdown}>
              {monthOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.monthOption, selectedMonth === option.value && styles.monthOptionActive]}
                  onPress={() => { setSelectedMonth(option.value); setShowMonthPicker(false); }}>
                  <Text style={[styles.monthOptionText, selectedMonth === option.value && styles.monthOptionTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <SwissFlag size={24} />
            <Text style={styles.summaryTitle}>{selectedLabel}</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.count}</Text>
              <Text style={styles.statLabel}>Receipts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>CHF {stats.total.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#DC2626' }]}>CHF {stats.taxDeductible.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Tax Deduct.</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Options</Text>
          <TouchableOpacity
            style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
            onPress={handleExportCSV}
            disabled={exporting}>
            {exporting ? (
              <>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.exportButtonText}>Exporting...</Text>
              </>
            ) : (
              <>
                <Download size={24} color="#ffffff" strokeWidth={2.5} />
                <View style={styles.exportButtonContent}>
                  <Text style={styles.exportButtonText}>Export as CSV File</Text>
                  <Text style={styles.exportButtonSubtext}>
                    {stats.count} receipts · Save to Drive, email & more
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About CSV Export</Text>
          <View style={styles.infoList}>
            {[
              'Exports as a proper .csv file attachment',
              'Compatible with Excel, Google Sheets, and Numbers',
              'Includes date, supplier, category, amount and notes',
              'Receipt image links valid for 1 year',
              'Filter by month or export everything at once',
              'Perfect for tax filing and accountant submissions',
            ].map((text, i) => (
              <View key={i} style={styles.infoItem}>
                <View style={styles.infoBullet} />
                <Text style={styles.infoText}>{text}</Text>
              </View>
            ))}
          </View>
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
    backgroundColor: '#ffffff', paddingTop: 60, paddingBottom: 16,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827', letterSpacing: -0.5 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280', fontWeight: '500' },
  content: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12, letterSpacing: -0.3 },
  monthSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f9fafb', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  monthSelectorText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  monthDropdown: {
    backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    marginTop: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  monthOption: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  monthOptionActive: { backgroundColor: '#fef2f2' },
  monthOptionText: { fontSize: 15, color: '#374151', fontWeight: '500' },
  monthOptionTextActive: { color: '#DC2626', fontWeight: '700' },
  summaryCard: {
    backgroundColor: '#f9fafb', borderRadius: 12, padding: 20,
    marginBottom: 24, borderWidth: 1, borderColor: '#e5e7eb',
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#111827', letterSpacing: -0.3 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 40, backgroundColor: '#e5e7eb' },
  statValue: { fontSize: 15, fontWeight: '700', color: '#111827', letterSpacing: -0.3, marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  exportButton: {
    backgroundColor: '#DC2626', borderRadius: 12, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  exportButtonDisabled: { opacity: 0.5 },
  exportButtonContent: { flex: 1 },
  exportButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '700', marginBottom: 2, letterSpacing: -0.3 },
  exportButtonSubtext: { color: '#fecaca', fontSize: 13, fontWeight: '500' },
  infoCard: {
    backgroundColor: '#f9fafb', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e5e7eb',
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12, letterSpacing: -0.2 },
  infoList: { gap: 10 },
  infoItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DC2626', marginTop: 7 },
  infoText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  swissDecoration: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 32, gap: 12,
  },
  swissLine: { width: 60, height: 1, backgroundColor: '#e5e7eb' },
});