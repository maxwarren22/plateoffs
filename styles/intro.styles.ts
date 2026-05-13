import { StyleSheet } from 'react-native';
import { C } from '@/constants/colors';
import { LAYOUT_WIDTH } from '@/constants/layout';

export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f55f4f', overflow: 'hidden' },
  content: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: LAYOUT_WIDTH, alignSelf: 'center' },

  plateoffs: {
    fontWeight: '900', fontSize: 80, color: '#fff', opacity: 0.18,
    position: 'absolute', top: 44, left: -24,
    width: LAYOUT_WIDTH,
    fontStyle: 'italic', letterSpacing: -2,
    transform: [{ skewX: '-6deg' }],
    textShadowColor: '#000', textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0,
  },

  titleContainer: { alignItems: 'center', marginBottom: 28 },
  title: {
    fontWeight: '900', fontSize: Math.floor(LAYOUT_WIDTH * 0.145), color: C.primary,
    lineHeight: Math.floor(LAYOUT_WIDTH * 0.138), textAlign: 'center', fontStyle: 'italic',
    textShadowColor: '#d05bff',
    textShadowOffset: { width: 8, height: 8 },
    textShadowRadius: 0,
  },
  subtitle: {
    fontWeight: '900', fontSize: 18, color: C.onSurface,
    marginTop: 20, backgroundColor: C.surface,
    paddingHorizontal: 14, paddingVertical: 6,
    transform: [{ rotate: '-2deg' }],
    borderWidth: 3, borderColor: '#000',
    shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 6,
    fontStyle: 'italic',
  },

  startBtn: {
    width: '100%', backgroundColor: C.secondary,
    borderRadius: 60, paddingVertical: 22, paddingHorizontal: 20,
    borderWidth: 5, borderColor: '#000',
    position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 10,
  },
  startBtnText: { fontWeight: '900', fontSize: 30, color: C.onSecondaryContainer, fontStyle: 'italic', textAlign: 'center' },
  bolt: { position: 'absolute', right: 24, top: '50%', marginTop: -16 },

  stickers: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%', marginTop: 40,
  },
  polaroid: {
    width: LAYOUT_WIDTH * 0.42, padding: 8, paddingBottom: 24,
    borderWidth: 3, borderColor: '#000',
    shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 4,
  },
  polaroidImg: { width: '100%', height: 130, backgroundColor: '#000' },
  polaroidText: { fontWeight: '700', fontSize: 11, color: '#000', marginTop: 10, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
});
