import { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { C } from '@/constants/colors';
import { IS_TABLET } from '@/constants/layout';

const CATEGORIES = ['Bug Report', 'Feature Request', 'General'] as const;
type Category = (typeof CATEGORIES)[number];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function FeedbackModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<Category>('General');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setEmail('');
    setCategory('General');
    setMessage('');
    setSent(false);
    setError(null);
  }

  function handleClose() {
    onClose();
    setTimeout(reset, 300);
  }

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: fnError } = await supabase.functions.invoke('send-contact-email', {
        body: { name: name.trim(), email: email.trim(), app: 'Plateoffs', category, message: message.trim() },
      });
      if (fnError) throw fnError;
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && message.trim().length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={f.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[f.handle]} />

        <View style={f.header}>
          <Text style={f.title}>FEEDBACK</Text>
          <TouchableOpacity onPress={handleClose} style={f.closeBtn} hitSlop={12}>
            <Text style={f.closeX}>✕</Text>
          </TouchableOpacity>
        </View>

        {sent ? (
          <View style={[f.sentContainer, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={f.sentEmoji}>🏆</Text>
            <Text style={f.sentTitle}>SENT!</Text>
            <Text style={f.sentSub}>Thanks for the feedback. We'll be in touch.</Text>
            <TouchableOpacity style={f.doneBtn} onPress={handleClose} activeOpacity={0.85}>
              <Text style={f.doneBtnText}>DONE</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={f.scroll}
            contentContainerStyle={[f.scrollContent, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={f.row}>
              <View style={f.field}>
                <Text style={f.label}>NAME</Text>
                <TextInput
                  style={f.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
              <View style={f.field}>
                <Text style={f.label}>EMAIL</Text>
                <TextInput
                  style={f.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                />
              </View>
            </View>

            <Text style={f.label}>CATEGORY</Text>
            <View style={f.categoryRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[f.categoryChip, category === cat && f.categoryChipActive]}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Text style={[f.categoryChipText, category === cat && f.categoryChipTextActive]}>
                    {cat.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={f.label}>MESSAGE</Text>
            <TextInput
              style={f.textarea}
              value={message}
              onChangeText={setMessage}
              placeholder="Tell us what's on your mind..."
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              returnKeyType="default"
            />

            {error && <Text style={f.error}>{error}</Text>}

            <TouchableOpacity
              style={[f.submitBtn, (!canSubmit || submitting) && f.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={f.submitBtnText}>SEND FEEDBACK</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const f = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 3,
    borderBottomColor: '#000',
  },
  title: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 32 : 26,
    color: C.primary,
    fontStyle: 'italic',
    letterSpacing: 2,
    textShadowColor: C.electricPurple,
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
  closeBtn: {
    width: 36,
    height: 36,
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  closeX: {
    fontWeight: '900',
    fontSize: 14,
    color: C.textLight,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },

  row: {
    flexDirection: IS_TABLET ? 'row' : 'column',
    gap: 12,
  },
  field: { flex: 1 },

  label: {
    fontWeight: '900',
    fontSize: 11,
    color: C.trophyGold,
    letterSpacing: 2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 3,
    borderColor: C.border,
    paddingVertical: IS_TABLET ? 14 : 12,
    paddingHorizontal: 14,
    fontWeight: '700',
    fontSize: IS_TABLET ? 16 : 15,
    color: C.onSurface,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },

  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 3,
    borderColor: C.border,
    backgroundColor: C.surfaceContainerHigh,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  categoryChipActive: {
    backgroundColor: C.primaryContainer,
    borderColor: '#000',
  },
  categoryChipText: {
    fontWeight: '900',
    fontSize: 11,
    color: C.textMuted,
    letterSpacing: 1,
    fontStyle: 'italic',
  },
  categoryChipTextActive: {
    color: '#fff',
  },

  textarea: {
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 3,
    borderColor: C.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontWeight: '600',
    fontSize: IS_TABLET ? 16 : 15,
    color: C.onSurface,
    minHeight: IS_TABLET ? 140 : 120,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },

  error: {
    fontWeight: '700',
    fontSize: 13,
    color: C.error,
    textAlign: 'center',
  },

  submitBtn: {
    backgroundColor: C.primaryContainer,
    borderWidth: 4,
    borderColor: '#000',
    paddingVertical: IS_TABLET ? 20 : 16,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 22 : 18,
    color: '#fff',
    fontStyle: 'italic',
    letterSpacing: 2,
  },

  sentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  sentEmoji: { fontSize: 64 },
  sentTitle: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 56 : 44,
    color: C.trophyGold,
    fontStyle: 'italic',
    textShadowColor: '#000',
    textShadowOffset: { width: 5, height: 5 },
    textShadowRadius: 0,
    letterSpacing: 4,
  },
  sentSub: {
    fontWeight: '700',
    fontSize: IS_TABLET ? 16 : 14,
    color: C.textMuted,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  doneBtn: {
    marginTop: 8,
    backgroundColor: C.secondary,
    borderWidth: 4,
    borderColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 48,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  doneBtnText: {
    fontWeight: '900',
    fontSize: IS_TABLET ? 22 : 18,
    color: '#000',
    fontStyle: 'italic',
    letterSpacing: 2,
  },
});
