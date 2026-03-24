// app/(tabs)/receipts.tsx
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/withRetry';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Receipt, ChevronRight, ChevronDown } from 'lucide-react-native';
import { BeaconFileLogo } from '@/components/BeaconFileLogo';

interface ReceiptItem {
  id: string;
  supplier: string;
  receipt_date: string;
  category: string;
  total_cost: number;
  notes: string | null;
  image_path: string | null;
  created_at: string;
  status: string;
}

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  submitted: { label: 'Submitted', bg: '#F59E0B', text: '#1E293B' },
  approved:  { label: 'Approved',  bg: '#f0fdf4', text: '#166534' },
  rejected:  { label: 'Rejected',  bg: '#fef2f2', text: '#991b1b' },
};

interface MonthSection {
  title: string;       // e.g. "February 2026"
  monthKey: string;    // e.g. "2026-02"
  total: number;
  data: ReceiptItem[];
}

function groupByMonth(receipts: ReceiptItem[]): MonthSection[] {
  const map: Record<string, MonthSection> = {};

  receipts.forEach(r => {
    const [ry, rm, rd] = r.receipt_date.split('-').map(Number);
    const date = new Date(ry, rm - 1, rd);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const title = date.toLocaleString('default', { month: 'long', year: 'numeric' });

    if (!map[monthKey]) {
      map[monthKey] = { title, monthKey, total: 0, data: [] };
    }
    map[monthKey].data.push(r);
    map[monthKey].total += r.total_cost;
  });

  return Object.values(map).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

export default function ReceiptsScreen() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadReceipts();
    }, [])
  );

  async function loadReceipts() {
    setLoadError(null);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user.id)
        .order('receipt_date', { ascending: false });

      if (error) throw error;
      const loaded = data || [];
      setReceipts(loaded);

      // Collapse all months except the most recent by default
      const sections = groupByMonth(loaded);
      if (sections.length > 1) {
        const toCollapse = new Set(sections.slice(1).map(s => s.monthKey));
        setCollapsedMonths(toCollapse);
      }
    } catch (error) {
      console.error('Error loading receipts:', error);
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function toggleMonth(monthKey: string) {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey);
      return next;
    });
  }

  const sections = groupByMonth(receipts);

  // For collapsed months, show empty data array so header still renders
  const visibleSections = sections.map(s => ({
    ...s,
    data: collapsedMonths.has(s.monthKey) ? [] : s.data,
  }));

  const totalAmount = receipts.reduce((sum, r) => sum + r.total_cost, 0);
  const totalCount = receipts.length;

  function renderSectionHeader({ section }: { section: MonthSection }) {
    const isCollapsed = collapsedMonths.has(section.monthKey);
    return (
      <TouchableOpacity
        style={styles.monthHeader}
        onPress={() => toggleMonth(section.monthKey)}
        activeOpacity={0.7}>
        <View style={styles.monthHeaderLeft}>
          {isCollapsed
            ? <ChevronRight size={18} color="#F59E0B" strokeWidth={2.5} />
            : <ChevronDown size={18} color="#F59E0B" strokeWidth={2.5} />}
          <Text style={styles.monthTitle}>{section.title}</Text>
          <Text style={styles.monthCount}>{section.data.length || sections.find(s => s.monthKey === section.monthKey)?.data.length || 0} receipts</Text>
        </View>
        <Text style={styles.monthTotal}>CHF {section.total.toFixed(2)}</Text>
      </TouchableOpacity>
    );
  }

  function renderItem({ item }: { item: ReceiptItem }) {
    const [iy, im, id] = item.receipt_date.split('-').map(Number);
    const date = new Date(iy, im - 1, id);
    const formattedDate = date.toLocaleDateString('en-CH', {
      day: '2-digit',
      month: 'short',
    });

    return (
      <TouchableOpacity
        style={styles.receiptCard}
        onPress={() => router.push({ pathname: '/receipt-detail', params: { id: item.id } })}>
        <View style={styles.receiptLeft}>
          <View style={styles.receiptIcon}>
            <Receipt size={18} color="#F59E0B" strokeWidth={2.5} />
          </View>
          <View style={styles.receiptInfo}>
            <View style={styles.receiptTopRow}>
              <Text style={styles.receiptSupplier}>{item.supplier}</Text>
              {STATUS_BADGE[item.status] && (
                <View style={[styles.statusPill, { backgroundColor: STATUS_BADGE[item.status].bg }]}>
                  <Text style={[styles.statusPillText, { color: STATUS_BADGE[item.status].text }]}>
                    {STATUS_BADGE[item.status].label}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.receiptMeta}>
              <Text style={styles.receiptDate}>{formattedDate}</Text>
              <View style={styles.dot} />
              <Text style={styles.receiptCategory}>{item.category}</Text>
            </View>
          </View>
        </View>
        <View style={styles.receiptRight}>
          <Text style={styles.receiptAmount}>CHF {item.total_cost.toFixed(2)}</Text>
          <ChevronRight size={18} color="#9ca3af" strokeWidth={2.5} />
        </View>
      </TouchableOpacity>
    );
  }

  function renderEmpty() {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Receipt size={64} color="#F59E0B" strokeWidth={2} />
        </View>
        <Text style={styles.emptyTitle}>No Receipts Yet</Text>
        <Text style={styles.emptyText}>Start by scanning your first receipt using the camera tab.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BeaconFileLogo size={32} variant="light" />
          <Text style={styles.headerTitle}>My Receipts</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Loading receipts...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <BeaconFileLogo size={32} variant="light" />
          <Text style={styles.headerTitle}>My Receipts</Text>
        </View>
      </View>

      {loadError && (
        <ErrorBanner
          type="error"
          message={loadError}
          onRetry={loadReceipts}
        />
      )}

      {/* Overall Summary */}
      {receipts.length > 0 && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>All Time</Text>
            <Text style={styles.summaryAmount}>CHF {totalAmount.toFixed(2)}</Text>
            <Text style={styles.summaryCount}>{totalCount} receipts</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardHighlight]}>
            <Text style={styles.summaryLabelHighlight}>This Month</Text>
            <Text style={styles.summaryAmountHighlight}>
              CHF {(sections[0]?.total || 0).toFixed(2)}
            </Text>
            <Text style={styles.summaryCountHighlight}>
              {sections[0]?.data.length || 0} receipts
            </Text>
          </View>
        </View>
      )}

      <SectionList
        sections={visibleSections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          receipts.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadReceipts(); }}
            tintColor="#DC2626"
            colors={['#DC2626']}
          />
        }
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: '#1E293B',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 22, fontWeight: '500', color: '#FEF9EE', letterSpacing: -0.5, fontFamily: 'DMSans_500Medium' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280', fontWeight: '500' },

  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  summaryCard: {
    flex: 1, backgroundColor: '#f9fafb', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#e5e7eb',
  },
  summaryCardHighlight: {
    backgroundColor: '#FFFBEB', borderColor: '#F59E0B', borderWidth: 2,
  },
  summaryLabel: { fontSize: 11, color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryLabelHighlight: { fontSize: 11, color: '#D97706', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryAmount: { fontSize: 18, fontWeight: '700', color: '#111827', letterSpacing: -0.5 },
  summaryAmountHighlight: { fontSize: 18, fontWeight: '700', color: '#1E293B', letterSpacing: -0.5 },
  summaryCount: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  summaryCountHighlight: { fontSize: 12, color: '#D97706', marginTop: 2, opacity: 0.8 },

  listContent: { paddingBottom: 40 },
  listContentEmpty: { flex: 1 },

  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0,
  },
  monthHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthTitle: { fontSize: 15, fontWeight: '500', color: '#FEF9EE', letterSpacing: -0.3, fontFamily: 'DMSans_500Medium' },
  monthCount: { fontSize: 12, color: 'rgba(254,249,238,0.5)', fontWeight: '400' },
  monthTotal: { fontSize: 15, fontWeight: '500', color: '#F59E0B', letterSpacing: -0.3, fontFamily: 'DMSans_500Medium' },

  receiptCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  receiptLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  receiptIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#FCD34D',
  },
  receiptInfo: { flex: 1 },
  receiptTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  receiptSupplier: { fontSize: 15, fontWeight: '700', color: '#111827', letterSpacing: -0.2, flex: 1 },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  statusPillText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  receiptMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  receiptDate: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#d1d5db' },
  receiptCategory: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  receiptRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  receiptAmount: { fontSize: 15, fontWeight: '700', color: '#1E293B', letterSpacing: -0.3 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingTop: 80 },
  emptyIconContainer: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 2, borderColor: '#F59E0B',
  },
  emptyTitle: { fontSize: 24, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 8, letterSpacing: -0.5 },
  emptyText: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
});
