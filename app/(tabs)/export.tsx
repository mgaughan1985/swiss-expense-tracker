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
import { getErrorMessage } from '@/lib/withRetry';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Download, Calendar, ChevronDown, Globe } from 'lucide-react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { EXPORT_PROFILES, DEFAULT_PROFILE_ID, ExportProfile } from '@/lib/exportProfiles';

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
  const [selectedProfileId, setSelectedProfileId] = useState<string>(DEFAULT_PROFILE_ID);
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [taxDeductibleCats, setTaxDeductibleCats] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<{ type: 'error' | 'warning'; message: string } | null>(null);

  const selectedProfile: ExportProfile =
    EXPORT_PROFILES.find(p => p.id === selectedProfileId) ?? EXPORT_PROFILES[0];

  useEffect(() => {
    loadReceipts();
  }, []);

  async function loadReceipts() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      const [receiptsRes, catsRes] = await Promise.all([
        supabase
          .from('receipts')
          .select('id, supplier, receipt_date, category, total_cost, notes, image_path, created_at')
          .eq('user_id', user.id)
          .order('receipt_date', { ascending: false }),
        supabase.from('categories').select('name, tax_deductible').eq('is_active', true),
      ]);

      if (receiptsRes.error) throw receiptsRes.error;

      const loaded = receiptsRes.data || [];
      setTaxDeductibleCats(new Set(
        (catsRes.data || []).filter(c => c.tax_deductible).map(c => c.name)
      ));
      setReceipts(loaded);

      const seen = new Set<string>();
      const options: MonthOption[] = [{ label: 'All Time', value: 'all' }];
      loaded.forEach(r => {
        const [ey, em, ed] = r.receipt_date.split('-').map(Number);
        const d = new Date(ey, em - 1, ed);
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
      const [fy, fm, fd] = r.receipt_date.split('-').map(Number);
      const d = new Date(fy, fm - 1, fd);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });
  }

  function getStats(data: ReceiptData[], deductibleCats: Set<string>) {
    const total = data.reduce((sum, r) => sum + r.total_cost, 0);
    const taxDeductible = data
      .filter(r => deductibleCats.has(r.category))
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

    setBanner(null);
    setExporting(true);
    try {
      // Generate signed URLs for all receipt images
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

      const failedUrls = rowsWithUrls.filter(r => r.image_path && !r.imageUrl).length;

      // Use selected profile to build headers and rows
      const { headers, mapRow } = selectedProfile;
      const rows = rowsWithUrls.map(r => mapRow(r));

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const periodLabel = selectedMonth === 'all'
        ? 'all-time'
        : (monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth)
            .replace(/\s+/g, '-').toLowerCase();
      const fileName = `expenses-${periodLabel}-${selectedProfile.filenameSuffix}.csv`;
      if (!FileSystem.cacheDirectory) throw new Error('Cache directory unavailable');
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csvContent, {
        encoding: 'utf8',
      });

      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: `Export for ${selectedProfile.software}`,
        UTI: 'public.comma-separated-values-text',
      });

      if (failedUrls > 0) {
        setBanner({
          type: 'warning',
          message: `${failedUrls} receipt image ${failedUrls === 1 ? 'link' : 'links'} could not be generated and will be blank in the CSV.`,
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      setBanner({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setExporting(false);
    }
  }

  const filtered = getFilteredReceipts();
  const stats = getStats(filtered, taxDeductibleCats);
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

      {banner && (
        <ErrorBanner
          type={banner.type}
          message={banner.message}
          onRetry={banner.type === 'error' ? handleExportCSV : undefined}
        />
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ── Accounting Software Selector ─────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accounting Software</Text>
          <TouchableOpacity
            style={styles.monthSelector}
            onPress={() => {
              setShowProfilePicker(!showProfilePicker);
              setShowMonthPicker(false);
            }}>
            <Globe size={18} color="#DC2626" strokeWidth={2.5} />
            <View style={styles.profileSelectorText}>
              <Text style={styles.monthSelectorText}>{selectedProfile.label}</Text>
              <Text style={styles.profileSubtext}>{selectedProfile.country} · {selectedProfile.currency}</Text>
            </View>
            <ChevronDown size={18} color="#6b7280" strokeWidth={2.5} />
          </TouchableOpacity>

          {showProfilePicker && (
            <View style={styles.monthDropdown}>
              {EXPORT_PROFILES.map(profile => (
                <TouchableOpacity
                  key={profile.id}
                  style={[
                    styles.monthOption,
                    selectedProfileId === profile.id && styles.monthOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedProfileId(profile.id);
                    setShowProfilePicker(false);
                  }}>
                  <Text style={[
                    styles.monthOptionText,
                    selectedProfileId === profile.id && styles.monthOptionTextActive,
                  ]}>
                    {profile.label}
                  </Text>
                  <Text style={styles.profileOptionSubtext}>
                    {profile.country} · {profile.currency}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Period Selector ───────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Period</Text>
          <TouchableOpacity
            style={styles.monthSelector}
            onPress={() => {
              setShowMonthPicker(!showMonthPicker);
              setShowProfilePicker(false);
            }}>
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

        {/* ── Summary Card ─────────────────────────────────────────── */}
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
              <Text style={styles.statValue}>{selectedProfile.currency} {stats.total.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#DC2626' }]}>{selectedProfile.currency} {stats.taxDeductible.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Tax Deduct.</Text>
            </View>
          </View>
        </View>

        {/* ── Export Button ────────────────────────────────────────── */}
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
                  <Text style={styles.exportButtonText}>
                    Export for {selectedProfile.software}
                  </Text>
                  <Text style={styles.exportButtonSubtext}>
                    {stats.count} receipts · {selectedProfile.country} · {selectedProfile.currency}
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Info Card ────────────────────────────────────────────── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            About {selectedProfile.software} Export ({selectedProfile.country})
          </Text>
          <View style={styles.infoList}>
            {getProfileInfo(selectedProfile).map((text, i) => (
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

function getProfileInfo(profile: ExportProfile): string[] {
  switch (profile.id) {
    case 'bexio-ch':
     return [
    'Formatted as a bookkeeper reconciliation file for Bexio',
    'Column order mirrors the Bexio expense entry screen',
    'Date format: DD.MM.YYYY (Swiss standard)',
    'Gross and Net calculated using Swiss VAT rates (8.1% standard)',
    'Accounting account codes included for each category',
    'Receipt image links valid for 1 year',
  ];
    case 'sage-ie':
      return [
        'Formatted for Sage Business Cloud (Ireland)',
        'Date format: DD/MM/YYYY',
        'VAT rates: T1 (23%), T0 (zero/exempt)',
        'Net, Tax and Gross amounts calculated automatically',
        'Import via Sage → Purchases → Import',
        'Receipt image links valid for 1 year',
      ];
    case 'sage-uk':
      return [
        'Formatted for Sage Business Cloud (United Kingdom)',
        'Date format: DD/MM/YYYY',
        'VAT rates: T1 (20%), T5 (5%), T0 (zero/exempt)',
        'Net, Tax and Gross amounts calculated automatically',
        'Import via Sage → Purchases → Import',
        'Receipt image links valid for 1 year',
      ];
    default:
      return [
        'Exports as a proper .csv file attachment',
        'Compatible with Excel, Google Sheets, and Numbers',
        'Receipt image links valid for 1 year',
      ];
  }
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
  profileSelectorText: { flex: 1 },
  monthSelectorText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  profileSubtext: { fontSize: 12, color: '#6b7280', fontWeight: '500', marginTop: 1 },
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
  profileOptionSubtext: { fontSize: 12, color: '#9ca3af', fontWeight: '400', marginTop: 2 },
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