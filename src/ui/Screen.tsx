// Shared frame for secondary screens: live sky backdrop (no bird), back button, title.
import { router, useIsFocused } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameCanvas } from '../game/GameCanvas';
import { BubbleText, FluffyButton } from './kit';
import { colors } from './theme';

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <GameCanvas mode="menu" skin={-1} active={focused} />
      <View style={[styles.head, { paddingTop: insets.top + 12 }]}>
        <FluffyButton icon="‹" tone="white" size="sm" onPress={goBack} accessibilityLabel="Back" />
        <BubbleText size={34} edge={colors.lilacDeep} style={styles.title}>{title}</BubbleText>
        <View style={styles.spacer} />
      </View>
      <View style={[styles.body, { paddingBottom: insets.bottom + 12 }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  title: { flex: 1, textAlign: 'center' },
  spacer: { width: 44 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
});
