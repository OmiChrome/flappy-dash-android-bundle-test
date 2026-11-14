// Settings: player name, sound, haptics, FPS meter, reset.
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { SKINS, isUnlocked, unlockText } from '../game/look';
import { isExpoGo } from '../lib/observe';
import { play } from '../lib/sfx';
import { resetAll, update, useData } from '../lib/store';
import { BirdIcon, FluffyButton, Label, Panel } from '../ui/kit';
import { Screen } from '../ui/Screen';
import { colors, font } from '../ui/theme';

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(value ? 26 : 0, { damping: 14 }) }] }));
  return (
    <Pressable
      style={styles.toggleRow}
      onPress={() => { onChange(!value); play('click'); }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <View style={styles.flex}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={[styles.track, { backgroundColor: value ? colors.mint : '#E6DDF2' }]}>
        <Animated.View style={[styles.knob, knob]} />
      </View>
    </Pressable>
  );
}

export default function Settings() {
  const d = useData();
  const [name, setName] = useState(d.name);
  const [confirm, setConfirm] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  const stats = { best: d.best, totalStars: d.totalStars, games: d.games };

  const saveName = () => {
    const n = name.trim().slice(0, 16);
    if (n) update({ name: n });
    else setName(d.name);
  };

  return (
    <Screen title="Settings">
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Panel>
          <Label>Pilot name</Label>
          <TextInput
            value={name}
            onChangeText={setName}
            onBlur={saveName}
            onSubmitEditing={saveName}
            maxLength={16}
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.inkSoft}
            returnKeyType="done"
            autoCorrect={false}
          />
          <Text style={styles.hint}>Shown on your leaderboard runs.</Text>
        </Panel>

        <Panel>
          <Toggle label="Sound effects" value={d.sound} onChange={(v) => update({ sound: v })} />
          <View style={styles.sep} />
          <Toggle label="Vibration" hint={Platform.OS === 'web' ? 'Phones only' : undefined} value={d.haptics} onChange={(v) => update({ haptics: v })} />
          <View style={styles.sep} />
          <Toggle label="FPS meter" hint="Shows frame rate while playing" value={d.showFps} onChange={(v) => update({ showFps: v })} />
        </Panel>

        <Panel>
          <Label>Friends</Label>
          <View style={styles.friends}>
            {SKINS.map((s, i) => {
              const ok = isUnlocked(s, stats);
              return (
                <Pressable key={s.id} disabled={!ok} onPress={() => { update({ skin: s.id }); play('click'); }} style={[styles.friend, d.skin === s.id && styles.friendOn]} accessibilityLabel={`${s.name}${ok ? '' : `, locked: ${unlockText(s)}`}`}>
                  <BirdIcon skin={i} size={48} locked={!ok} />
                  <Text style={styles.friendName}>{s.name}</Text>
                  {!ok && <Text style={styles.friendLock}>{unlockText(s)}</Text>}
                </Pressable>
              );
            })}
          </View>
        </Panel>

        <Panel>
          <Label>Benchmark</Label>
          <Text style={styles.hint}>A 60 second autopilot run on a fixed course. Measures frame rate and dropped frames so you can compare builds and frameworks.</Text>
          <FluffyButton label="Run benchmark" icon="⏱" tone="mint" size="sm" onPress={() => router.push('/bench')} style={styles.benchBtn} />
        </Panel>

        <FluffyButton
          label={confirm ? 'Tap again to erase everything' : 'Reset scores & stats'}
          tone={confirm ? 'pink' : 'white'}
          size="sm"
          onPress={() => {
            if (confirm) {
              resetAll();
              setConfirm(false);
            } else {
              setConfirm(true);
              if (t.current) clearTimeout(t.current);
              t.current = setTimeout(() => setConfirm(false), 3000);
            }
          }}
        />
        <Text style={styles.version}>
          Flappy Dash {Constants.expoConfig?.version ?? ''} · {Platform.OS}{isExpoGo ? ' · Expo Go' : ''}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16, paddingBottom: 30 },
  flex: { flex: 1 },
  input: { fontFamily: font.semi, fontSize: 20, color: colors.ink, backgroundColor: '#F8F3FD', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8, borderWidth: 2, borderColor: '#EBDDF7' },
  hint: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, marginTop: 4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  toggleLabel: { fontFamily: font.semi, fontSize: 18, color: colors.ink },
  track: { width: 58, height: 32, borderRadius: 16, padding: 3 },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  sep: { height: 2, backgroundColor: '#F4ECFB', marginVertical: 8, borderRadius: 1 },
  friends: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  friend: { width: '33.33%', alignItems: 'center', paddingVertical: 8, borderRadius: 18 },
  friendOn: { backgroundColor: '#FFF4D6' },
  friendName: { fontFamily: font.semi, fontSize: 14, color: colors.ink },
  friendLock: { fontFamily: font.regular, fontSize: 11, color: colors.inkSoft, textAlign: 'center' },
  benchBtn: { marginTop: 10 },
  version: { fontFamily: font.regular, fontSize: 12, color: colors.inkSoft, textAlign: 'center' },
});
