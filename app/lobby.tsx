import { useEffect, useState, useCallback, useRef } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
  Image,
  Modal,
  Alert,
  Animated,
} from 'react-native';
import { AppFooter } from '@/components/AppFooter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTournamentStore } from '@/store/tournament';
import { useUserStore, type DietaryTag } from '@/store/user';
import { fetchDivisionRecipes } from '@/lib/supabase';
import { type Division, BRACKET_SIZE } from '@/lib/tournament';
import { C } from '@/constants/colors';
import { s } from '@/styles/lobby.styles';
import { IS_TABLET, useLayout } from '@/constants/layout';
import { getNotificationPermissionStatus, requestNotificationPermission, scheduleRotationNotifications } from '@/lib/notifications';
import { useLobbyStore } from '@/store/lobby';
import { useSavedRecipesStore } from '@/store/savedRecipes';
import { useSessionStore } from '@/store/session';
import { createVoteSession } from '@/lib/supabase';


function formatCountdownParts(targetMs: number, now: number) {
  const total = Math.max(0, targetMs - now);
  const days = Math.floor(total / 86_400_000);
  const h = Math.floor((total % 86_400_000) / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const sec = Math.floor((total % 60_000) / 1_000);
  if (days > 0) {
    return `${days}D ${String(h).padStart(2, '0')}H ${String(m).padStart(2, '0')}M`;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const MAX_CONTENT_W = 1060;

const STEPS = [
  'Pick an arena below to create your session.',
  'Share your invite code with friends.',
  'Everyone plays their own full bracket independently.',
  'Compare champions on the results screen.',
];

function MultiplayerInstructions() {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.multiplayerBanner}>
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        style={s.multiplayerBannerHeader}
        accessibilityRole="button"
        accessibilityLabel={`Multiplayer instructions, ${open ? 'collapse' : 'expand'}`}
        accessibilityState={{ expanded: open }}
      >
        <Text style={s.multiplayerBannerText}>MULTIPLAYER — HOW IT WORKS</Text>
        <View style={s.multiplayerToggle}>
          <Text style={s.multiplayerToggleText}>{open ? '−' : '+'}</Text>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={s.multiplayerSteps}>
          {STEPS.map((text, i) => (
            <View key={i} style={s.multiplayerStep}>
              <View style={s.multiplayerStepNum}>
                <Text style={s.multiplayerStepNumText}>{i + 1}</Text>
              </View>
              <Text style={s.multiplayerStepText}>{text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function LobbyScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isMultiplayer = mode === 'multiplayer';
  const { setMode, setSession } = useSessionStore();
  const { isTablet, screenWidth } = useLayout();
  // Full-width contentContainer; symmetric padding centers the content visually.
  const hPad = isTablet ? Math.max(28, Math.floor((screenWidth - MAX_CONTENT_W) / 2)) : 20;
  const { setDivision, startGauntlet } = useTournamentStore();
  const { dietaryProfile, notifPromptSeen, markNotifPromptSeen } = useUserStore();
  const savedCount = useSavedRecipesStore((s) => s.recipes.length);
  const { divisions, rotationTimes, coverImageUris, prefetchedRecipes, loading: loadingDivisions, error: storeError, prefetch, refresh } = useLobbyStore();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  // Initial load via prefetch (no-ops if already loaded).
  // On subsequent focus events (returning from match/champion), silently refresh recipe_ids.
  const hasLoaded = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      prefetch();
    } else {
      refresh();
    }
  }, []));

  // Tick every second so per-card timers stay live
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (notifPromptSeen) {
      setShowNotifPrompt(false);
      return;
    }
    getNotificationPermissionStatus()
      .then((status) => { if (status !== 'granted') setShowNotifPrompt(true); })
      .catch(() => {});
  }, [notifPromptSeen]);


  // Schedule notifications once we know both division names and rotation times
  useEffect(() => {
    if (!divisions.length || !Object.keys(rotationTimes).length) return;
    const entries = divisions
      .filter((d) => d.division_type === 'rotating' && d.slot)
      .map((d) => ({
        slot: d.slot!,
        name: d.name,
        rotatesAt: rotationTimes[d.slot!.toUpperCase()] ?? 0,
      }))
      .filter((e) => e.rotatesAt > 0);
    scheduleRotationNotifications(entries).catch(() => {});
  }, [divisions, rotationTimes]);

  async function handleSelectDivision(div: Division) {
    setLoadingId(div.id);
    setError(null);
    try {
      // Use in-memory prefetched recipes (loaded in background when lobby opened).
      // Falls back to a fresh DB fetch if background load hasn't finished yet.
      const cached = prefetchedRecipes[div.id];
      let recipes: import('@/types/recipe').Recipe[];
      if (cached && cached.length >= BRACKET_SIZE) {
        // Apply dietary filter client-side — cached set is always unfiltered.
        if (dietaryProfile.length > 0) {
          const filtered = cached.filter((r) =>
            dietaryProfile.every((tag) => r.dietary_tags?.includes(tag))
          );
          recipes = filtered.length >= BRACKET_SIZE
            ? filtered.slice(0, BRACKET_SIZE)
            : cached.slice(0, BRACKET_SIZE); // not enough matches — use unfiltered fallback
        } else {
          recipes = cached.slice(0, BRACKET_SIZE);
        }
      } else {
        recipes = await fetchDivisionRecipes(div, dietaryProfile);
      }

      // Shuffle here so we know which two images appear first in the matchup.
      const shuffled = [...recipes].sort(() => Math.random() - 0.5);
      // Await first two images — if already in native cache (from lobby background prefetch)
      // this resolves near-instantly; otherwise downloads complete before navigation.
      await Promise.allSettled([
        shuffled[0]?.image_url ? Image.prefetch(shuffled[0].image_url) : Promise.resolve(),
        shuffled[1]?.image_url ? Image.prefetch(shuffled[1].image_url) : Promise.resolve(),
      ]);
      shuffled.slice(2).forEach((r) => { if (r.image_url) Image.prefetch(r.image_url).catch(() => {}); });
      if (isMultiplayer) {
        setMode('multiplayer');
        const session = await createVoteSession(div, shuffled.map((r) => r.id));
        setSession(session, true);
        setDivision(div);
        startGauntlet(shuffled);
        router.push(`/session/${session.code}?host=true`);
      } else {
        setMode('solo');
        setDivision(div);
        startGauntlet(shuffled);
        router.push('/matchup');
      }
    } catch (e: any) {
      const msg = e.message ?? 'Failed to load recipes. Try again.';
      setError(msg);
      Alert.alert('Arena Unavailable', msg);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Header — full screen width, content self-centers */}
      <View style={[s.header, lh.headerRow]}>
        <View style={{ width: IS_TABLET ? 90 : 76 }} />
        <Text style={s.wordmark}>PLATEOFFS</Text>
        <TouchableOpacity
          onPress={() => router.push('/saved')}
          style={lh.savesBtn}
          accessibilityRole="button"
          accessibilityLabel={`My Recipe Box, ${savedCount} saved`}
          activeOpacity={0.85}
        >
          {savedCount > 0 && (
            <View style={lh.savesBadge}>
              <Text style={lh.savesBadgeText}>{savedCount}</Text>
            </View>
          )}
          <Text style={lh.savesBtnText}>★{'\n'}BOX</Text>
        </TouchableOpacity>
      </View>

      <NotifPromptSheet
        visible={showNotifPrompt}
        onEnable={() => {
          setShowNotifPrompt(false);
          markNotifPromptSeen();
          requestNotificationPermission().catch(() => {});
        }}
        onDismiss={() => {
          setShowNotifPrompt(false);
          markNotifPromptSeen();
        }}
      />

      {/* ScrollView spans the full screen width so you can scroll anywhere */}
      <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingHorizontal: hPad }]} showsVerticalScrollIndicator={false}>
        {/* Title */}
        {isMultiplayer && <MultiplayerInstructions />}
        <Text style={s.title}>SELECT{'\n'}YOUR{'\n'}ARENA</Text>

        {/* Diet filter panel */}
        <DietFilterPanel open={filterOpen} onToggle={() => setFilterOpen(o => !o)} />

        {(error || storeError) && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error ?? storeError}</Text>
          </View>
        )}

        {/* Division cards */}
        <View style={[s.cardList, lt.cardListTablet]}>
          {loadingDivisions ? (
            CARD_VARIANTS.map((_, i) => (
              <View key={i} style={lt.cardWrapper}>
                <SkeletonDivisionCard index={i} />
              </View>
            ))
          ) : (
            divisions.map((div, i) => {
              const slotKey = div.division_type === 'anchor' ? 'ANCHOR' : (div.slot?.toUpperCase() ?? '');
              const rotatesAt = rotationTimes[slotKey] ?? null;
              return (
                <View key={div.id} style={lt.cardWrapper}>
                  <DivisionCard
                    division={div}
                    coverImageUri={coverImageUris[div.id]}
                    loading={loadingId === div.id}
                    disabled={loadingId !== null}
                    onPress={() => handleSelectDivision(div)}
                    index={i}
                    rotatesAt={rotatesAt}
                    now={now}
                    isTablet={isTablet}
                  />
                </View>
              );
            })
          )}
        </View>

        <AppFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Notification pre-prompt sheet ────────────────────────────────────────────

function NotifPromptSheet({
  visible,
  onEnable,
  onDismiss,
}: {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={np.backdrop}>
        <View style={np.sheet}>
          <View style={np.iconRow}>
            <Text style={np.icon}>🔔</Text>
          </View>
          <Text style={np.title}>KNOW WHEN THE{'\n'}ARENA ROTATES</Text>
          <Text style={np.body}>
            New divisions drop every few days. Enable notifications and we'll alert you the moment fresh recipes enter the bracket — so you never miss a new arena.
          </Text>
          <TouchableOpacity style={np.primaryBtn} onPress={onEnable} activeOpacity={0.85}
            accessibilityRole="button" accessibilityLabel="Enable notifications">
            <Text style={np.primaryBtnText}>TURN ON NOTIFICATIONS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={np.secondaryBtn} onPress={onDismiss} activeOpacity={0.7}
            accessibilityRole="button" accessibilityLabel="Skip notifications">
            <Text style={np.secondaryBtnText}>NOT NOW</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const np = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1000',
    borderTopWidth: 4,
    borderTopColor: C.trophyGold,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 48,
    gap: 16,
    shadowColor: C.trophyGold,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.6,
    shadowRadius: 0,
    elevation: 16,
  },
  iconRow: { alignItems: 'center' },
  icon: { fontSize: 40 },
  title: {
    fontWeight: '900',
    fontSize: 28,
    color: C.trophyGold,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 30,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  body: {
    fontSize: 15,
    color: C.onBackground,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: C.trophyGold,
    paddingVertical: 18,
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    marginTop: 8,
  },
  primaryBtnText: {
    fontWeight: '900',
    fontSize: 16,
    color: '#000',
    letterSpacing: 1,
  },
  secondaryBtn: { alignItems: 'center', paddingVertical: 12 },
  secondaryBtnText: {
    fontWeight: '900',
    fontSize: 13,
    color: C.textMuted,
    letterSpacing: 1,
    textDecorationLine: 'underline',
  },
});

// ── Dietary filter data ───────────────────────────────────────────────────────

const DIET_OPTIONS: { tag: DietaryTag; label: string; color: string; textColor: string }[] = [
  { tag: 'vegetarian', label: 'VEGETARIAN', color: C.neonGreen,    textColor: '#000' },
  { tag: 'vegan',      label: 'VEGAN',      color: '#00FFAA',      textColor: '#000' },
  { tag: 'gluten_free',label: 'GLUTEN-FREE',color: C.trophyGold,   textColor: '#000' },
  { tag: 'no_pork',    label: 'NO PORK',    color: C.tertiary,     textColor: '#000' },
  { tag: 'dairy_free', label: 'DAIRY-FREE', color: C.primary,      textColor: '#000' },
];

function DietFilterPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { dietaryProfile, toggleDietaryTag, setDietaryProfile } = useUserStore();
  const activeCount = dietaryProfile.length;

  return (
    <View style={df.container}>
      {/* Header row — always visible, tapping toggles panel */}
      <TouchableOpacity
        style={df.header}
        onPress={onToggle}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Diet filters${activeCount > 0 ? `, ${activeCount} active` : ''}, ${open ? 'collapse' : 'expand'}`}
        accessibilityState={{ expanded: open }}
      >
        {/* Diagonal hazard stripes — decorative only */}
        <View style={df.stripeRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={[df.stripe, { backgroundColor: i % 2 === 0 ? '#000' : C.trophyGold }]} />
          ))}
        </View>
        <View style={df.headerInner}>
          <Text style={df.headerLabel} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">DIET FILTERS</Text>
          <View style={df.headerRight} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {activeCount > 0 && (
              <View style={df.activeBadge}>
                <Text style={df.activeBadgeText}>{activeCount} ON</Text>
              </View>
            )}
            <Text style={df.caret}>{open ? '▲' : '▼'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Expandable chip grid */}
      {open && (
        <View style={df.body}>
          <Text style={df.subLabel}>SELECT ALL THAT APPLY — WE'LL CURATE YOUR BRACKET</Text>
          <View style={df.chipRow}>
            {DIET_OPTIONS.map(({ tag, label, color, textColor }) => {
              const active = dietaryProfile.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => toggleDietaryTag(tag)}
                  activeOpacity={0.8}
                  style={[
                    df.chip,
                    active
                      ? { backgroundColor: color, borderColor: '#000', shadowColor: color }
                      : { backgroundColor: '#000', borderColor: color, shadowColor: '#000' },
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityLabel={label}
                  accessibilityState={{ checked: active }}
                >
                  {active && <Text style={df.chipCheck} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">✓ </Text>}
                  <Text style={[df.chipLabel, { color: active ? textColor : color }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {activeCount > 0 && (
            <TouchableOpacity
              onPress={() => setDietaryProfile([])}
              style={df.clearBtn}
              accessibilityRole="button"
              accessibilityLabel="Clear all diet filters"
            >
              <Text style={df.clearText}>CLEAR ALL</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const df = StyleSheet.create({
  container: {
    borderWidth: 4, borderColor: '#000',
    shadowColor: C.trophyGold, shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 6,
    overflow: 'hidden',
  },
  stripeRow: { flexDirection: 'row', height: 10, overflow: 'hidden' },
  stripe: { flex: 1, height: 20, transform: [{ skewX: '-20deg' }] },

  header: { backgroundColor: '#1a1a00' },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerLabel: {
    fontWeight: '900', fontSize: 22, color: C.trophyGold,
    fontStyle: 'italic', letterSpacing: 1,
    textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activeBadge: {
    backgroundColor: C.neonGreen, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 2, borderColor: '#000',
  },
  activeBadgeText: { fontWeight: '900', fontSize: 11, color: '#000' },
  caret: { fontWeight: '900', fontSize: 18, color: C.trophyGold },

  body: {
    backgroundColor: '#0d0d00', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18,
    borderTopWidth: 3, borderTopColor: '#000', gap: 14,
  },
  subLabel: {
    fontSize: 10, fontWeight: '900', color: C.textMuted, letterSpacing: 0.8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 3, paddingHorizontal: 14, paddingVertical: 8,
    shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 3,
  },
  chipCheck: { fontWeight: '900', fontSize: 13, color: '#000' },
  chipLabel: { fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

  clearBtn: { alignSelf: 'flex-start', borderBottomWidth: 2, borderBottomColor: C.chiliRed },
  clearText: { fontWeight: '900', fontSize: 11, color: C.chiliRed, letterSpacing: 1 },
});

// ── Skeleton loading cards ────────────────────────────────────────────────────

const CARD_HEIGHT = IS_TABLET ? 480 : 260;

function SkeletonDivisionCard({ index }: { index: number }) {
  const v = CARD_VARIANTS[index % CARD_VARIANTS.length];
  const pulse = useRef(new Animated.Value(0.5)).current;
  const scanY = useRef(new Animated.Value(-CARD_HEIGHT)).current;
  const [dots, setDots] = useState('');

  useEffect(() => {
    const stagger = index * 200;
    const t = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 480, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.45, duration: 480, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanY, { toValue: CARD_HEIGHT, duration: 1200, useNativeDriver: true }),
          Animated.delay(400),
          Animated.timing(scanY, { toValue: -CARD_HEIGHT, duration: 0, useNativeDriver: true }),
          Animated.delay(stagger),
        ])
      ).start();
    }, stagger);

    const dotsTimer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 380);

    return () => { clearTimeout(t); clearInterval(dotsTimer); };
  }, []);

  return (
    <Animated.View style={[
      s.card,
      { borderColor: v.border, shadowColor: v.shadow, backgroundColor: v.bg, opacity: pulse },
    ]}>
      {v.topElement === 'checkerboard' && (
        <View style={cs.topStrip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <CheckerboardStrip />
        </View>
      )}
      {v.topElement === 'slimeDrip' && (
        <View style={cs.topStrip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <SlimeDripBar color={v.slimeDripColor ?? '#ccff00'} />
        </View>
      )}
      {v.topElement === 'holographic' && (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <HolographicOverlay />
        </View>
      )}
      {v.topElement === 'starburst' && (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <StarburstBadge color={v.badgeBg} />
        </View>
      )}

      {/* Scan line sweeping top → bottom */}
      <Animated.View
        style={[sk.scanLine, { backgroundColor: v.border, transform: [{ translateY: scanY }] }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <View style={s.cardOverlay}>
        <Text style={[
          s.cardName,
          { color: v.nameColor, textShadowColor: v.nameColor === '#000' ? '#fff' : '#000', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
        ]}>
          ARENA{'\n'}LOADING{dots}
        </Text>
        <View style={[s.contenderBadge, { backgroundColor: v.badgeBg }]}>
          <Text style={[s.contenderText, { color: v.badgeText }]}>INCOMING</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const sk = StyleSheet.create({
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    opacity: 0.9,
    zIndex: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 8,
  },
});

// ── Division cards ────────────────────────────────────────────────────────────

const CARD_VARIANTS = [
  {
    bg: '#1e3d1e',
    border: C.neonGreen,
    shadow: C.neonGreen,
    topElement: 'checkerboard' as const,
    nameColor: '#fff',
    badgeBg: '#000',
    badgeText: '#fff',
    imageOpacity: 0.78,
  },
  {
    bg: '#5a1212',
    border: C.chiliRed,
    shadow: C.chiliRed,
    topElement: 'slimeDrip' as const,
    slimeDripColor: '#ccff00',
    nameColor: '#fff',
    badgeBg: '#ccff00',
    badgeText: '#000',
    imageOpacity: 0.88,
  },
  {
    bg: '#1a2040',
    border: C.tertiary,
    shadow: C.tertiary,
    topElement: 'holographic' as const,
    nameColor: '#fff',
    badgeBg: '#fff',
    badgeText: '#000',
    imageOpacity: 0.70,
  },
  {
    bg: '#3d2e00',
    border: C.trophyGold,
    shadow: C.trophyGold,
    topElement: 'starburst' as const,
    nameColor: '#000',
    badgeBg: '#000',
    badgeText: C.trophyGold,
    imageOpacity: 0.82,
  },
];

const CARD_IMAGES = [
  require('@/assets/weekend-brunch.jpg'),
  require('@/assets/power-bowls.jpg'),
  require('@/assets/weekend-brunch.jpg'),
  require('@/assets/power-bowls.jpg'),
];

function CheckerboardStrip() {
  const count = 22;
  return (
    <View style={cs.strip}>
      <View style={cs.stripRow}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={`a${i}`} style={[cs.cell, { backgroundColor: i % 2 === 0 ? '#000' : '#fff' }]} />
        ))}
      </View>
      <View style={cs.stripRow}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={`b${i}`} style={[cs.cell, { backgroundColor: i % 2 === 0 ? '#fff' : '#000' }]} />
        ))}
      </View>
    </View>
  );
}

function SlimeDripBar({ color }: { color: string }) {
  return (
    <View style={[cs.slimeBar, { backgroundColor: color }]}>
      {/* Drip teeth along the bottom */}
      <View style={cs.dripRow}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View
            key={i}
            style={[
              cs.dripTooth,
              { backgroundColor: color, height: i % 3 === 0 ? 18 : i % 3 === 1 ? 12 : 22 },
            ]}
          />
        ))}
      </View>
      <View style={cs.slimeBorder} />
    </View>
  );
}

function HolographicOverlay() {
  return (
    <View style={cs.holoWrap} pointerEvents="none">
      <View style={[cs.holoStripe, { backgroundColor: '#ecb1ff', opacity: 0.12 }]} />
      <View style={[cs.holoStripe, { backgroundColor: '#00ffff', opacity: 0.08, marginTop: 60 }]} />
      <View style={[cs.holoStripe, { backgroundColor: '#ffb4a9', opacity: 0.10, marginTop: 120 }]} />
      <View style={[cs.holoStripe, { backgroundColor: '#f6bd50', opacity: 0.08, marginTop: 180 }]} />
      <View style={[cs.holoStripe, { backgroundColor: '#ecb1ff', opacity: 0.12, marginTop: 240 }]} />
    </View>
  );
}

function StarburstBadge({ color }: { color: string }) {
  return (
    <View style={[cs.starOuter, { backgroundColor: color }]}>
      <Text style={cs.starText}>★</Text>
    </View>
  );
}

function RotationTimer({
  rotatesAt,
  now,
  accentColor,
  label,
  isTablet,
}: {
  rotatesAt: number | null;
  now: number;
  accentColor: string;
  label: string;
  isTablet: boolean;
}) {
  const display = (rotatesAt && rotatesAt > now) ? formatCountdownParts(rotatesAt, now) : '--:--:--';

  return (
    <View style={[rt.timerWrap, !isTablet && { marginBottom: 4 }]}>
      <View style={[
        rt.timerBorder,
        { borderColor: accentColor, shadowColor: accentColor, backgroundColor: accentColor },
        !isTablet && { paddingHorizontal: 8, paddingVertical: 3 },
      ]}>
        <Text style={[rt.timerLabel, !isTablet && { fontSize: 6, letterSpacing: 1 }]}>{label}</Text>
        <Text style={[rt.timerDigits, !isTablet && { fontSize: 13, letterSpacing: 0 }]}>{display}</Text>
      </View>
    </View>
  );
}

const rt = StyleSheet.create({
  timerWrap: { marginBottom: 10 },
  timerBorder: {
    borderWidth: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  timerLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 2,
    marginBottom: 1,
  },
  timerDigits: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    fontStyle: 'italic',
  },
});

function DivisionCard({
  division,
  coverImageUri,
  loading,
  disabled,
  onPress,
  index,
  rotatesAt,
  now,
  isTablet,
}: {
  division: Division;
  coverImageUri?: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
  index: number;
  rotatesAt: number | null;
  now: number;
  isTablet: boolean;
}) {
  const v = CARD_VARIANTS[index % CARD_VARIANTS.length];
  const isAnchor = division.division_type === 'anchor';
  const timerLabel = isAnchor ? 'RECIPES IN' : 'ROTATES IN';
  const isPreparing = division.curation_pending || (division.recipe_ids?.length ?? 0) < BRACKET_SIZE;

  function handlePress() {
    if (isPreparing) {
      Alert.alert(
        'Recipes Are Being Curated',
        'This arena just rotated and we\'re generating its recipes right now. It takes about 5 minutes — check back shortly!',
        [{ text: 'Got It', style: 'default' }]
      );
      return;
    }
    onPress();
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        s.card,
        { borderColor: v.border, shadowColor: v.shadow, backgroundColor: v.bg },
        disabled && { opacity: 0.6 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Enter ${division.name} arena`}
      accessibilityState={{ disabled }}
    >
      {/* Food image — decorative background */}
      <ImageBackground
        source={coverImageUri ? { uri: coverImageUri } : CARD_IMAGES[index % CARD_IMAGES.length]}
        style={[s.cardImage, { opacity: v.imageOpacity }]}
        imageStyle={{ resizeMode: 'cover' }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      {/* Decorative overlays — all hidden from screen readers */}
      {v.topElement === 'holographic' && (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <HolographicOverlay />
        </View>
      )}
      {v.topElement === 'starburst' && (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <StarburstBadge color={v.badgeBg} />
        </View>
      )}
      {v.topElement === 'checkerboard' && (
        <View style={cs.topStrip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <CheckerboardStrip />
        </View>
      )}
      {v.topElement === 'slimeDrip' && (
        <View style={cs.topStrip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <SlimeDripBar color={v.slimeDripColor ?? '#ccff00'} />
        </View>
      )}

      {/* Preparing overlay — sits above image, below bottom text */}
      {isPreparing && (
        <View style={pr.overlay} pointerEvents="none">
          <View style={pr.badge}>
            <Text style={pr.badgeIcon}>⚙️</Text>
            <Text style={pr.badgeText}>ARENA PREPARING</Text>
          </View>
          <Text style={pr.subText}>READY IN A FEW MINUTES</Text>
        </View>
      )}

      {/* Bottom dark overlay + text */}
      <View style={s.cardOverlay}>
        {loading ? (
          <ActivityIndicator color={C.trophyGold} size="large" />
        ) : (
          <>
            <Text style={[
              s.cardName,
              { color: v.nameColor, textShadowColor: v.nameColor === '#000' ? '#fff' : '#000', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
            ]}>
              {division.name.toUpperCase()}
            </Text>
            {!isPreparing && (
              <RotationTimer
                rotatesAt={rotatesAt}
                now={now}
                accentColor={v.border}
                label={timerLabel}
                isTablet={isTablet}
              />
            )}
            <View style={[s.contenderBadge, { backgroundColor: isPreparing ? '#333' : v.badgeBg }]}>
              <Text style={[s.contenderText, { color: isPreparing ? '#888' : v.badgeText }]}>
                {isPreparing ? 'COMING SOON' : `${BRACKET_SIZE} CONTENDERS`}
              </Text>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Preparing overlay styles
const pr = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 6, gap: 8,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 3, borderColor: C.trophyGold,
    paddingHorizontal: 16, paddingVertical: 8,
    shadowColor: C.trophyGold, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 6,
  },
  badgeIcon: { fontSize: 18 },
  badgeText: {
    fontWeight: '900', fontSize: 16, color: C.trophyGold,
    fontStyle: 'italic', letterSpacing: 2,
  },
  subText: {
    fontWeight: '900', fontSize: 10, color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
  },
});

// Lobby header extras
const lh = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savesBtn: {
    width: IS_TABLET ? 90 : 76,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 3,
    borderColor: '#000',
    paddingVertical: IS_TABLET ? 8 : 6,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    position: 'relative',
  },
  savesBtnText: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 12 : 10,
    color: C.secondary,
    letterSpacing: 1,
    textAlign: 'center',
    lineHeight: IS_TABLET ? 14 : 12,
  },
  savesBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: '#000',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  savesBadgeText: {
    fontWeight: '900',
    fontSize: 10,
    color: C.onPrimary,
    lineHeight: 12,
  },
});

// Two-column grid layout for card list (phone and tablet portrait)
const lt = StyleSheet.create({
  cardListTablet: { flexDirection: 'row', flexWrap: 'wrap', gap: IS_TABLET ? 20 : 12 },
  cardWrapper: { width: IS_TABLET ? '48.5%' : '48%' },
});

// Styles only used by card sub-components
const cs = StyleSheet.create({
  strip: { overflow: 'hidden' },
  stripRow: { flexDirection: 'row' },
  cell: { width: 20, height: 14 },

  slimeBar: { paddingBottom: 0, zIndex: 10 },
  dripRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 28 },
  dripTooth: { width: 28, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  slimeBorder: { height: 3, backgroundColor: '#000' },

  holoWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2 },
  holoStripe: { position: 'absolute', top: 0, left: '-10%', right: '-10%', height: 40, transform: [{ rotate: '-8deg' }] },

  starOuter: {
    position: 'absolute', top: 16, right: 16, zIndex: 10,
    width: 64, height: 64,
    borderWidth: 3, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '12deg' }],
    shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 4,
  },
  starText: { fontSize: 30, color: C.trophyGold },

  topStrip: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
});

