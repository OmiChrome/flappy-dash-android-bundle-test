// Flappy Dash engine - line-by-line port of src/game/engine.ts (see ports/SPEC.md).
package com.flappydash.kotlin

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

const val WORLD_H = 640f
const val FLOOR_Y = 548f
const val BIRD_R = 13f
const val GRAVITY = 1650f
const val FLAP_V = -455f
const val MAX_FALL = 720f
const val PILLAR_W = 66f
const val CAP_W = 80f
const val CAP_H = 26f
const val SPACING = 228f
const val BASE_SPEED = 150f
const val MAX_SPEED = 205f
const val BASE_GAP = 184f
const val MIN_GAP = 150f
private const val EDGE = 58f
private const val MAX_SHIFT = 165f
const val STEP = 1f / 120f
const val PILLARS = 6
const val PARTICLES = 64
const val THEMES = 4

const val READY = 0
const val PLAYING = 1
const val DEAD = 2

const val P_FLUFF = 0
const val P_SPARK = 1
const val P_FEATHER = 2

class Pillar {
    var on = false; var x = 0f; var gapY = 0f; var base = 0f; var gap = BASE_GAP
    var amp = 0f; var freq = 0f; var phase = 0f; var passed = false; var star = 0; var starDy = 0f
}

class Particle {
    var life = 0f; var max = 1f; var x = 0f; var y = 0f; var vx = 0f; var vy = 0f; var size = 1f; var kind = 0
}

class Game(width: Float, var seed: Int) {
    var phase = READY
    var width = width
    var birdX = width * 0.3f
    var y = WORLD_H * 0.42f
    var vy = 0f
    var rot = 0f
    var time = 0f
    var scroll = 0f
    var speed = BASE_SPEED
    var score = 0
    var stars = 0
    var deadFor = 0f
    var flapAt = -10f
    var squash = 0f
    var shake = 0f
    var flash = 0f
    var landed = false
    var spawnIn = 0f
    var lastGap = -1f
    var spawned = 0
    val pillars = Array(PILLARS) { Pillar() }
    val parts = Array(PARTICLES) { Particle() }
    var pNext = 0
    var theme = 0
    var themeFrom = 0
    var themeMix = 1f
    var acc = 0f
    var bot = false

    fun rand(): Float {
        seed += 0x6d2b79f5
        var t = seed
        t = (t xor (t ushr 15)) * (t or 1)
        t = t xor (t + (t xor (t ushr 7)) * (t or 61))
        return (((t xor (t ushr 14)).toLong() and 0xffffffffL).toDouble() / 4294967296.0).toFloat()
    }

    fun reset() {
        phase = READY; y = WORLD_H * 0.42f; vy = 0f; rot = 0f; speed = BASE_SPEED; score = 0; stars = 0
        deadFor = 0f; flapAt = -10f; squash = 0f; shake = 0f; flash = 0f; landed = false
        spawnIn = 0f; lastGap = -1f; spawned = 0
        themeFrom = theme; theme = 0; themeMix = if (themeFrom == 0) 1f else 0f
        pillars.forEach { it.on = false }
    }

    fun resize(w: Float) { width = w; birdX = w * 0.3f }

    private fun difficulty(s: Int) = min(1f, s / 45f)
    private fun gapFor(s: Int) = BASE_GAP - (BASE_GAP - MIN_GAP) * difficulty(s)
    private fun speedFor(s: Int) = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * difficulty(s)

    private fun emit(kind: Int, x: Float, y: Float, vx: Float, vy: Float, size: Float, life: Float) {
        val p = parts[pNext]
        pNext = (pNext + 1) % PARTICLES
        p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.size = size; p.life = life; p.max = life
    }

    private fun puff(n: Int, kind: Int, x: Float, y: Float, power: Float) {
        repeat(n) {
            val a = rand() * PI.toFloat() * 2
            val v = power * (0.35f + rand() * 0.65f)
            emit(kind, x, y, cos(a) * v, sin(a) * v, 2.5f + rand() * 3.5f, 0.45f + rand() * 0.45f)
        }
    }

    fun flap(): Boolean {
        if (phase == DEAD) return false
        if (phase == READY) { phase = PLAYING; spawnIn = width * 0.55f + 60f }
        vy = FLAP_V; flapAt = time; squash = 1f
        repeat(3) {
            emit(P_FLUFF, birdX - 12, y + 6, -40 - rand() * 50, 30 + rand() * 60, 2 + rand() * 2.5f, 0.35f + rand() * 0.2f)
        }
        return true
    }

    fun canRestart() = phase == DEAD && deadFor > 0.6f

    private fun spawnPillar(x: Float) {
        val p = pillars.firstOrNull { !it.on } ?: return
        val gap = gapFor(score)
        val d = difficulty(score)
        val moving = spawned >= 8 && rand() < 0.2f + 0.4f * d
        val amp = if (moving) 22 + 26 * d else 0f
        val lo = EDGE + gap / 2 + amp
        val hi = FLOOR_Y - EDGE - gap / 2 - amp
        var a = lo; var b = hi
        if (lastGap >= 0) {
            a = max(lo, lastGap - MAX_SHIFT); b = min(hi, lastGap + MAX_SHIFT)
            if (a > b) { a = min(hi, max(lo, lastGap)); b = a }
        }
        val base = a + rand() * (b - a)
        p.on = true; p.x = x; p.base = base; p.gap = gap; p.amp = amp
        p.freq = 1.1f + rand() * 0.8f
        p.phase = rand() * PI.toFloat() * 2
        p.gapY = base + if (amp != 0f) sin(time * p.freq + p.phase) * amp else 0f
        p.passed = false
        p.star = if (spawned >= 2 && rand() < 0.34f) 1 else 0
        p.starDy = (rand() - 0.5f) * gap * 0.45f
        lastGap = base
        spawned++
    }

    private fun circleRect(cx: Float, cy: Float, r: Float, l: Float, t: Float, rr: Float, b: Float): Boolean {
        val nx = if (cx < l) l else if (cx > rr) rr else cx
        val ny = if (cy < t) t else if (cy > b) b else cy
        val dx = cx - nx; val dy = cy - ny
        return dx * dx + dy * dy < r * r
    }

    fun hitsPillar(p: Pillar): Boolean {
        val top = p.gapY - p.gap / 2; val bot = p.gapY + p.gap / 2; val x = birdX; val r = BIRD_R
        if (x + r < p.x - CAP_W / 2 || x - r > p.x + CAP_W / 2) return false
        if (circleRect(x, y, r, p.x - PILLAR_W / 2, -1000f, p.x + PILLAR_W / 2, top - CAP_H)) return true
        if (circleRect(x, y, r, p.x - PILLAR_W / 2, bot + CAP_H, p.x + PILLAR_W / 2, FLOOR_Y + 100)) return true
        if (circleRect(x, y, r - 2, p.x - CAP_W / 2 + 3, top - CAP_H, p.x + CAP_W / 2 - 3, top)) return true
        if (circleRect(x, y, r - 2, p.x - CAP_W / 2 + 3, bot, p.x + CAP_W / 2 - 3, bot + CAP_H)) return true
        return false
    }

    private fun die() {
        phase = DEAD; deadFor = 0f; shake = 1f; flash = 1f; vy = min(vy, -180f)
        puff(14, P_FEATHER, birdX, y, 260f)
        puff(8, P_FLUFF, birdX, y, 160f)
    }

    private fun updateParticles(dt: Float) {
        for (p in parts) {
            if (p.life <= 0) continue
            p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt
            if (p.kind == P_FEATHER) {
                p.vy += 380 * dt; p.vx *= 1 - 2.2f * dt
                if (p.vy > 90) p.vy = 90f
            } else {
                p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt
            }
        }
    }

    private fun addScore(n: Int) {
        val before = score / 10
        score += n
        speed = speedFor(score)
        val after = score / 10
        if (after != before) { themeFrom = theme; theme = after % THEMES; themeMix = 0f }
    }

    fun autopilot() {
        if (phase == READY) { if (time > 0.6f) flap(); return }
        if (phase != PLAYING) return
        var target = FLOOR_Y * 0.5f
        var nearest = 1e9f
        for (p in pillars) {
            if (p.on && p.x + CAP_W / 2 + BIRD_R > birdX && p.x < nearest) {
                nearest = p.x; target = p.gapY + p.gap / 2 - BIRD_R - 18
            }
        }
        if (y > target && vy > 0) flap()
    }

    fun tick(dt: Float) {
        if (bot) autopilot()
        time += dt
        squash = max(0f, squash - dt * 5); shake = max(0f, shake - dt * 3.2f); flash = max(0f, flash - dt * 5)
        if (themeMix < 1) themeMix = min(1f, themeMix + dt / 1.4f)
        updateParticles(dt)

        if (phase == READY) {
            scroll += BASE_SPEED * 0.55f * dt
            y = WORLD_H * 0.42f + sin(time * 3.2f) * 9
            rot = sin(time * 3.2f + 1) * 4
            return
        }
        if (phase == DEAD) {
            deadFor += dt
            val floor = FLOOR_Y - BIRD_R
            if (y < floor) {
                vy = min(vy + GRAVITY * dt, MAX_FALL)
                y = min(y + vy * dt, floor)
                rot = min(100f, rot + 420 * dt)
                if (y >= floor && !landed) { landed = true; puff(8, P_FLUFF, birdX, floor + BIRD_R, 120f) }
            }
            return
        }
        vy = min(vy + GRAVITY * dt, MAX_FALL)
        y += vy * dt
        if (y < BIRD_R) { y = BIRD_R; if (vy < 0) vy = 0f }
        val targetRot = if (vy < 0) -22f else min(85f, -22 + (vy / MAX_FALL) * 120)
        rot += (targetRot - rot) * min(1f, dt * (if (vy < 0) 18 else 6))

        val dx = speed * dt
        scroll += dx
        spawnIn -= dx
        if (spawnIn <= 0) { spawnPillar(width + CAP_W); spawnIn += SPACING }

        for (p in pillars) {
            if (!p.on) continue
            p.x -= dx
            if (p.amp != 0f) p.gapY = p.base + sin(time * p.freq + p.phase) * p.amp
            if (p.x < -CAP_W) { p.on = false; continue }
            if (p.star == 1) {
                val sy = p.gapY + p.starDy
                val ddx = birdX - p.x; val ddy = y - sy
                if (ddx * ddx + ddy * ddy < (BIRD_R + 12) * (BIRD_R + 12)) {
                    p.star = 2; stars++; addScore(1); puff(10, P_SPARK, p.x, sy, 170f)
                }
            }
            if (!p.passed && p.x + PILLAR_W / 2 < birdX - BIRD_R) {
                p.passed = true; addScore(1); puff(5, P_SPARK, birdX + 6, y - 18, 90f)
            }
            if (!bot && hitsPillar(p)) { die(); return }
        }
        if (y + BIRD_R >= FLOOR_Y) {
            y = FLOOR_Y - BIRD_R; die(); vy = 0f; landed = true
        }
    }

    fun advance(frameDt: Float) {
        acc += min(max(frameDt, 0f), 0.1f)
        while (acc >= STEP) { tick(STEP); acc -= STEP }
    }
}

/** Frame-time stats, same definitions as src/lib/benchStats.ts. */
data class BenchStats(
    val frames: Int, val seconds: Double, val avgFps: Double, val refreshHz: Int,
    val p50: Double, val p95: Double, val p99: Double, val worst: Double,
    val low1Fps: Double, val dropped: Int, val droppedPct: Double, val jank: Int,
)

fun benchStats(frameMs: List<Double>): BenchStats {
    val t = frameMs.filter { it.isFinite() && it > 0 }
    val sorted = t.sorted()
    fun pct(p: Double): Double = if (sorted.isEmpty()) 0.0 else sorted[min(sorted.size - 1, max(0, kotlin.math.ceil(p / 100 * sorted.size).toInt() - 1))]
    val total = t.sum()
    val p50 = pct(50.0)
    val hzRaw = if (p50 > 0) 1000 / p50 else 60.0
    val hz = listOf(30, 48, 50, 60, 72, 75, 90, 120, 144, 165).minBy { kotlin.math.abs(it - hzRaw) }
    val interval = 1000.0 / hz
    var dropped = 0; var jank = 0
    for (x in t) {
        val slots = kotlin.math.round(x / interval).toInt()
        if (slots > 1) dropped += slots - 1
        if (x > interval * 2) jank++
    }
    val slowest = sorted.drop(floor(sorted.size * 0.99).toInt())
    val slowAvg = if (slowest.isEmpty()) 0.0 else slowest.average()
    val expected = t.size + dropped
    return BenchStats(
        t.size, total / 1000, if (total > 0) t.size * 1000 / total else 0.0, hz,
        p50, pct(95.0), pct(99.0), sorted.lastOrNull() ?: 0.0,
        if (slowAvg > 0) 1000 / slowAvg else 0.0, dropped, if (expected > 0) dropped * 100.0 / expected else 0.0, jank,
    )
}
