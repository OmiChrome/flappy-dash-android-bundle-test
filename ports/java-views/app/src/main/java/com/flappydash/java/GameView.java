// Custom View: Choreographer frame loop + android.graphics.Canvas drawing. No AndroidX.
package com.flappydash.java;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.Build;
import android.view.Choreographer;
import android.view.MotionEvent;
import android.view.View;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Locale;

import static com.flappydash.java.Game.*;

public final class GameView extends View implements Choreographer.FrameCallback {
    // theme colours: sky0, sky1, sky2, orb, orbGlow, hillFar, hillNear, cloud, pillarA, pillarB, pillarLine, cap, capShade, floor, floorShade
    private static final int[][] THEME = {
        {0x8FD3FF, 0xC9ECFF, 0xFFF1F7, 0xFFF2A8, 0xFFF8D6, 0xC8EBD9, 0xA6E0C3, 0xFFFFFF, 0xFFC7DE, 0xF7A8CB, 0xC76E98, 0xFFFFFF, 0xF2E3F4, 0xFFFFFF, 0xEADCF5},
        {0xFFA9A3, 0xFFCB9A, 0xFFE8C2, 0xFFE08A, 0xFFD0A0, 0xF5B9B5, 0xEE9EA6, 0xFFF0E6, 0xC9B6FF, 0xAE96F5, 0x7A62C2, 0xFFF6F0, 0xF3DCD8, 0xFFF6F0, 0xF2D3CF},
        {0x7F7CD9, 0xB49BE8, 0xF2B8D8, 0xFFE9F5, 0xE8C9F5, 0x9F8FDC, 0x8A79D0, 0xEBDDFF, 0x9EE6D3, 0x7DD3BE, 0x3F8F7C, 0xF7F1FF, 0xDCCDF3, 0xF4EEFF, 0xD8C8F2},
        {0x1E2459, 0x3A3C8C, 0x6E5BAF, 0xFFF7D1, 0xB8B6F2, 0x3A3F86, 0x2E3270, 0x7D7BC9, 0xFFD39A, 0xF5B76E, 0xA7672A, 0xE9E5FF, 0xB9B3EA, 0xE2DCFF, 0xACA3E6},
    };
    private static final float[] ORB_Y = {120, 330, 130, 110};
    private static final boolean[] MOON = {false, false, true, true};
    private static final int LINE = 0xFF6B4A2B, BELLY = 0xFFFFF6CF, WING = 0xFFFFD25E, BEAK = 0xFFFF9A55, INK = 0xFF3D2C4E, GOLD = 0xFFFFD45C, SHADE = 0xFFFFC94A;
    private static final float TILE = 360, FLOOR_TILE = 280;

    private final Game g = new Game(360, (int) System.nanoTime());
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path fluff = new Path(), wing = new Path(), beak = new Path(), cloud = new Path(), capTop = new Path(), capBot = new Path(),
            floorPuffs = new Path(), star = new Path(), hillFar, hillNear;
    private final RadialGradient bodyShader;
    private final RectF rect = new RectF();
    private final SharedPreferences prefs;
    private long lastNs;
    private int best;
    private boolean benchOn;
    private double benchMs;
    private final ArrayList<Double> times = new ArrayList<>(10000);
    private String[] benchResult;

    public GameView(Context ctx) {
        super(ctx);
        prefs = ctx.getSharedPreferences("flappy", Context.MODE_PRIVATE);
        best = prefs.getInt("best", 0);
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeJoin(Paint.Join.ROUND);
        stroke.setStrokeCap(Paint.Cap.ROUND);
        text.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        text.setTextAlign(Paint.Align.CENTER);

        fluff.addCircle(0, 0, 14, Path.Direction.CW);
        for (int i = 0; i < 13; i++) {
            double a = i / 13.0 * Math.PI * 2;
            fluff.addCircle((float) Math.cos(a) * 12, (float) Math.sin(a) * 11.5f, 6.2f, Path.Direction.CW);
        }
        fluff.addCircle(-3, -18, 4.2f, Path.Direction.CW);
        fluff.addCircle(2.5f, -19.5f, 3.4f, Path.Direction.CW);
        wing.addOval(new RectF(-11, -6, 7, 6), Path.Direction.CW);
        wing.addCircle(-9, 3, 4.5f, Path.Direction.CW);
        wing.addCircle(-4, 5, 4.5f, Path.Direction.CW);
        beak.moveTo(12.5f, -3.5f); beak.quadTo(24, -1, 23, 2); beak.quadTo(22, 5, 12.5f, 6); beak.close();
        cloud.addCircle(0, 0, 20, Path.Direction.CW); cloud.addCircle(24, -12, 25, Path.Direction.CW);
        cloud.addCircle(52, -4, 21, Path.Direction.CW); cloud.addCircle(74, 6, 15, Path.Direction.CW);
        cloud.addRoundRect(new RectF(-12, 0, 86, 22), 11, 11, Path.Direction.CW);
        for (int h = 0; h < 2; h++) {
            Path p = h == 0 ? capTop : capBot;
            p.addRoundRect(new RectF(-CAP_W / 2, 0, CAP_W / 2, CAP_H), 12, 12, Path.Direction.CW);
            for (int i = 0; i < 4; i++) p.addCircle(-CAP_W / 2 + 12 + i * ((CAP_W - 24) / 3), h == 0 ? CAP_H - 3 : 3, 11, Path.Direction.CW);
        }
        for (float x = -14; x <= FLOOR_TILE + 14; x += 28) floorPuffs.addCircle(x, FLOOR_Y + 12, 17, Path.Direction.CW);
        floorPuffs.addRect(-14, FLOOR_Y + 12, FLOOR_TILE + 14, WORLD_H + 20, Path.Direction.CW);
        for (int i = 0; i < 10; i++) {
            double a = -Math.PI / 2 + i * Math.PI / 5;
            float r = i % 2 == 0 ? 12 : 5.5f;
            if (i == 0) star.moveTo((float) Math.cos(a) * r, (float) Math.sin(a) * r);
            else star.lineTo((float) Math.cos(a) * r, (float) Math.sin(a) * r);
        }
        star.close();
        hillFar = wave(78, FLOOR_Y - 10, 0.2f, 2);
        hillNear = wave(52, FLOOR_Y + 8, 1.4f, 3);
        bodyShader = new RadialGradient(-5, -7, 26, new int[]{0xFFFFE27A, 0xFFFFE27A, SHADE}, new float[]{0, 0.45f, 1}, Shader.TileMode.CLAMP);
    }

    private static Path wave(float amp, float base, float phase, float freq) {
        Path p = new Path();
        p.moveTo(0, WORLD_H);
        for (float x = 0; x <= TILE; x += 6) {
            double t = x / TILE * Math.PI * 2;
            p.lineTo(x, (float) (base - amp * (0.55 + 0.3 * Math.sin(t * freq + phase) + 0.15 * Math.sin(t * freq * 2 + phase * 3))));
        }
        p.lineTo(TILE, WORLD_H);
        p.close();
        return p;
    }

    @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); Choreographer.getInstance().postFrameCallback(this); }
    @Override protected void onDetachedFromWindow() { Choreographer.getInstance().removeFrameCallback(this); super.onDetachedFromWindow(); }
    @Override protected void onSizeChanged(int w, int h, int ow, int oh) { g.setWidth(w / (h / WORLD_H)); }

    @Override public void doFrame(long ns) {
        double dtMs = lastNs == 0 ? 0 : (ns - lastNs) / 1e6;
        lastNs = ns;
        int before = g.phase;
        g.advance((float) (dtMs / 1000));
        if (benchOn && dtMs > 0) {
            times.add(dtMs);
            benchMs += dtMs;
            if (benchMs >= 60000) { benchOn = false; benchResult = stats(); android.util.Log.i("FlappyBench", "RESULT framework=java-views | " + String.join(" | ", java.util.Arrays.copyOfRange(benchResult, 1, 5))); g.bot = false; g.reset(); }
        }
        if (before != DEAD && g.phase == DEAD && !g.bot && g.score > best) { best = g.score; prefs.edit().putInt("best", best).apply(); }
        invalidate();
        Choreographer.getInstance().postFrameCallback(this);
    }

    private boolean benchButtonHit(float x, float y) {
        return g.phase == READY && benchResult == null && !benchOn && y > getHeight() * 0.78f && y < getHeight() * 0.88f;
    }

    @Override public boolean onTouchEvent(MotionEvent e) {
        if (e.getActionMasked() != MotionEvent.ACTION_DOWN) return true;
        if (benchResult != null) { benchResult = null; return true; }
        if (benchOn) return true;
        if (benchButtonHit(e.getX(), e.getY())) {
            times.clear(); g.reset(); g.seed = 1234; g.time = 0; g.bot = true; benchMs = 0; benchOn = true;
            return true;
        }
        if (g.phase == DEAD) { if (g.canRestart()) g.reset(); } else g.flap();
        return true;
    }

    private static int mix(int a, int b, float t) {
        if (t >= 1) return 0xFF000000 | b;
        int r = (int) (((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);
        int gg = (int) (((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
        int bl = (int) ((a & 255) + ((b & 255) - (a & 255)) * t);
        return 0xFF000000 | (r << 16) | (gg << 8) | bl;
    }

    private int tc(int i) { return mix(THEME[g.themeFrom][i], THEME[g.theme][i], g.themeMix); }
    private static float wrap(float v, float m) { return ((v % m) + m) % m; }

    private void fillColor(int c, float alpha) { fill.setShader(null); fill.setColor(c); fill.setAlpha((int) (alpha * 255)); }

    @Override protected void onDraw(Canvas c) {
        float k = getHeight() / WORLD_H, w = getWidth() / k, m = g.themeMix;
        c.save();
        c.scale(k, k);
        if (g.shake > 0) c.translate((float) Math.sin(g.time * 91) * g.shake * g.shake * 7, (float) Math.cos(g.time * 77) * g.shake * g.shake * 7);

        fill.setShader(new LinearGradient(0, 0, 0, FLOOR_Y, new int[]{tc(0), tc(1), tc(2)}, new float[]{0, 0.6f, 1}, Shader.TileMode.CLAMP));
        fill.setAlpha(255);
        c.drawRect(-20, -20, w + 20, WORLD_H + 20, fill);
        fill.setShader(null);

        float night = (MOON[g.themeFrom] ? 1 : 0) * (1 - m) + (MOON[g.theme] ? 1 : 0) * m;
        if (night > 0.01f) {
            for (int i = 0; i < 34; i++) {
                float tw = 0.55f + 0.45f * (float) Math.sin(g.time * 2 + i * 3);
                fillColor(0xFFFFFFFF, night * tw * 0.9f);
                c.drawCircle(((i * 97.3f) % 520) % w, 18 + (i * 53.7f) % 340, 0.8f + (i * 7 % 3) * 0.55f, fill);
            }
        }
        float orbY = ORB_Y[g.themeFrom] + (ORB_Y[g.theme] - ORB_Y[g.themeFrom]) * m, orbX = w * 0.76f;
        int glow = tc(4);
        fill.setShader(new RadialGradient(orbX, orbY, 60, new int[]{(glow & 0xFFFFFF) | 0xCC000000, glow & 0xFFFFFF}, null, Shader.TileMode.CLAMP));
        c.drawCircle(orbX, orbY, 60, fill);
        fillColor(tc(3), 1);
        c.drawCircle(orbX, orbY, 28, fill);
        if (night > 0.01f) { fillColor(glow, night); c.drawCircle(orbX + 11, orbY - 7, 23, fill); }

        float[] clouds = {40, 96, 1, 7, 0.08f, 250, 170, 0.7f, 5, 0.06f, 380, 64, 0.85f, 9, 0.1f, 150, 262, 0.55f, 4, 0.05f};
        float span = w + 220;
        fillColor(tc(7), 0.92f);
        for (int i = 0; i < clouds.length; i += 5) {
            float x = wrap(clouds[i] - g.time * clouds[i + 3] - g.scroll * clouds[i + 4], span) - 110;
            c.save(); c.translate(x, clouds[i + 1]); c.scale(clouds[i + 2], clouds[i + 2]); c.drawPath(cloud, fill); c.restore();
        }
        int tiles = (int) Math.ceil(w / TILE) + 1;
        fillColor(tc(5), 1);
        float far = -wrap(g.scroll * 0.18f, TILE);
        for (int i = 0; i < tiles; i++) { c.save(); c.translate(far + i * TILE, 0); c.drawPath(hillFar, fill); c.restore(); }
        fillColor(tc(6), 1);
        float near = -wrap(g.scroll * 0.42f, TILE);
        for (int i = 0; i < tiles; i++) { c.save(); c.translate(near + i * TILE, 0); c.drawPath(hillNear, fill); c.restore(); }

        int line = tc(10), cap = tc(11), capShade = tc(12);
        LinearGradient pg = new LinearGradient(-PILLAR_W / 2, 0, PILLAR_W / 2, 0, new int[]{tc(8), tc(8), tc(9)}, new float[]{0, 0.35f, 1}, Shader.TileMode.CLAMP);
        for (int idx = 0; idx < PILLARS; idx++) {
            Pillar p = g.pillars[idx];
            if (!p.on) continue;
            float top = p.gapY - p.gap / 2, bot = p.gapY + p.gap / 2;
            c.save();
            c.translate(p.x, 0);
            for (int h = 0; h < 2; h++) {
                float y0 = h == 0 ? -40 : bot + CAP_H - 4, y1 = h == 0 ? top - CAP_H + 4 : FLOOR_Y + 40;
                rect.set(-PILLAR_W / 2, y0, PILLAR_W / 2, y1);
                fill.setShader(pg); fill.setAlpha(255);
                c.drawRoundRect(rect, 12, 12, fill);
                fillColor(0xFFFFFFFF, 0.38f);
                rect.set(-PILLAR_W / 2 + 9, y0, -PILLAR_W / 2 + 18, y1);
                c.drawRoundRect(rect, 4.5f, 4.5f, fill);
                stroke.setColor(line); stroke.setStrokeWidth(2.4f);
                rect.set(-PILLAR_W / 2, y0, PILLAR_W / 2, y1);
                c.drawRoundRect(rect, 12, 12, stroke);
            }
            stroke.setStrokeWidth(4.8f);
            for (int h = 0; h < 2; h++) {
                Path cp = h == 0 ? capTop : capBot;
                c.save();
                c.translate(0, h == 0 ? top - CAP_H : bot);
                c.drawPath(cp, stroke);
                fillColor(capShade, 1); c.drawPath(cp, fill);
                c.translate(0, -3);
                fillColor(cap, 1); c.drawPath(cp, fill);
                c.restore();
            }
            if (p.star == 1) {
                float sy = p.gapY + p.starDy + (float) Math.sin(g.time * 3 + idx) * 3;
                fill.setShader(new RadialGradient(0, sy, 22, new int[]{0x99FFD45C, 0x00FFD45C}, null, Shader.TileMode.CLAMP));
                fill.setAlpha(255);
                c.drawCircle(0, sy, 22, fill);
                c.save(); c.translate(0, sy); c.rotate((float) Math.sin(g.time * 2.4f + idx) * 14);
                fillColor(GOLD, 1); c.drawPath(star, fill);
                stroke.setColor(0xFFFFFFFF); stroke.setStrokeWidth(2); c.drawPath(star, stroke);
                c.restore();
            }
            c.restore();
        }

        int fTiles = (int) Math.ceil(w / FLOOR_TILE) + 1;
        fillColor(tc(14), 1);
        float fb = -wrap(g.scroll * 0.75f + 14, FLOOR_TILE);
        for (int i = 0; i < fTiles; i++) { c.save(); c.translate(fb + i * FLOOR_TILE, -8); c.drawPath(floorPuffs, fill); c.restore(); }
        fillColor(tc(13), 1);
        float ff = -wrap(g.scroll, FLOOR_TILE);
        for (int i = 0; i < fTiles; i++) { c.save(); c.translate(ff + i * FLOOR_TILE, 4); c.drawPath(floorPuffs, fill); c.restore(); }

        float hh = Math.max(0, Math.min(1, (FLOOR_Y - g.y) / 300));
        fillColor(INK, 0.16f * (1 - hh * 0.7f));
        rect.set(g.birdX - 18 * (1 - hh * 0.5f), FLOOR_Y + 5, g.birdX + 18 * (1 - hh * 0.5f), FLOOR_Y + 15);
        c.drawOval(rect, fill);

        for (Particle q : g.parts) {
            if (q.life <= 0 || q.kind == P_SPARK) continue;
            float t = q.life / q.max;
            if (q.kind == P_FLUFF) { fillColor(0xFFFFFFFF, t * 0.9f); c.drawCircle(q.x, q.y, q.size * (1.6f - t * 0.6f), fill); }
            else { fillColor(SHADE, Math.min(1, t * 1.6f)); rect.set(q.x - q.size * 1.6f, q.y - q.size * 0.7f, q.x + q.size * 1.6f, q.y + q.size * 0.7f); c.drawOval(rect, fill); }
        }
        drawBird(c);
        for (int i = 0; i < PARTICLES; i++) {
            Particle q = g.parts[i];
            if (q.life <= 0 || q.kind != P_SPARK) continue;
            float t = q.life / q.max, s = 0.45f * (0.5f + t);
            c.save(); c.translate(q.x, q.y); c.rotate(g.time * 200 + i * 40); c.scale(s, s);
            fillColor(0xFFFFF4B0, t); c.drawPath(star, fill);
            c.restore();
        }
        c.restore();
        if (g.flash > 0) { fillColor(0xFFFFFFFF, g.flash * 0.55f); c.drawRect(0, 0, getWidth(), getHeight(), fill); }
        drawHud(c);
    }

    private void drawBird(Canvas c) {
        boolean dead = g.phase == DEAD;
        c.save();
        c.translate(g.birdX, g.y);
        c.rotate(g.rot);
        float sq = g.squash * g.squash;
        c.scale(1 - 0.1f * sq, 1 + 0.13f * sq);
        stroke.setColor(LINE); stroke.setStrokeWidth(4.4f); c.drawPath(fluff, stroke);
        fill.setShader(bodyShader); fill.setAlpha(255); c.drawPath(fluff, fill);
        fillColor(BELLY, 1); rect.set(-9, 0, 10, 13); c.drawOval(rect, fill);
        fillColor(0xFFFF8FB1, 0.55f); c.drawCircle(5, 5.5f, 3.6f, fill);
        if (dead) {
            stroke.setColor(INK); stroke.setStrokeWidth(2.2f);
            c.drawLine(4, -8, 10, -2, stroke); c.drawLine(10, -8, 4, -2, stroke);
        } else {
            float bt = g.time % 3.7f, open = bt < 0.12f ? Math.abs(bt - 0.06f) / 0.06f : 1;
            c.save(); c.translate(7, -5); c.scale(1, Math.max(0.12f, open));
            fillColor(0xFFFFFFFF, 1); c.drawCircle(0, 0, 5.8f, fill);
            stroke.setColor(LINE); stroke.setStrokeWidth(1.8f); c.drawCircle(0, 0, 5.8f, stroke);
            fillColor(INK, 1); c.drawCircle(1.6f, 0.4f, 3.3f, fill);
            fillColor(0xFFFFFFFF, 1); c.drawCircle(2.6f, -1.1f, 1.25f, fill);
            c.restore();
        }
        stroke.setColor(LINE); stroke.setStrokeWidth(3.2f); c.drawPath(beak, stroke);
        fillColor(BEAK, 1); c.drawPath(beak, fill);
        float since = g.time - g.flapAt;
        float wingA = dead ? -30 : (since < 0.32f || g.vy < -60) ? (float) Math.sin(g.time * 34) * 32 - 8 : 8 + (float) Math.sin(g.time * 4) * 4;
        c.save(); c.translate(-5, 3); c.rotate(wingA, 2, -1);
        stroke.setStrokeWidth(3.8f); c.drawPath(wing, stroke);
        fillColor(WING, 1); c.drawPath(wing, fill);
        c.restore();
        c.restore();
    }

    private void bubbleText(Canvas c, String s, float x, float y, float size, int color) {
        text.setTextSize(size);
        text.setColor(0xFF9479DB);
        c.drawText(s, x, y + size / 10, text);
        text.setColor(color);
        c.drawText(s, x, y, text);
    }

    private void drawHud(Canvas c) {
        float dp = getResources().getDisplayMetrics().density, cx = getWidth() / 2f, H = getHeight();
        if (benchResult != null) {
            rect.set(24 * dp, H * 0.25f, getWidth() - 24 * dp, H * 0.25f + (40 + 26 * benchResult.length) * dp);
            fillColor(0xFFFFFFFF, 1); c.drawRoundRect(rect, 28 * dp, 28 * dp, fill);
            text.setColor(0xFF4A3763);
            for (int i = 0; i < benchResult.length; i++) {
                text.setTextSize((i == 0 ? 24 : 14) * dp);
                c.drawText(benchResult[i], cx, H * 0.25f + (36 + 26 * i) * dp, text);
            }
            return;
        }
        if (benchOn) { bubbleText(c, String.format(Locale.US, "Benchmark · %ds · ⭐ %d", 60 - (int) (benchMs / 1000), g.score), cx, 60 * dp, 18 * dp, 0xFFFFFFFF); return; }
        if (g.phase == PLAYING) bubbleText(c, String.valueOf(g.score), cx, 110 * dp, 64 * dp, 0xFFFFFFFF);
        else if (g.phase == READY) {
            bubbleText(c, "Flappy", cx, 130 * dp, 56 * dp, 0xFFFFFFFF);
            bubbleText(c, "Dash", cx, 180 * dp, 42 * dp, 0xFFFFD36B);
            bubbleText(c, "Tap to flap · Best " + best, cx, 220 * dp, 18 * dp, 0xFFFFFFFF);
            rect.set(cx - 130 * dp, H * 0.79f, cx + 130 * dp, H * 0.87f);
            fillColor(0xFF55BF98, 1); c.drawRoundRect(rect, 40 * dp, 40 * dp, fill);
            text.setColor(0xFFFFFFFF); text.setTextSize(20 * dp);
            c.drawText("⏱ Benchmark (60 s)", cx, H * 0.83f + 7 * dp, text);
            bubbleText(c, "Java + Android Views", cx, H * 0.92f, 14 * dp, 0xFFFFFFFF);
        } else {
            bubbleText(c, "Game over", cx, H * 0.3f, 44 * dp, 0xFFFFFFFF);
            rect.set(cx - 120 * dp, H * 0.34f, cx + 120 * dp, H * 0.34f + 100 * dp);
            fillColor(0xFFFFFFFF, 1); c.drawRoundRect(rect, 28 * dp, 28 * dp, fill);
            text.setColor(0xFF4A3763); text.setTextSize(30 * dp);
            c.drawText("SCORE " + g.score, cx, H * 0.34f + 45 * dp, text);
            text.setTextSize(20 * dp);
            c.drawText("BEST " + best, cx, H * 0.34f + 80 * dp, text);
            bubbleText(c, "Tap to retry", cx, H * 0.34f + 140 * dp, 20 * dp, 0xFFFFFFFF);
        }
    }

    private String[] stats() {
        ArrayList<Double> t = new ArrayList<>();
        for (double x : times) if (x > 0) t.add(x);
        ArrayList<Double> s = new ArrayList<>(t);
        Collections.sort(s);
        double total = 0;
        for (double x : t) total += x;
        double p50 = pct(s, 50), hzRaw = p50 > 0 ? 1000 / p50 : 60;
        int[] hzs = {30, 48, 50, 60, 72, 75, 90, 120, 144, 165};
        int hz = 60;
        for (int h : hzs) if (Math.abs(h - hzRaw) < Math.abs(hz - hzRaw)) hz = h;
        double interval = 1000.0 / hz;
        int dropped = 0, jank = 0;
        for (double x : t) { long slots = Math.round(x / interval); if (slots > 1) dropped += slots - 1; if (x > interval * 2) jank++; }
        int from = (int) Math.floor(s.size() * 0.99);
        double slow = 0;
        for (int i = from; i < s.size(); i++) slow += s.get(i);
        slow = s.size() > from ? slow / (s.size() - from) : 0;
        double avg = total > 0 ? t.size() * 1000 / total : 0;
        int expected = t.size() + dropped;
        return new String[]{
            "Benchmark",
            String.format(Locale.US, "avg %.1f fps · 1%% low %.0f · dropped %.1f%%", avg, slow > 0 ? 1000 / slow : 0, expected > 0 ? dropped * 100.0 / expected : 0),
            String.format(Locale.US, "display ≈ %d Hz · %d frames in %.1f s", hz, t.size(), total / 1000),
            String.format(Locale.US, "p50 %.1f · p95 %.1f · p99 %.1f · max %.1f ms", p50, pct(s, 95), pct(s, 99), s.isEmpty() ? 0 : s.get(s.size() - 1)),
            String.format(Locale.US, "dropped %d · janky %d", dropped, jank),
            Build.MANUFACTURER + " " + Build.MODEL + " · Android " + Build.VERSION.RELEASE,
            "Java + Android Views · tap to close",
        };
    }

    private static double pct(ArrayList<Double> s, double p) {
        if (s.isEmpty()) return 0;
        int i = (int) Math.min(s.size() - 1, Math.max(0, Math.ceil(p / 100 * s.size()) - 1));
        return s.get(i);
    }
}
