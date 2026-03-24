import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { Tabs, useSegments } from 'expo-router';
import { Home, Camera, Receipt, Download, Inbox } from 'lucide-react-native';

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
        tabBarActiveTintColor: '#F59E0B',
        tabBarInactiveTintColor: 'rgba(254,249,238,0.5)',
        tabBarStyle: {
          backgroundColor: '#1E293B',
          borderTopColor: 'rgba(254,249,238,0.1)',
        },
        tabBarLabelStyle: {
          fontFamily: 'DMSans_500Medium',
          fontSize: 11,
        },
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ size, color }) => <Home size={size} color={color} /> }} />
      <Tabs.Screen name="camera" options={{ title: 'Camera', tabBarIcon: ({ size, color }) => <Camera size={size} color={color} /> }} />
      <Tabs.Screen name="receipts" options={{ title: 'Receipts', tabBarIcon: ({ size, color }) => <Receipt size={size} color={color} /> }} />
      <Tabs.Screen name="export" options={{ title: 'Export', tabBarIcon: ({ size, color }) => <Download size={size} color={color} /> }} />
      <Tabs.Screen name="review" options={{ title: 'Review', tabBarIcon: ({ size, color }) => <Inbox size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="tax-prep" options={{ href: null }} />
      <Tabs.Screen name="documents" options={{ href: null }} />
    </Tabs>
  );
}