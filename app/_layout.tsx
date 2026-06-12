import { useEffect, Component, type ReactNode } from 'react';
import { View, Text, AppState } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { enableScreens } from 'react-native-screens';
import * as Sentry from '@sentry/react-native';
import { initNotificationHandler } from '@/lib/notifications';
import { initAnonAuth } from '@/lib/supabase';
import { useTournamentStore } from '@/store/tournament';

// Disable native screens to prevent an NSException crash on iOS 26 + certain iPad models
// (ScreenStackNativeComponent throws in ObjCTurboModule dispatch during startup).
// The patch in patches/react-native-screens+4.25.2.patch makes ScreenStack respect this flag.
// Remove once react-native-screens ships a stable iOS 26 fix.
enableScreens(false);

Sentry.init({
  dsn: 'https://c1454766247305cb502d6094ebcac419@o4511434260873216.ingest.us.sentry.io/4511504421617664',
  sendDefaultPii: true,
  enableLogs: true,
  // All integrations that hook into the native view hierarchy are disabled on iOS 26 + New
  // Architecture — they dispatch TurboModule calls during init that throw NSExceptions.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  integrations: [],
});

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { Sentry.captureException(error); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#1d100e', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', paddingHorizontal: 32 }}>
            Something went wrong. Please restart the app.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Defer off the initial render tick to avoid crashing the Hermes GC during
    // startup — expo-notifications throws an NSException on some iPad/iOS combos
    // that corrupts the JS runtime if called synchronously at mount.
    const t = setTimeout(initNotificationHandler, 500);
    initAnonAuth().catch(() => {});

    // When the app returns to the foreground, reset to the intro screen unless
    // a game is actively in progress (both recipe slots filled = mid-matchup or
    // champion just crowned). Without this, iOS keeps the backgrounded JS alive
    // and the user re-enters directly on the lobby instead of the mode-select screen.
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const { leftRecipe, rightRecipe } = useTournamentStore.getState();
        if (!leftRecipe || !rightRecipe) {
          router.replace('/');
        }
      }
    });

    return () => { clearTimeout(t); sub.remove(); };
  }, []);

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#1d100e' },
          animation: 'slide_from_right',
        }}
      />
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
