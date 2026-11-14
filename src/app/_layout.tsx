import { Fredoka_400Regular, Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useMarkInteractive, wrapRoot } from '../lib/observe';
import { initSfx } from '../lib/sfx';
import { loadStore, useLoaded } from '../lib/store';
import { colors } from '../ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Fredoka_400Regular, Fredoka_600SemiBold, Fredoka_700Bold });
  const storeLoaded = useLoaded();
  const markInteractive = useMarkInteractive();
  const { width, height } = useWindowDimensions();
  const ready = (fontsLoaded || !!fontError) && storeLoaded;

  useEffect(() => {
    loadStore();
    initSfx();
  }, []);

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    markInteractive();
  }, [ready, markInteractive]);

  if (!ready) return <View style={styles.boot} />;

  // phones use the full screen; wide screens (web, tablets) get a phone-shaped column
  const maxW = Math.min(width, Math.max(400, height * 0.62));

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <View style={[styles.column, { width: maxW }]}>
        <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.sky } }} />
      </View>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.sky },
  root: { flex: 1, backgroundColor: '#E9E1FA', alignItems: 'center' },
  column: { flex: 1, overflow: 'hidden', backgroundColor: colors.sky },
});
