package com.flappydash.crux

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * Game sounds + vibration, same rules as the Expo app (src/app/play.tsx).
 * SoundPool decodes each .wav once and plays it on an already-open stream, so taps sound instantly.
 * Call [events] once per frame with the frame's EV_* bits (from the engine or from [Watch]).
 */
class Sfx(ctx: Context) {
    companion object {
        const val EV_FLAP = 1; const val EV_SCORE = 2; const val EV_STAR = 4
        const val EV_HIT = 8; const val EV_LAND = 16; const val EV_THEME = 32
    }

    private val pool = SoundPool.Builder().setMaxStreams(8).setAudioAttributes(
        AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
    ).build()
    private val flap = pool.load(ctx, R.raw.flap, 1)
    private val score = pool.load(ctx, R.raw.score, 1)
    private val star = pool.load(ctx, R.raw.star, 1)
    private val hit = pool.load(ctx, R.raw.hit, 1)
    private val land = pool.load(ctx, R.raw.land, 1)
    private val theme = pool.load(ctx, R.raw.theme, 1)
    private val vibrator: Vibrator? =
        if (Build.VERSION.SDK_INT >= 31) ctx.getSystemService(VibratorManager::class.java)?.defaultVibrator
        else @Suppress("DEPRECATION") ctx.getSystemService(Vibrator::class.java)

    private fun play(id: Int, vol: Float) { pool.play(id, vol, vol, 1, 0, 1f) }

    private fun buzz(ms: Long) {
        val v = vibrator ?: return
        if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
        else @Suppress("DEPRECATION") v.vibrate(ms)
    }

    fun events(ev: Int) {
        if (ev == 0) return
        var ms = 0L
        if (ev and EV_FLAP != 0) { play(flap, 0.45f); ms = 12 }
        if (ev and EV_STAR != 0) play(star, 0.7f) else if (ev and EV_SCORE != 0) { play(score, 0.7f); ms = maxOf(ms, 8) }
        if (ev and EV_THEME != 0) play(theme, 0.5f)
        if (ev and EV_HIT != 0) { play(hit, 0.8f); ms = 45 }
        if (ev and EV_LAND != 0 && ev and EV_HIT == 0) play(land, 0.6f)
        if (ms > 0) buzz(ms)
    }

    fun release() = pool.release()

    /** Turns frame-to-frame changes of the game state into EV_* bits (for engines without events). */
    class Watch {
        private var flapAt = -10f; private var score = 0; private var stars = 0
        private var dead = false; private var landed = false; private var theme = 0

        fun diff(flapAt: Float, score: Int, stars: Int, dead: Boolean, landed: Boolean, theme: Int): Int {
            var ev = 0
            if (flapAt != this.flapAt && flapAt >= 0f) ev = ev or EV_FLAP
            if (stars > this.stars) ev = ev or EV_STAR
            if (score > this.score) ev = ev or EV_SCORE
            if (theme != this.theme && score > this.score) ev = ev or EV_THEME
            if (dead && !this.dead) ev = ev or EV_HIT
            if (landed && !this.landed && dead && this.dead) ev = ev or EV_LAND
            this.flapAt = flapAt; this.score = score; this.stars = stars; this.dead = dead; this.landed = landed; this.theme = theme
            return ev
        }
    }
}
