// Flappy Dash - Flutter port. CustomPainter + Ticker; paths and paints built once.
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'engine.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  runApp(const MaterialApp(debugShowCheckedModeBanner: false, title: 'Flappy Dash (Flutter)', home: GameScreen()));
}

const _theme = [
  [0x8FD3FF, 0xC9ECFF, 0xFFF1F7, 0xFFF2A8, 0xFFF8D6, 0xC8EBD9, 0xA6E0C3, 0xFFFFFF, 0xFFC7DE, 0xF7A8CB, 0xC76E98, 0xFFFFFF, 0xF2E3F4, 0xFFFFFF, 0xEADCF5],
  [0xFFA9A3, 0xFFCB9A, 0xFFE8C2, 0xFFE08A, 0xFFD0A0, 0xF5B9B5, 0xEE9EA6, 0xFFF0E6, 0xC9B6FF, 0xAE96F5, 0x7A62C2, 0xFFF6F0, 0xF3DCD8, 0xFFF6F0, 0xF2D3CF],
  [0x7F7CD9, 0xB49BE8, 0xF2B8D8, 0xFFE9F5, 0xE8C9F5, 0x9F8FDC, 0x8A79D0, 0xEBDDFF, 0x9EE6D3, 0x7DD3BE, 0x3F8F7C, 0xF7F1FF, 0xDCCDF3, 0xF4EEFF, 0xD8C8F2],
  [0x1E2459, 0x3A3C8C, 0x6E5BAF, 0xFFF7D1, 0xB8B6F2, 0x3A3F86, 0x2E3270, 0x7D7BC9, 0xFFD39A, 0xF5B76E, 0xA7672A, 0xE9E5FF, 0xB9B3EA, 0xE2DCFF, 0xACA3E6],
];
const _orbY = [120.0, 330.0, 130.0, 110.0];
const _moon = [0.0, 0.0, 1.0, 1.0];
const _line = Color(0xFF6B4A2B), _belly = Color(0xFFFFF6CF), _wing = Color(0xFFFFD25E), _beakC = Color(0xFFFF9A55);
const _ink = Color(0xFF3D2C4E), _gold = Color(0xFFFFD45C), _shade = Color(0xFFFFC94A), _lilac = Color(0xFF9479DB);
const _tile = 360.0, _floorTile = 280.0;

class Art {
  final fluff = Path(), wing = Path(), beak = Path(), cloud = Path(), capTop = Path(), capBot = Path(), floorPuffs = Path(), star = Path();
  late final Path hillFar = _wave(78, floorY - 10, 0.2, 2), hillNear = _wave(52, floorY + 8, 1.4, 3);
  final bodyShader = ui.Gradient.radial(const Offset(-5, -7), 26, const [Color(0xFFFFE27A), Color(0xFFFFE27A), _shade], const [0, 0.45, 1]);

  Art() {
    void circle(Path p, double x, double y, double r) => p.addOval(Rect.fromCircle(center: Offset(x, y), radius: r));
    circle(fluff, 0, 0, 14);
    for (var i = 0; i < 13; i++) { final a = i / 13 * math.pi * 2; circle(fluff, math.cos(a) * 12, math.sin(a) * 11.5, 6.2); }
    circle(fluff, -3, -18, 4.2);
    circle(fluff, 2.5, -19.5, 3.4);
    wing.addOval(const Rect.fromLTRB(-11, -6, 7, 6));
    circle(wing, -9, 3, 4.5);
    circle(wing, -4, 5, 4.5);
    beak..moveTo(12.5, -3.5)..quadraticBezierTo(24, -1, 23, 2)..quadraticBezierTo(22, 5, 12.5, 6)..close();
    circle(cloud, 0, 0, 20); circle(cloud, 24, -12, 25); circle(cloud, 52, -4, 21); circle(cloud, 74, 6, 15);
    cloud.addRRect(RRect.fromLTRBR(-12, 0, 86, 22, const Radius.circular(11)));
    for (final (p, puffY) in [(capTop, capH - 3), (capBot, 3.0)]) {
      p.addRRect(RRect.fromLTRBR(-capW / 2, 0, capW / 2, capH, const Radius.circular(12)));
      for (var i = 0; i < 4; i++) { circle(p, -capW / 2 + 12 + i * ((capW - 24) / 3), puffY, 11); }
    }
    for (var x = -14.0; x <= _floorTile + 14; x += 28) { circle(floorPuffs, x, floorY + 12, 17); }
    floorPuffs.addRect(const Rect.fromLTRB(-14, floorY + 12, _floorTile + 14, worldH + 20));
    for (var i = 0; i < 10; i++) {
      final a = -math.pi / 2 + i * math.pi / 5, r = i.isEven ? 12.0 : 5.5;
      i == 0 ? star.moveTo(math.cos(a) * r, math.sin(a) * r) : star.lineTo(math.cos(a) * r, math.sin(a) * r);
    }
    star.close();
  }

  static Path _wave(double amp, double base, double phase, double freq) {
    final p = Path()..moveTo(0, worldH);
    for (var x = 0.0; x <= _tile; x += 6) {
      final t = x / _tile * math.pi * 2;
      p.lineTo(x, base - amp * (0.55 + 0.3 * math.sin(t * freq + phase) + 0.15 * math.sin(t * freq * 2 + phase * 3)));
    }
    return p..lineTo(_tile, worldH)..close();
  }
}

class GamePainter extends CustomPainter {
  GamePainter(this.g, this.art, Listenable repaint) : super(repaint: repaint);
  final Game g;
  final Art art;
  final fill = Paint()..isAntiAlias = true;
  final stroke = Paint()..style = PaintingStyle.stroke..strokeJoin = StrokeJoin.round..strokeCap = StrokeCap.round;

  Color tc(int i) => Color.lerp(Color(0xFF000000 | _theme[g.themeFrom][i]), Color(0xFF000000 | _theme[g.theme][i]), g.themeMix)!;
  static double wrap(double v, double m) => ((v % m) + m) % m;
  Paint col(Color c, [double a = 1]) => fill..shader = null..color = c.withValues(alpha: a);

  @override
  void paint(Canvas c, Size size) {
    final k = size.height / worldH, w = size.width / k, m = g.themeMix;
    c.save();
    c.scale(k);
    if (g.shake > 0) c.translate(math.sin(g.time * 91) * g.shake * g.shake * 7, math.cos(g.time * 77) * g.shake * g.shake * 7);
    fill.shader = ui.Gradient.linear(Offset.zero, const Offset(0, floorY), [tc(0), tc(1), tc(2)], const [0, 0.6, 1]);
    c.drawRect(Rect.fromLTWH(-20, -20, w + 40, worldH + 40), fill);
    fill.shader = null;

    final night = _moon[g.themeFrom] * (1 - m) + _moon[g.theme] * m;
    if (night > 0.01) {
      for (var i = 0; i < 34; i++) {
        final tw = 0.55 + 0.45 * math.sin(g.time * 2 + i * 3);
        c.drawCircle(Offset(((i * 97.3) % 520) % w, 18 + (i * 53.7) % 340), 0.8 + (i * 7 % 3) * 0.55, col(Colors.white, night * tw * 0.9));
      }
    }
    final orbY = _orbY[g.themeFrom] + (_orbY[g.theme] - _orbY[g.themeFrom]) * m, orbX = w * 0.76, glow = tc(4);
    fill.shader = ui.Gradient.radial(Offset(orbX, orbY), 60, [glow.withValues(alpha: 0.8), glow.withValues(alpha: 0)]);
    c.drawCircle(Offset(orbX, orbY), 60, fill);
    c.drawCircle(Offset(orbX, orbY), 28, col(tc(3)));
    if (night > 0.01) c.drawCircle(Offset(orbX + 11, orbY - 7), 23, col(glow, night));

    const clouds = [40.0, 96.0, 1.0, 7.0, 0.08, 250.0, 170.0, 0.7, 5.0, 0.06, 380.0, 64.0, 0.85, 9.0, 0.1, 150.0, 262.0, 0.55, 4.0, 0.05];
    final span = w + 220;
    for (var i = 0; i < clouds.length; i += 5) {
      final x = wrap(clouds[i] - g.time * clouds[i + 3] - g.scroll * clouds[i + 4], span) - 110;
      c..save()..translate(x, clouds[i + 1])..scale(clouds[i + 2]);
      c.drawPath(art.cloud, col(tc(7), 0.92));
      c.restore();
    }
    final tiles = (w / _tile).ceil() + 1;
    for (final (path, color, speed) in [(art.hillFar, tc(5), 0.18), (art.hillNear, tc(6), 0.42)]) {
      final off = -wrap(g.scroll * speed, _tile);
      for (var i = 0; i < tiles; i++) { c..save()..translate(off + i * _tile, 0)..drawPath(path, col(color))..restore(); }
    }

    final line = tc(10), cap = tc(11), capShade = tc(12);
    final pg = ui.Gradient.linear(const Offset(-pillarW / 2, 0), const Offset(pillarW / 2, 0), [tc(8), tc(8), tc(9)], const [0, 0.35, 1]);
    for (var idx = 0; idx < pillarCount; idx++) {
      final p = g.pillars[idx];
      if (!p.on) continue;
      final top = p.gapY - p.gap / 2, bot = p.gapY + p.gap / 2;
      c..save()..translate(p.x, 0);
      for (final (y0, y1) in [(-40.0, top - capH + 4), (bot + capH - 4, floorY + 40)]) {
        final r = RRect.fromLTRBR(-pillarW / 2, y0, pillarW / 2, y1, const Radius.circular(12));
        fill..shader = pg..color = Colors.white;
        c.drawRRect(r, fill);
        c.drawRRect(RRect.fromLTRBR(-pillarW / 2 + 9, y0, -pillarW / 2 + 18, y1, const Radius.circular(4.5)), col(Colors.white, 0.38));
        c.drawRRect(r, stroke..color = line..strokeWidth = 2.4);
      }
      for (final (path, y0) in [(art.capTop, top - capH), (art.capBot, bot)]) {
        c..save()..translate(0, y0);
        c.drawPath(path, stroke..strokeWidth = 4.8);
        c.drawPath(path, col(capShade));
        c.translate(0, -3);
        c.drawPath(path, col(cap));
        c.restore();
      }
      if (p.star == 1) {
        final sy = p.gapY + p.starDy + math.sin(g.time * 3 + idx) * 3;
        fill.shader = ui.Gradient.radial(Offset(0, sy), 22, [_gold.withValues(alpha: 0.6), _gold.withValues(alpha: 0)]);
        c.drawCircle(Offset(0, sy), 22, fill);
        c..save()..translate(0, sy)..rotate(math.sin(g.time * 2.4 + idx) * 14 * math.pi / 180);
        c.drawPath(art.star, col(_gold));
        c.drawPath(art.star, stroke..color = Colors.white..strokeWidth = 2);
        c.restore();
      }
      c.restore();
    }
    final fTiles = (w / _floorTile).ceil() + 1;
    for (final (color, off, dy) in [(tc(14), -wrap(g.scroll * 0.75 + 14, _floorTile), -8.0), (tc(13), -wrap(g.scroll, _floorTile), 4.0)]) {
      for (var i = 0; i < fTiles; i++) { c..save()..translate(off + i * _floorTile, dy)..drawPath(art.floorPuffs, col(color))..restore(); }
    }
    final h = ((floorY - g.y) / 300).clamp(0.0, 1.0);
    c.drawOval(Rect.fromCenter(center: Offset(g.birdX, floorY + 10), width: 36 * (1 - h * 0.5), height: 10), col(_ink, 0.16 * (1 - h * 0.7)));

    for (final q in g.parts) {
      if (q.life <= 0 || q.kind == pSpark) continue;
      final t = q.life / q.max;
      if (q.kind == pFluff) {
        c.drawCircle(Offset(q.x, q.y), q.size * (1.6 - t * 0.6), col(Colors.white, t * 0.9));
      } else {
        c.drawOval(Rect.fromCenter(center: Offset(q.x, q.y), width: q.size * 3.2, height: q.size * 1.4), col(_shade, math.min(1, t * 1.6)));
      }
    }
    _bird(c);
    for (var i = 0; i < particleCount; i++) {
      final q = g.parts[i];
      if (q.life <= 0 || q.kind != pSpark) continue;
      final t = q.life / q.max, s = 0.45 * (0.5 + t);
      c..save()..translate(q.x, q.y)..rotate((g.time * 200 + i * 40) * math.pi / 180)..scale(s);
      c.drawPath(art.star, col(const Color(0xFFFFF4B0), t));
      c.restore();
    }
    c.restore();
    if (g.flash > 0) c.drawRect(Offset.zero & size, col(Colors.white, g.flash * 0.55));
  }

  void _bird(Canvas c) {
    final dead = g.phase == Phase.dead, sq = g.squash * g.squash;
    c..save()..translate(g.birdX, g.y)..rotate(g.rot * math.pi / 180)..scale(1 - 0.1 * sq, 1 + 0.13 * sq);
    c.drawPath(art.fluff, stroke..color = _line..strokeWidth = 4.4);
    fill..shader = art.bodyShader..color = Colors.white;
    c.drawPath(art.fluff, fill);
    c.drawOval(const Rect.fromLTWH(-9, 0, 19, 13), col(_belly));
    c.drawCircle(const Offset(5, 5.5), 3.6, col(const Color(0xFFFF8FB1), 0.55));
    if (dead) {
      stroke..color = _ink..strokeWidth = 2.2;
      c.drawLine(const Offset(4, -8), const Offset(10, -2), stroke);
      c.drawLine(const Offset(10, -8), const Offset(4, -2), stroke);
    } else {
      final bt = g.time % 3.7, open = bt < 0.12 ? (bt - 0.06).abs() / 0.06 : 1.0;
      c..save()..translate(7, -5)..scale(1, math.max(0.12, open));
      c.drawCircle(Offset.zero, 5.8, col(Colors.white));
      c.drawCircle(Offset.zero, 5.8, stroke..color = _line..strokeWidth = 1.8);
      c.drawCircle(const Offset(1.6, 0.4), 3.3, col(_ink));
      c.drawCircle(const Offset(2.6, -1.1), 1.25, col(Colors.white));
      c.restore();
    }
    c.drawPath(art.beak, stroke..color = _line..strokeWidth = 3.2);
    c.drawPath(art.beak, col(_beakC));
    final since = g.time - g.flapAt;
    final wingA = dead ? -30.0 : (since < 0.32 || g.vy < -60) ? math.sin(g.time * 34) * 32 - 8 : 8 + math.sin(g.time * 4) * 4;
    c..save()..translate(-5, 3)..translate(2, -1)..rotate(wingA * math.pi / 180)..translate(-2, 1);
    c.drawPath(art.wing, stroke..strokeWidth = 3.8);
    c.drawPath(art.wing, col(_wing));
    c.restore();
    c.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class GameScreen extends StatefulWidget {
  const GameScreen({super.key});
  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> with SingleTickerProviderStateMixin {
  final game = Game(360, DateTime.now().microsecondsSinceEpoch.toSigned(32));
  final art = Art();
  final frame = ValueNotifier<int>(0);
  late final Ticker ticker;
  Duration? last;
  int best = 0, shownScore = 0;
  Phase shownPhase = Phase.ready;
  bool benchOn = false;
  double benchMs = 0;
  final times = <double>[];
  List<String>? result;
  SharedPreferences? prefs;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) => setState(() { prefs = p; best = p.getInt('best') ?? 0; }));
    ticker = createTicker(_onTick)..start();
  }

  void _onTick(Duration now) {
    final dtMs = last == null ? 0.0 : (now - last!).inMicroseconds / 1000;
    last = now;
    final before = game.phase;
    game.advance(dtMs / 1000);
    if (benchOn && dtMs > 0) {
      times.add(dtMs);
      benchMs += dtMs;
      if (benchMs >= 60000) { benchOn = false; result = benchStats(times); debugPrint('RESULT framework=flutter | ${result!.sublist(1, 5).join(' | ')}'); game..bot = false..reset(); setState(() {}); }
    }
    if (before != Phase.dead && game.phase == Phase.dead && !game.bot && game.score > best) { best = game.score; prefs?.setInt('best', best); }
    if (game.score != shownScore || game.phase != shownPhase || benchOn) setState(() { shownScore = game.score; shownPhase = game.phase; });
    frame.value++;
  }

  @override
  void dispose() { ticker.dispose(); super.dispose(); }

  void _tap() {
    if (result != null) { setState(() => result = null); return; }
    if (benchOn) return;
    if (game.phase == Phase.dead) { if (game.canRestart) game.reset(); } else { game.flap(); }
  }

  void _startBench() {
    times.clear();
    game..reset()..seed = 1234..time = 0..bot = true;
    benchMs = 0;
    setState(() => benchOn = true);
  }

  TextStyle bubble(double size, [Color color = Colors.white]) => TextStyle(
      color: color, fontSize: size, fontWeight: FontWeight.w900,
      shadows: [Shadow(color: _lilac, offset: Offset(0, size / 10), blurRadius: 1)]);

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.sizeOf(context);
    game.setWidth(media.width / (media.height / worldH));
    return Scaffold(
      backgroundColor: const Color(0xFFC9ECFF),
      body: Listener(
        behavior: HitTestBehavior.opaque,
        onPointerDown: (_) => _tap(),
        child: Stack(children: [
          Positioned.fill(child: RepaintBoundary(child: CustomPaint(painter: GamePainter(game, art, frame)))),
          SafeArea(child: SizedBox.expand(child: _hud())),
        ]),
      ),
    );
  }

  Widget _hud() {
    if (result != null) {
      return Center(
        child: Container(
          margin: const EdgeInsets.all(24), padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28)),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            for (final (i, l) in result!.indexed)
              Text(l, style: TextStyle(color: const Color(0xFF4A3763), fontSize: i == 0 ? 26 : 14, fontWeight: i == 0 ? FontWeight.w900 : FontWeight.w500)),
          ]),
        ),
      );
    }
    if (benchOn) return Align(alignment: Alignment.topCenter, child: Padding(padding: const EdgeInsets.only(top: 16), child: Text('Benchmark · ${60 - benchMs ~/ 1000}s · ⭐ $shownScore', style: bubble(18))));
    switch (shownPhase) {
      case Phase.playing:
        return Align(alignment: Alignment.topCenter, child: Padding(padding: const EdgeInsets.only(top: 30), child: Text('$shownScore', style: bubble(64))));
      case Phase.ready:
        return Column(children: [
          const SizedBox(height: 80),
          Text('Flappy', style: bubble(56)),
          Text('Dash', style: bubble(42, const Color(0xFFFFD36B))),
          const SizedBox(height: 16),
          Text('Tap to flap · Best $best', style: bubble(18)),
          const Spacer(),
          GestureDetector(
            onTapDown: (_) {},
            child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF55BF98), padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 16)),
              onPressed: _startBench,
              child: const Text('⏱ Benchmark (60 s)', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ),
          ),
          Padding(padding: const EdgeInsets.all(12), child: Text('Flutter', style: bubble(14))),
        ]);
      case Phase.dead:
        return Column(children: [
          const SizedBox(height: 160),
          Text('Game over', style: bubble(44)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28)),
            child: Column(children: [
              Text('SCORE $shownScore', style: const TextStyle(color: Color(0xFF4A3763), fontSize: 30, fontWeight: FontWeight.w900)),
              Text('BEST $best', style: const TextStyle(color: Color(0xFF4A3763), fontSize: 20, fontWeight: FontWeight.bold)),
            ]),
          ),
          const SizedBox(height: 12),
          Text('Tap to retry', style: bubble(20)),
        ]);
    }
  }
}
