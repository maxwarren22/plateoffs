import { useEffect, useState } from 'react';
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
import { useLayout } from '@/constants/layout';
import * as Notifications from 'expo-notifications';
import { requestNotificationPermission, scheduleRotationNotifications } from '@/lib/notifications';
import { useLobbyStore } from '@/store/lobby';


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

export default function LobbyScreen() {
  const router = useRouter();
  const { isTablet, screenWidth } = useLayout();
  // Full-width contentContainer; symmetric padding centers the content visually.
  const hPad = isTablet ? Math.max(28, Math.floor((screenWidth - MAX_CONTENT_W) / 2)) : 20;
  const { setDivision, startGauntlet } = useTournamentStore();
  const { dietaryProfile, notifPromptSeen, markNotifPromptSeen } = useUserStore();
  const { divisions, rotationTimes, loading: loadingDivisions, error: storeError, prefetch } = useLobbyStore();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  // Kick off fetch if somehow not started (e.g. deep-linked directly to lobby)
  useEffect(() => { prefetch(); }, []);

  // Tick every second so per-card timers stay live
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (notifPromptSeen) return;
    Notifications.getPermissionsAsync()
      .then(({ status }) => { if (status !== 'granted') setShowNotifPrompt(true); })
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
      const recipes = await fetchDivisionRecipes(div, dietaryProfile);
      await Promise.all(
        recipes
          .map((r) => r.image_url)
          .filter((url): url is string => !!url)
          .map((url) => Image.prefetch(url))
      );
      setDivision(div);
      startGauntlet(recipes);
      router.push('/matchup');
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
      <View style={s.header}>
        <Text style={s.wordmark}>PLATEOFFS</Text>
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
        <Text style={s.title}>SELECT{'\n'}YOUR{'\n'}ARENA</Text>

        {/* Diet filter panel */}
        <DietFilterPanel open={filterOpen} onToggle={() => setFilterOpen(o => !o)} />

        {(error || storeError) && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error ?? storeError}</Text>
          </View>
        )}

        {/* Division cards */}
        <View style={[s.cardList, isTablet && lt.cardListTablet]}>
          {loadingDivisions ? (
            <ActivityIndicator color={C.trophyGold} size="large" style={{ marginVertical: 40 }} />
          ) : (
            divisions.map((div, i) => {
              const slotKey = div.division_type === 'anchor' ? 'ANCHOR' : (div.slot?.toUpperCase() ?? '');
              const rotatesAt = rotationTimes[slotKey] ?? null;
              return (
                <View key={div.id} style={isTablet ? lt.cardWrapper : null}>
                  <DivisionCard
                    division={div}
                    loading={loadingId === div.id}
                    disabled={loadingId !== null}
                    onPress={() => handleSelectDivision(div)}
                    index={i}
                    rotatesAt={rotatesAt}
                    now={now}
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
}: {
  rotatesAt: number | null;
  now: number;
  accentColor: string;
  label: string;
}) {
  const display = (rotatesAt && rotatesAt > now) ? formatCountdownParts(rotatesAt, now) : '--:--:--';

  return (
    <View style={rt.timerWrap}>
      <View style={[rt.timerBorder, { borderColor: accentColor, shadowColor: accentColor, backgroundColor: accentColor }]}>
        <Text style={rt.timerLabel}>{label}</Text>
        <Text style={rt.timerDigits}>{display}</Text>
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
  loading,
  disabled,
  onPress,
  index,
  rotatesAt,
  now,
}: {
  division: Division;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
  index: number;
  rotatesAt: number | null;
  now: number;
}) {
  const v = CARD_VARIANTS[index % CARD_VARIANTS.length];
  const isAnchor = division.division_type === 'anchor';
  const timerLabel = isAnchor ? 'RECIPES IN' : 'ROTATES IN';

  return (
    <TouchableOpacity
      onPress={onPress}
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
        source={division.cover_image_url ? { uri: division.cover_image_url } : CARD_IMAGES[index % CARD_IMAGES.length]}
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
            <RotationTimer
              rotatesAt={rotatesAt}
              now={now}
              accentColor={v.border}
              label={timerLabel}
            />
            <View style={[s.contenderBadge, { backgroundColor: v.badgeBg }]}>
              <Text style={[s.contenderText, { color: v.badgeText }]}>{BRACKET_SIZE} CONTENDERS</Text>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Tablet grid layout for card list
const lt = StyleSheet.create({
  cardListTablet: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  cardWrapper: { width: '48.5%' },
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

