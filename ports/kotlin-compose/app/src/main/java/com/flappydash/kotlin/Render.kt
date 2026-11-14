// Fluffy art drawn with Compose DrawScope. Paths are built once; colours crossfade between themes.
package com.flappydash.kotlin

import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.lerp
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

private fun c(hex: Long) = Color(0xFF000000 or hex)

class Theme(
    val sky: List<Color>, val orb: Color, val orbGlow: Color, val orbY: Float, val moon: Boolean,
    val hillFar: Color, val hillNear: Color, val cloud: Color, val pillarA: Color, val pillarB: Color,
    val pillarLine: Color, val cap: Color, val capShade: Color, val floor: Color, val floorShade: Color,
)

val THEME_LIST = listOf(
    Theme(listOf(c(0x8FD3FF), c(0xC9ECFF), c(0xFFF1F7)), c(0xFFF2A8), c(0xFFF8D6), 120f, false, c(0xC8EBD9), c(0xA6E0C3), c(0xFFFFFF),
        c(0xFFC7DE), c(0xF7A8CB), c(0xC76E98), c(0xFFFFFF), c(0xF2E3F4), c(0xFFFFFF), c(0xEADCF5)),
    Theme(listOf(c(0xFFA9A3), c(0xFFCB9A), c(0xFFE8C2)), c(0xFFE08A), c(0xFFD0A0), 330f, false, c(0xF5B9B5), c(0xEE9EA6), c(0xFFF0E6),
        c(0xC9B6FF), c(0xAE96F5), c(0x7A62C2), c(0xFFF6F0), c(0xF3DCD8), c(0xFFF6F0), c(0xF2D3CF)),
    Theme(listOf(c(0x7F7CD9), c(0xB49BE8), c(0xF2B8D8)), c(0xFFE9F5), c(0xE8C9F5), 130f, true, c(0x9F8FDC), c(0x8A79D0), c(0xEBDDFF),
        c(0x9EE6D3), c(0x7DD3BE), c(0x3F8F7C), c(0xF7F1FF), c(0xDCCDF3), c(0xF4EEFF), c(0xD8C8F2)),
    Theme(listOf(c(0x1E2459), c(0x3A3C8C), c(0x6E5BAF)), c(0xFFF7D1), c(0xB8B6F2), 110f, true, c(0x3A3F86), c(0x2E3270), c(0x7D7BC9),
        c(0xFFD39A), c(0xF5B76E), c(0xA7672A), c(0xE9E5FF), c(0xB9B3EA), c(0xE2DCFF), c(0xACA3E6)),
)

private val BODY = c(0xFFE27A); private val SHADE = c(0xFFC94A); private val BELLY = c(0xFFF6CF)
private val WING = c(0xFFD25E); private val LINE = c(0x6B4A2B); private val BEAK = c(0xFF9A55)
private val INK = c(0x3D2C4E); private val GOLD = c(0xFFD45C); private val BLUSH = c(0xFF8FB1); private val SPARK = c(0xFFF4B0)

private const val TILE = 360f
private const val FLOOR_TILE = 280f

class Art {
    private fun wave(amp: Float, base: Float, phase: Float, freq: Float) = Path().apply {
        moveTo(0f, WORLD_H)
        var x = 0f
        while (x <= TILE) {
            val t = x / TILE * PI.toFloat() * 2
            lineTo(x, base - amp * (0.55f + 0.3f * sin(t * freq + phase) + 0.15f * sin(t * freq * 2 + phase * 3)))
            x += 6f
        }
        lineTo(TILE, WORLD_H); close()
    }
    private fun circle(p: Path, x: Float, y: Float, r: Float) = p.addOval(Rect(x - r, y - r, x + r, y + r))

    val hillFar = wave(78f, FLOOR_Y - 10, 0.2f, 2f)
    val hillNear = wave(52f, FLOOR_Y + 8, 1.4f, 3f)
    val cloud = Path().apply {
        circle(this, 0f, 0f, 20f); circle(this, 24f, -12f, 25f); circle(this, 52f, -4f, 21f); circle(this, 74f, 6f, 15f)
        addRoundRect(RoundRect(-12f, 0f, 86f, 22f, CornerRadius(11f)))
    }
    private fun cap(puffY: Float) = Path().apply {
        addRoundRect(RoundRect(-CAP_W / 2, 0f, CAP_W / 2, CAP_H, CornerRadius(12f)))
        for (i in 0 until 4) circle(this, -CAP_W / 2 + 12 + i * ((CAP_W - 24) / 3), puffY, 11f)
    }
    val capTop = cap(CAP_H - 3)
    val capBot = cap(3f)
    val floorPuffs = Path().apply {
        var x = -14f
        while (x <= FLOOR_TILE + 14) { circle(this, x, FLOOR_Y + 12, 17f); x += 28f }
        addRect(Rect(-14f, FLOOR_Y + 12, FLOOR_TILE + 14, WORLD_H + 20))
    }
    val star = Path().apply {
        for (i in 0 until 10) {
            val a = -PI.toFloat() / 2 + i * PI.toFloat() / 5
            val r = if (i % 2 == 0) 12f else 5.5f
            if (i == 0) moveTo(cos(a) * r, sin(a) * r) else lineTo(cos(a) * r, sin(a) * r)
        }
        close()
    }
    val fluff = Path().apply {
        circle(this, 0f, 0f, 14f)
        for (i in 0 until 13) { val a = i / 13f * PI.toFloat() * 2; circle(this, cos(a) * 12, sin(a) * 11.5f, 6.2f) }
        circle(this, -3f, -18f, 4.2f); circle(this, 2.5f, -19.5f, 3.4f)
    }
    val wing = Path().apply {
        addOval(Rect(-11f, -6f, 7f, 6f)); circle(this, -9f, 3f, 4.5f); circle(this, -4f, 5f, 4.5f)
    }
    val beak = Path().apply { moveTo(12.5f, -3.5f); quadraticTo(24f, -1f, 23f, 2f); quadraticTo(22f, 5f, 12.5f, 6f); close() }
    val bodyBrush = Brush.radialGradient(0f to BODY, 0.45f to BODY, 1f to SHADE, center = Offset(-5f, -7f), radius = 26f)
    val starsXY = FloatArray(34 * 3).also { for (i in 0 until 34) { it[i * 3] = (i * 97.3f) % 520; it[i * 3 + 1] = 18 + (i * 53.7f) % 340; it[i * 3 + 2] = 0.8f + (i * 7 % 3) * 0.55f } }
}

private fun wrap(v: Float, m: Float) = ((v % m) + m) % m

fun DrawScope.drawBird(a: Art, x: Float, y: Float, rot: Float, time: Float, flapAt: Float, squash: Float, dead: Boolean, vy: Float) {
    withTransform({
        translate(x, y); rotate(rot, Offset.Zero)
        val sq = squash * squash
        scale(1 - 0.1f * sq, 1 + 0.13f * sq, Offset.Zero)
    }) {
        drawPath(a.fluff, LINE, style = Stroke(4.4f, join = StrokeJoin.Round))
        drawPath(a.fluff, a.bodyBrush)
        drawOval(BELLY, Offset(-9f, 0f), Size(19f, 13f))
        drawCircle(BLUSH.copy(alpha = 0.55f), 3.6f, Offset(5f, 5.5f))
        if (dead) {
            drawLine(INK, Offset(4f, -8f), Offset(10f, -2f), 2.2f, StrokeCap.Round)
            drawLine(INK, Offset(10f, -8f), Offset(4f, -2f), 2.2f, StrokeCap.Round)
        } else {
            val bt = time % 3.7f
            val open = if (bt < 0.12f) abs(bt - 0.06f) / 0.06f else 1f
            withTransform({ translate(7f, -5f); scale(1f, max(0.12f, open), Offset.Zero) }) {
                drawCircle(Color.White, 5.8f, Offset.Zero)
                drawCircle(LINE, 5.8f, Offset.Zero, style = Stroke(1.8f))
                drawCircle(INK, 3.3f, Offset(1.6f, 0.4f))
                drawCircle(Color.White, 1.25f, Offset(2.6f, -1.1f))
            }
        }
        drawPath(a.beak, LINE, style = Stroke(3.2f, join = StrokeJoin.Round))
        drawPath(a.beak, BEAK)
        val since = time - flapAt
        val wingA = if (dead) -30f else if (since < 0.32f || vy < -60) sin(time * 34) * 32 - 8 else 8 + sin(time * 4) * 4
        withTransform({ translate(-5f, 3f); rotate(wingA, Offset(2f, -1f)) }) {
            drawPath(a.wing, LINE, style = Stroke(3.8f, join = StrokeJoin.Round))
            drawPath(a.wing, WING)
        }
    }
}

fun DrawScope.drawScene(g: Game, a: Art) {
    val k = size.height / WORLD_H
    val w = size.width / k
    val from = THEME_LIST[g.themeFrom]; val to = THEME_LIST[g.theme]; val m = g.themeMix
    fun mix(x: Color, y: Color) = if (m >= 1f) y else lerp(x, y, m)

    scale(k, k, Offset.Zero) {
        val sx = if (g.shake > 0) sin(g.time * 91) * g.shake * g.shake * 7 else 0f
        val sy = if (g.shake > 0) cos(g.time * 77) * g.shake * g.shake * 7 else 0f
        translate(sx, sy) {
            val skyH = FLOOR_Y
            drawRect(Brush.verticalGradient(0f to mix(from.sky[0], to.sky[0]), 0.6f to mix(from.sky[1], to.sky[1]), 1f to mix(from.sky[2], to.sky[2]), endY = skyH), Offset(-20f, -20f), Size(w + 40, WORLD_H + 40))

            val night = (if (from.moon) 1f else 0f) * (1 - m) + (if (to.moon) 1f else 0f) * m
            if (night > 0.01f) {
                var i = 0
                while (i < a.starsXY.size) {
                    val tw = 0.55f + 0.45f * sin(g.time * 2 + i)
                    drawCircle(Color.White.copy(alpha = night * tw * 0.9f), a.starsXY[i + 2], Offset(a.starsXY[i] % w, a.starsXY[i + 1]))
                    i += 3
                }
            }
            val orbY = from.orbY + (to.orbY - from.orbY) * m
            val orbX = w * 0.76f
            val glow = mix(from.orbGlow, to.orbGlow)
            drawCircle(Brush.radialGradient(listOf(glow.copy(alpha = 0.8f), glow.copy(alpha = 0f)), Offset(orbX, orbY), 60f), 60f, Offset(orbX, orbY))
            drawCircle(mix(from.orb, to.orb), 28f, Offset(orbX, orbY))
            if (night > 0.01f) drawCircle(glow.copy(alpha = night), 23f, Offset(orbX + 11, orbY - 7))

            val cloudCol = mix(from.cloud, to.cloud).copy(alpha = 0.92f)
            val span = w + 220
            val clouds = floatArrayOf(40f, 96f, 1f, 7f, 0.08f, 250f, 170f, 0.7f, 5f, 0.06f, 380f, 64f, 0.85f, 9f, 0.1f, 150f, 262f, 0.55f, 4f, 0.05f)
            for (i in clouds.indices step 5) {
                val x = wrap(clouds[i] - g.time * clouds[i + 3] - g.scroll * clouds[i + 4], span) - 110
                withTransform({ translate(x, clouds[i + 1]); scale(clouds[i + 2], clouds[i + 2], Offset.Zero) }) { drawPath(a.cloud, cloudCol) }
            }

            val tiles = ceil(w / TILE).toInt() + 1
            val hf = mix(from.hillFar, to.hillFar); val far = -wrap(g.scroll * 0.18f, TILE)
            for (i in 0 until tiles) translate(far + i * TILE, 0f) { drawPath(a.hillFar, hf) }
            val hn = mix(from.hillNear, to.hillNear); val near = -wrap(g.scroll * 0.42f, TILE)
            for (i in 0 until tiles) translate(near + i * TILE, 0f) { drawPath(a.hillNear, hn) }

            val line = mix(from.pillarLine, to.pillarLine); val cap = mix(from.cap, to.cap); val capShade = mix(from.capShade, to.capShade)
            val pBrush = Brush.horizontalGradient(0f to mix(from.pillarA, to.pillarA), 0.35f to mix(from.pillarA, to.pillarA), 1f to mix(from.pillarB, to.pillarB), startX = -PILLAR_W / 2, endX = PILLAR_W / 2)
            for ((idx, p) in g.pillars.withIndex()) {
                if (!p.on) continue
                val top = p.gapY - p.gap / 2; val bot = p.gapY + p.gap / 2
                translate(p.x, 0f) {
                    for (half in 0..1) {
                        val y0 = if (half == 0) -40f else bot + CAP_H - 4
                        val y1 = if (half == 0) top - CAP_H + 4 else FLOOR_Y + 40
                        drawRoundRect(pBrush, Offset(-PILLAR_W / 2, y0), Size(PILLAR_W, y1 - y0), CornerRadius(12f))
                        drawRoundRect(Color.White.copy(alpha = 0.38f), Offset(-PILLAR_W / 2 + 9, y0), Size(9f, y1 - y0), CornerRadius(4.5f))
                        drawRoundRect(line, Offset(-PILLAR_W / 2, y0), Size(PILLAR_W, y1 - y0), CornerRadius(12f), style = Stroke(2.4f))
                    }
                    for (half in 0..1) {
                        val path = if (half == 0) a.capTop else a.capBot
                        translate(0f, if (half == 0) top - CAP_H else bot) {
                            drawPath(path, line, style = Stroke(4.8f, join = StrokeJoin.Round))
                            drawPath(path, capShade)
                            translate(0f, -3f) { drawPath(path, cap) }
                        }
                    }
                    if (p.star == 1) {
                        val sy = p.gapY + p.starDy + sin(g.time * 3 + idx) * 3
                        drawCircle(Brush.radialGradient(listOf(GOLD.copy(alpha = 0.6f), GOLD.copy(alpha = 0f)), Offset(0f, sy), 22f), 22f, Offset(0f, sy))
                        withTransform({ translate(0f, sy); rotate(sin(g.time * 2.4f + idx) * 14, Offset.Zero) }) {
                            drawPath(a.star, GOLD)
                            drawPath(a.star, Color.White, style = Stroke(2f, join = StrokeJoin.Round))
                        }
                    }
                }
            }

            val fTiles = ceil(w / FLOOR_TILE).toInt() + 1
            val fs = mix(from.floorShade, to.floorShade); val fb = -wrap(g.scroll * 0.75f + 14, FLOOR_TILE)
            for (i in 0 until fTiles) translate(fb + i * FLOOR_TILE, -8f) { drawPath(a.floorPuffs, fs) }
            val fl = mix(from.floor, to.floor); val ff = -wrap(g.scroll, FLOOR_TILE)
            for (i in 0 until fTiles) translate(ff + i * FLOOR_TILE, 4f) { drawPath(a.floorPuffs, fl) }

            val h = max(0f, min(1f, (FLOOR_Y - g.y) / 300))
            drawOval(INK.copy(alpha = 0.16f * (1 - h * 0.7f)), Offset(g.birdX - 18 * (1 - h * 0.5f), FLOOR_Y + 10 - 5f), Size(36 * (1 - h * 0.5f), 10f))

            for (q in g.parts) {
                if (q.life <= 0 || q.kind == P_SPARK) continue
                val t = q.life / q.max
                if (q.kind == P_FLUFF) drawCircle(Color.White.copy(alpha = t * 0.9f), q.size * (1.6f - t * 0.6f), Offset(q.x, q.y))
                else drawOval(SHADE.copy(alpha = min(1f, t * 1.6f)), Offset(q.x - q.size * 1.6f, q.y - q.size * 0.7f), Size(q.size * 3.2f, q.size * 1.4f))
            }
            drawBird(a, g.birdX, g.y, g.rot, g.time, g.flapAt, g.squash, g.phase == DEAD, g.vy)
            for ((i, q) in g.parts.withIndex()) {
                if (q.life <= 0 || q.kind != P_SPARK) continue
                val t = q.life / q.max
                val s = 0.45f * (0.5f + t)
                withTransform({ translate(q.x, q.y); rotate(g.time * 200 + i * 40, Offset.Zero); scale(s, s, Offset.Zero) }) { drawPath(a.star, SPARK.copy(alpha = t)) }
            }
        }
    }
    if (g.flash > 0) drawRect(Color.White.copy(alpha = g.flash * 0.55f))
}
