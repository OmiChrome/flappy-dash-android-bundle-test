// Flappy Dash engine - port of src/game/engine.ts (see ports/SPEC.md).
import 'dart:math' as math;

const worldH = 640.0, floorY = 548.0, birdR = 13.0, gravity = 1650.0, flapV = -455.0, maxFall = 720.0;
const pillarW = 66.0, capW = 80.0, capH = 26.0, spacing = 228.0;
const baseSpeed = 150.0, maxSpeed = 205.0, baseGap = 184.0, minGap = 150.0, edge = 58.0, maxShift = 165.0;
const step = 1 / 120;
const pillarCount = 6, particleCount = 64, themeCount = 4;
const pFluff = 0, pSpark = 1, pFeather = 2;

enum Phase { ready, playing, dead }

class Pillar {
  bool on = false, passed = false;
  double x = 0, gapY = 0, base = 0, gap = baseGap, amp = 0, freq = 0, phase = 0, starDy = 0;
  int star = 0;
}

class Particle {
  double life = 0, max = 1, x = 0, y = 0, vx = 0, vy = 0, size = 1;
  int kind = 0;
}

int _i32(int v) => v.toSigned(32);
// 32-bit multiply that is exact on the VM (64-bit ints) and on web (ints are JS doubles)
int _imul(int a, int b) {
  final al = a & 0xffff, ah = (a.toUnsigned(32) >> 16) & 0xffff;
  return _i32(al * b.toUnsigned(32) + (((ah * b.toUnsigned(32)) & 0xffff) << 16));
}
int _ushr(int v, int n) => (v.toUnsigned(32)) >> n;

class Game {
  Phase phase = Phase.ready;
  double width, birdX, y = worldH * 0.42, vy = 0, rot = 0, time = 0, scroll = 0, speed = baseSpeed;
  int score = 0, stars = 0, spawned = 0, pNext = 0, theme = 0, themeFrom = 0, seed;
  double deadFor = 0, flapAt = -10, squash = 0, shake = 0, flash = 0, spawnIn = 0, lastGap = -1, themeMix = 1, acc = 0;
  bool landed = false, bot = false;
  final pillars = List.generate(pillarCount, (_) => Pillar());
  final parts = List.generate(particleCount, (_) => Particle());

  Game(this.width, this.seed) : birdX = width * 0.3;

  double rand() {
    seed = _i32(seed + 0x6d2b79f5);
    var t = seed;
    t = _imul(t ^ _ushr(t, 15), t | 1);
    t = _i32(t ^ _i32(t + _imul(t ^ _ushr(t, 7), t | 61)));
    return (t ^ _ushr(t, 14)).toUnsigned(32) / 4294967296.0;
  }

  void reset() {
    phase = Phase.ready; y = worldH * 0.42; vy = 0; rot = 0; speed = baseSpeed; score = 0; stars = 0;
    deadFor = 0; flapAt = -10; squash = 0; shake = 0; flash = 0; landed = false; spawnIn = 0; lastGap = -1; spawned = 0;
    themeFrom = theme; theme = 0; themeMix = themeFrom == 0 ? 1 : 0;
    for (final p in pillars) { p.on = false; }
  }

  void setWidth(double w) { width = w; birdX = w * 0.3; }

  static double difficulty(int s) => math.min(1.0, s / 45);

  void _emit(int kind, double x, double y, double vx, double vy, double size, double life) {
    final p = parts[pNext];
    pNext = (pNext + 1) % particleCount;
    p..kind = kind..x = x..y = y..vx = vx..vy = vy..size = size..life = life..max = life;
  }

  void _puff(int n, int kind, double x, double y, double power) {
    for (var i = 0; i < n; i++) {
      final a = rand() * math.pi * 2;
      final v = power * (0.35 + rand() * 0.65);
      final size = 2.5 + rand() * 3.5;
      final life = 0.45 + rand() * 0.45;
      _emit(kind, x, y, math.cos(a) * v, math.sin(a) * v, size, life);
    }
  }

  bool flap() {
    if (phase == Phase.dead) return false;
    if (phase == Phase.ready) { phase = Phase.playing; spawnIn = width * 0.55 + 60; }
    vy = flapV; flapAt = time; squash = 1;
    for (var i = 0; i < 3; i++) {
      final vx = -40 - rand() * 50, vy2 = 30 + rand() * 60, size = 2 + rand() * 2.5, life = 0.35 + rand() * 0.2;
      _emit(pFluff, birdX - 12, y + 6, vx, vy2, size, life);
    }
    return true;
  }

  bool get canRestart => phase == Phase.dead && deadFor > 0.6;

  void _spawnPillar(double x) {
    Pillar? p;
    for (final q in pillars) { if (!q.on) { p = q; break; } }
    if (p == null) return;
    final d = difficulty(score);
    final gap = baseGap - (baseGap - minGap) * d;
    final moving = spawned >= 8 && rand() < 0.2 + 0.4 * d;
    final amp = moving ? 22 + 26 * d : 0.0;
    final lo = edge + gap / 2 + amp, hi = floorY - edge - gap / 2 - amp;
    var a = lo, b = hi;
    if (lastGap >= 0) {
      a = math.max(lo, lastGap - maxShift); b = math.min(hi, lastGap + maxShift);
      if (a > b) { a = math.min(hi, math.max(lo, lastGap)); b = a; }
    }
    final base = a + rand() * (b - a);
    p..on = true..x = x..base = base..gap = gap..amp = amp;
    p.freq = 1.1 + rand() * 0.8;
    p.phase = rand() * math.pi * 2;
    p.gapY = base + (amp != 0 ? math.sin(time * p.freq + p.phase) * amp : 0);
    p.passed = false;
    p.star = spawned >= 2 && rand() < 0.34 ? 1 : 0;
    p.starDy = (rand() - 0.5) * gap * 0.45;
    lastGap = base;
    spawned++;
  }

  static bool _circleRect(double cx, double cy, double r, double l, double t, double rr, double b) {
    final nx = cx.clamp(l, rr), ny = cy.clamp(t, b), dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  bool hitsPillar(Pillar p) {
    final top = p.gapY - p.gap / 2, bot = p.gapY + p.gap / 2, x = birdX, r = birdR;
    if (x + r < p.x - capW / 2 || x - r > p.x + capW / 2) return false;
    return _circleRect(x, y, r, p.x - pillarW / 2, -1000, p.x + pillarW / 2, top - capH) ||
        _circleRect(x, y, r, p.x - pillarW / 2, bot + capH, p.x + pillarW / 2, floorY + 100) ||
        _circleRect(x, y, r - 2, p.x - capW / 2 + 3, top - capH, p.x + capW / 2 - 3, top) ||
        _circleRect(x, y, r - 2, p.x - capW / 2 + 3, bot, p.x + capW / 2 - 3, bot + capH);
  }

  void _die() {
    phase = Phase.dead; deadFor = 0; shake = 1; flash = 1; vy = math.min(vy, -180);
    _puff(14, pFeather, birdX, y, 260);
    _puff(8, pFluff, birdX, y, 160);
  }

  void _addScore(int n) {
    final before = score ~/ 10;
    score += n;
    speed = baseSpeed + (maxSpeed - baseSpeed) * difficulty(score);
    final after = score ~/ 10;
    if (after != before) { themeFrom = theme; theme = after % themeCount; themeMix = 0; }
  }

  void autopilot() {
    if (phase == Phase.ready) { if (time > 0.6) flap(); return; }
    if (phase != Phase.playing) return;
    var target = floorY * 0.5, nearest = 1e9;
    for (final p in pillars) {
      if (p.on && p.x + capW / 2 + birdR > birdX && p.x < nearest) { nearest = p.x; target = p.gapY + p.gap / 2 - birdR - 18; }
    }
    if (y > target && vy > 0) flap();
  }

  void tick(double dt) {
    if (bot) autopilot();
    time += dt;
    squash = math.max(0, squash - dt * 5); shake = math.max(0, shake - dt * 3.2); flash = math.max(0, flash - dt * 5);
    if (themeMix < 1) themeMix = math.min(1, themeMix + dt / 1.4);
    for (final p in parts) {
      if (p.life <= 0) continue;
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind == pFeather) { p.vy += 380 * dt; p.vx *= 1 - 2.2 * dt; if (p.vy > 90) p.vy = 90; } else { p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt; }
    }
    if (phase == Phase.ready) {
      scroll += baseSpeed * 0.55 * dt;
      y = worldH * 0.42 + math.sin(time * 3.2) * 9;
      rot = math.sin(time * 3.2 + 1) * 4;
      return;
    }
    if (phase == Phase.dead) {
      deadFor += dt;
      const floor = floorY - birdR;
      if (y < floor) {
        vy = math.min(vy + gravity * dt, maxFall);
        y = math.min(y + vy * dt, floor);
        rot = math.min(100, rot + 420 * dt);
        if (y >= floor && !landed) { landed = true; _puff(8, pFluff, birdX, floor + birdR, 120); }
      }
      return;
    }
    vy = math.min(vy + gravity * dt, maxFall);
    y += vy * dt;
    if (y < birdR) { y = birdR; if (vy < 0) vy = 0; }
    final targetRot = vy < 0 ? -22.0 : math.min(85.0, -22 + (vy / maxFall) * 120);
    rot += (targetRot - rot) * math.min(1, dt * (vy < 0 ? 18 : 6));
    final dx = speed * dt;
    scroll += dx; spawnIn -= dx;
    if (spawnIn <= 0) { _spawnPillar(width + capW); spawnIn += spacing; }
    for (final p in pillars) {
      if (!p.on) continue;
      p.x -= dx;
      if (p.amp != 0) p.gapY = p.base + math.sin(time * p.freq + p.phase) * p.amp;
      if (p.x < -capW) { p.on = false; continue; }
      if (p.star == 1) {
        final sy = p.gapY + p.starDy, ddx = birdX - p.x, ddy = y - sy;
        if (ddx * ddx + ddy * ddy < (birdR + 12) * (birdR + 12)) { p.star = 2; stars++; _addScore(1); _puff(10, pSpark, p.x, sy, 170); }
      }
      if (!p.passed && p.x + pillarW / 2 < birdX - birdR) { p.passed = true; _addScore(1); _puff(5, pSpark, birdX + 6, y - 18, 90); }
      if (!bot && hitsPillar(p)) { _die(); return; }
    }
    if (y + birdR >= floorY) { y = floorY - birdR; _die(); vy = 0; landed = true; }
  }

  void advance(double frameDt) {
    acc += frameDt.clamp(0, 0.1);
    while (acc >= step) { tick(step); acc -= step; }
  }
}

List<String> benchStats(List<double> times) {
  final t = times.where((x) => x.isFinite && x > 0).toList();
  final s = [...t]..sort();
  double pct(double p) => s.isEmpty ? 0 : s[(p / 100 * s.length).ceil().clamp(1, s.length) - 1];
  final total = t.fold(0.0, (a, b) => a + b);
  final p50 = pct(50);
  final hzRaw = p50 > 0 ? 1000 / p50 : 60;
  final hz = [30, 48, 50, 60, 72, 75, 90, 120, 144, 165].reduce((a, b) => (a - hzRaw).abs() <= (b - hzRaw).abs() ? a : b);
  final interval = 1000 / hz;
  var dropped = 0, jank = 0;
  for (final x in t) { final slots = (x / interval).round(); if (slots > 1) dropped += slots - 1; if (x > interval * 2) jank++; }
  final from = (s.length * 0.99).floor();
  final slowList = s.sublist(from);
  final slow = slowList.isEmpty ? 0.0 : slowList.reduce((a, b) => a + b) / slowList.length;
  final avg = total > 0 ? t.length * 1000 / total : 0;
  final expected = t.length + dropped;
  return [
    'Benchmark',
    'avg ${avg.toStringAsFixed(1)} fps · 1% low ${(slow > 0 ? 1000 / slow : 0).toStringAsFixed(0)} · dropped ${(expected > 0 ? dropped * 100 / expected : 0).toStringAsFixed(1)}%',
    'display ≈ $hz Hz · ${t.length} frames in ${(total / 1000).toStringAsFixed(1)} s',
    'p50 ${p50.toStringAsFixed(1)} · p95 ${pct(95).toStringAsFixed(1)} · p99 ${pct(99).toStringAsFixed(1)} · max ${(s.isEmpty ? 0 : s.last).toStringAsFixed(1)} ms',
    'dropped $dropped · janky $jank',
    'Flutter · tap to close',
  ];
}
