import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';
import { initNotificationHandler } from '@/lib/notifications';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__,
  tracesSampleRate: 0,
});

export default Sentry.wrap(function RootLayout() {
  useEffect(() => { initNotificationHandler(); }, []);

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
});
