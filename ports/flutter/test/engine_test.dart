import 'package:flutter_test/flutter_test.dart';
import 'package:flappy_dash/engine.dart';

void main() {
  test('parity with the TypeScript engine (seed 1234, autopilot)', () {
    final g = Game(360, 1234)..bot = true;
    final got = <String>[];
    for (var i = 0; i < 120 * 30; i++) {
      g.tick(1 / 120);
      if (i % 1200 == 1199) got.add('${g.score}/${g.stars}/${g.spawned}');
    }
    expect(got, ['4/0/6', '15/4/13', '23/4/20']);
  });
}
