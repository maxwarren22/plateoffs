import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C } from '@/constants/colors';
import { IS_TABLET, LAYOUT_WIDTH } from '@/constants/layout';
import { useSessionStore } from '@/store/session';
import { useTournamentStore } from '@/store/tournament';
import {
  supabase,
  fetchSessionParticipants,
  fetchRecipesByIds,
  fetchRecipeById,
  type SessionParticipant,
} from '@/lib/supabase';
import type { Recipe } from '@/types/recipe';

// ── Ingredient / instruction formatters ─────────────────────────────────────
type Ingredient = { name?: string; quantity?: string | number; unit?: string; notes?: string };
function formatIngredient(item: string | Ingredient): string {
  if (typeof item === 'string') return item;
  const qty = item.quantity != null ? String(item.quantity) : '';
  const unit = item.unit ?? '';
  const name = item.name ?? '';
  const notes = item.notes ? ` (${item.notes})` : '';
  return [qty, unit, name].filter(Boolean).join(' ') + notes;
}
function formatInstruction(item: string | Record<string, unknown>): string {
  if (typeof item === 'string') return item;
  const val = item.text ?? item.instruction ?? item.step ?? item.description ?? item.content;
  return val != null ? String(val) : JSON.stringify(item);
}

// ── Collapsible panel ────────────────────────────────────────────────────────
function CollapsiblePanel({
  label,
  accentColor,
  items,
  loading,
  numbered,
}: {
  label: string;
  accentColor: string;
  items: any[] | null | undefined;
  loading: boolean;
  numbered?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={cp.wrapper}>
      <View style={[cp.backing, { backgroundColor: accentColor }]} />
      <View style={[cp.panel, { borderColor: accentColor, shadowColor: accentColor }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setOpen((v) => !v)}
          style={cp.header}
        >
          <Text style={[cp.label, { color: accentColor }]}>{label}</Text>
          <View style={[cp.pill, { backgroundColor: accentColor }]}>
            <Text style={cp.pillText}>{open ? '−' : '+'}</Text>
          </View>
        </TouchableOpacity>
        {open && <View style={[cp.divider, { backgroundColor: accentColor }]} />}
        {open && (
          <View style={cp.body}>
            {loading ? (
              <ActivityIndicator color={accentColor} size="small" style={{ marginVertical: 12 }} />
            ) : !items || items.length === 0 ? (
              <Text style={cp.empty}>No data available.</Text>
            ) : (
              items.map((item, i) => (
                <View key={i} style={cp.row}>
                  <Text style={[cp.bullet, { color: accentColor }]}>
                    {numbered ? `${i + 1}.` : '▸'}
                  </Text>
                  <Text style={cp.itemText}>
                    {numbered ? formatInstruction(item) : formatIngredient(item)}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Recipe detail modal ──────────────────────────────────────────────────────
function RecipeDetailModal({
  recipe,
  onClose,
}: {
  recipe: Recipe;
  onClose: () => void;
}) {
  const [fullRecipe, setFullRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecipeById(recipe.id)
      .then((r) => setFullRecipe(r))
      .finally(() => setLoading(false));
  }, [recipe.id]);

  const imgSource = recipe.image_url
    ? { uri: recipe.image_url }
    : require('@/assets/weekend-brunch.jpg');

  async function handleOpenCMP() {
    const deepLink = `curatemyplate://recipe?id=${recipe.id}&action=save`;
    try {
      await Linking.openURL(deepLink);
    } catch {
      Alert.alert(
        'Curate My Plate not found',
        'Install the Curate My Plate app to save and cook this recipe.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Install',
            onPress: () => Linking.openURL('https://apps.apple.com/app/id6762019159'),
          },
        ],
      );
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={md.root}>
        <View style={md.topBar}>
          <TouchableOpacity onPress={onClose} style={md.closeBtn} activeOpacity={0.85}>
            <Text style={md.closeX}>×</Text>
          </TouchableOpacity>
          <Text style={md.wordmark}>PLATEOFFS</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView style={md.scroll} contentContainerStyle={md.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={md.content}>
            <View style={md.frameOuter}>
              <View style={md.frameBacking} />
              <View style={md.frameCard}>
                <Image source={imgSource} style={md.heroImage} resizeMode="cover" />
                <View style={md.championBadge}>
                  <Text style={md.championBadgeText}>★ CHAMPION</Text>
                </View>
              </View>
            </View>

            <View style={md.infoCard}>
              <Text style={md.recipeTitle}>{(recipe.title ?? '').toUpperCase()}</Text>
              {(recipe.cook_time_minutes || recipe.difficulty) ? (
                <View style={md.metaRow}>
                  {recipe.cook_time_minutes ? (
                    <Text style={md.metaText}>⏱ {recipe.cook_time_minutes} MINS</Text>
                  ) : null}
                  {recipe.difficulty ? (
                    <Text style={md.metaText}>🔥 {recipe.difficulty.toUpperCase()}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            {loading ? (
              <ActivityIndicator color={C.secondary} size="large" style={{ marginVertical: 24 }} />
            ) : (
              <>
                <CollapsiblePanel
                  label="INGREDIENTS"
                  accentColor={C.secondary}
                  items={fullRecipe?.ingredients}
                  loading={false}
                />
                <CollapsiblePanel
                  label="INSTRUCTIONS"
                  accentColor={C.tertiaryContainer}
                  items={fullRecipe?.instructions}
                  loading={false}
                  numbered
                />
              </>
            )}

            <TouchableOpacity onPress={handleOpenCMP} activeOpacity={0.85} style={md.cmpBtn}>
              <Text style={md.cmpBtnText}>Save in Curate My Plate</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Champion card ────────────────────────────────────────────────────────────
const CARD_ACCENTS = [C.secondary, C.primary, C.tertiaryContainer];

function ChampionCard({
  recipe,
  index,
  isMe,
  onPress,
}: {
  recipe: Recipe;
  index: number;
  isMe: boolean;
  onPress: () => void;
}) {
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[s.card, { borderColor: accent }]}>
      {recipe.image_url ? (
        <Image source={{ uri: recipe.image_url }} style={s.cardImage} resizeMode="cover" />
      ) : (
        <View style={[s.cardImagePlaceholder, { backgroundColor: accent + '33' }]}>
          <Text style={{ fontSize: 32 }}>🍽️</Text>
        </View>
      )}
      <View style={s.cardBody}>
        <Text style={[s.cardTitle, { color: accent }]} numberOfLines={2}>
          {(recipe.title ?? '').toUpperCase()}
        </Text>
        {recipe.cook_time_minutes ? (
          <Text style={s.cardMeta}>⏱ {recipe.cook_time_minutes} MINS</Text>
        ) : null}
        {recipe.difficulty ? (
          <Text style={s.cardMeta}>🔥 {recipe.difficulty.toUpperCase()}</Text>
        ) : null}
      </View>
      <View style={[s.cardArrow, { backgroundColor: accent }]}>
        <Text style={s.cardArrowText}>→</Text>
      </View>
      {isMe && (
        <View style={[s.youBadge, { backgroundColor: accent }]}>
          <Text style={s.youBadgeText}>YOU</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function SessionResultsScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session, clearSession } = useSessionStore();
  const { champion: myChampion, reset } = useTournamentStore();
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [champions, setChampions] = useState<Recipe[]>([]);
  const [myVoterId, setMyVoterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const sessionId = session?.id;
  const divisionName = session?.division_name ?? '';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      setMyVoterId(authSession?.user.id ?? null);
    });
  }, []);

  async function loadResults(sid: string) {
    setLoading(true);
    try {
      const ps = await fetchSessionParticipants(sid);
      setParticipants(ps);
      const finishedIds = ps
        .filter((p) => p.champion_recipe_id)
        .map((p) => p.champion_recipe_id!);
      if (finishedIds.length) {
        const recipes = await fetchRecipesByIds(finishedIds);
        setChampions(recipes);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    loadResults(sessionId);

    // Realtime: refresh when someone submits their champion
    const channel = supabase
      .channel(`results:${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'session_participants',
        filter: `session_id=eq.${sessionId}`,
      }, () => { loadResults(sessionId); })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [sessionId]);

  const pending = participants.filter((p) => !p.champion_recipe_id);
  const finished = participants.filter((p) => p.champion_recipe_id);

  function handleDone() {
    reset();
    clearSession();
    router.replace('/');
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.inner}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.wordmark}>PLATEOFFS</Text>
          </View>

          {/* Headline */}
          <View style={s.heroSection}>
            <Text style={s.headline}>GROUP{'\n'}RESULTS</Text>
            <View style={s.divisionPill}>
              <Text style={s.divisionPillText}>{divisionName.toUpperCase()} DIVISION</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color={C.primary} size="large" style={{ marginVertical: 48 }} />
          ) : (
            <>
              {/* Finished picks */}
              {champions.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionLabel}>
                    <Text style={s.sectionLabelText}>
                      {finished.length} {finished.length === 1 ? 'PICK' : 'PICKS'} IN
                    </Text>
                  </View>
                  {champions.map((recipe, i) => {
                    const participant = participants.find(
                      (p) => p.champion_recipe_id === recipe.id,
                    );
                    const isMe = !!participant && participant.voter_id === myVoterId;
                    return (
                      <ChampionCard
                        key={recipe.id + i}
                        recipe={recipe}
                        index={i}
                        isMe={isMe}
                        onPress={() => setSelectedRecipe(recipe)}
                      />
                    );
                  })}
                </View>
              )}

              {/* Pending players */}
              {pending.length > 0 && (
                <View style={s.section}>
                  <View style={[s.sectionLabel, s.sectionLabelPending]}>
                    <Text style={[s.sectionLabelText, { color: C.textMuted }]}>
                      {pending.length} STILL VOTING
                    </Text>
                  </View>
                  {pending.map((_, i) => (
                    <View key={i} style={s.pendingCard}>
                      <ActivityIndicator color={C.textMuted} size="small" />
                      <Text style={s.pendingText}>Voting in progress...</Text>
                    </View>
                  ))}
                </View>
              )}

              {pending.length === 0 && (
                <View style={s.allDoneBanner}>
                  <Text style={s.allDoneText}>★ ALL PICKS ARE IN ★</Text>
                </View>
              )}
            </>
          )}

          {/* Done CTA */}
          <TouchableOpacity onPress={handleDone} activeOpacity={0.85} style={s.doneBtn}>
            <Text style={s.doneBtnText}>DONE  ↩</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Recipe detail modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </SafeAreaView>
  );
}

const CARD_IMG = IS_TABLET ? 120 : 90;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  scroll: { paddingBottom: 48 },
  inner: {
    width: '100%',
    maxWidth: LAYOUT_WIDTH,
    alignSelf: 'center',
  },

  header: {
    alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 4, borderBottomColor: '#000',
    shadowColor: '#ba881c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
  },
  wordmark: {
    fontWeight: '900', fontSize: 26, color: C.secondary, fontStyle: 'italic',
    textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0,
  },

  heroSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24, gap: 16 },
  headline: {
    fontWeight: '900', fontSize: IS_TABLET ? 80 : 56, color: C.tertiaryContainer,
    fontStyle: 'italic', textAlign: 'center', lineHeight: IS_TABLET ? 78 : 54,
    transform: [{ rotate: '-2deg' }],
    textShadowColor: '#d05bff', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18,
  },
  divisionPill: {
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 3, borderColor: '#000',
    paddingHorizontal: 16, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0,
  },
  divisionPillText: { fontWeight: '900', fontSize: IS_TABLET ? 14 : 12, color: C.primary, letterSpacing: 2, fontStyle: 'italic' },

  section: { paddingHorizontal: IS_TABLET ? 48 : 20, gap: IS_TABLET ? 16 : 14, marginBottom: 28 },

  sectionLabel: {
    backgroundColor: C.tertiaryContainer,
    borderWidth: 3, borderColor: '#000',
    paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start',
    transform: [{ rotate: '-1deg' }],
    shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0,
    marginBottom: 4,
  },
  sectionLabelPending: { backgroundColor: C.surfaceContainerHigh },
  sectionLabelText: { fontWeight: '900', fontSize: IS_TABLET ? 13 : 11, color: '#000', letterSpacing: 2 },

  card: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 5, borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 6,
  },
  cardImage: { width: CARD_IMG, height: CARD_IMG },
  cardImagePlaceholder: { width: CARD_IMG, height: CARD_IMG, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, padding: IS_TABLET ? 16 : 12, gap: IS_TABLET ? 6 : 4, justifyContent: 'center' },
  cardTitle: { fontWeight: '900', fontSize: IS_TABLET ? 22 : 16, fontStyle: 'italic', lineHeight: IS_TABLET ? 26 : 18 },
  cardMeta: { fontSize: IS_TABLET ? 13 : 11, color: C.textMuted, fontWeight: '700', letterSpacing: 1 },
  cardArrow: {
    width: IS_TABLET ? 52 : 40, height: CARD_IMG, alignItems: 'center', justifyContent: 'center',
  },
  cardArrowText: { fontWeight: '900', fontSize: IS_TABLET ? 24 : 20, color: '#000' },
  youBadge: {
    position: 'absolute', top: 8, right: IS_TABLET ? 60 : 44,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 2, borderColor: '#000',
    transform: [{ rotate: '-4deg' }],
  },
  youBadgeText: { fontWeight: '900', fontSize: IS_TABLET ? 10 : 9, color: '#000', letterSpacing: 1 },

  pendingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 3, borderColor: C.outlineVariant, borderRadius: 8,
    padding: IS_TABLET ? 20 : 16, opacity: 0.6,
  },
  pendingText: { fontWeight: '700', fontSize: IS_TABLET ? 16 : 14, color: C.textMuted, fontStyle: 'italic' },

  allDoneBanner: {
    marginHorizontal: IS_TABLET ? 48 : 20, marginBottom: 20,
    backgroundColor: C.secondary,
    borderWidth: 4, borderColor: '#000',
    padding: IS_TABLET ? 20 : 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0,
    transform: [{ rotate: '-1deg' }],
  },
  allDoneText: { fontWeight: '900', fontSize: IS_TABLET ? 22 : 16, color: '#000', letterSpacing: 2, fontStyle: 'italic' },

  doneBtn: {
    marginHorizontal: IS_TABLET ? 48 : 20, marginTop: 8,
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 4, borderColor: C.outlineVariant,
    borderRadius: 60, paddingVertical: IS_TABLET ? 20 : 14,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
  },
  doneBtnText: { fontWeight: '900', fontSize: IS_TABLET ? 19 : 15, color: C.textLight, fontStyle: 'italic' },
});

// ── CollapsiblePanel styles ──────────────────────────────────────────────────
const cp = StyleSheet.create({
  wrapper: { width: '100%', paddingBottom: 6, paddingRight: 6, marginBottom: 8 },
  backing: {
    position: 'absolute', top: 6, left: 6, right: 0, bottom: 0,
    borderWidth: 3, borderColor: '#000', borderRadius: 4, opacity: 0.5,
  },
  panel: {
    backgroundColor: C.surfaceContainerLow, borderWidth: 3, borderRadius: 4,
    overflow: 'hidden', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: IS_TABLET ? 20 : 16, paddingVertical: IS_TABLET ? 16 : 12,
  },
  label: { fontWeight: '900', fontSize: IS_TABLET ? 20 : 16, letterSpacing: 2, fontStyle: 'italic' },
  pill: {
    width: IS_TABLET ? 38 : 32, height: IS_TABLET ? 38 : 32,
    borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0,
  },
  pillText: { fontWeight: '900', fontSize: IS_TABLET ? 22 : 18, color: '#000', lineHeight: IS_TABLET ? 24 : 20 },
  divider: { height: 2 },
  body: { paddingHorizontal: IS_TABLET ? 20 : 16, paddingVertical: IS_TABLET ? 14 : 12, gap: IS_TABLET ? 12 : 8 },
  row: { flexDirection: 'row', gap: IS_TABLET ? 12 : 8, alignItems: 'flex-start' },
  bullet: { fontWeight: '900', fontSize: IS_TABLET ? 17 : 15, minWidth: IS_TABLET ? 26 : 22, paddingTop: 1 },
  itemText: { flex: 1, fontSize: IS_TABLET ? 17 : 15, color: C.onSurface, lineHeight: IS_TABLET ? 28 : 24 },
  empty: { fontSize: 14, color: C.onSurfaceVariant, fontStyle: 'italic' },
});

// ── Modal styles ─────────────────────────────────────────────────────────────
const md = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 4, borderBottomColor: '#000',
  },
  closeBtn: {
    width: 48, height: 48, borderWidth: 3, borderColor: C.outlineVariant,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0,
  },
  closeX: { fontWeight: '900', fontSize: 28, color: C.textLight, lineHeight: 32 },
  wordmark: { fontWeight: '900', fontSize: 22, color: C.secondary, fontStyle: 'italic' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  content: {
    width: '100%', maxWidth: IS_TABLET ? 720 : undefined, alignSelf: 'center',
    padding: IS_TABLET ? 40 : 24, gap: 20,
  },

  frameOuter: { width: '100%', paddingBottom: 12, paddingRight: 12 },
  frameBacking: {
    position: 'absolute', top: 12, left: 12, right: 0, bottom: 0,
    backgroundColor: C.primaryContainer, borderWidth: 4, borderColor: '#000', borderRadius: 12,
    transform: [{ rotate: '-3deg' }],
  },
  frameCard: {
    borderWidth: 4, borderColor: C.secondary, borderRadius: 8, overflow: 'hidden',
    transform: [{ rotate: '1deg' }],
    shadowColor: '#d05bff', shadowOffset: { width: 12, height: 12 }, shadowOpacity: 1, shadowRadius: 0,
  },
  heroImage: { width: '100%', height: IS_TABLET ? 380 : 260 },
  championBadge: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: C.secondary, paddingHorizontal: 16, paddingVertical: 6,
    borderWidth: 4, borderColor: '#000', transform: [{ rotate: '-12deg' }],
    shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
  },
  championBadgeText: { fontWeight: '900', fontSize: 14, color: C.onSecondary },

  infoCard: {
    backgroundColor: C.surfaceContainer, borderWidth: 4, borderColor: '#000',
    padding: IS_TABLET ? 24 : 18,
    shadowColor: C.primary, shadowOffset: { width: 8, height: 8 }, shadowOpacity: 1, shadowRadius: 0,
  },
  recipeTitle: { fontWeight: '900', fontSize: IS_TABLET ? 32 : 26, color: C.primary, lineHeight: IS_TABLET ? 36 : 28 },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: IS_TABLET ? 10 : 6 },
  metaText: { fontSize: IS_TABLET ? 13 : 11, color: C.secondaryFixed, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  cmpBtn: {
    backgroundColor: C.primary, paddingVertical: IS_TABLET ? 22 : 18, borderRadius: 999,
    borderWidth: 4, borderColor: '#000', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0,
  },
  cmpBtnText: { fontWeight: '900', fontSize: IS_TABLET ? 20 : 18, color: C.onPrimary, fontStyle: 'italic', textTransform: 'uppercase' },
});
