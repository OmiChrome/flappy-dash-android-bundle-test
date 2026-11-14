# Flappy Dash: port spec

Every port reimplements the **same game** so that size and performance numbers compare like with like. The reference implementation is `src/game/engine.ts`. Port it line by line.

## Must match exactly
- **World:** 640 units tall. Width is `screenWidth / (screenHeight / 640)`. The floor is at `y = 548` (floor height 92).
- **Physics:** fixed step `1/120 s` with an accumulator. The frame delta is clamped to `0.1 s`. Gravity 1650, flap velocity −455, max fall 720. The bird hitbox radius is 13 and `birdX = width * 0.3`.
- **Pillars:** width 66; cap 80 × 26; spacing 228; pool of 6.
  - Speed is `150 + 55 * d` and gap is `184 - 34 * d`, where `d = min(1, score / 45)`.
  - Gap edge margin is 58 and the max centre shift between neighbours is 165.
  - From the 8th pillar on, a pillar moves with probability `0.2 + 0.4 d`, amplitude `22 + 26 d`, frequency `1.1 + rand * 0.8`, and a random phase.
  - A star appears from the 3rd pillar on with probability 0.34, offset `(rand - 0.5) * gap * 0.45`. A star is worth +1 point and +1 star.
- **RNG:** mulberry32 seeded from `seed`, consumed in the same order as `engine.ts`. Particles also call `rand`, so emit them identically or the course diverges.
- **Ceiling:** soft (clamp `y >= 13`). The floor and pillars kill.
- **Themes:** 4 skies that switch every 10 points (Morning, Sunset, Twilight, Starry). Colours are in `src/game/look.ts`.
- **Autopilot (benchmark):** seed **1234**, 60 s, bird invincible on pillars. The flap rule:
  `target = nearestPillarAhead.gapY + gap/2 - 13 - 18` (or `548 * 0.5` if none); flap when `y > target && vy > 0`.
  During the ready phase, flap once `time > 0.6`.
- **Benchmark stats:** record every frame's delta in ms. Report frames, avg fps, display Hz (nearest of 30/48/50/60/72/75/90/120/144/165 to `1000 / p50`), p50/p95/p99/max, 1% low fps (mean of the slowest 1%), dropped frames (`round(dt / interval) - 1` summed), and jank (frames over 2× the interval). See `src/lib/benchStats.ts`.

## Minimum feature set per port
- Fluffy art drawn with the framework's own 2D API: gradient sky, sun/moon, clouds, hills, rounded pillars with puffy caps, a puffy floor, and the round fluffy bird with eye, beak, wing and blush.
- Ready → playing → game over, tap to flap, tap to retry, score display, and a best score saved on the device.
- A **Benchmark** button on the ready screen that runs the 60 s autopilot and shows the stats on screen.
- Package id: `com.flappydash.<framework>`, so all ports can be installed side by side.

The Expo app also has menus, a leaderboard and settings. Ports skip those, because the benchmark measures the game loop and rendering.
