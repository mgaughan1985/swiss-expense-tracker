// app/(tabs)/tax-prep.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  Calendar,
  CheckSquare,
  Square,
  TrendingUp,
  FileText,
  Home as HomeIcon,
  Download,
} from 'lucide-react-native';
import Svg, { Path, Rect } from 'react-native-svg';

// Swiss Flag Component
function SwissFlag({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" fill="#DC2626" />
      <Path
        d="M13 9h6v5h5v4h-5v5h-6v-5H8v-4h5V9z"
        fill="white"
      />
    </Svg>
  );
}

const TAX_CHECKLIST_ITEMS = [
  { id: 1, name: 'Swiss ID or residence permit', category: 'Identity' },
  { id: 2, name: 'Previous year tax ruling', category: 'Tax Documents' },
  { id: 3, name: 'Transmittal form from tax authorities', category: 'Tax Documents' },
  { id: 4, name: 'Salary certificate (Lohnausweis)', category: 'Income' },
  { id: 5, name: 'Other income certificates (rent, family allowance)', category: 'Income' },
  { id: 6, name: 'Training/education expenses certificate', category: 'Deductions' },
  { id: 7, name: '3rd pillar A certificate', category: 'Deductions' },
  { id: 8, name: '2nd pillar (LPP) purchase certificate', category: 'Deductions' },
  { id: 9, name: 'Life insurance & 3rd pillar B contributions', category: 'Deductions' },
  { id: 10, name: 'Bank account tax certificates (Swiss & foreign)', category: 'Assets' },
  { id: 11, name: 'Investment/cryptocurrency certificates', category: 'Assets' },
  { id: 12, name: 'Real estate ownership certificate', category: 'Property' },
  { id: 13, name: 'Real estate bills and fees', category: 'Property' },
  { id: 14, name: 'Loan interest certification', category: 'Debts' },
  { id: 15, name: 'Mortgage debt and interest certificate', category: 'Debts' },
  { id: 16, name: 'Alimony proof (paid or received)', category: 'Other' },
  { id: 17, name: 'Health insurance premiums proof', category: 'Deductions' },
  { id: 18, name: 'Medical expenses not reimbursed', category: 'Deductions' },
  { id: 19, name: 'Donation receipts (Swiss organizations)', category: 'Deductions' },
  { id: 20, name: 'Rental lease', category: 'Property' },
  { id: 21, name: 'Union dues', category: 'Deductions' },
];

export default function TaxPrepScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [wfhDays, setWfhDays] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<{ [key: number]: boolean }>({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [receiptStats, setReceiptStats] = useState({
    total: 0,
    taxDeductible: 0,
    count: 0,
    byCategory: {} as { [key: string]: number },
  });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [currentMonth])
  );

  async function loadData() {
    setLoading(true);
    try {
      const catsRes = await supabase
        .from('categories')
        .select('name, tax_deductible')
        .eq('is_active', true);
      const taxCats = new Set<string>(
        (catsRes.data || []).filter(c => c.tax_deductible).map(c => c.name)
      );
      await Promise.all([
        loadWFHDays(),
        loadChecklist(),
        loadReceiptStats(taxCats),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadWFHDays() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('work_from_home_days')
        .select('work_date')
        .eq('user_id', user.id)
        .gte('work_date', startOfMonth.toISOString().split('T')[0])
        .lte('work_date', endOfMonth.toISOString().split('T')[0]);

      if (error) throw error;
      setWfhDays(data?.map(d => d.work_date) || []);
    } catch (error) {
      console.error('Error loading WFH days:', error);
    }
  }

  async function loadChecklist() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('tax_checklist_items')
        .select('item_name, is_completed')
        .eq('user_id', user.id);

      if (error) throw error;

      const checklistMap: { [key: number]: boolean } = {};
      data?.forEach(item => {
        const found = TAX_CHECKLIST_ITEMS.find(i => i.name === item.item_name);
        if (found) {
          checklistMap[found.id] = item.is_completed;
        }
      });
      setChecklist(checklistMap);
    } catch (error) {
      console.error('Error loading checklist:', error);
    }
  }

  async function loadReceiptStats(taxCats: Set<string>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('receipts')
        .select('total_cost, category')
        .eq('user_id', user.id);

      if (error) throw error;

      const total = data?.reduce((sum, r) => sum + r.total_cost, 0) || 0;
      const taxDeductible = data?.filter(r => taxCats.has(r.category))
        .reduce((sum, r) => sum + r.total_cost, 0) || 0;

      const byCategory: { [key: string]: number } = {};
      data?.forEach(r => {
        byCategory[r.category] = (byCategory[r.category] || 0) + r.total_cost;
      });

      setReceiptStats({
        total,
        taxDeductible,
        count: data?.length || 0,
        byCategory,
      });
    } catch (error) {
      console.error('Error loading receipt stats:', error);
    }
  }

  async function toggleWFHDay(date: Date) {
    const dateStr = date.toISOString().split('T')[0];
    const isMarked = wfhDays.includes(dateStr);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isMarked) {
        const { error } = await supabase
          .from('work_from_home_days')
          .delete()
          .eq('user_id', user.id)
          .eq('work_date', dateStr);

        if (error) throw error;
        setWfhDays(wfhDays.filter(d => d !== dateStr));
      } else {
        const { error } = await supabase
          .from('work_from_home_days')
          .insert({ user_id: user.id, work_date: dateStr });

        if (error) throw error;
        setWfhDays([...wfhDays, dateStr]);
      }
    } catch (error) {
      console.error('Error toggling WFH day:', error);
      Alert.alert('Error', 'Failed to update work-from-home day');
    }
  }

  async function toggleChecklistItem(itemId: number, itemName: string) {
    const isCompleted = checklist[itemId] || false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const item = TAX_CHECKLIST_ITEMS.find(i => i.id === itemId);
      if (!item) return;

      const { error } = await supabase
        .from('tax_checklist_items')
        .upsert({
          user_id: user.id,
          item_name: itemName,
          item_category: item.category,
          is_completed: !isCompleted,
        }, {
          onConflict: 'user_id,item_name',
        });

      if (error) throw error;

      setChecklist({ ...checklist, [itemId]: !isCompleted });
    } catch (error) {
      console.error('Error toggling checklist item:', error);
      Alert.alert('Error', 'Failed to update checklist');
    }
  }

  function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Header
    days.push(
      <View key="header" style={styles.calendarHeader}>
        <TouchableOpacity
          onPress={() => setCurrentMonth(new Date(year, month - 1, 1))}
          style={styles.monthButton}>
          <Text style={styles.monthButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity
          onPress={() => setCurrentMonth(new Date(year, month + 1, 1))}
          style={styles.monthButton}
          disabled={month >= new Date().getMonth() && year >= new Date().getFullYear()}>
          <Text style={[styles.monthButtonText, month >= new Date().getMonth() && year >= new Date().getFullYear() && styles.monthButtonDisabled]}>→</Text>
        </TouchableOpacity>
      </View>
    );

    // Week day labels
    days.push(
      <View key="weekdays" style={styles.weekDaysRow}>
        {weekDays.map(day => (
          <Text key={day} style={styles.weekDayLabel}>{day}</Text>
        ))}
      </View>
    );

    // Calendar days
    const calendarDays = [];
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      const isMarked = wfhDays.includes(dateStr);
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      const isFuture = date > new Date();
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      calendarDays.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            isMarked && styles.calendarDayMarked,
            isToday && styles.calendarDayToday,
          ]}
          onPress={() => !isFuture && toggleWFHDay(date)}
          disabled={isFuture}>
          <Text
            style={[
              styles.calendarDayText,
              isMarked && styles.calendarDayTextMarked,
              isWeekend && styles.calendarDayTextWeekend,
              isFuture && styles.calendarDayTextDisabled,
            ]}>
            {day}
          </Text>
          {isMarked && <View style={styles.wfhDot} />}
        </TouchableOpacity>
      );
    }

    days.push(
      <View key="days" style={styles.calendarGrid}>
        {calendarDays}
      </View>
    );

    return days;
  }

  const completedItems = Object.values(checklist).filter(Boolean).length;
  const totalItems = TAX_CHECKLIST_ITEMS.length;
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SwissFlag size={32} />
          <Text style={styles.headerTitle}>Tax Preparation</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Loading tax data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <SwissFlag size={32} />
          <Text style={styles.headerTitle}>Tax Preparation</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <TrendingUp size={24} color="#DC2626" strokeWidth={2.5} />
            <Text style={styles.statValue}>CHF {receiptStats.taxDeductible.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Tax Deductible</Text>
          </View>
          <View style={styles.statCard}>
            <HomeIcon size={24} color="#DC2626" strokeWidth={2.5} />
            <Text style={styles.statValue}>{wfhDays.length}</Text>
            <Text style={styles.statLabel}>WFH Days (This Month)</Text>
          </View>
        </View>

        {/* Work From Home Calendar */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Calendar size={20} color="#DC2626" strokeWidth={2.5} />
            <Text style={styles.sectionTitle}>Work From Home Tracker</Text>
          </View>
          <View style={styles.calendar}>
            {renderCalendar()}
          </View>
          <Text style={styles.calendarHint}>
            Tap days you worked from home. Weekend days are shown in gray.
          </Text>
        </View>

        {/* Tax Checklist */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FileText size={20} color="#DC2626" strokeWidth={2.5} />
            <Text style={styles.sectionTitle}>Tax Document Checklist</Text>
          </View>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {completedItems} of {totalItems} completed ({Math.round(progress)}%)
            </Text>
          </View>

          <View style={styles.checklistContainer}>
            {TAX_CHECKLIST_ITEMS.map(item => {
              const isCompleted = checklist[item.id] || false;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.checklistItem}
                  onPress={() => toggleChecklistItem(item.id, item.name)}>
                  {isCompleted ? (
                    <CheckSquare size={24} color="#DC2626" strokeWidth={2.5} />
                  ) : (
                    <Square size={24} color="#9ca3af" strokeWidth={2.5} />
                  )}
                  <View style={styles.checklistItemContent}>
                    <Text style={[styles.checklistItemText, isCompleted && styles.checklistItemTextCompleted]}>
                      {item.name}
                    </Text>
                    <Text style={styles.checklistItemCategory}>{item.category}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/export')}>
            <Download size={20} color="#ffffff" strokeWidth={2.5} />
            <Text style={styles.actionButtonText}>Export Data</Text>
          </TouchableOpacity>
        </View>

        {/* Swiss Decoration */}
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
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  calendar: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthButton: {
    padding: 8,
  },
  monthButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#DC2626',
  },
  monthButtonDisabled: {
    color: '#d1d5db',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  calendarDayMarked: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: '#DC2626',
    borderRadius: 8,
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  calendarDayTextMarked: {
    color: '#ffffff',
    fontWeight: '700',
  },
  calendarDayTextWeekend: {
    color: '#9ca3af',
  },
  calendarDayTextDisabled: {
    color: '#d1d5db',
  },
  wfhDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
  calendarHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 12,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#DC2626',
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  checklistContainer: {
    gap: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
  },
  checklistItemContent: {
    flex: 1,
  },
  checklistItemText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    marginBottom: 2,
  },
  checklistItemTextCompleted: {
    color: '#6b7280',
    textDecorationLine: 'line-through',
  },
  checklistItemCategory: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  swissDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 12,
  },
  swissLine: {
    width: 60,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
});
