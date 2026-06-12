import { StyleSheet } from 'react-native';
import { C } from '@/constants/colors';
import { IS_TABLET } from '@/constants/layout';

export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },

  header: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, paddingVertical: IS_TABLET ? 18 : 14,
    borderBottomWidth: 4, borderBottomColor: '#000',
    shadowColor: '#ba881c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 4,
  },
  wordmark: { fontWeight: '900', fontSize: IS_TABLET ? 30 : 24, color: C.trophyGold, fontStyle: 'italic', letterSpacing: 1 },

  scroll: { flex: 1 },
  // paddingHorizontal is injected dynamically in the component so the
  // contentContainer stays full-width and the ScrollView captures gestures
  // everywhere on screen, not just over the centered content column.
  content: { paddingVertical: 24, gap: 32 },

  multiplayerBanner: {
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 4, borderColor: C.trophyGold,
    shadowColor: C.trophyGold, shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 6,
    overflow: 'hidden',
  },
  multiplayerBannerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: IS_TABLET ? 20 : 16, paddingVertical: IS_TABLET ? 16 : 13,
  },
  multiplayerBannerText: {
    fontWeight: '900', fontSize: IS_TABLET ? 17 : 14, color: C.trophyGold,
    fontStyle: 'italic', letterSpacing: 1, flex: 1,
  },
  multiplayerToggle: {
    backgroundColor: C.trophyGold,
    width: IS_TABLET ? 32 : 28, height: IS_TABLET ? 32 : 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#000',
    shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0,
  },
  multiplayerToggleText: {
    fontWeight: '900', fontSize: IS_TABLET ? 22 : 18, color: '#000', lineHeight: IS_TABLET ? 24 : 20,
  },
  multiplayerSteps: {
    gap: IS_TABLET ? 10 : 8,
    paddingHorizontal: IS_TABLET ? 20 : 16,
    paddingBottom: IS_TABLET ? 18 : 14,
    borderTopWidth: 2, borderTopColor: C.outlineVariant,
  },
  multiplayerStep: {
    flexDirection: 'row', alignItems: 'flex-start', gap: IS_TABLET ? 10 : 8,
    paddingTop: IS_TABLET ? 10 : 8,
  },
  multiplayerStepNum: {
    backgroundColor: C.trophyGold,
    width: IS_TABLET ? 24 : 20, height: IS_TABLET ? 24 : 20,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  multiplayerStepNumText: {
    fontWeight: '900', fontSize: IS_TABLET ? 12 : 10, color: '#000',
  },
  multiplayerStepText: {
    flex: 1, fontWeight: '600', fontSize: IS_TABLET ? 14 : 13, color: C.textLight,
    lineHeight: IS_TABLET ? 21 : 18,
  },

  title: {
    fontWeight: '900', fontSize: IS_TABLET ? 80 : 64, color: C.primary, lineHeight: IS_TABLET ? 76 : 60,
    textTransform: 'uppercase', fontStyle: 'italic', textAlign: 'center',
    textShadowColor: '#000', textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0,
  },

  errorBox: {
    borderRadius: 8, borderWidth: 3, borderColor: C.chiliRed,
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#3c1010',
  },
  errorText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  cardList: { gap: IS_TABLET ? 24 : 12 },
  card: {
    height: IS_TABLET ? 480 : 260, borderRadius: 0, borderWidth: 4, borderColor: '#000',
    overflow: 'hidden', backgroundColor: '#222',
    shadowColor: '#000', shadowOffset: { width: 8, height: 8 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 8,
  },
  cardImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  cardOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.82)',
    padding: IS_TABLET ? 20 : 10,
    zIndex: 5,
  },
  cardName: { fontWeight: '900', fontSize: IS_TABLET ? 44 : 18, color: '#fff', fontStyle: 'italic', lineHeight: IS_TABLET ? 42 : 17, marginBottom: IS_TABLET ? 10 : 6 },
  contenderBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4 },
  contenderText: { fontSize: IS_TABLET ? 14 : 12, fontWeight: '900', color: '#000' },

  statsColumn: { gap: 20, marginTop: 12 },
  statBox: {
    borderRadius: 4, borderWidth: 4, padding: 20, backgroundColor: '#1d100e',
    shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 6,
  },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  statIcon: { fontSize: 24 },
  statLabel: { fontSize: 20, fontWeight: '900', color: '#fff', fontStyle: 'italic' },
  statValue: { fontWeight: '900', fontSize: 64, color: C.tertiary, fontStyle: 'italic' },
});
