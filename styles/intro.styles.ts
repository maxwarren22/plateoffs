import { StyleSheet } from 'react-native';
import { C } from '@/constants/colors';
import { LAYOUT_WIDTH, IS_TABLET } from '@/constants/layout';

const titleFontSize = IS_TABLET ? 96 : Math.floor(LAYOUT_WIDTH * 0.145);

export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f55f4f', overflow: 'hidden' },
  content: {
    flex: 1, paddingHorizontal: IS_TABLET ? 60 : 24,
    alignItems: 'center', justifyContent: 'center',
    width: '100%', maxWidth: LAYOUT_WIDTH, alignSelf: 'center',
  },

  plateoffs: {
    fontWeight: '900', fontSize: IS_TABLET ? 120 : 80, color: '#fff', opacity: 0.18,
    position: 'absolute', top: 44, left: IS_TABLET ? -40 : -24,
    width: LAYOUT_WIDTH,
    fontStyle: 'italic', letterSpacing: -2,
    transform: [{ skewX: '-6deg' }],
    textShadowColor: '#000', textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0,
  },

  titleContainer: { alignItems: 'center', marginBottom: IS_TABLET ? 28 : 20 },
  title: {
    fontWeight: '900', fontSize: titleFontSize, color: C.primary,
    lineHeight: Math.floor(titleFontSize * 0.95), textAlign: 'center', fontStyle: 'italic',
    textShadowColor: '#d05bff',
    textShadowOffset: { width: 8, height: 8 },
    textShadowRadius: 0,
  },
  subtitle: {
    fontWeight: '900', fontSize: IS_TABLET ? 22 : 18, color: C.onSurface,
    marginTop: 20, backgroundColor: C.surface,
    paddingHorizontal: 14, paddingVertical: 6,
    transform: [{ rotate: '-2deg' }],
    borderWidth: 3, borderColor: '#000',
    shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 6,
    fontStyle: 'italic',
  },

  modeRow: {
    flexDirection: 'row',
    width: '100%',
    gap: IS_TABLET ? 16 : 12,
  },
  modeBtn: {
    flex: 1,
    borderRadius: IS_TABLET ? 24 : 18,
    paddingVertical: IS_TABLET ? 28 : 22,
    paddingHorizontal: 8,
    borderWidth: 5, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 6, height: 8 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 10,
  },
  modeBtnSolo: { backgroundColor: C.secondary },
  modeBtnMulti: { backgroundColor: C.tertiaryContainer },
  modeBtnTitle: {
    fontWeight: '900', fontSize: IS_TABLET ? 34 : 26,
    fontStyle: 'italic', textAlign: 'center', color: '#000',
  },
  modeBtnSub: {
    fontWeight: '700', fontSize: IS_TABLET ? 12 : 10,
    fontStyle: 'italic', textAlign: 'center', color: '#000',
    opacity: 0.55, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  returnCard: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 4, borderColor: C.tertiaryContainer,
    paddingHorizontal: IS_TABLET ? 20 : 14, paddingVertical: IS_TABLET ? 16 : 12,
    marginTop: IS_TABLET ? 24 : 16,
    shadowColor: '#d05bff', shadowOffset: { width: 5, height: 5 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 5,
    gap: 8,
  },
  returnCardLeft: { flex: 1, gap: 2 },
  returnCardLabel: { fontWeight: '700', fontSize: 9, color: C.tertiaryContainer, letterSpacing: 2, textTransform: 'uppercase' },
  returnCardCode: { fontWeight: '900', fontSize: IS_TABLET ? 28 : 22, color: C.secondary, fontStyle: 'italic', letterSpacing: 6 },
  returnCardDiv: { fontWeight: '700', fontSize: IS_TABLET ? 11 : 10, color: C.textMuted, letterSpacing: 1 },
  returnCardActions: { alignItems: 'flex-end', gap: 4 },
  returnBtn: {
    backgroundColor: C.tertiaryContainer, borderWidth: 3, borderColor: '#000',
    paddingHorizontal: 14, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0,
  },
  returnBtnText: { fontWeight: '900', fontSize: IS_TABLET ? 15 : 13, color: '#000', fontStyle: 'italic' },
  returnDismiss: { paddingVertical: 2 },
  returnDismissText: { fontWeight: '600', fontSize: 11, color: '#00000055', textDecorationLine: 'underline' },

  joinLink: { paddingVertical: 10, marginTop: IS_TABLET ? 12 : 8 },
  joinLinkText: {
    fontWeight: '900', fontSize: IS_TABLET ? 22 : 19, color: '#000000cc',
    textAlign: 'center', fontStyle: 'italic', textDecorationLine: 'underline',
    letterSpacing: 0.5,
  },

  joinBox: { width: '100%', gap: 8 },
  joinInput: {
    width: '100%', backgroundColor: '#fff',
    borderWidth: 4, borderColor: '#000',
    borderRadius: IS_TABLET ? 16 : 12,
    paddingVertical: IS_TABLET ? 18 : 14, paddingHorizontal: 20,
    fontWeight: '900', fontSize: IS_TABLET ? 32 : 26,
    color: '#000', fontStyle: 'italic', textAlign: 'center', letterSpacing: 10,
    shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
  },
  joinBtn: {
    width: '100%', backgroundColor: C.tertiaryContainer,
    borderWidth: 4, borderColor: '#000',
    borderRadius: 60, paddingVertical: IS_TABLET ? 18 : 14,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 4, height: 6 }, shadowOpacity: 1, shadowRadius: 0,
  },
  joinBtnDisabled: { opacity: 0.4 },
  joinBtnText: { fontWeight: '900', fontSize: IS_TABLET ? 22 : 18, color: '#000', fontStyle: 'italic' },
  joinError: { fontWeight: '700', fontSize: 13, color: C.onPrimary, textAlign: 'center' },
  joinCancel: { paddingVertical: 4, alignItems: 'center' },
  joinCancelText: { fontWeight: '600', fontSize: 13, color: '#00000055', textDecorationLine: 'underline' },

  stickers: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%', marginTop: IS_TABLET ? 60 : 32,
  },
  polaroid: {
    width: IS_TABLET ? 220 : LAYOUT_WIDTH * 0.44,
    padding: IS_TABLET ? 10 : 7, paddingBottom: IS_TABLET ? 28 : 22,
    borderWidth: 3, borderColor: '#000',
    shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 4,
  },
  polaroidImg: { width: '100%', height: IS_TABLET ? 170 : 130, backgroundColor: '#000' },
  polaroidText: { fontWeight: '700', fontSize: IS_TABLET ? 13 : 11, color: '#000', marginTop: 10, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
});
