package com.flappydash.java;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.SoundPool;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

/**
 * Game sounds + vibration, same rules as the Expo app (src/app/play.tsx). SoundPool decodes each
 * .wav once and plays it on an already-open stream, so taps sound instantly. Call {@link #frame}
 * once per frame with the game state; it works out what happened since the last frame.
 */
final class Sfx {
    private final SoundPool pool = new SoundPool.Builder().setMaxStreams(8).setAudioAttributes(
            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build();
    private final int flap, score, star, hit, land, theme;
    private final Vibrator vibrator;
    private float lastFlapAt = -10;
    private int lastScore, lastStars, lastTheme;
    private boolean lastDead, lastLanded;

    Sfx(Context ctx) {
        flap = pool.load(ctx, R.raw.flap, 1);
        score = pool.load(ctx, R.raw.score, 1);
        star = pool.load(ctx, R.raw.star, 1);
        hit = pool.load(ctx, R.raw.hit, 1);
        land = pool.load(ctx, R.raw.land, 1);
        theme = pool.load(ctx, R.raw.theme, 1);
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager vm = ctx.getSystemService(VibratorManager.class);
            vibrator = vm == null ? null : vm.getDefaultVibrator();
        } else {
            vibrator = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
        }
    }

    private void play(int id, float vol) { pool.play(id, vol, vol, 1, 0, 1f); }

    @SuppressWarnings("deprecation")
    private void buzz(long ms) {
        if (vibrator == null) return;
        if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
        else vibrator.vibrate(ms);
    }

    void frame(Game g, boolean silent) {
        boolean dead = g.phase == Game.DEAD;
        boolean flapped = g.flapAt != lastFlapAt && g.flapAt >= 0;
        boolean starred = g.stars > lastStars, scored = g.score > lastScore;
        boolean themed = g.theme != lastTheme && scored, hitNow = dead && !lastDead;
        boolean landed = g.landed && !lastLanded && dead && lastDead;
        lastFlapAt = g.flapAt; lastScore = g.score; lastStars = g.stars; lastTheme = g.theme; lastDead = dead; lastLanded = g.landed;
        if (silent) return;
        long ms = 0;
        if (flapped) { play(flap, 0.45f); ms = 12; }
        if (starred) play(star, 0.7f); else if (scored) { play(score, 0.7f); ms = Math.max(ms, 8); }
        if (themed) play(theme, 0.5f);
        if (hitNow) { play(hit, 0.8f); ms = 45; }
        if (landed && !hitNow) play(land, 0.6f);
        if (ms > 0) buzz(ms);
    }

    void release() { pool.release(); }
}
