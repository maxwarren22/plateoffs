import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { IS_TABLET } from '@/constants/layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { s } from '@/styles/intro.styles';
import { C } from '@/constants/colors';
import { AppFooter } from '@/components/AppFooter';
import { useLobbyStore } from '@/store/lobby';
import { useSessionStore } from '@/store/session';


export default function IntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefetch = useLobbyStore((state) => state.prefetch);
  const { lastSessionCode, lastSessionDivisionName, lastSessionExpiresAt, clearLastSession } = useSessionStore();
  const [joinMode, setJoinMode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => { prefetch(); }, []);

  const hasActiveSession = !!lastSessionCode &&
    !!lastSessionExpiresAt &&
    new Date(lastSessionExpiresAt).getTime() > Date.now();

  async function handleJoinByCode() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    setJoining(true);
    setJoinError(null);
    try {
      router.push(`/session/${code}`);
    } finally {
      setJoining(false);
    }
  }

  return (
    <View style={s.root}>
      {/* Background patterns could go here */}
      
      <View style={[s.content, { paddingTop: insets.top + 20 }]}>
        <Text style={s.plateoffs} adjustsFontSizeToFit numberOfLines={1}>PLATEOFFS</Text>

        <View style={s.titleContainer}>
          <Text style={s.title}>PICK{'\n'}TONIGHT'S{'\n'}WINNER!</Text>
          <Text style={s.subtitle}>THE ULTIMATE RECIPE SHOWDOWN.</Text>
        </View>

        <View style={s.modeRow}>
          <TouchableOpacity
            style={[s.modeBtn, s.modeBtnSolo]}
            onPress={() => router.push('/lobby')}
            activeOpacity={0.85}
          >
            <Text style={s.modeBtnTitle}>SOLO</Text>
            <Text style={s.modeBtnSub}>just you</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.modeBtn, s.modeBtnMulti]}
            onPress={() => router.push('/lobby?mode=multiplayer')}
            activeOpacity={0.85}
          >
            <Text style={s.modeBtnTitle}>MULTIPLAYER</Text>
            <Text style={s.modeBtnSub}>invite friends</Text>
          </TouchableOpacity>
        </View>

        {hasActiveSession && (
          <View style={s.returnCard}>
            <View style={s.returnCardLeft}>
              <Text style={s.returnCardLabel}>ACTIVE SESSION</Text>
              <Text style={s.returnCardCode}>{lastSessionCode}</Text>
              {lastSessionDivisionName ? (
                <Text style={s.returnCardDiv} numberOfLines={1}>{lastSessionDivisionName.toUpperCase()}</Text>
              ) : null}
            </View>
            <View style={s.returnCardActions}>
              <TouchableOpacity
                style={s.returnBtn}
                onPress={() => router.push(`/session/${lastSessionCode}/results`)}
                activeOpacity={0.85}
              >
                <Text style={s.returnBtnText}>RESULTS →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearLastSession} activeOpacity={0.7} style={s.returnDismiss}>
                <Text style={s.returnDismissText}>dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!joinMode ? (
          <TouchableOpacity onPress={() => setJoinMode(true)} activeOpacity={0.7} style={s.joinLink}>
            <Text style={s.joinLinkText}>Have a code? Join a showdown</Text>
          </TouchableOpacity>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.joinBox}>
            <TextInput
              style={s.joinInput}
              value={joinCode}
              onChangeText={(t) => { setJoinCode(t.toUpperCase()); setJoinError(null); }}
              placeholder="ENTER CODE"
              placeholderTextColor="#00000055"
              maxLength={4}
              autoCapitalize="characters"
              autoFocus
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[s.joinBtn, (joinCode.trim().length < 4 || joining) && s.joinBtnDisabled]}
              onPress={handleJoinByCode}
              disabled={joinCode.trim().length < 4 || joining}
              activeOpacity={0.85}
            >
              {joining
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={s.joinBtnText}>JOIN</Text>
              }
            </TouchableOpacity>
            {joinError && <Text style={s.joinError}>{joinError}</Text>}
            <TouchableOpacity onPress={() => { setJoinMode(false); setJoinCode(''); setJoinError(null); }} style={s.joinCancel}>
              <Text style={s.joinCancelText}>Cancel</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        )}

        <View style={s.stickers}>
          <View style={[s.polaroid, { transform: [{ rotate: '-8deg' }], backgroundColor: C.tertiary }]}>
            <Image
              source={require('@/assets/weekend-brunch.jpg')}
              style={s.polaroidImg}
            />
            <Text style={s.polaroidText}>WEEKEND BRUNCH</Text>
          </View>

          <View style={[s.polaroid, { transform: [{ rotate: '6deg' }], backgroundColor: C.primary, marginTop: IS_TABLET ? 40 : 20 }]}>
            <Image
              source={require('@/assets/power-bowls.jpg')}
              style={s.polaroidImg}
            />
            <Text style={s.polaroidText}>DINNER DUEL</Text>
          </View>

          {IS_TABLET && (
            <View style={[s.polaroid, { transform: [{ rotate: '-3deg' }], backgroundColor: C.secondary, marginTop: 16 }]}>
              <Image
                source={require('@/assets/power-bowls-cover.png')}
                style={s.polaroidImg}
              />
              <Text style={s.polaroidText}>POWER BOWLS</Text>
            </View>
          )}
        </View>
      </View>
      <AppFooter />
    </View>
  );
}
