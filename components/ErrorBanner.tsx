// components/ErrorBanner.tsx
// Reusable banner for error, warning, and success states.
// Usage:
//   <ErrorBanner type="error" message="Failed to save receipt. Tap to retry." onRetry={handleRetry} />
//   <ErrorBanner type="success" message="Receipt saved." />
//   <ErrorBanner type="warning" message="Saved without image — connection was lost." />

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertCircle, CheckCircle, AlertTriangle, X } from 'lucide-react-native';
import { useState } from 'react';

type BannerType = 'error' | 'warning' | 'success';

interface ErrorBannerProps {
  type: BannerType;
  message: string;
  onRetry?: () => void;
  dismissable?: boolean;
}

const CONFIG = {
  error: {
    background: '#FEF2F2',
    border: '#FECACA',
    text: '#991B1B',
    icon: AlertCircle,
    iconColor: '#DC2626',
  },
  warning: {
    background: '#FFFBEB',
    border: '#FDE68A',
    text: '#92400E',
    icon: AlertTriangle,
    iconColor: '#D97706',
  },
  success: {
    background: '#F0FDF4',
    border: '#BBF7D0',
    text: '#166534',
    icon: CheckCircle,
    iconColor: '#16A34A',
  },
};

export function ErrorBanner({ type, message, onRetry, dismissable = true }: ErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const config = CONFIG[type];
  const Icon = config.icon;

  return (
    <View style={[styles.banner, { backgroundColor: config.background, borderColor: config.border }]}>
      <Icon size={18} color={config.iconColor} strokeWidth={2.5} style={styles.icon} />
      <Text style={[styles.message, { color: config.text }]}>{message}</Text>
      <View style={styles.actions}>
        {onRetry && (
          <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
            <Text style={[styles.retryText, { color: config.text }]}>Retry</Text>
          </TouchableOpacity>
        )}
        {dismissable && (
          <TouchableOpacity onPress={() => setDismissed(true)} style={styles.dismissButton}>
            <X size={16} color={config.text} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 10,
  },
  icon: { flexShrink: 0 },
  message: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  retryButton: { paddingHorizontal: 10, paddingVertical: 4 },
  retryText: { fontSize: 13, fontWeight: '700' },
  dismissButton: { padding: 2 },
});