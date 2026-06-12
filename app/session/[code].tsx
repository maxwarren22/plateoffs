import { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Share, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '@/constants/colors';
import { IS_TABLET } from '@/constants/layout';
import { useSessionStore } from '@/store/session';
import { useTournamentStore } from '@/store/tournament';
import {
  supabase,
  joinVoteSession,
  startVoteSession,
  fetchSessionParticipantCount,
  fetchRecipesByIds,
  type VoteSession,
} from '@/lib/supabase';

export default function SessionWaitingRoom() {
  const router = useRouter();
  const { code, host } = useLocalSearchParams<{ code: string; host?: string }>();
  const isHost = host === 'true';
  const { session, setSession, setParticipantCount, updateSessionStatus } = useSessionStore();
  const { setDivision, startGauntlet } = useTournamentStore();

  const [localSession, setLocalSession] = useState<VoteSession | null>(session);
  const [participantCount, setLocalParticipantCount] = useState(1);
  const [joining, setJoining] = useState(!isHost);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Guests join the session on mount
  useEffect(() => {
    if (isHost) {
      refreshCount(session?.id);
      return;
    }
    joinVoteSession(code)
      .then((s) => {
        setLocalSession(s);
        setSession(s, false);
        setJoining(false);
        refreshCount(s.id);
      })
      .catch((e) => {
        setError(e.message ?? 'Failed to join session.');
        setJoining(false);
      });
  }, []);

  async function refreshCount(sessionId?: string | null) {
    if (!sessionId) return;
    const count = await fetchSessionParticipantCount(sessionId).catch(() => 1);
    setLocalParticipantCount(count);
    setParticipantCount(count);
  }

  // Subscribe to participant joins and session status changes
  useEffect(() => {
    const sid = localSession?.id ?? session?.id;
    if (!sid) return;

    const channel = supabase
      .channel(`session:${sid}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'session_participants',
        filter: `session_id=eq.${sid}`,
      }, () => { refreshCount(sid); })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'vote_sessions',
        filter: `id=eq.${sid}`,
      }, async ({ new: updated }) => {
        const s = updated as VoteSession;
        setLocalSession(s);
        updateSessionStatus(s.status);
        if (s.status === 'active' && !isHost) {
          // Guests don't go through the lobby, so they need recipes fetched here
          // before the matchup screen mounts.
          try {
            const recipes = await fetchRecipesByIds(s.recipe_ids);
            // Prefetch first two images
            await Promise.allSettled([
              recipes[0]?.image_url ? Image.prefetch(recipes[0].image_url) : Promise.resolve(),
              recipes[1]?.image_url ? Image.prefetch(recipes[1].image_url) : Promise.resolve(),
            ]);
            recipes.slice(2).forEach((r) => { if (r.image_url) Image.prefetch(r.image_url).catch(() => {}); });
            setDivision({ id: s.division_id, name: s.division_name } as any);
            startGauntlet(recipes);
          } catch {
            // If fetch fails, still navigate — matchup will show the error/redirect
          }
          router.replace('/matchup');
        } else if (s.status === 'active' && isHost) {
          router.replace('/matchup');
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [localSession?.id, session?.id]);

  async function handleStart() {
    const sid = localSession?.id ?? session?.id;
    if (!sid) return;
    setStarting(true);
    try {
      await startVoteSession(sid);
      // Realtime update will trigger navigation for all participants including host
    } catch (e: any) {
      setError(e.message ?? 'Failed to start session.');
      setStarting(false);
    }
  }

  async function handleShare() {
    const sessionCode = localSession?.code ?? code;
    const divName = localSession?.division_name ?? session?.division_name ?? 'a division';
    const universalLink = `https://curatemyplate.com/plateoffs/session/${sessionCode}`;
    await Share.share({
      message: [
        `Join my Plateoffs showdown!`,
        `Arena: ${divName}`,
        ``,
        universalLink,
        ``,
        `(No app? Download free and enter code ${sessionCode})`,
      ].join('\n'),
      url: universalLink,
    });
  }

  if (joining) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.loadingText}>Joining showdown...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
            <Text style={styles.backBtnText}>GO BACK</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sessionCode = localSession?.code ?? code;
  const divisionName = localSession?.division_name ?? session?.division_name ?? '';

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.wordmark}>PLATEOFFS</Text>
        <View style={styles.modePill}>
          <Text style={styles.modePillText}>MULTIPLAYER</Text>
        </View>

        {/* Division */}
        <View style={styles.divisionCard}>
          <Text style={styles.divisionLabel}>ARENA</Text>
          <Text style={styles.divisionName}>{divisionName.toUpperCase()}</Text>
        </View>

        {/* Code block */}
        <View style={styles.codeBlock}>
          <Text style={styles.codeLabel}>JOIN CODE</Text>
          <Text style={styles.code}>{sessionCode}</Text>
        </View>

        {/* Participants */}
        <View style={styles.participantsRow}>
          <Text style={styles.participantsCount}>{participantCount}</Text>
          <Text style={styles.participantsLabel}>
            {participantCount === 1 ? 'PLAYER IN' : 'PLAYERS IN'}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Text style={styles.shareBtnText}>INVITE FRIENDS</Text>
          </TouchableOpacity>

          {isHost ? (
            <TouchableOpacity
              style={[styles.startBtn, starting && styles.startBtnDisabled]}
              onPress={handleStart}
              disabled={starting}
              activeOpacity={0.85}
            >
              {starting
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.startBtnText}>START SHOWDOWN</Text>
              }
            </TouchableOpacity>
          ) : (
            <View style={styles.waitingRow}>
              <ActivityIndicator color={C.tertiaryContainer} size="small" />
              <Text style={styles.waitingText}>Waiting for host to start...</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('/')} activeOpacity={0.7}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: IS_TABLET ? 60 : 28, gap: IS_TABLET ? 28 : 20,
  },

  wordmark: { fontWeight: '900', fontSize: IS_TABLET ? 30 : 24, color: C.trophyGold, fontStyle: 'italic', letterSpacing: 1 },

  modePill: {
    backgroundColor: C.tertiaryContainer,
    borderWidth: 3, borderColor: '#000',
    paddingHorizontal: 14, paddingVertical: 4,
    transform: [{ rotate: '-1.5deg' }],
    shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0,
  },
  modePillText: { fontWeight: '900', fontSize: IS_TABLET ? 13 : 11, color: '#000', fontStyle: 'italic', letterSpacing: 1 },

  divisionCard: {
    width: '100%', backgroundColor: C.surfaceContainerHigh,
    borderWidth: 4, borderColor: '#000',
    padding: IS_TABLET ? 20 : 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0,
  },
  divisionLabel: { fontWeight: '700', fontSize: 10, color: C.textMuted, letterSpacing: 2, marginBottom: 4 },
  divisionName: { fontWeight: '900', fontSize: IS_TABLET ? 28 : 22, color: C.primary, fontStyle: 'italic', textAlign: 'center' },

  codeBlock: {
    width: '100%', backgroundColor: C.secondary,
    borderWidth: 5, borderColor: '#000',
    padding: IS_TABLET ? 24 : 18, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 8, height: 8 }, shadowOpacity: 1, shadowRadius: 0,
  },
  codeLabel: { fontWeight: '700', fontSize: 10, color: '#00000088', letterSpacing: 3, marginBottom: 6 },
  code: {
    fontWeight: '900', fontSize: IS_TABLET ? 72 : 56, color: '#000',
    fontStyle: 'italic', letterSpacing: IS_TABLET ? 16 : 12,
  },

  participantsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  participantsCount: { fontWeight: '900', fontSize: IS_TABLET ? 48 : 40, color: C.primary, fontStyle: 'italic' },
  participantsLabel: { fontWeight: '700', fontSize: IS_TABLET ? 16 : 13, color: C.textLight, letterSpacing: 1 },

  actions: { width: '100%', gap: 12 },

  shareBtn: {
    width: '100%', backgroundColor: C.surfaceContainerHigh,
    borderWidth: 4, borderColor: C.outlineVariant,
    borderRadius: 60, paddingVertical: IS_TABLET ? 18 : 14,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
  },
  shareBtnText: { fontWeight: '900', fontSize: IS_TABLET ? 20 : 16, color: C.textLight, fontStyle: 'italic' },

  startBtn: {
    width: '100%', backgroundColor: C.tertiaryContainer,
    borderWidth: 5, borderColor: '#000',
    borderRadius: 60, paddingVertical: IS_TABLET ? 22 : 18,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 0,
  },
  startBtnDisabled: { opacity: 0.6 },
  startBtnText: { fontWeight: '900', fontSize: IS_TABLET ? 28 : 22, color: '#000', fontStyle: 'italic' },

  waitingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  waitingText: { fontWeight: '700', fontSize: IS_TABLET ? 16 : 13, color: C.textMuted, fontStyle: 'italic' },

  cancelBtn: { paddingVertical: 8 },
  cancelBtnText: { fontWeight: '600', fontSize: 14, color: C.textMuted, textAlign: 'center' },

  loadingText: { marginTop: 16, fontWeight: '700', fontSize: 16, color: C.textLight },
  errorText: { fontWeight: '700', fontSize: 16, color: C.error, textAlign: 'center', marginBottom: 24 },
  backBtn: {
    backgroundColor: C.surfaceContainerHigh, borderWidth: 3, borderColor: C.outlineVariant,
    borderRadius: 60, paddingVertical: 14, paddingHorizontal: 32,
  },
  backBtnText: { fontWeight: '900', fontSize: 16, color: C.textLight, fontStyle: 'italic' },
});
