// Fluffy UI kit: squishy 3D buttons, soft panels, bubble title, bird + ribbon icons.
import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { RIBBON_COLORS } from '../game/look';
import type { Ribbon } from '../game/engine';
import { drawBird, getResources } from '../game/render';
import { buzz, play } from '../lib/sfx';
import { colors, font } from './theme';

type Tone = 'pink' | 'lilac' | 'mint' | 'sun' | 'white';
const TONES: Record<Tone, { face: string; edge: string; text: string }> = {
  pink: { face: colors.pink, edge: colors.pinkDeep, text: '#FFFFFF' },
  lilac: { face: colors.lilac, edge: colors.lilacDeep, text: '#FFFFFF' },
  mint: { face: colors.mint, edge: colors.mintDeep, text: '#FFFFFF' },
  sun: { face: colors.sun, edge: colors.sunDeep, text: colors.ink },
  white: { face: '#FFFFFF', edge: colors.panelEdge, text: colors.ink },
};

export function FluffyButton({
  label, onPress, tone = 'pink', size = 'md', icon, style, disabled, accessibilityLabel,
}: {
  label?: string; onPress: () => void; tone?: Tone; size?: 'sm' | 'md' | 'lg'; icon?: string;
  style?: StyleProp<ViewStyle>; disabled?: boolean; accessibilityLabel?: string;
}) {
  const t = TONES[tone];
  const down = useSharedValue(0);
  const depth = size === 'lg' ? 7 : size === 'md' ? 6 : 4;
  const face = useAnimatedStyle(() => ({
    transform: [{ translateY: down.value * (depth - 1) }, { scale: 1 - down.value * 0.02 }],
  }));
  const h = size === 'lg' ? 68 : size === 'md' ? 54 : 44;
  const fs = size === 'lg' ? 28 : size === 'md' ? 21 : 17;
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPressIn={() => { down.value = withSpring(1, { damping: 14, stiffness: 420 }); }}
      onPressOut={() => { down.value = withSpring(0, { damping: 9, stiffness: 260 }); }}
      onPress={() => { play('click'); buzz('light'); onPress(); }}
      style={[{ height: h + depth, opacity: disabled ? 0.5 : 1 }, style]}
      hitSlop={6}
    >
      <View style={[styles.btnEdge, { backgroundColor: t.edge, height: h, top: depth, borderRadius: h / 2 }]} />
      <Animated.View style={[styles.btnFace, { backgroundColor: t.face, height: h, borderRadius: h / 2, paddingHorizontal: label ? h * 0.45 : 0, minWidth: h }, face]}>
        <View style={[styles.btnShine, { borderRadius: h / 2, height: h * 0.42 }]} />
        {icon ? <Text style={[styles.btnIcon, { fontSize: fs * 1.05, color: t.text, marginRight: label ? 8 : 0 }]}>{icon}</Text> : null}
        {label ? <Text style={[styles.btnText, { fontSize: fs, color: t.text }]} numberOfLines={1}>{label}</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.panelWrap, style]}>
      <View style={styles.panelEdge} />
      <View style={styles.panel}>{children}</View>
    </View>
  );
}

export function BubbleText({ children, size = 48, color = '#FFFFFF', edge = colors.lilacDeep, style }: {
  children: ReactNode; size?: number; color?: string; edge?: string; style?: StyleProp<TextStyle>;
}) {
  const off = Math.max(2, Math.round(size / 12));
  return (
    <Text
      style={[{
        fontFamily: font.bold, fontSize: size, color, letterSpacing: size * 0.02,
        textShadowColor: edge, textShadowOffset: { width: 0, height: off }, textShadowRadius: 1,
        includeFontPadding: false,
      }, style]}
    >
      {children}
    </Text>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

/** Static bird drawing (character picker, leaderboard rows). */
export function BirdIcon({ skin, size = 56, locked = false, angle = -8 }: { skin: number; size?: number; locked?: boolean; angle?: number }) {
  const picture = useMemo(() => {
    const res = getResources();
    return createPicture((c) => {
      const k = size / 52;
      c.scale(k, k);
      drawBird(c, res, skin, 26, 28, angle, 1, -10, 0, false, 0);
    });
  }, [skin, size, angle]);
  return (
    <View style={{ width: size, height: size, opacity: locked ? 0.35 : 1 }}>
      <Canvas style={{ width: size, height: size }}>
        <Picture picture={picture} />
      </Canvas>
      {locked && <Text style={[styles.lock, { fontSize: size * 0.34 }]}>🔒</Text>}
    </View>
  );
}

/** Round ribbon badge for score milestones (Sprout 10, Bloom 20, Rainbow 30, Cosmic 50). */
export function RibbonBadge({ kind, size = 64 }: { kind: Exclude<Ribbon, 'none'>; size?: number }) {
  const c = RIBBON_COLORS[kind];
  const picture = useMemo(() => {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    return createPicture((cv) => {
      const k = size / 64;
      cv.scale(k, k);
      p.setColor(Skia.Color(c.b));
      // ribbon tails
      const tail = Skia.Path.MakeFromSVGString('M20 34 L12 60 L22 54 L28 62 L32 38 Z M44 34 L52 60 L42 54 L36 62 L32 38 Z')!;
      cv.drawPath(tail, p);
      // scalloped rosette
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        cv.drawCircle(32 + Math.cos(a) * 19, 28 + Math.sin(a) * 19, 8, p);
      }
      cv.drawCircle(32, 28, 20, p);
      p.setColor(Skia.Color(c.a));
      cv.drawCircle(32, 28, 15, p);
      p.setColor(Skia.Color('#FFFFFF'));
      p.setAlphaf(0.6);
      cv.drawCircle(27, 22, 4, p);
      p.setAlphaf(1);
    });
  }, [size, c]);
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${c.label} ribbon`}>
      <Canvas style={{ width: size, height: size }}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

export function Chip({ text, tone = 'white' }: { text: string; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.face, borderColor: t.edge }]}>
      <Text style={[styles.chipText, { color: t.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btnEdge: { position: 'absolute', left: 0, right: 0 },
  btnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btnShine: { position: 'absolute', top: 4, left: 10, right: 10, backgroundColor: 'rgba(255,255,255,0.28)' },
  btnText: { fontFamily: font.bold, letterSpacing: 0.5, includeFontPadding: false },
  btnIcon: { fontFamily: font.bold, includeFontPadding: false },
  panelWrap: { alignSelf: 'stretch' },
  panelEdge: { position: 'absolute', left: 0, right: 0, top: 6, bottom: -6, borderRadius: 28, backgroundColor: colors.panelEdge },
  panel: { backgroundColor: colors.panel, borderRadius: 28, padding: 18, borderWidth: 3, borderColor: '#F4ECFB' },
  label: { fontFamily: font.semi, fontSize: 14, color: colors.inkSoft, letterSpacing: 1.2, textTransform: 'uppercase' },
  lock: { position: 'absolute', alignSelf: 'center', top: '30%' },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 2, alignSelf: 'flex-start' },
  chipText: { fontFamily: font.semi, fontSize: 13 },
});
