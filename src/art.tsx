import React, { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { GROUND_H, PIPE_GAP, PIPE_W, WORLD_H } from './game';

export type Theme = {
  skyTop: string; skyBottom: string; hillFar: string; hillNear: string;
  cloud: string; stars: boolean; orb: string; orbGlow: string; orbY: number;
};

export const THEMES: Theme[] = [
  { skyTop: '#4EC0F0', skyBottom: '#BDEBFF', hillFar: '#8FD7B5', hillNear: '#5FC48D', cloud: '#FFFFFF', stars: false, orb: '#FFE066', orbGlow: '#FFF3B0', orbY: 110 },
  { skyTop: '#6C4BA8', skyBottom: '#FFB27A', hillFar: '#B8638F', hillNear: '#8A4575', cloud: '#FFD9C2', stars: false, orb: '#FF8A5B', orbGlow: '#FFC29B', orbY: 330 },
  { skyTop: '#0B1437', skyBottom: '#34408A', hillFar: '#26336B', hillNear: '#1B2552', cloud: '#5C6BB5', stars: true, orb: '#F4F1DE', orbGlow: '#B9C2F0', orbY: 110 },
];

const STARS = Array.from({ length: 28 }, (_, i) => ({
  x: (i * 97) % 420, y: 20 + ((i * 53) % 330), r: 0.8 + ((i * 7) % 3) * 0.5,
}));

const CLOUDS = [
  { x: 40, y: 90, s: 1.0, v: 9 }, { x: 220, y: 170, s: 0.7, v: 6 },
  { x: 330, y: 60, s: 0.8, v: 12 }, { x: 120, y: 260, s: 0.55, v: 5 },
];

const TILE = 360;
function hillPath(amp: number, base: number, phase: number, freq: number) {
  const pts: string[] = [`M0 ${WORLD_H}`];
  for (let x = 0; x <= TILE; x += 12) {
    const y = base - amp * (0.5 + 0.5 * Math.sin(((x / TILE) * freq + phase) * Math.PI * 2));
    pts.push(`L${x} ${y.toFixed(1)}`);
  }
  pts.push(`L${TILE} ${WORLD_H} Z`);
  return pts.join(' ');
}
const FAR = hillPath(70, WORLD_H - GROUND_H - 20, 0.1, 2);
const NEAR = hillPath(45, WORLD_H - GROUND_H + 5, 0.6, 3);

export const Sky = memo(function Sky({ w, theme }: { w: number; theme: Theme }) {
  return (
    <G>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.skyTop} />
          <Stop offset="1" stopColor={theme.skyBottom} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={WORLD_H} fill="url(#sky)" />
      {theme.stars && STARS.map((s, i) => <Circle key={i} cx={s.x % w} cy={s.y} r={s.r} fill="#fff" opacity={0.85} />)}
      <Circle cx={w * 0.78} cy={theme.orbY} r={46} fill={theme.orbGlow} opacity={0.35} />
      <Circle cx={w * 0.78} cy={theme.orbY} r={30} fill={theme.orb} />
      {theme.stars && <Circle cx={w * 0.78 + 10} cy={theme.orbY - 6} r={26} fill={theme.skyTop} opacity={0.55} />}
    </G>
  );
});

function Cloud({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`} opacity={0.92}>
      <Circle cx={0} cy={0} r={20} fill={color} />
      <Circle cx={26} cy={-10} r={26} fill={color} />
      <Circle cx={58} cy={0} r={20} fill={color} />
      <Rect x={0} y={0} width={58} height={20} fill={color} />
    </G>
  );
}

export function Parallax({ w, time, scroll, theme }: { w: number; time: number; scroll: number; theme: Theme }) {
  const span = w + 240;
  const tiles = Math.ceil(w / TILE) + 2;
  const far = -((scroll * 0.18) % TILE);
  const near = -((scroll * 0.4) % TILE);
  return (
    <G>
      {CLOUDS.map((c, i) => {
        const x = (((c.x - time * c.v) % span) + span) % span - 120;
        return <Cloud key={i} x={x} y={c.y} s={c.s} color={theme.cloud} />;
      })}
      {Array.from({ length: tiles }, (_, i) => (
        <Path key={`f${i}`} d={FAR} fill={theme.hillFar} transform={`translate(${far + i * TILE} 0)`} />
      ))}
      {Array.from({ length: tiles }, (_, i) => (
        <Path key={`n${i}`} d={NEAR} fill={theme.hillNear} transform={`translate(${near + i * TILE} 0)`} />
      ))}
    </G>
  );
}

export function Ground({ w, scroll }: { w: number; scroll: number }) {
  const top = WORLD_H - GROUND_H;
  const stripe = 28;
  const off = -(scroll % stripe);
  const n = Math.ceil(w / stripe) + 2;
  return (
    <G>
      <Rect x={0} y={top} width={w} height={GROUND_H} fill="#DED895" />
      <Rect x={0} y={top + 24} width={w} height={GROUND_H - 24} fill="#D2C77B" />
      <Rect x={0} y={top} width={w} height={6} fill="#4B3A1E" opacity={0.35} />
      <Rect x={0} y={top} width={w} height={22} fill="#6CCB3C" />
      {Array.from({ length: n }, (_, i) => {
        const x = off + i * stripe;
        return <Polygon key={i} points={`${x},${top + 4} ${x + 14},${top + 4} ${x + 4},${top + 22} ${x - 10},${top + 22}`} fill="#4FB02B" />;
      })}
      <Rect x={0} y={top + 20} width={w} height={4} fill="#3A8F1E" />
      <Rect x={0} y={top + 24} width={w} height={3} fill="#B8AB5E" />
    </G>
  );
}

const CAP_H = 28;
const CAP_W = PIPE_W + 10;

function PipeBody({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <G>
      <Rect x={x - PIPE_W / 2} y={y} width={PIPE_W} height={h} fill="url(#pipe)" stroke="#2D5A14" strokeWidth={2.5} />
      <Rect x={x - PIPE_W / 2 + 7} y={y} width={7} height={h} fill="#fff" opacity={0.22} />
    </G>
  );
}
function PipeCap({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Rect x={x - CAP_W / 2} y={y} width={CAP_W} height={CAP_H} rx={4} fill="url(#pipe)" stroke="#2D5A14" strokeWidth={2.5} />
      <Rect x={x - CAP_W / 2 + 7} y={y + 2} width={7} height={CAP_H - 4} fill="#fff" opacity={0.22} />
    </G>
  );
}

export function Pipes({ pipes }: { pipes: { x: number; gapY: number }[] }) {
  const floor = WORLD_H - GROUND_H;
  return (
    <G>
      <Defs>
        <LinearGradient id="pipe" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#8BDB4A" />
          <Stop offset="0.5" stopColor="#6CC22E" />
          <Stop offset="1" stopColor="#4C9A1E" />
        </LinearGradient>
      </Defs>
      {pipes.map((p, i) => {
        const top = p.gapY - PIPE_GAP / 2;
        const bot = p.gapY + PIPE_GAP / 2;
        return (
          <G key={i}>
            <PipeBody x={p.x} y={-10} h={top + 10 - CAP_H} />
            <PipeCap x={p.x} y={top - CAP_H} />
            <PipeBody x={p.x} y={bot + CAP_H} h={floor - bot - CAP_H} />
            <PipeCap x={p.x} y={bot} />
          </G>
        );
      })}
    </G>
  );
}

export function Bird({ x, y, vy, time, flapAt, dead }: { x: number; y: number; vy: number; time: number; flapAt: number; dead: boolean }) {
  const rot = dead ? Math.min(90, 40 + Math.max(vy, 0) * 0.06) : Math.max(-28, Math.min(80, vy * 0.085));
  const flapping = time - flapAt < 0.35 || vy < 0;
  const wing = dead ? 20 : flapping ? Math.sin(time * 32) * 28 : 10;
  return (
    <G transform={`translate(${x} ${y}) rotate(${rot})`}>
      {/* tail */}
      <Path d="M-14 -2 L-26 -8 L-24 0 L-27 6 L-14 4 Z" fill="#F29E1B" stroke="#3B2A1A" strokeWidth={2} strokeLinejoin="round" />
      {/* body */}
      <Ellipse cx={0} cy={0} rx={19} ry={15} fill="#FFD93B" stroke="#3B2A1A" strokeWidth={2.5} />
      <Ellipse cx={1} cy={7} rx={12} ry={6.5} fill="#FFF3B0" />
      <Ellipse cx={-3} cy={-8} rx={9} ry={3} fill="#fff" opacity={0.45} />
      {/* wing */}
      <G transform={`translate(-6 3) rotate(${wing})`}>
        <Ellipse cx={-3} cy={2} rx={10} ry={6.5} fill="#FFB52E" stroke="#3B2A1A" strokeWidth={2} />
        <Path d="M-10 3 Q-4 6 2 3" stroke="#D9861A" strokeWidth={1.5} fill="none" />
      </G>
      {/* eye */}
      <Circle cx={9} cy={-5} r={6.5} fill="#fff" stroke="#3B2A1A" strokeWidth={2} />
      <Circle cx={dead ? 9 : 11} cy={-5} r={dead ? 1.2 : 3} fill="#3B2A1A" />
      {dead && <Path d="M5 -9 L13 -1 M13 -9 L5 -1" stroke="#3B2A1A" strokeWidth={2} strokeLinecap="round" />}
      {/* beak */}
      <Path d="M14 0 Q26 -1 27 3 Q25 5 14 5 Z" fill="#FF6B3D" stroke="#3B2A1A" strokeWidth={2} strokeLinejoin="round" />
      <Path d="M15 4 Q22 7 26 5 Q24 9 15 8 Z" fill="#E0482A" stroke="#3B2A1A" strokeWidth={1.5} strokeLinejoin="round" />
      <Circle cx={4} cy={3} r={3} fill="#FF8F8F" opacity={0.55} />
    </G>
  );
}

export function MedalIcon({ kind, size = 56 }: { kind: 'bronze' | 'silver' | 'gold' | 'platinum'; size?: number }) {
  const c = { bronze: ['#E39A5B', '#A9612B'], silver: ['#E5EAF0', '#9AA7B5'], gold: ['#FFE066', '#E0A412'], platinum: ['#B8F3FF', '#4FB6D6'] }[kind];
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Polygon points="14,2 26,2 30,22 18,26" fill="#E24B4B" />
      <Polygon points="42,2 30,2 26,22 38,26" fill="#B93434" />
      <Circle cx={28} cy={34} r={19} fill={c[1]} stroke="#3B2A1A" strokeWidth={2.5} />
      <Circle cx={28} cy={34} r={14} fill={c[0]} />
      <Polygon points="28,24 31,31 38,31.5 32.5,36 34.5,43 28,39 21.5,43 23.5,36 18,31.5 25,31" fill={c[1]} opacity={0.85} />
    </Svg>
  );
}
