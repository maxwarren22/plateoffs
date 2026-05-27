import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTournamentStore } from '@/store/tournament';
import type { Recipe } from '@/types/recipe';
import { C } from '@/constants/colors';
import { LAYOUT_WIDTH, IS_TABLET, TABLET_BREAKPOINT } from '@/constants/layout';

export default function MatchupScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isTabletLandscape = width >= TABLET_BREAKPOINT && width > height;
  const {
    division,
    leftRecipe,
    rightRecipe,
    remainingRecipes,
    matchupCount,
    totalMatchups,
    champion,
    selectWinner,
  } = useTournamentStore();

  // Prefetch the next recipe's image so it's cached before the user taps a winner.
  useEffect(() => {
    const next = remainingRecipes[0];
    if (next?.image_url) Image.prefetch(next.image_url).catch(() => {});
  }, [remainingRecipes[0]?.id]);

  useEffect(() => {
    if (champion) {
      router.replace('/champion');
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
            <Text style={s.divisionName} numberOfLines={1} adjustsFontSizeToFit>{division.name.toUpperCase()} DIVISION</Text>
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
        {IS_TABLET && (
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
        )}

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
        <View style={[
          s.cardsRow,
          !isTabletLandscape && { flexDirection: 'column', alignItems: 'stretch', gap: 0 },
        ]}>
          <RecipeCard
            key="left"
            recipe={leftRecipe}
            accent={C.cyan}
            label="CONTENDER"
            imageRight={false}
            isTabletLandscape={isTabletLandscape}
            matchupCount={matchupCount}
            onSelect={() => selectWinner(leftRecipe, 'left')}
          />

          {/* VS separator */}
          <View style={[s.vsRow, !isTabletLandscape && { marginVertical: -40 }]}>
            <Text style={s.vsFlankText}>⚡</Text>
            <View style={s.vsBadge}>
              <Text style={s.vsText}>VS</Text>
            </View>
            <Text style={s.vsFlankText}>⚡</Text>
          </View>

          <RecipeCard
            key="right"
            recipe={rightRecipe}
            accent={C.hotPink}
            label="CHALLENGER"
            imageRight={true}
            isTabletLandscape={isTabletLandscape}
            matchupCount={matchupCount}
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
  isTabletLandscape,
  matchupCount,
  onSelect,
}: {
  recipe: Recipe;
  accent: string;
  imageRight: boolean;
  label: string;
  isTabletLandscape: boolean;
  matchupCount: number;
  onSelect: () => void;
}) {
  // displayRecipe lags behind recipe prop so we can hold the old content during
  // the first half of the flip, then swap at the midpoint (card is edge-on).
  const [displayRecipe, setDisplayRecipe] = useState(recipe);

  const imageOpacity = useRef(new Animated.Value(0)).current;
  const cardScaleX = useRef(new Animated.Value(1)).current;
  // Tracks which recipe ID's image has finished loading — handles the race
  // where a cached image's onLoad fires before the useEffect reset.
  const loadedIdRef = useRef<string | null>(null);
  const selectingRef = useRef(false);
  const prevRecipeIdRef = useRef(recipe.id);

  const animateImageIn = () => {
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // Reset image opacity whenever the displayed recipe changes.
  useEffect(() => {
    imageOpacity.setValue(0);
    if (!displayRecipe.image_url) {
      imageOpacity.setValue(1);
      return;
    }
    if (loadedIdRef.current === displayRecipe.id) {
      animateImageIn();
    }
  }, [displayRecipe.id]);

  // Reset the tap-guard for both cards when a new round starts.
  // The losing card's recipe.id changes so its existing effect handles it, but the
  // winning card's id is unchanged — this effect covers that case.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    selectingRef.current = false;
  }, [matchupCount]);

  // When the recipe prop changes (this is the losing card), run the flip animation.
  // The winning card's recipe.id stays the same so this effect is a no-op for it.
  useEffect(() => {
    if (recipe.id === prevRecipeIdRef.current) return;
    prevRecipeIdRef.current = recipe.id;
    selectingRef.current = false;

    // Phase 1 — flip out: squish to edge-on (scaleX 1 → 0)
    Animated.timing(cardScaleX, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      // Midpoint: card is invisible edge-on — swap to new recipe
      setDisplayRecipe(recipe);
      // Phase 2 — flip in: expand back to full (scaleX 0 → 1)
      Animated.timing(cardScaleX, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start();
    });
  }, [recipe.id]);

  function handleImageReady() {
    loadedIdRef.current = displayRecipe.id;
    animateImageIn();
  }

  const content = (
    <>
      <View style={s.cardImageContainer}>
        {displayRecipe.image_url ? (
          <Animated.Image
            source={{ uri: displayRecipe.image_url }}
            style={[s.cardImage, { opacity: imageOpacity }]}
            resizeMode="cover"
            onLoad={handleImageReady}
            onError={handleImageReady}
          />
        ) : (
          <View style={s.cardImagePlaceholder}>
            <Text style={{ fontSize: 40 }}>🍽️</Text>
          </View>
        )}
        {displayRecipe.difficulty && (
          <View style={[s.levelBadge, { backgroundColor: accent }]}>
            <Text style={s.levelText}>{displayRecipe.difficulty.toUpperCase()}</Text>
          </View>
        )}
      </View>

      <View style={[s.cardInfo, imageRight && s.cardInfoRight]}>
        <Text style={[s.cardTitle, { color: accent }]}>{(displayRecipe.title ?? '').toUpperCase()}</Text>
        <View style={s.tagRow}>
          {displayRecipe.tags?.filter(Boolean).slice(0, 2).map((tag) => (
            <View key={tag} style={s.tag}>
              <Text style={s.tagText}>#{tag.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );

  return (
    <View style={[s.cardOuter, { flex: 1 }]}>
      {/* Label badge above card — tablet only (on mobile it falls into the VS zone) */}
      {IS_TABLET && (
        <View style={[s.cardLabelBadge, { backgroundColor: accent }, imageRight && s.cardLabelBadgeRight]}>
          <Text style={s.cardLabelText}>{label}</Text>
        </View>
      )}

      {/* Card + corner brackets */}
      <View style={[s.cardBracketWrap, !isTabletLandscape && { flex: 1 }]}>
        <View style={[s.bracketTL, { borderColor: accent }]} pointerEvents="none" />
        <View style={[s.bracketTR, { borderColor: accent }]} pointerEvents="none" />
        <View style={[s.bracketBL, { borderColor: accent }]} pointerEvents="none" />
        <View style={[s.bracketBR, { borderColor: accent }]} pointerEvents="none" />
        <Animated.View style={[{ transform: [{ scaleX: cardScaleX }] }, !isTabletLandscape && { flex: 1 }]}>
          <TouchableOpacity
            onPress={() => {
              if (selectingRef.current) return;
              selectingRef.current = true;
              onSelect();
            }}
            activeOpacity={0.7}
            style={[
              s.card,
              { borderColor: accent },
              !isTabletLandscape && { height: undefined, flex: 1 },
              imageRight && { flexDirection: 'row-reverse' },
            ]}
          >
            {content}
          </TouchableOpacity>
        </Animated.View>
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
  topBarRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  wordmark: { fontWeight: '900', fontSize: 28, color: C.trophyGold, fontStyle: 'italic' },
  divisionInfo: { alignItems: 'flex-end', gap: 4, flexShrink: 1, maxWidth: '65%' },
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
    paddingVertical: IS_TABLET ? 20 : 12,
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

  cardBracketWrap: { position: 'relative', flex: IS_TABLET ? undefined : 1 },
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
    height: IS_TABLET ? 360 : undefined,
    flex: IS_TABLET ? undefined : 1,
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
  cardImageContainer: { width: '45%', height: '100%', backgroundColor: '#1a0d00' },
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
    marginVertical: IS_TABLET ? 0 : -40,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: IS_TABLET ? 16 : 8,
  },
  vsFlankText: {
    fontSize: IS_TABLET ? 28 : 18,
    color: 'rgba(255,255,255,0.35)',
  },
  vsBadge: {
    width: IS_TABLET ? 160 : 100,
    height: IS_TABLET ? 160 : 100,
    borderRadius: IS_TABLET ? 80 : 50,
    backgroundColor: 'rgba(10,5,4,0.88)',
    borderWidth: 6, borderColor: '#555',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#d05bff',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  vsText: { fontWeight: '900', fontSize: IS_TABLET ? 64 : 40, color: '#fff', fontStyle: 'italic' },

  footer: { paddingHorizontal: 24, paddingTop: IS_TABLET ? 0 : 8, paddingBottom: IS_TABLET ? 24 : 12, alignItems: 'center', gap: IS_TABLET ? 16 : 10 },
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
