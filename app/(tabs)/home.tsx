/// app/(tabs)/home.tsx
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Camera, Receipt, Download, UserCircle, TrendingUp } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import CropTool, { CropRegion } from '@/components/CropTool';
import { BeaconFileLogo } from '@/components/BeaconFileLogo';

interface MonthStats {
  total: number;
  count: number;
  byCategory: { category: string; amount: number }[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Meals: '#F59E0B',
  Transport: '#2563EB',
  Accommodation: '#059669',
  'Office Supplies': '#D97706',
  Communication: '#7C3AED',
  Parking: '#0891B2',
  Fuel: '#374151',
  food: '#F59E0B',
  Other: '#9CA3AF',
};

export default function HomeScreen() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [stats, setStats] = useState<MonthStats>({ total: 0, count: 0, byCategory: [] });
  const [loadingStats, setLoadingStats] = useState(true);
  const [monthLabel, setMonthLabel] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadMonthStats();
    }, [])
  );

  async function loadMonthStats() {
    setLoadingStats(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      setMonthLabel(now.toLocaleString('default', { month: 'long', year: 'numeric' }));

      const { data, error } = await supabase
        .from('receipts')
        .select('category, total_cost')
        .eq('user_id', user.id)
        .gte('receipt_date', firstDay)
        .lte('receipt_date', lastDay);

      if (error) throw error;

      const total = data?.reduce((sum, r) => sum + r.total_cost, 0) || 0;
      const count = data?.length || 0;

      const categoryMap: Record<string, number> = {};
      data?.forEach(r => {
        categoryMap[r.category] = (categoryMap[r.category] || 0) + r.total_cost;
      });
      const byCategory = Object.entries(categoryMap)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4);

      setStats({ total, count, byCategory });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoadingStats(false);
    }
  }

  async function handleScanReceipt() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission Required', 'Please enable camera access in your device settings.');
        return;
      }

      // No native crop UI — we handle cropping ourselves
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.9,
        exif: false,
      });

      if (result.canceled) return;

      const photo = result.assets[0];
      setPendingPhoto({ uri: photo.uri, width: photo.width, height: photo.height });

    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  }

  async function handleCrop(region: CropRegion) {
    if (!pendingPhoto) return;
    try {
      const processed = await ImageManipulator.manipulateAsync(
        pendingPhoto.uri,
        [
          {
            crop: {
              originX: Math.round(region.x      * pendingPhoto.width),
              originY: Math.round(region.y      * pendingPhoto.height),
              width:   Math.round(region.width  * pendingPhoto.width),
              height:  Math.round(region.height * pendingPhoto.height),
            },
          },
          { resize: { width: 1200 } },
        ],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      setPendingPhoto(null);
      await uploadImage(processed.uri);
    } catch (error) {
      console.error('Crop error:', error);
      Alert.alert('Error', 'Failed to crop photo. Please try again.');
    }
  }

  function handleCancelCrop() {
    setPendingPhoto(null);
  }

  async function uploadImage(uri: string) {
    setIsUploading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        Alert.alert('Authentication Error', 'Please log in to upload receipts');
        return;
      }

      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const timestamp = Date.now();
      const fileName = `receipt_${timestamp}.jpg`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) throw uploadError;

      router.push({ pathname: '/receipt-form', params: { imagePath: filePath } });
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Could not upload the photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  // ── Show crop tool if a photo has been captured ───────────────────────────
  if (pendingPhoto) {
    return (
      <CropTool
        imageUri={pendingPhoto.uri}
        onCrop={handleCrop}
        onCancel={handleCancelCrop}
      />
    );
  }

  // ── Normal home screen ────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <BeaconFileLogo size={40} variant="light" />
          <View style={styles.headerText}>
            <Text style={styles.headerWordmark}>
              <Text style={styles.headerWordmarkBeacon}>Beacon</Text>
              <Text style={styles.headerWordmarkFile}>File</Text>
            </Text>
            <Text style={styles.subtitle}>Work expense tracker</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/(tabs)/profile')}>
          <UserCircle size={28} color="#F59E0B" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Main Actions */}
        <View style={styles.grid}>
          <TouchableOpacity
            style={[styles.card, styles.cardPrimary, isUploading && styles.cardDisabled]}
            onPress={handleScanReceipt}
            disabled={isUploading}>
            <View style={styles.cardIcon}>
              {isUploading
                ? <ActivityIndicator size="large" color="#F59E0B" />
                : <Camera size={32} color="#F59E0B" strokeWidth={2} />}
            </View>
            <Text style={styles.cardTitle}>{isUploading ? 'Uploading...' : 'Scan Receipt'}</Text>
            <Text style={styles.cardDescription}>
              {isUploading ? 'Please wait' : 'Tap to open camera instantly'}
            </Text>
          </TouchableOpacity>

          <View style={styles.cardRow}>
            <TouchableOpacity
              style={[styles.card, styles.cardSmall]}
              onPress={() => router.push('/(tabs)/receipts')}>
              <View style={styles.cardIconSmall}>
                <Receipt size={24} color="#374151" strokeWidth={2} />
              </View>
              <Text style={styles.cardTitleSmall}>My Receipts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.card, styles.cardSmall]}
              onPress={() => router.push('/(tabs)/export')}>
              <View style={styles.cardIconSmall}>
                <Download size={24} color="#374151" strokeWidth={2} />
              </View>
              <Text style={styles.cardTitleSmall}>Export Data</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Monthly Dashboard */}
        <View style={styles.dashboardContainer}>
          <View style={styles.dashboardHeader}>
            <TrendingUp size={18} color="#F59E0B" strokeWidth={2.5} />
            <Text style={styles.dashboardTitle}>{monthLabel}</Text>
          </View>

          {loadingStats ? (
            <ActivityIndicator size="small" color="#F59E0B" style={{ marginVertical: 20 }} />
          ) : (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>CHF {stats.total.toFixed(2)}</Text>
                  <Text style={styles.statLabel}>Total Spent</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{stats.count}</Text>
                  <Text style={styles.statLabel}>Receipts</Text>
                </View>
              </View>

              {stats.byCategory.length > 0 ? (
                <View style={styles.categoryBreakdown}>
                  <Text style={styles.breakdownTitle}>Top Categories</Text>
                  {stats.byCategory.map(({ category, amount }) => {
                    const pct = stats.total > 0 ? (amount / stats.total) * 100 : 0;
                    const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
                    return (
                      <View key={category} style={styles.categoryRow}>
                        <View style={styles.categoryLabelRow}>
                          <View style={[styles.categoryDot, { backgroundColor: color }]} />
                          <Text style={styles.categoryName}>{category}</Text>
                          <Text style={styles.categoryAmount}>CHF {amount.toFixed(2)}</Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyMonth}>
                  <Text style={styles.emptyMonthText}>No receipts logged this month yet.</Text>
                  <Text style={styles.emptyMonthSub}>Tap Scan Receipt to get started.</Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.swissDecoration}>
          <View style={styles.swissLine} />
          <BeaconFileLogo size={20} variant="light" />
          <View style={styles.swissLine} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF9EE' },
  header: {
    backgroundColor: '#1E293B',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { gap: 2 },
  headerWordmark: { fontSize: 20, letterSpacing: -0.3 },
  headerWordmarkBeacon: { color: '#FEF9EE', fontWeight: '500', fontFamily: 'DMSans_500Medium' },
  headerWordmarkFile:   { color: '#F59E0B', fontWeight: '400', fontFamily: 'DMSans_400Regular' },
  profileButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  subtitle: { fontSize: 13, color: 'rgba(254,249,238,0.55)', fontFamily: 'DMSans_400Regular' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  grid: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  cardRow: { flexDirection: 'row', gap: 12 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  cardPrimary: { backgroundColor: '#FFFBEB', borderColor: '#F59E0B', borderWidth: 2 },
  cardSmall: { flex: 1, padding: 16 },
  cardDisabled: { opacity: 0.6 },
  cardIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 2, borderColor: '#F59E0B',
  },
  cardIconSmall: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#f9fafb', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4, letterSpacing: -0.3 },
  cardTitleSmall: { fontSize: 15, fontWeight: '600', color: '#111827', textAlign: 'center' },
  cardDescription: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  dashboardContainer: {
    backgroundColor: '#f9fafb', marginHorizontal: 20, marginTop: 24,
    borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e5e7eb',
  },
  dashboardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  dashboardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', letterSpacing: -0.3 },
  statsRow: { flexDirection: 'row', marginBottom: 20 },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#e5e7eb', marginVertical: 4 },
  statValue: { fontSize: 24, fontWeight: '700', color: '#1E293B', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  categoryBreakdown: { gap: 12 },
  breakdownTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  categoryRow: { gap: 6 },
  categoryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  categoryName: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },
  categoryAmount: { fontSize: 14, color: '#111827', fontWeight: '600' },
  barTrack: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  emptyMonth: { alignItems: 'center', paddingVertical: 16 },
  emptyMonthText: { fontSize: 15, color: '#374151', fontWeight: '600', marginBottom: 4 },
  emptyMonthSub: { fontSize: 13, color: '#9CA3AF' },
  swissDecoration: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginTop: 32, gap: 12,
  },
  swissLine: { width: 60, height: 1, backgroundColor: '#e5e7eb' },
});