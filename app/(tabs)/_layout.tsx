import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { Tabs, useSegments } from 'expo-router';
import { Home, Camera, Receipt, Download } from 'lucide-react-native';

export default function TabLayout() {
  const segments = useSegments();

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // When on any main tab, exit the app instead of navigating back through the stack
      if (segments[0] === '(tabs)') {
        BackHandler.exitApp();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [segments]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#DC2626',
        tabBarInactiveTintColor: '#6b7280',
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ size, color }) => <Home size={size} color={color} /> }} />
      <Tabs.Screen name="camera" options={{ title: 'Camera', tabBarIcon: ({ size, color }) => <Camera size={size} color={color} /> }} />
      <Tabs.Screen name="receipts" options={{ title: 'Receipts', tabBarIcon: ({ size, color }) => <Receipt size={size} color={color} /> }} />
      <Tabs.Screen name="export" options={{ title: 'Export', tabBarIcon: ({ size, color }) => <Download size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="tax-prep" options={{ href: null }} />
      <Tabs.Screen name="documents" options={{ href: null }} />
    </Tabs>
  );
}