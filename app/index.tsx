import { useEffect } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { s } from '@/styles/intro.styles';
import { C } from '@/constants/colors';
import { AppFooter } from '@/components/AppFooter';
import { useLobbyStore } from '@/store/lobby';


export default function IntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefetch = useLobbyStore((state) => state.prefetch);

  useEffect(() => { prefetch(); }, []);

  return (
    <View style={s.root}>
      {/* Background patterns could go here */}
      
      <View style={[s.content, { paddingTop: insets.top + 20 }]}>
        <Text style={s.plateoffs} adjustsFontSizeToFit numberOfLines={1}>PLATEOFFS</Text>

        <View style={s.titleContainer}>
          <Text style={s.title}>PICK{'\n'}TONIGHT'S{'\n'}WINNER!</Text>
          <Text style={s.subtitle}>THE ULTIMATE RECIPE SHOWDOWN.</Text>
        </View>

        <TouchableOpacity
          style={s.startBtn}
          onPress={() => router.push('/lobby')}
          activeOpacity={0.85}
        >
          <Text style={s.startBtnText}>START THE SHOWDOWN</Text>
          <View style={s.bolt}>
            <Text style={{ fontSize: 26 }}>⚡</Text>
          </View>
        </TouchableOpacity>

        <View style={s.stickers}>
          <View style={[s.polaroid, { transform: [{ rotate: '-8deg' }], backgroundColor: C.tertiary }]}>
            <Image
              source={require('@/assets/weekend-brunch.jpg')}
              style={s.polaroidImg}
            />
            <Text style={s.polaroidText}>WEEKEND BRUNCH</Text>
          </View>

          <View style={[s.polaroid, { transform: [{ rotate: '6deg' }], backgroundColor: C.primary, marginTop: 40 }]}>
            <Image
              source={require('@/assets/power-bowls.jpg')}
              style={s.polaroidImg}
            />
            <Text style={s.polaroidText}>DINNER DUEL</Text>
          </View>

          <View style={[s.polaroid, { transform: [{ rotate: '-3deg' }], backgroundColor: C.secondary, marginTop: 16 }]}>
            <Image
              source={require('@/assets/weekend-brunch.jpg')}
              style={s.polaroidImg}
            />
            <Text style={s.polaroidText}>POWER BOWLS</Text>
          </View>
        </View>
      </View>
      <AppFooter />
    </View>
  );
}
