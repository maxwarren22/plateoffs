import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initNotificationHandler } from '@/lib/notifications';

export default function RootLayout() {
  useEffect(() => {
    // Defer off the initial render tick to avoid crashing the Hermes GC during
    // startup — expo-notifications throws an NSException on some iPad/iOS combos
    // that corrupts the JS runtime if called synchronously at mount.
    const t = setTimeout(initNotificationHandler, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#1d100e' },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}
