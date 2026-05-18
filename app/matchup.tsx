import { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTournamentStore } from '@/store/tournament';
import type { Recipe } from '@/types/recipe';
import { C } from '@/constants/colors';
import { LAYOUT_WIDTH, IS_TABLET } from '@/constants/layout';

export default function MatchupScreen() {
  const router = useRouter();
  const {
    division,
    leftRecipe,
    rightRecipe,
    matchupCount,
    totalMatchups,
    champion,
    selectWinner,
  } = useTournamentStore();

  useEffect(() => {
    if (champion) {
      router.push('/champion');
    }
  }, [champion]);

  useEffect(() => {
    if (!division || !leftRecipe || !rightRecipe) {
      router.replace('/lobby');
    }
  }, [division, leftRecipe, rightRecipe]);

  if (!division || !leftRecipe || !rightRecipe) {
    return null;
  }

  const progressPct = Math.min(100, (matchupCount / totalMatchups) * 100);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.centeredWrapper}>
      {/* Top bar */}
      <View style={s.topBar}>
        <View style={s.topBarRow}>
          <Text style={s.wordmark}>PLATEOFFS</Text>
          <View style={s.divisionInfo}>
            <Text style={s.divisionName}>{division.name.toUpperCase()} DIVISION</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${progressPct}%` as any }]} />
            </View>
            <Text style={s.roundInfo}>MATCH {matchupCount + 1} OF {totalMatchups}</Text>
          </View>
        </View>
      </View>

      {/* Main Duel Area */}
      <View style={s.duelArea}>

        {/* ── Decorative layer (absolute, behind cards) ── */}
        <View style={s.decorLayer} pointerEvents="none">
          <Text style={s.decorWatermark}>BATTLE</Text>
          <Text style={[s.decorCorner, { top: 14, left: 14 }]}>✦</Text>
          <Text style={[s.decorCorner, { top: 14, right: 14 }]}>✦</Text>
          <Text style={[s.decorCorner, { bottom: 14, left: 14 }]}>★</Text>
          <Text style={[s.decorCorner, { bottom: 14, right: 14 }]}>★</Text>
        </View>

        {/* ── Top fight-card banner ── */}
        <View style={s.fightBanner} pointerEvents="none">
          <View style={s.fightBannerStripes}>
            {Array.from({ length: 18 }).map((_, i) => (
              <View key={i} style={[s.fightStripe, { backgroundColor: i % 2 === 0 ? '#0a0502' : 'rgba(240,184,75,0.35)' }]} />
            ))}
          </View>
          <View style={s.fightBannerInner}>
            <Text style={s.fightBannerLabel}>TONIGHT'S MAIN EVENT</Text>
          </View>
        </View>

        {/* ── Tablet-only arena stats strip ── */}
        {IS_TABLET && (
          <View style={s.arenaStats} pointerEvents="none">
            <Text style={s.arenaStatText}>⚔  TASTE TOURNAMENT</Text>
            <View style={s.arenaStatDot} />
            <Text style={s.arenaStatText}>{Math.max(0, totalMatchups - matchupCount)} BATTLES REMAINING</Text>
            <View style={s.arenaStatDot} />
            <Text style={s.arenaStatText}>PICK YOUR CHAMPION  ⚔</Text>
          </View>
        )}

        {/* ── Cards row ── */}
        <View style={s.cardsRow}>
          <RecipeCard
            recipe={leftRecipe}
            accent={C.cyan}
            label="CONTENDER"
            imageRight={false}
            onSelect={() => selectWinner(leftRecipe, 'left')}
          />

          {/* VS separator */}
          <View style={s.vsRow}>
            <Text style={s.vsFlankText}>⚡</Text>
            <View style={s.vsBadge}>
              <Text style={s.vsText}>VS</Text>
            </View>
            <Text style={s.vsFlankText}>⚡</Text>
          </View>

          <RecipeCard
            recipe={rightRecipe}
            accent={C.hotPink}
            label="CHALLENGER"
            imageRight={true}
            onSelect={() => selectWinner(rightRecipe, 'right')}
          />
        </View>

      </View>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.tapHint}>TAP A RECIPE TO PICK THE WINNER</Text>

        <TouchableOpacity onPress={() => {
          Alert.alert(
            'Exit Battle?',
            'Your current bracket and picks won\'t be saved if you leave.',
            [
              { text: 'Stay', style: 'cancel' },
              { text: 'Exit', style: 'destructive', onPress: () => router.push('/lobby') },
            ]
          );
        }}>
          <Text style={s.backLink}>← BACK TO ARENA</Text>
        </TouchableOpacity>
      </View>
      </View>
    </SafeAreaView>
  );
}

function RecipeCard({
  recipe,
  accent,
  imageRight,
  label,
  onSelect,
}: {
  recipe: Recipe;
  accent: string;
  imageRight: boolean;
  label: string;
  onSelect: () => void;
}) {
  const content = (
    <>
      <View style={s.cardImageContainer}>
        {recipe.image_url ? (
          <Image source={{ uri: recipe.image_url }} style={s.cardImage} resizeMode="cover" />
        ) : (
          <View style={s.cardImagePlaceholder}>
            <Text style={{ fontSize: 40 }}>🍽️</Text>
          </View>
        )}
        {recipe.difficulty && (
          <View style={[s.levelBadge, { backgroundColor: accent }]}>
            <Text style={s.levelText}>{recipe.difficulty.toUpperCase()}</Text>
          </View>
        )}
      </View>

      <View style={[s.cardInfo, imageRight && s.cardInfoRight]}>
        <Text style={[s.cardTitle, { color: accent }]}>{recipe.title.toUpperCase()}</Text>
        <View style={s.tagRow}>
          {recipe.tags?.slice(0, 2).map((tag) => (
            <View key={tag} style={s.tag}>
              <Text style={s.tagText}>#{tag.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );

  return (
    <View style={[s.cardOuter, IS_TABLET && { flex: 1 }]}>
      {/* Label badge above card */}
      <View style={[s.cardLabelBadge, { backgroundColor: accent }, imageRight && s.cardLabelBadgeRight]}>
        <Text style={s.cardLabelText}>{label}</Text>
      </View>

      {/* Card + corner brackets */}
      <View style={s.cardBracketWrap}>
        <View style={[s.bracketTL, { borderColor: accent }]} pointerEvents="none" />
        <View style={[s.bracketTR, { borderColor: accent }]} pointerEvents="none" />
        <View style={[s.bracketBL, { borderColor: accent }]} pointerEvents="none" />
        <View style={[s.bracketBR, { borderColor: accent }]} pointerEvents="none" />
        <TouchableOpacity
          onPress={onSelect}
          activeOpacity={0.7}
          style={[
            s.card,
            { borderColor: accent },
            imageRight && { flexDirection: 'row-reverse' },
          ]}
        >
          {content}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  centeredWrapper: { flex: 1, width: '100%', maxWidth: LAYOUT_WIDTH, alignSelf: 'center' },

  topBar: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 4, borderBottomColor: '#000',
  },
  topBarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontWeight: '900', fontSize: 28, color: C.trophyGold, fontStyle: 'italic' },
  divisionInfo: { alignItems: 'flex-end', gap: 4 },
  divisionName: { fontSize: 12, fontWeight: '900', color: C.onBackground },
  progressTrack: {
    width: 140, height: 10, backgroundColor: '#333', borderRadius: 5, overflow: 'hidden',
    borderWidth: 1, borderColor: '#000',
    shadowColor: '#d05bff', shadowOffset: { width: 0, height: 0 }, shadowRadius: 6, shadowOpacity: 1,
  },
  progressFill: { height: '100%', backgroundColor: C.tertiaryContainer },
  roundInfo: { fontSize: 10, fontWeight: '700', color: C.onBackground },

  duelArea: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'stretch',
  },

  arenaStats: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, paddingHorizontal: 20, gap: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(240,184,75,0.15)',
  },
  arenaStatText: {
    fontSize: 10, fontWeight: '900', letterSpacing: 2, color: 'rgba(240,184,75,0.55)',
    fontStyle: 'italic',
  },
  arenaStatDot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(240,184,75,0.3)',
  },

  cardsRow: {
    flex: 1,
    flexDirection: IS_TABLET ? 'row' : 'column',
    alignItems: IS_TABLET ? 'center' : 'stretch',
    justifyContent: 'center',
    paddingHorizontal: IS_TABLET ? 20 : 12,
    paddingVertical: IS_TABLET ? 20 : 20,
    gap: IS_TABLET ? 16 : 0,
  },

  cardOuter: {
    flexDirection: 'column',
    gap: 8,
  },
  cardLabelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 5,
    transform: [{ skewX: '-6deg' }],
    borderWidth: 2, borderColor: '#000',
  },
  cardLabelBadgeRight: { alignSelf: 'flex-end' },
  cardLabelText: { fontSize: 11, fontWeight: '900', color: '#000', letterSpacing: 2 },

  cardBracketWrap: { position: 'relative' },
  bracketTL: {
    position: 'absolute', top: -10, left: -10, zIndex: 20,
    width: 26, height: 26,
    borderTopWidth: 3, borderLeftWidth: 3, borderBottomWidth: 0, borderRightWidth: 0,
    borderTopLeftRadius: 3,
  },
  bracketTR: {
    position: 'absolute', top: -10, right: -10, zIndex: 20,
    width: 26, height: 26,
    borderTopWidth: 3, borderRightWidth: 3, borderBottomWidth: 0, borderLeftWidth: 0,
    borderTopRightRadius: 3,
  },
  bracketBL: {
    position: 'absolute', bottom: -10, left: -10, zIndex: 20,
    width: 26, height: 26,
    borderBottomWidth: 3, borderLeftWidth: 3, borderTopWidth: 0, borderRightWidth: 0,
    borderBottomLeftRadius: 3,
  },
  bracketBR: {
    position: 'absolute', bottom: -10, right: -10, zIndex: 20,
    width: 26, height: 26,
    borderBottomWidth: 3, borderRightWidth: 3, borderTopWidth: 0, borderLeftWidth: 0,
    borderBottomRightRadius: 3,
  },

  card: {
    height: IS_TABLET ? 360 : 250,
    flexDirection: 'row',
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 6,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 10, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  cardImageContainer: { width: '45%', height: '100%', backgroundColor: '#000' },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  levelBadge: {
    position: 'absolute', top: 10, left: 10,
    paddingHorizontal: 8, paddingVertical: 4,
    transform: [{ skewX: '-8deg' }],
    borderWidth: 2, borderColor: '#000',
  },
  levelText: { fontSize: 10, fontWeight: '900', color: '#000' },

  cardInfo: { flex: 1, padding: 12, justifyContent: 'center' },
  cardInfoRight: { alignItems: 'flex-end' },
  cardTitle: { fontWeight: '900', fontSize: IS_TABLET ? 28 : 22, fontStyle: 'italic', marginBottom: 6, lineHeight: IS_TABLET ? 28 : 22 },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { backgroundColor: C.surface, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 2, borderColor: '#000' },
  tagText: { fontSize: 9, fontWeight: '900', color: C.onSurface },

  vsRow: {
    alignSelf: 'center',
    marginVertical: IS_TABLET ? 0 : -48,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: IS_TABLET ? 16 : 8,
  },
  vsFlankText: {
    fontSize: IS_TABLET ? 28 : 20,
    color: 'rgba(255,255,255,0.35)',
  },
  vsBadge: {
    width: IS_TABLET ? 160 : 130,
    height: IS_TABLET ? 160 : 130,
    borderRadius: IS_TABLET ? 80 : 65,
    backgroundColor: 'rgba(10,5,4,0.88)',
    borderWidth: 6, borderColor: '#555',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#d05bff',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  vsText: { fontWeight: '900', fontSize: IS_TABLET ? 64 : 52, color: '#fff', fontStyle: 'italic' },

  footer: { paddingHorizontal: 24, paddingBottom: 24, alignItems: 'center', gap: 16 },
  tapHint: { fontSize: 13, fontWeight: '900', color: C.onSurfaceVariant, letterSpacing: 1 },
  backLink: { fontSize: 12, fontWeight: '900', color: C.onSurfaceVariant, letterSpacing: 1 },

  // ── Maximalist decor ──────────────────────────────────────────────────────
  decorLayer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
  },
  decorWatermark: {
    position: 'absolute', top: '25%', left: '-8%',
    fontSize: 180, fontWeight: '900', fontStyle: 'italic',
    color: 'rgba(255,255,255,0.022)',
    transform: [{ rotate: '-18deg' }],
    letterSpacing: -6,
  },
  decorCorner: {
    position: 'absolute',
    fontSize: 22, fontWeight: '900',
    color: 'rgba(255,255,255,0.18)',
  },

  fightBanner: {
    zIndex: 2, overflow: 'hidden',
  },
  fightBannerStripes: {
    flexDirection: 'row', height: 8, overflow: 'hidden',
  },
  fightStripe: {
    flex: 1, height: 14, transform: [{ skewX: '-20deg' }],
  },
  fightBannerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 9,
    backgroundColor: 'rgba(10,5,2,0.75)',
    borderBottomWidth: 2, borderBottomColor: 'rgba(240,184,75,0.25)',
  },
  fightBannerLabel: {
    fontSize: 10, fontWeight: '900', color: C.trophyGold,
    letterSpacing: 2.5, fontStyle: 'italic', opacity: 0.9,
  },
});
