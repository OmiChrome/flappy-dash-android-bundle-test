// Game sounds + vibration, same rules as the Expo app (src/app/play.tsx).
// Android: audioplayers' low-latency mode uses SoundPool (sounds decoded once, played instantly).
// Vibration: Flutter's built-in HapticFeedback (no extra plugin).
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'engine.dart';

class Sfx {
  static const _volume = {'flap': 0.45, 'score': 0.7, 'star': 0.7, 'hit': 0.8, 'land': 0.6, 'theme': 0.5};
  final _pools = <String, AudioPool>{};

  // last frame's state, to see what changed
  double _flapAt = -10;
  int _score = 0, _stars = 0, _theme = 0;
  bool _dead = false, _landed = false;

  Sfx() {
    final mode = !kIsWeb && defaultTargetPlatform == TargetPlatform.android ? PlayerMode.lowLatency : PlayerMode.mediaPlayer;
    for (final name in _volume.keys) { _load(name, mode); }
  }

  Future<void> _load(String name, PlayerMode mode) async {
    try {
      _pools[name] = await AudioPool.createFromAsset(path: 'sfx/$name.wav', maxPlayers: 3, playerMode: mode);
    } catch (_) {
      // no audio here (tests, a desktop without sound) - stay silent
    }
  }

  void _play(String name) {
    try { _pools[name]?.start(volume: _volume[name]!); } catch (_) {}
  }

  /// Call once per frame. `silent` = benchmark running: track state, make no sound.
  void frame(Game g, {bool silent = false}) {
    final dead = g.phase == Phase.dead;
    final flapped = g.flapAt != _flapAt && g.flapAt >= 0;
    final starred = g.stars > _stars, scored = g.score > _score;
    final themed = g.theme != _theme && scored, hit = dead && !_dead;
    final landed = g.landed && !_landed && dead && _dead;
    _flapAt = g.flapAt; _score = g.score; _stars = g.stars; _theme = g.theme; _dead = dead; _landed = g.landed;
    if (silent) return;
    if (flapped) { _play('flap'); HapticFeedback.lightImpact(); }
    if (starred) { _play('star'); } else if (scored) { _play('score'); HapticFeedback.selectionClick(); }
    if (themed) _play('theme');
    if (hit) { _play('hit'); HapticFeedback.heavyImpact(); }
    if (landed && !hit) _play('land');
  }

  void dispose() { for (final p in _pools.values) { p.dispose(); } }
}
