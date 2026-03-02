// app/(tabs)/documents.tsx
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

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

export default function DocumentsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <SwissFlag size={32} />
          <Text style={styles.headerTitle}>Documents</Text>
        </View>
      </View>
      <View style={styles.content}>
        <Text style={styles.comingSoon}>Coming Soon</Text>
        <Text style={styles.description}>
          Upload and manage your tax documents here
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  comingSoon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});
