import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSavedRecipesStore, type SavedRecipe, MAX_SAVED_RECIPES } from '@/store/savedRecipes';
import { useTournamentStore } from '@/store/tournament';
import { fetchRecipeById } from '@/lib/supabase';
import type { Recipe } from '@/types/recipe';
import { C } from '@/constants/colors';
import { IS_TABLET, useLayout } from '@/constants/layout';

// ── Slot accent colors cycling through the palette ──────────────────────────
const SLOT_ACCENTS = [C.secondary, C.primary, C.tertiaryContainer, C.secondary, C.primary, C.tertiaryContainer];
const SLOT_ON: Record<string, string> = {
  [C.secondary]: '#000',
  [C.primary]: C.onPrimary,
  [C.tertiaryContainer]: C.onTertiaryContainer,
};

const MAX_CONTENT_W = 1060;

// ── Ingredient / instruction formatters (mirrored from champion.tsx) ─────────
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

// ── Collapsible recipe panel ─────────────────────────────────────────────────
function CollapsiblePanel({
  label,
  accentColor,
  rotate,
  items,
  loading,
  numbered,
}: {
  label: string;
  accentColor: string;
  rotate: string;
  items: any[] | null | undefined;
  loading: boolean;
  numbered?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[cp.wrapper, { transform: [{ rotate }] }]}>
      <View style={[cp.backing, { backgroundColor: accentColor }]} />
      <View style={[cp.panel, { borderColor: accentColor, shadowColor: accentColor }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setOpen((v) => !v)}
          style={cp.header}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${open ? 'collapse' : 'expand'}`}
          accessibilityState={{ expanded: open }}
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
  recipe: SavedRecipe;
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
        {/* Close row */}
        <View style={md.topBar}>
          <TouchableOpacity
            onPress={onClose}
            style={md.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close recipe"
            activeOpacity={0.85}
          >
            <Text style={md.closeX}>×</Text>
          </TouchableOpacity>
          <Text style={md.topWordmark}>PLATEOFFS</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView
          style={md.scroll}
          contentContainerStyle={md.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero image */}
          <View style={md.frameOuter}>
            <View style={md.frameBacking} />
            <View style={md.frameCard}>
              <Image
                source={imgSource}
                style={md.heroImage}
                resizeMode="cover"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <View style={md.savedBadge}>
                <Text style={md.savedBadgeText}>★ SAVED</Text>
              </View>
            </View>
          </View>

          {/* Info card */}
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
            {recipe.description ? (
              <Text style={md.desc}>{recipe.description}</Text>
            ) : null}
            <Text style={md.disclaimer}>AI-generated recipe — always use your best judgement when cooking.</Text>
          </View>

          {/* Panels */}
          <CollapsiblePanel
            label="INGREDIENTS"
            accentColor={C.secondary}
            rotate="-1.5deg"
            items={fullRecipe?.ingredients}
            loading={loading}
          />
          <CollapsiblePanel
            label="INSTRUCTIONS"
            accentColor={C.tertiaryContainer}
            rotate="1deg"
            items={fullRecipe?.instructions}
            loading={loading}
            numbered
          />

          {/* CMP CTA */}
          <TouchableOpacity
            onPress={handleOpenCMP}
            activeOpacity={0.85}
            style={md.cmpBtn}
            accessibilityRole="button"
            accessibilityLabel="Save Recipe in Curate My Plate"
          >
            <Text style={md.cmpBtnText}>Save Recipe in Curate My Plate</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Empty slot ───────────────────────────────────────────────────────────────
function EmptySlot({ accent, replaceMode }: { accent: string; replaceMode: boolean }) {
  return (
    <View style={[sl.slot, sl.emptySlot, { borderColor: accent }]}>
      <Text style={[sl.emptyPlus, { color: accent }]}>{replaceMode ? '—' : '+'}</Text>
      <Text style={[sl.emptyLabel, { color: accent }]}>
        {replaceMode ? 'UNAVAILABLE' : 'EMPTY SLOT'}
      </Text>
    </View>
  );
}

// ── Filled slot ──────────────────────────────────────────────────────────────
function FilledSlot({
  recipe,
  accent,
  replaceMode,
  onPress,
  onDelete,
}: {
  recipe: SavedRecipe;
  accent: string;
  replaceMode: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const imgSource = recipe.image_url
    ? { uri: recipe.image_url }
    : require('@/assets/weekend-brunch.jpg');

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[sl.slot, sl.filledSlot, { borderColor: accent, shadowColor: accent }]}
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}${replaceMode ? ', tap to replace' : ', tap to view'}`}
    >
      {/* Backing offset */}
      <View style={[sl.backing, { backgroundColor: accent }]} />

      {/* Image */}
      <Image source={imgSource} style={sl.slotImage} resizeMode="cover" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />

      {/* Replace mode flash overlay */}
      {replaceMode && (
        <View style={sl.replaceOverlay} pointerEvents="none">
          <Text style={sl.replaceOverlayText}>TAP TO{'\n'}REPLACE</Text>
        </View>
      )}

      {/* Bottom overlay */}
      <View style={sl.overlay}>
        <Text style={sl.slotTitle} numberOfLines={2}>{recipe.title.toUpperCase()}</Text>
        {(recipe.cook_time_minutes || recipe.difficulty) ? (
          <View style={sl.metaRow}>
            {recipe.cook_time_minutes ? <Text style={sl.metaText}>⏱ {recipe.cook_time_minutes}M</Text> : null}
            {recipe.difficulty ? <Text style={sl.metaText}>🔥 {recipe.difficulty.toUpperCase()}</Text> : null}
          </View>
        ) : null}
      </View>

      {/* Delete button — hidden in replace mode */}
      {!replaceMode && (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); onDelete(); }}
          style={sl.deleteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${recipe.title}`}
          activeOpacity={0.8}
        >
          <Text style={sl.deleteX}>×</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ── Main saved screen ────────────────────────────────────────────────────────
export default function SavedScreen() {
  const router = useRouter();
  const { isTablet, screenWidth } = useLayout();
  const hPad = isTablet ? Math.max(32, Math.floor((screenWidth - MAX_CONTENT_W) / 2)) : 20;

  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isReplaceMode = mode === 'replace';

  const { recipes, removeRecipe, replaceRecipe } = useSavedRecipesStore();
  const { champion } = useTournamentStore();

  // Pending recipe is champion from tournament store when in replace mode
  const pendingRecipe = isReplaceMode && champion ? champion : null;

  const [detailRecipe, setDetailRecipe] = useState<SavedRecipe | null>(null);

  // Build 6 slots — filled recipes first, then empties
  const slots: (SavedRecipe | null)[] = [
    ...recipes,
    ...Array(Math.max(0, MAX_SAVED_RECIPES - recipes.length)).fill(null),
  ];

  function handleSlotPress(slot: SavedRecipe | null, index: number) {
    if (!slot) return;

    if (isReplaceMode && pendingRecipe) {
      Alert.alert(
        'Replace Recipe?',
        `Replace "${slot.title}" with "${pendingRecipe.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: () => {
              replaceRecipe(slot.id, {
                id: pendingRecipe.id,
                title: pendingRecipe.title,
                image_url: pendingRecipe.image_url,
                description: pendingRecipe.description,
                cook_time_minutes: pendingRecipe.cook_time_minutes,
                difficulty: pendingRecipe.difficulty,
                savedAt: Date.now(),
              });
              router.back();
            },
          },
        ],
      );
    } else {
      setDetailRecipe(slot);
    }
  }

  function handleDelete(id: string, title: string) {
    Alert.alert(
      'Remove Recipe',
      `Remove "${title}" from your Recipe Box?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeRecipe(id),
        },
      ],
    );
  }

  async function handleImportAll() {
    if (recipes.length === 0) {
      Alert.alert('Nothing to Import', 'Save some recipes first!');
      return;
    }
    const ids = recipes.map((r) => r.id).join(',');
    const deepLink = `curatemyplate://import?ids=${ids}`;
    try {
      await Linking.openURL(deepLink);
    } catch {
      Alert.alert(
        'Curate My Plate not found',
        'Install the Curate My Plate app to import your saved recipes.',
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

  const filled = recipes.length;
  const colCount = isTablet ? 3 : 2;

  return (
    <SafeAreaView style={g.root}>
      {/* Header */}
      <View style={g.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={g.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          activeOpacity={0.8}
        >
          <Text style={g.backText}>←</Text>
        </TouchableOpacity>
        <View style={g.headerCenter}>
          <Text style={g.wordmark}>PLATEOFFS</Text>
          <Text style={g.headerSub}>MY RECIPE BOX</Text>
        </View>
        <View style={g.countBadge}>
          <Text style={g.countText}>{filled}/{MAX_SAVED_RECIPES}</Text>
        </View>
      </View>

      <ScrollView
        style={g.scroll}
        contentContainerStyle={[g.content, { paddingHorizontal: hPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Replace mode banner */}
        {isReplaceMode && pendingRecipe && (
          <View style={g.replaceBanner}>
            <View style={g.replaceBannerStripeRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {Array.from({ length: 14 }).map((_, i) => (
                <View key={i} style={[g.replaceBannerStripe, { backgroundColor: i % 2 === 0 ? '#000' : C.secondary }]} />
              ))}
            </View>
            <View style={g.replaceBannerBody}>
              <Text style={g.replaceBannerTitle}>RECIPE BOX FULL</Text>
              <Text style={g.replaceBannerSub}>TAP A RECIPE BELOW TO REPLACE IT WITH:</Text>
              <View style={g.replacePendingCard}>
                <Text style={g.replacePendingName}>"{pendingRecipe.title.toUpperCase()}"</Text>
              </View>
            </View>
          </View>
        )}

        {/* Slot grid */}
        <View style={[g.grid, { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }]}>
          {slots.map((slot, i) => {
            const accent = SLOT_ACCENTS[i % SLOT_ACCENTS.length];
            const colW = isTablet
              ? `${Math.floor(100 / colCount) - 2}%` as any
              : '47%' as any;
            return (
              <View key={slot?.id ?? `empty-${i}`} style={{ width: colW }}>
                {slot ? (
                  <FilledSlot
                    recipe={slot}
                    accent={accent}
                    replaceMode={isReplaceMode}
                    onPress={() => handleSlotPress(slot, i)}
                    onDelete={() => handleDelete(slot.id, slot.title)}
                  />
                ) : (
                  <EmptySlot accent={accent} replaceMode={isReplaceMode} />
                )}
              </View>
            );
          })}
        </View>

        {/* Import CTA */}
        <View style={g.importSection}>
          {/* Decorative divider */}
          <View style={g.importDivider}>
            <View style={g.importDividerLine} />
            <Text style={g.importDividerText}>OR GO FURTHER</Text>
            <View style={g.importDividerLine} />
          </View>

          <View style={g.importCard}>
            <View style={g.importCardBacking} />
            <View style={g.importCardInner}>
              <Text style={g.importCardTitle}>NEVER LOSE A RECIPE</Text>
              <Text style={g.importCardBody}>
                Get a free Curate My Plate account and bring your whole Recipe Box with you. Cook your winners, adjust the portions, and never lose a great recipe.
              </Text>
              <TouchableOpacity
                onPress={handleImportAll}
                activeOpacity={0.85}
                style={[g.importBtn, recipes.length === 0 && g.importBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel={`Import ${filled} recipes to Curate My Plate`}
                disabled={recipes.length === 0}
              >
                <Text style={g.importBtnText} numberOfLines={1} adjustsFontSizeToFit>
                  IMPORT {filled > 0 ? `${filled} ` : ''}RECIPE{filled !== 1 ? 'S' : ''} TO CURATE MY PLATE  →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Recipe detail modal */}
      {detailRecipe && (
        <RecipeDetailModal
          recipe={detailRecipe}
          onClose={() => setDetailRecipe(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Slot styles ──────────────────────────────────────────────────────────────
const SLOT_H = IS_TABLET ? 240 : 200;

const sl = StyleSheet.create({
  slot: {
    height: SLOT_H,
    borderWidth: 4,
    borderColor: '#000',
    overflow: 'hidden',
    position: 'relative',
  },

  emptySlot: {
    borderStyle: 'dashed',
    backgroundColor: C.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyPlus: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 48 : 38,
    fontStyle: 'italic',
    opacity: 0.5,
  },
  emptyLabel: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 11 : 9,
    letterSpacing: 2,
    opacity: 0.5,
  },

  filledSlot: {
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },

  backing: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    zIndex: -1,
  },

  slotImage: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: '100%',
    height: '100%',
  },

  replaceOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  replaceOverlayText: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 18 : 15,
    color: C.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
    letterSpacing: 1,
  },

  overlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    zIndex: 4,
    gap: 3,
  },
  slotTitle: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 15 : 12,
    color: '#fff',
    fontStyle: 'italic',
    lineHeight: IS_TABLET ? 18 : 14,
  },
  metaRow: { flexDirection: 'row', gap: 8 },
  metaText: {
    fontSize: IS_TABLET ? 10 : 9,
    color: C.secondaryFixed,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  deleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
    backgroundColor: C.errorContainer,
    borderWidth: 3,
    borderColor: '#000',
    width: IS_TABLET ? 34 : 28,
    height: IS_TABLET ? 34 : 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  deleteX: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 22 : 18,
    color: C.onErrorContainer,
    lineHeight: IS_TABLET ? 24 : 20,
  },
});

// ── Page styles ──────────────────────────────────────────────────────────────
const g = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  scroll: { flex: 1 },
  content: { paddingTop: IS_TABLET ? 40 : 24, paddingBottom: 60, gap: 28 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: IS_TABLET ? 14 : 12,
    borderBottomWidth: 4,
    borderBottomColor: '#000',
    shadowColor: C.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  backText: {
    fontWeight: '900',
    fontSize: 20,
    color: C.onSurface,
    lineHeight: 22,
  },
  headerCenter: { alignItems: 'center', gap: 2 },
  wordmark: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 24 : 20,
    color: C.secondary,
    fontStyle: 'italic',
    letterSpacing: 1,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  headerSub: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 11 : 9,
    color: C.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  countBadge: {
    backgroundColor: C.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    minWidth: 44,
    alignItems: 'center',
  },
  countText: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 15 : 13,
    color: '#000',
    fontStyle: 'italic',
  },

  grid: { alignItems: 'flex-start' },

  // Replace mode banner
  replaceBanner: {
    borderWidth: 4,
    borderColor: '#000',
    overflow: 'hidden',
    shadowColor: C.secondary,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  replaceBannerStripeRow: { flexDirection: 'row', height: 10, overflow: 'hidden' },
  replaceBannerStripe: { flex: 1, height: 20, transform: [{ skewX: '-20deg' }] },
  replaceBannerBody: {
    backgroundColor: '#1a1000',
    paddingHorizontal: IS_TABLET ? 24 : 18,
    paddingVertical: IS_TABLET ? 20 : 16,
    gap: 8,
  },
  replaceBannerTitle: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 28 : 22,
    color: C.secondary,
    fontStyle: 'italic',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  replaceBannerSub: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 12 : 10,
    color: C.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  replacePendingCard: {
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 3,
    borderColor: C.secondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    transform: [{ rotate: '-1deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    marginTop: 4,
  },
  replacePendingName: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 18 : 15,
    color: C.primary,
    fontStyle: 'italic',
  },

  // Import section
  importSection: { gap: 16 },
  importDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  importDividerLine: {
    flex: 1,
    height: 3,
    backgroundColor: C.outlineVariant,
  },
  importDividerText: {
    fontWeight: '900',
    fontSize: 10,
    color: C.textMuted,
    letterSpacing: 2,
  },

  importCard: {
    position: 'relative',
    paddingBottom: 8,
    paddingRight: 8,
  },
  importCardBacking: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 0,
    bottom: 0,
    backgroundColor: C.tertiaryContainer,
    borderWidth: 4,
    borderColor: '#000',
  },
  importCardInner: {
    backgroundColor: C.surfaceContainer,
    borderWidth: 4,
    borderColor: '#000',
    padding: IS_TABLET ? 28 : 20,
    gap: 14,
    shadowColor: C.tertiaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  importCardTitle: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 26 : 22,
    color: C.tertiaryContainer,
    fontStyle: 'italic',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  importCardBody: {
    fontSize: IS_TABLET ? 16 : 14,
    color: C.onSurfaceVariant,
    lineHeight: IS_TABLET ? 26 : 22,
  },
  importBtn: {
    backgroundColor: C.tertiaryContainer,
    paddingVertical: IS_TABLET ? 20 : 16,
    borderWidth: 4,
    borderColor: '#000',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  importBtnDisabled: {
    opacity: 0.4,
  },
  importBtnText: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 16 : 13,
    color: C.onTertiaryContainer,
    fontStyle: 'italic',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

// ── Modal styles ─────────────────────────────────────────────────────────────
const md = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: IS_TABLET ? 48 : 24,
    paddingBottom: 60,
    gap: 24,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: IS_TABLET ? 14 : 12,
    borderBottomWidth: 4,
    borderBottomColor: '#000',
    shadowColor: C.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  closeBtn: {
    width: IS_TABLET ? 52 : 44,
    height: IS_TABLET ? 52 : 44,
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 4,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  closeX: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 28 : 24,
    color: C.onSurface,
    lineHeight: IS_TABLET ? 30 : 26,
  },
  topWordmark: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 24 : 20,
    color: C.secondary,
    fontStyle: 'italic',
    letterSpacing: 1,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },

  frameOuter: { width: '100%', paddingBottom: 12, paddingRight: 12, marginTop: 20 },
  frameBacking: {
    position: 'absolute',
    top: 12, left: 12, right: 0, bottom: 0,
    backgroundColor: C.primaryContainer,
    borderWidth: 4,
    borderColor: '#000',
    borderRadius: 8,
    transform: [{ rotate: '-2deg' }],
  },
  frameCard: {
    borderWidth: 4,
    borderColor: C.secondary,
    overflow: 'hidden',
    transform: [{ rotate: '1deg' }],
    shadowColor: C.tertiaryContainer,
    shadowOffset: { width: 10, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  heroImage: { width: '100%', height: IS_TABLET ? 380 : 260 },
  savedBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: C.secondary,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 3,
    borderColor: '#000',
    transform: [{ rotate: '-10deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  savedBadgeText: {
    fontWeight: '900',
    fontSize: 13,
    color: C.onSecondary,
  },

  infoCard: {
    backgroundColor: C.surfaceContainer,
    borderWidth: 4,
    borderColor: '#000',
    padding: IS_TABLET ? 24 : 18,
    shadowColor: C.primary,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
    transform: [{ rotate: '-0.5deg' }],
    gap: 8,
  },
  recipeTitle: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 32 : 24,
    color: C.primary,
    textTransform: 'uppercase',
    lineHeight: IS_TABLET ? 36 : 28,
    fontStyle: 'italic',
  },
  metaRow: { flexDirection: 'row', gap: 14 },
  metaText: {
    fontSize: IS_TABLET ? 13 : 11,
    color: C.secondaryFixed,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  desc: {
    fontSize: IS_TABLET ? 15 : 13,
    color: C.onSurfaceVariant,
    lineHeight: IS_TABLET ? 24 : 20,
  },
  disclaimer: {
    fontSize: IS_TABLET ? 12 : 10,
    color: C.textMuted,
    fontStyle: 'italic',
  },

  cmpBtn: {
    backgroundColor: C.primary,
    paddingVertical: IS_TABLET ? 24 : 20,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: '#000',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  cmpBtnText: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 20 : 17,
    color: C.onPrimary,
    fontStyle: 'italic',
    textTransform: 'uppercase',
  },
});

// ── Collapsible panel styles ─────────────────────────────────────────────────
const cp = StyleSheet.create({
  wrapper: { width: '100%', paddingBottom: 8, paddingRight: 8 },
  backing: {
    position: 'absolute',
    top: 8, left: 8, right: 0, bottom: 0,
    borderWidth: 4,
    borderColor: '#000',
    opacity: 0.5,
  },
  panel: {
    backgroundColor: C.surfaceContainerLow,
    borderWidth: 4,
    overflow: 'hidden',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IS_TABLET ? 24 : 18,
    paddingVertical: IS_TABLET ? 18 : 14,
  },
  label: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 22 : 18,
    letterSpacing: 2,
    fontStyle: 'italic',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  pill: {
    width: IS_TABLET ? 42 : 36,
    height: IS_TABLET ? 42 : 36,
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  pillText: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 26 : 22,
    color: '#000',
    lineHeight: IS_TABLET ? 28 : 24,
  },
  divider: { height: 3 },
  body: {
    paddingHorizontal: IS_TABLET ? 24 : 18,
    paddingVertical: IS_TABLET ? 18 : 14,
    gap: IS_TABLET ? 14 : 10,
  },
  row: { flexDirection: 'row', gap: IS_TABLET ? 14 : 10, alignItems: 'flex-start' },
  bullet: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 19 : 17,
    minWidth: IS_TABLET ? 30 : 26,
    paddingTop: 1,
  },
  itemText: {
    flex: 1,
    fontSize: IS_TABLET ? 19 : 17,
    color: C.onSurface,
    lineHeight: IS_TABLET ? 30 : 26,
  },
  empty: {
    fontSize: 15,
    color: C.onSurfaceVariant,
    fontStyle: 'italic',
  },
});
