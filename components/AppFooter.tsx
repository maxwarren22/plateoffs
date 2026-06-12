import { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { C } from '@/constants/colors';
import { FeedbackModal } from '@/components/FeedbackModal';

const TERMS_URL = 'https://curatemyplate.com/terms';
const PRIVACY_URL = 'https://curatemyplate.com/privacy';

export function AppFooter() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <View style={f.container}>
      <View style={f.links}>
        <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)} activeOpacity={0.7}>
          <Text style={f.link}>PRIVACY POLICY</Text>
        </TouchableOpacity>
        <Text style={f.dot}>·</Text>
        <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)} activeOpacity={0.7}>
          <Text style={f.link}>TERMS OF SERVICE</Text>
        </TouchableOpacity>
        <Text style={f.dot}>·</Text>
        <TouchableOpacity onPress={() => setFeedbackOpen(true)} activeOpacity={0.7}>
          <Text style={f.link}>FEEDBACK</Text>
        </TouchableOpacity>
      </View>
      <Text style={f.copy}>© {new Date().getFullYear()} CURATE MY PLATE</Text>
      <FeedbackModal visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </View>
  );
}

const f = StyleSheet.create({
  container: {
    borderTopWidth: 3,
    borderTopColor: '#000',
    backgroundColor: C.bgDeep,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  link: {
    fontWeight: '900',
    fontSize: 11,
    color: C.trophyGold,
    letterSpacing: 1,
    textDecorationLine: 'underline',
  },
  dot: {
    fontWeight: '900',
    fontSize: 11,
    color: C.textMuted,
  },
  copy: {
    fontWeight: '700',
    fontSize: 10,
    color: C.textMuted,
    letterSpacing: 0.8,
  },
});
