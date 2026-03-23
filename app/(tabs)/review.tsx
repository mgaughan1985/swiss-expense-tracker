// app/(tabs)/review.tsx
// Manager review queue — shows all submitted receipts for the organisation.
// Employees see an informational state. Managers can bulk-approve or drill in.

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { withRetry, getErrorMessage } from '@/lib/withRetry';
import { ErrorBanner } from '@/components/ErrorBanner';
import { getActiveMembership, isManager, OrgMembership } from '@/lib/organisation';
import { ChevronRight, CheckSquare, Square, CheckCheck, Inbox } from 'lucide-react-native';
import Svg, { Path, Rect } from 'react-native-svg';

function SwissFlag({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" fill="#DC2626" />
      <Path d="M13 9h6v5h5v4h-5v5h-6v-5H8v-4h5V9z" fill="white" />
    </Svg>
  );
}

interface QueueItem {
  id: string;
  supplier: string;
  receipt_date: string;
  category: string;
  total_cost: number;
  project_notes: string | null;
  submitted_at: string | null;
  user_id: string;
}

export default function ReviewScreen() {
  const router = useRouter();
  const [membership, setMembership] = useState<OrgMembership | null | undefined>(undefined); // undefined = loading
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    try {
      const mem = await getActiveMembership();
      setMembership(mem);

      if (!mem || !isManager(mem.role)) {
        setQueue([]);
        return;
      }

      const { data, error } = await supabase
        .from('receipts')
        .select('id, supplier, receipt_date, category, total_cost, project_notes, submitted_at, user_id')
        .eq('organisation_id', mem.organisation_id)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: true });

      if (error) throw error;
      setQueue(data || []);
      setSelected(new Set()); // reset selection on reload
    } catch (error) {
      console.error('Error loading review queue:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === queue.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(queue.map(r => r.id)));
    }
  }

  async function handleBulkApprove() {
    if (selected.size === 0) return;

    Alert.alert(
      'Bulk Approve',
      `Approve ${selected.size} receipt${selected.size === 1 ? '' : 's'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve All',
          onPress: async () => {
            setBanner(null);
            setBulkApproving(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');

              const now = new Date().toISOString();
              const ids = Array.from(selected);

              await withRetry(async () => {
                const { error } = await supabase
                  .from('receipts')
                  .update({
                    status: 'approved',
                    reviewed_by: user.id,
                    reviewed_at: now,
                  })
                  .in('id', ids);
                if (error) throw error;
              });

              setBanner({ type: 'success', message: `${ids.length} receipt${ids.length === 1 ? '' : 's'} approved.` });
              await loadData();
            } catch (error) {
              console.error('Bulk approve error:', error);
              setBanner({ type: 'error', message: getErrorMessage(error) });
            } finally {
              setBulkApproving(false);
            }
          },
        },
      ]
    );
  }

  function renderItem({ item }: { item: QueueItem }) {
    const [iy, im, id] = item.receipt_date.split('-').map(Number);
    const date = new Date(iy, im - 1, id);
    const formattedDate = date.toLocaleDateString('en-CH', { day: '2-digit', month: 'short', year: 'numeric' });
    const isSelected = selected.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => router.push({ pathname: '/review-detail', params: { id: item.id } })}
        activeOpacity={0.7}>
        <TouchableOpacity
          style={styles.checkboxArea}
          onPress={() => toggleSelect(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {isSelected
            ? <CheckSquare size={22} color="#DC2626" strokeWidth={2.5} />
            : <Square size={22} color="#d1d5db" strokeWidth={2} />}
        </TouchableOpacity>

        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardSupplier} numberOfLines={1}>{item.supplier}</Text>
            <Text style={styles.cardAmount}>CHF {item.total_cost.toFixed(2)}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardDate}>{formattedDate}</Text>
            <View style={styles.dot} />
            <Text style={styles.cardCategory}>{item.category}</Text>
          </View>
          {item.project_notes ? (
            <Text style={styles.cardProjectNotes} numberOfLines={1}>
              {item.project_notes}
            </Text>
          ) : null}
        </View>

        <ChevronRight size={18} color="#9ca3af" strokeWidth={2.5} />
      </TouchableOpacity>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading || membership === undefined) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SwissFlag size={32} />
          <Text style={styles.headerTitle}>Review Queue</Text>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
        </View>
      </View>
    );
  }

  // ── No org or employee role ───────────────────────────────────────────────────

  if (!membership || !isManager(membership.role)) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SwissFlag size={32} />
          <Text style={styles.headerTitle}>Review Queue</Text>
        </View>
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconContainer}>
            <Inbox size={48} color="#9ca3af" strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>Manager Access Required</Text>
          <Text style={styles.emptyText}>
            The review queue is available for managers and admins.
            {!membership ? '\n\nYou are not part of an organisation yet.' : ''}
          </Text>
        </View>
      </View>
    );
  }

  // ── Manager view ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <SwissFlag size={32} />
          <View>
            <Text style={styles.headerTitle}>Review Queue</Text>
            <Text style={styles.headerSubtitle}>{membership.name}</Text>
          </View>
        </View>
        {queue.length > 0 && (
          <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllButton}>
            <Text style={styles.selectAllText}>
              {selected.size === queue.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {banner && (
        <ErrorBanner
          type={banner.type}
          message={banner.message}
          onRetry={banner.type === 'error' ? handleBulkApprove : undefined}
        />
      )}

      {queue.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconContainer}>
            <CheckCheck size={48} color="#16a34a" strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>All Clear</Text>
          <Text style={styles.emptyText}>No receipts pending review.</Text>
        </View>
      ) : (
        <>
          <View style={styles.queueHeader}>
            <Text style={styles.queueCount}>{queue.length} pending</Text>
            {selected.size > 0 && (
              <Text style={styles.selectedCount}>{selected.size} selected</Text>
            )}
          </View>

          <FlatList
            data={queue}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); loadData(); }}
                tintColor="#DC2626"
                colors={['#DC2626']}
              />
            }
            showsVerticalScrollIndicator={false}
          />

          {selected.size > 0 && (
            <View style={styles.bulkBar}>
              <TouchableOpacity
                style={[styles.bulkApproveButton, bulkApproving && styles.bulkApproveDisabled]}
                onPress={handleBulkApprove}
                disabled={bulkApproving}>
                {bulkApproving
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <>
                      <CheckCheck size={20} color="#ffffff" strokeWidth={2.5} />
                      <Text style={styles.bulkApproveText}>
                        Approve {selected.size} Receipt{selected.size === 1 ? '' : 's'}
                      </Text>
                    </>}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, color: '#6b7280', fontWeight: '500', marginTop: 1 },
  selectAllButton: { paddingVertical: 6, paddingHorizontal: 10 },
  selectAllText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIconContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8, letterSpacing: -0.3 },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  queueCount: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  selectedCount: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  listContent: { paddingVertical: 8, paddingHorizontal: 16, paddingBottom: 120 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  cardSelected: { borderColor: '#DC2626', backgroundColor: '#fef2f2' },
  checkboxArea: { padding: 2 },
  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardSupplier: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, letterSpacing: -0.2 },
  cardAmount: { fontSize: 15, fontWeight: '700', color: '#DC2626', letterSpacing: -0.3 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardDate: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#d1d5db' },
  cardCategory: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  cardProjectNotes: { fontSize: 12, color: '#DC2626', fontWeight: '600', marginTop: 4 },
  bulkBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  bulkApproveButton: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bulkApproveDisabled: { opacity: 0.5 },
  bulkApproveText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
