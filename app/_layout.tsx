import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout);

      if (session) {
        // Check whether the user opted out of staying signed in
        const keepSignedIn = await AsyncStorage.getItem('keepSignedIn');
        if (keepSignedIn === 'false') {
          // They chose not to persist — sign them out silently and go to login
          await supabase.auth.signOut();
          setSession(null);
        } else {
          setSession(session);
        }
      } else {
        setSession(null);
      }

      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="index" />
      <Stack.Screen name="receipt-form" />
      <Stack.Screen name="receipt-detail" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}