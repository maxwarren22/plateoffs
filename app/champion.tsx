import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTournamentStore } from '@/store/tournament';
import { fetchRecipeById } from '@/lib/supabase';
import type { Recipe } from '@/types/recipe';
import { C } from '@/constants/colors';
import { LAYOUT_WIDTH } from '@/constants/layout';

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
  // handle {text: ...}, {instruction: ...}, {step: ...}, {description: ...}
  const val = item.text ?? item.instruction ?? item.step ?? item.description ?? item.content;
  return val != null ? String(val) : JSON.stringify(item);
}

function CollapsibleRecipePanel({
  label,
  accentColor,
  shadowColor,
  rotate,
  items,
  loading,
  numbered,
}: {
  label: string;
  accentColor: string;
  shadowColor: string;
  rotate: string;
  items: any[] | null | undefined;
  loading: boolean;
  numbered?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={[p.wrapper, { transform: [{ rotate }] }]}>
      {/* Backing offset layer */}
      <View style={[p.backing, { backgroundColor: accentColor }]} />

      <View style={[p.panel, { borderColor: accentColor, shadowColor }]}>
        {/* Header row — always visible */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setOpen((v) => !v)}
          style={p.header}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${open ? 'collapse' : 'expand'}`}
          accessibilityState={{ expanded: open }}
        >
          <Text style={[p.label, { color: accentColor }]}>{label}</Text>
          <View style={[p.togglePill, { backgroundColor: accentColor }]}>
            <Text style={p.toggleText}>{open ? '−' : '+'}</Text>
          </View>
        </TouchableOpacity>

        {/* Divider */}
        {open && <View style={[p.divider, { backgroundColor: accentColor }]} />}

        {/* Body */}
        {open && (
          <View style={p.body}>
            {loading ? (
              <ActivityIndicator color={accentColor} size="small" style={{ marginVertical: 12 }} />
            ) : !items || items.length === 0 ? (
              <Text style={p.emptyText}>No data available.</Text>
            ) : (
              items.map((item, i) => (
                <View key={i} style={p.row}>
                  <Text style={[p.bullet, { color: accentColor }]}>
                    {numbered ? `${i + 1}.` : '▸'}
                  </Text>
                  <Text style={p.itemText}>
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

export default function ChampionScreen() {
  const router = useRouter();
  const { champion, reset } = useTournamentStore();
  const [fullRecipe, setFullRecipe] = useState<Recipe | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!champion) router.replace('/lobby');
  }, [champion]);

  useEffect(() => {
    if (!champion) return;
    setLoadingDetails(true);
    fetchRecipeById(champion.id)
      .then((r) => setFullRecipe(r))
      .finally(() => setLoadingDetails(false));
  }, [champion?.id]);

  if (!champion) return null;

  const imgSource = champion.image_url
    ? { uri: champion.image_url }
    : require('@/assets/weekend-brunch.jpg');

  return (
    <SafeAreaView style={s.root}>
      <View style={s.centeredWrapper}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.wordmark}>PLATEOFFS</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Electric glow headline */}
        <View style={s.headlineContainer}>
          <Text style={s.headline}>WE HAVE A{'\n'}CHAMPION!</Text>
          <View style={s.starsRow}>
            <Text style={s.star}>★</Text>
            <Text style={s.starAlt}>✦</Text>
            <Text style={s.star}>★</Text>
          </View>
        </View>

        {/* Layered image frame */}
        <View style={s.frameOuter} accessible accessibilityLabel={`Photo of ${champion.title}`}>
          <View style={s.frameBacking} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          <View style={s.frameCard}>
            <Image
              source={imgSource}
              style={s.winnerImage}
              resizeMode="cover"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <View style={s.winnerBadge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={s.winnerBadgeText}>★ WINNER</Text>
            </View>
          </View>
        </View>

        {/* Recipe info */}
        <View style={s.infoCard}>
          <Text style={s.recipeTitle}>{champion.title.toUpperCase()}</Text>
          {(champion.cook_time_minutes || champion.difficulty) ? (
            <View style={s.metaRow}>
              {champion.cook_time_minutes ? (
                <Text style={s.metaText}>⏱ {champion.cook_time_minutes} MINS</Text>
              ) : null}
              {champion.difficulty ? (
                <Text style={s.metaText}>🔥 {champion.difficulty.toUpperCase()}</Text>
              ) : null}
            </View>
          ) : null}
          {champion.description ? (
            <Text style={s.recipeDesc}>{champion.description}</Text>
          ) : null}
          <Text style={s.aiDisclaimer}>AI-generated recipe — always use your best judgement when cooking.</Text>
        </View>

        {/* ── Collapsible panels ── */}
        <CollapsibleRecipePanel
          label="INGREDIENTS"
          accentColor={C.secondary}
          shadowColor={C.secondaryContainer}
          rotate="-1.5deg"
          items={fullRecipe?.ingredients}
          loading={loadingDetails}
        />

        <CollapsibleRecipePanel
          label="INSTRUCTIONS"
          accentColor={C.tertiaryContainer}
          shadowColor="#d05bff"
          rotate="1deg"
          items={fullRecipe?.instructions}
          loading={loadingDetails}
          numbered
        />

        {/* CTAs */}
        <TouchableOpacity
          onPress={async () => {
            const deepLink = `curatemyplate://recipe?id=${champion.id}&action=save`;
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
          }}
          activeOpacity={0.85}
          style={s.primaryCta}
          accessibilityRole="button"
          accessibilityLabel="Save Recipe in Curate My Plate"
        >
          <Text style={s.primaryCtaText}>Save Recipe in Curate My Plate</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { reset(); router.replace('/lobby'); }}
          activeOpacity={0.85}
          style={s.secondaryCta}
          accessibilityRole="button"
          accessibilityLabel="Play another division"
        >
          <Text style={s.secondaryCtaText}>PLAY ANOTHER DIVISION  ↻</Text>
        </TouchableOpacity>
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  centeredWrapper: { flex: 1, width: '100%', maxWidth: LAYOUT_WIDTH, alignSelf: 'center' },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 4, borderBottomColor: '#000',
    shadowColor: '#ba881c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 4,
  },
  wordmark: {
    fontWeight: '900', fontSize: 26, color: C.secondary, fontStyle: 'italic',
    textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0,
  },

  content: { paddingHorizontal: 24, paddingBottom: 48, gap: 28 },

  headlineContainer: { alignItems: 'center', paddingTop: 20 },
  headline: {
    fontWeight: '900', fontSize: 52, color: C.tertiaryContainer,
    fontStyle: 'italic', textAlign: 'center', lineHeight: 50,
    transform: [{ rotate: '-2deg' }],
    textShadowColor: '#d05bff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  starsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  star: { fontSize: 28, color: C.secondary },
  starAlt: { fontSize: 24, color: C.primary },

  frameOuter: { width: '100%', paddingBottom: 12, paddingRight: 12 },
  frameBacking: {
    position: 'absolute', top: 12, left: 12, right: 0, bottom: 0,
    backgroundColor: C.primaryContainer,
    borderWidth: 4, borderColor: '#000', borderRadius: 12,
    transform: [{ rotate: '-3deg' }],
  },
  frameCard: {
    borderWidth: 4, borderColor: C.secondary, borderRadius: 8,
    overflow: 'hidden',
    transform: [{ rotate: '1deg' }],
    shadowColor: '#d05bff',
    shadowOffset: { width: 12, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 12,
  },
  winnerImage: { width: '100%', height: 300 },
  winnerBadge: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: C.secondary, paddingHorizontal: 16, paddingVertical: 6,
    borderWidth: 4, borderColor: '#000',
    transform: [{ rotate: '-12deg' }],
    shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
  },
  winnerBadgeText: { fontWeight: '900', fontSize: 14, color: C.onSecondary },

  infoCard: {
    backgroundColor: C.surfaceContainer, borderWidth: 4, borderColor: '#000',
    padding: 20,
    shadowColor: C.primary, shadowOffset: { width: 8, height: 8 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 8, transform: [{ rotate: '-1deg' }],
  },
  recipeTitle: { fontWeight: '900', fontSize: 28, color: C.primary, textTransform: 'uppercase', lineHeight: 28 },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 6 },
  metaText: { fontSize: 12, color: C.secondaryFixed, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  recipeDesc: { fontSize: 14, color: C.onSurfaceVariant, marginTop: 10, lineHeight: 20 },
  aiDisclaimer: { fontSize: 11, color: C.textMuted, marginTop: 10, fontStyle: 'italic' },

  primaryCta: {
    backgroundColor: C.primary, paddingVertical: 22, borderRadius: 999,
    borderWidth: 4, borderColor: '#000', alignItems: 'center',
    alignSelf: 'center', paddingHorizontal: 32,
    shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 6,
  },
  primaryCtaText: { fontWeight: '900', fontSize: 20, color: C.onPrimary, fontStyle: 'italic', textTransform: 'uppercase' },

  secondaryCta: {
    backgroundColor: C.tertiaryContainer, paddingVertical: 18, borderRadius: 0,
    borderWidth: 4, borderColor: '#000', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 4,
  },
  secondaryCtaText: { fontWeight: '900', fontSize: 15, color: C.onTertiaryContainer, textTransform: 'uppercase', letterSpacing: 1 },
});

const p = StyleSheet.create({
  wrapper: { width: '100%', paddingBottom: 8, paddingRight: 8 },

  backing: {
    position: 'absolute', top: 8, left: 8, right: 0, bottom: 0,
    borderWidth: 4, borderColor: '#000', borderRadius: 4,
    opacity: 0.5,
  },

  panel: {
    backgroundColor: C.surfaceContainerLow,
    borderWidth: 4,
    borderColor: C.secondary,
    borderRadius: 4,
    overflow: 'hidden',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
  },

  label: {
    fontWeight: '900', fontSize: 18, letterSpacing: 2, fontStyle: 'italic',
    textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0,
  },

  togglePill: {
    width: 36, height: 36, borderRadius: 0,
    borderWidth: 3, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 3,
  },
  toggleText: { fontWeight: '900', fontSize: 22, color: '#000', lineHeight: 24 },

  divider: { height: 3, marginHorizontal: 0 },

  body: { paddingHorizontal: 18, paddingVertical: 14, gap: 10 },

  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },

  bullet: { fontWeight: '900', fontSize: 17, minWidth: 26, paddingTop: 1 },

  itemText: { flex: 1, fontSize: 17, color: C.onSurface, lineHeight: 26 },

  emptyText: { fontSize: 15, color: C.onSurfaceVariant, fontStyle: 'italic' },
});
