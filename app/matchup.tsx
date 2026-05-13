import { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTournamentStore } from '@/store/tournament';
import type { Recipe } from '@/types/recipe';
import { C } from '@/constants/colors';
import { LAYOUT_WIDTH } from '@/constants/layout';

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
        <RecipeCard
          recipe={leftRecipe}
          accent={C.cyan}
          imageRight={false}
          onSelect={() => selectWinner(leftRecipe, 'left')}
        />

        {/* VS separator */}
        <View style={s.vsRow}>
          <View style={s.vsBadge}>
            <Text style={s.vsText}>VS</Text>
          </View>
        </View>

        <RecipeCard
          recipe={rightRecipe}
          accent={C.hotPink}
          imageRight={true}
          onSelect={() => selectWinner(rightRecipe, 'right')}
        />
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
  onSelect,
}: {
  recipe: Recipe;
  accent: string;
  imageRight: boolean;
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

  duelArea: { flex: 1, paddingHorizontal: 12, paddingVertical: 20, justifyContent: 'center' },

  card: {
    height: 250,
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
  cardTitle: { fontWeight: '900', fontSize: 22, fontStyle: 'italic', marginBottom: 6, lineHeight: 22 },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { backgroundColor: C.surface, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 2, borderColor: '#000' },
  tagText: { fontSize: 9, fontWeight: '900', color: C.onSurface },

  vsRow: {
    alignSelf: 'center',
    marginVertical: -48,
    zIndex: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  vsBadge: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(10,5,4,0.88)',
    borderWidth: 6, borderColor: '#555',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#d05bff',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  vsText: { fontWeight: '900', fontSize: 52, color: '#fff', fontStyle: 'italic' },

  footer: { paddingHorizontal: 24, paddingBottom: 24, alignItems: 'center', gap: 16 },
  tapHint: { fontSize: 13, fontWeight: '900', color: C.onSurfaceVariant, letterSpacing: 1 },
  backLink: { fontSize: 12, fontWeight: '900', color: C.onSurfaceVariant, letterSpacing: 1 },
});
