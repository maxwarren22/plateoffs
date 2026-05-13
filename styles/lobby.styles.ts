import { StyleSheet } from 'react-native';
import { C } from '@/constants/colors';
import { LAYOUT_WIDTH } from '@/constants/layout';

export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  centeredWrapper: { flex: 1, width: '100%', maxWidth: LAYOUT_WIDTH, alignSelf: 'center' },
  
  header: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 4, borderBottomColor: '#000',
    shadowColor: '#ba881c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 4,
  },
  wordmark: { fontWeight: '900', fontSize: 24, color: C.trophyGold, fontStyle: 'italic', letterSpacing: 1 },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingVertical: 24, gap: 32 },

  title: {
    fontWeight: '900', fontSize: 64, color: C.primary, lineHeight: 60,
    textTransform: 'uppercase', fontStyle: 'italic', textAlign: 'center',
    textShadowColor: '#000', textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0,
  },

  errorBox: {
    borderRadius: 8, borderWidth: 3, borderColor: C.chiliRed,
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#3c1010',
  },
  errorText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  cardList: { gap: 24 },
  card: {
    height: 460, borderRadius: 0, borderWidth: 4, borderColor: '#000',
    overflow: 'hidden', backgroundColor: '#222',
    shadowColor: '#000', shadowOffset: { width: 8, height: 8 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 8,
  },
  cardImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  cardOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.82)',
    padding: 16,
    zIndex: 5,
  },
  cardName: { fontWeight: '900', fontSize: 36, color: '#fff', fontStyle: 'italic', lineHeight: 34, marginBottom: 10 },
  contenderBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4 },
  contenderText: { fontSize: 12, fontWeight: '900', color: '#000' },

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
