// Flappy Dash engine - port of src/game/engine.ts (see ports/SPEC.md).
package com.flappydash.java;

public final class Game {
    public static final float WORLD_H = 640f, FLOOR_Y = 548f, BIRD_R = 13f, GRAVITY = 1650f, FLAP_V = -455f, MAX_FALL = 720f;
    public static final float PILLAR_W = 66f, CAP_W = 80f, CAP_H = 26f, SPACING = 228f;
    static final float BASE_SPEED = 150f, MAX_SPEED = 205f, BASE_GAP = 184f, MIN_GAP = 150f, EDGE = 58f, MAX_SHIFT = 165f;
    static final float STEP = 1f / 120f;
    public static final int PILLARS = 6, PARTICLES = 64, THEMES = 4;
    public static final int READY = 0, PLAYING = 1, DEAD = 2;
    public static final int P_FLUFF = 0, P_SPARK = 1, P_FEATHER = 2;

    public static final class Pillar {
        public boolean on, passed; public float x, gapY, base, gap = BASE_GAP, amp, freq, phase, starDy; public int star;
    }
    public static final class Particle {
        public float life, max = 1, x, y, vx, vy, size = 1; public int kind;
    }

    public int phase = READY, score, stars, spawned, pNext, theme, themeFrom, seed;
    public float width, birdX, y = WORLD_H * 0.42f, vy, rot, time, scroll, speed = BASE_SPEED, deadFor, flapAt = -10,
            squash, shake, flash, spawnIn, lastGap = -1, themeMix = 1, acc;
    public boolean landed, bot;
    public final Pillar[] pillars = new Pillar[PILLARS];
    public final Particle[] parts = new Particle[PARTICLES];

    public Game(float width, int seed) {
        this.seed = seed;
        setWidth(width);
        for (int i = 0; i < PILLARS; i++) pillars[i] = new Pillar();
        for (int i = 0; i < PARTICLES; i++) parts[i] = new Particle();
    }

    public float rand() {
        seed += 0x6d2b79f5;
        int t = seed;
        t = (t ^ (t >>> 15)) * (t | 1);
        t ^= t + (t ^ (t >>> 7)) * (t | 61);
        return (float) (((t ^ (t >>> 14)) & 0xffffffffL) / 4294967296.0);
    }

    public void reset() {
        phase = READY; y = WORLD_H * 0.42f; vy = 0; rot = 0; speed = BASE_SPEED; score = 0; stars = 0;
        deadFor = 0; flapAt = -10; squash = 0; shake = 0; flash = 0; landed = false; spawnIn = 0; lastGap = -1; spawned = 0;
        themeFrom = theme; theme = 0; themeMix = themeFrom == 0 ? 1 : 0;
        for (Pillar p : pillars) p.on = false;
    }

    public void setWidth(float w) { width = w; birdX = w * 0.3f; }

    static float difficulty(int s) { return Math.min(1f, s / 45f); }

    private void emit(int kind, float x, float y, float vx, float vy, float size, float life) {
        Particle p = parts[pNext];
        pNext = (pNext + 1) % PARTICLES;
        p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.size = size; p.life = life; p.max = life;
    }

    private void puff(int n, int kind, float x, float y, float power) {
        for (int i = 0; i < n; i++) {
            float a = rand() * (float) Math.PI * 2;
            float v = power * (0.35f + rand() * 0.65f);
            emit(kind, x, y, (float) Math.cos(a) * v, (float) Math.sin(a) * v, 2.5f + rand() * 3.5f, 0.45f + rand() * 0.45f);
        }
    }

    public boolean flap() {
        if (phase == DEAD) return false;
        if (phase == READY) { phase = PLAYING; spawnIn = width * 0.55f + 60; }
        vy = FLAP_V; flapAt = time; squash = 1;
        for (int i = 0; i < 3; i++) {
            emit(P_FLUFF, birdX - 12, y + 6, -40 - rand() * 50, 30 + rand() * 60, 2 + rand() * 2.5f, 0.35f + rand() * 0.2f);
        }
        return true;
    }

    public boolean canRestart() { return phase == DEAD && deadFor > 0.6f; }

    private void spawnPillar(float x) {
        Pillar p = null;
        for (Pillar q : pillars) if (!q.on) { p = q; break; }
        if (p == null) return;
        float d = difficulty(score);
        float gap = BASE_GAP - (BASE_GAP - MIN_GAP) * d;
        boolean moving = spawned >= 8 && rand() < 0.2f + 0.4f * d;
        float amp = moving ? 22 + 26 * d : 0;
        float lo = EDGE + gap / 2 + amp, hi = FLOOR_Y - EDGE - gap / 2 - amp, a = lo, b = hi;
        if (lastGap >= 0) {
            a = Math.max(lo, lastGap - MAX_SHIFT); b = Math.min(hi, lastGap + MAX_SHIFT);
            if (a > b) { a = Math.min(hi, Math.max(lo, lastGap)); b = a; }
        }
        float base = a + rand() * (b - a);
        p.on = true; p.x = x; p.base = base; p.gap = gap; p.amp = amp;
        p.freq = 1.1f + rand() * 0.8f;
        p.phase = rand() * (float) Math.PI * 2;
        p.gapY = base + (amp != 0 ? (float) Math.sin(time * p.freq + p.phase) * amp : 0);
        p.passed = false;
        p.star = spawned >= 2 && rand() < 0.34f ? 1 : 0;
        p.starDy = (rand() - 0.5f) * gap * 0.45f;
        lastGap = base;
        spawned++;
    }

    private static boolean circleRect(float cx, float cy, float r, float l, float t, float rr, float b) {
        float nx = cx < l ? l : Math.min(cx, rr), ny = cy < t ? t : Math.min(cy, b);
        float dx = cx - nx, dy = cy - ny;
        return dx * dx + dy * dy < r * r;
    }

    public boolean hitsPillar(Pillar p) {
        float top = p.gapY - p.gap / 2, bot = p.gapY + p.gap / 2, x = birdX, r = BIRD_R;
        if (x + r < p.x - CAP_W / 2 || x - r > p.x + CAP_W / 2) return false;
        return circleRect(x, y, r, p.x - PILLAR_W / 2, -1000, p.x + PILLAR_W / 2, top - CAP_H)
                || circleRect(x, y, r, p.x - PILLAR_W / 2, bot + CAP_H, p.x + PILLAR_W / 2, FLOOR_Y + 100)
                || circleRect(x, y, r - 2, p.x - CAP_W / 2 + 3, top - CAP_H, p.x + CAP_W / 2 - 3, top)
                || circleRect(x, y, r - 2, p.x - CAP_W / 2 + 3, bot, p.x + CAP_W / 2 - 3, bot + CAP_H);
    }

    private void die() {
        phase = DEAD; deadFor = 0; shake = 1; flash = 1; vy = Math.min(vy, -180);
        puff(14, P_FEATHER, birdX, y, 260);
        puff(8, P_FLUFF, birdX, y, 160);
    }

    private void addScore(int n) {
        int before = score / 10;
        score += n;
        speed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * difficulty(score);
        int after = score / 10;
        if (after != before) { themeFrom = theme; theme = after % THEMES; themeMix = 0; }
    }

    public void autopilot() {
        if (phase == READY) { if (time > 0.6f) flap(); return; }
        if (phase != PLAYING) return;
        float target = FLOOR_Y * 0.5f, nearest = 1e9f;
        for (Pillar p : pillars) {
            if (p.on && p.x + CAP_W / 2 + BIRD_R > birdX && p.x < nearest) { nearest = p.x; target = p.gapY + p.gap / 2 - BIRD_R - 18; }
        }
        if (y > target && vy > 0) flap();
    }

    public void tick(float dt) {
        if (bot) autopilot();
        time += dt;
        squash = Math.max(0, squash - dt * 5); shake = Math.max(0, shake - dt * 3.2f); flash = Math.max(0, flash - dt * 5);
        if (themeMix < 1) themeMix = Math.min(1, themeMix + dt / 1.4f);
        for (Particle p : parts) {
            if (p.life <= 0) continue;
            p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.kind == P_FEATHER) { p.vy += 380 * dt; p.vx *= 1 - 2.2f * dt; if (p.vy > 90) p.vy = 90; }
            else { p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt; }
        }
        if (phase == READY) {
            scroll += BASE_SPEED * 0.55f * dt;
            y = WORLD_H * 0.42f + (float) Math.sin(time * 3.2f) * 9;
            rot = (float) Math.sin(time * 3.2f + 1) * 4;
            return;
        }
        if (phase == DEAD) {
            deadFor += dt;
            float floor = FLOOR_Y - BIRD_R;
            if (y < floor) {
                vy = Math.min(vy + GRAVITY * dt, MAX_FALL);
                y = Math.min(y + vy * dt, floor);
                rot = Math.min(100, rot + 420 * dt);
                if (y >= floor && !landed) { landed = true; puff(8, P_FLUFF, birdX, floor + BIRD_R, 120); }
            }
            return;
        }
        vy = Math.min(vy + GRAVITY * dt, MAX_FALL);
        y += vy * dt;
        if (y < BIRD_R) { y = BIRD_R; if (vy < 0) vy = 0; }
        float targetRot = vy < 0 ? -22 : Math.min(85, -22 + (vy / MAX_FALL) * 120);
        rot += (targetRot - rot) * Math.min(1, dt * (vy < 0 ? 18 : 6));
        float dx = speed * dt;
        scroll += dx; spawnIn -= dx;
        if (spawnIn <= 0) { spawnPillar(width + CAP_W); spawnIn += SPACING; }
        for (Pillar p : pillars) {
            if (!p.on) continue;
            p.x -= dx;
            if (p.amp != 0) p.gapY = p.base + (float) Math.sin(time * p.freq + p.phase) * p.amp;
            if (p.x < -CAP_W) { p.on = false; continue; }
            if (p.star == 1) {
                float sy = p.gapY + p.starDy, ddx = birdX - p.x, ddy = y - sy;
                if (ddx * ddx + ddy * ddy < (BIRD_R + 12) * (BIRD_R + 12)) { p.star = 2; stars++; addScore(1); puff(10, P_SPARK, p.x, sy, 170); }
            }
            if (!p.passed && p.x + PILLAR_W / 2 < birdX - BIRD_R) { p.passed = true; addScore(1); puff(5, P_SPARK, birdX + 6, y - 18, 90); }
            if (!bot && hitsPillar(p)) { die(); return; }
        }
        if (y + BIRD_R >= FLOOR_Y) { y = FLOOR_Y - BIRD_R; die(); vy = 0; landed = true; }
    }

    public void advance(float frameDt) {
        acc += Math.min(Math.max(frameDt, 0), 0.1f);
        while (acc >= STEP) { tick(STEP); acc -= STEP; }
    }
}
