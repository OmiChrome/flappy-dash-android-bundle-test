package com.flappydash.kotlin

import android.content.Context
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.geometry.Offset

private val INKC = Color(0xFF4A3763)
private val LILAC = Color(0xFF9479DB)
private val PINK = Color(0xFFFF8FB8)
private val MINT = Color(0xFF7FDDBA)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { GameScreen(getSharedPreferences("flappy", Context.MODE_PRIVATE)) }
    }
}

private fun bubble(size: Int) = TextStyle(
    color = Color.White, fontSize = size.sp, fontWeight = FontWeight.Black,
    shadow = Shadow(LILAC, Offset(0f, size / 10f), 1f), textAlign = TextAlign.Center,
)

@Composable
fun GameScreen(prefs: android.content.SharedPreferences) {
    val art = remember { Art() }
    val game = remember { Game(360f, System.nanoTime().toInt()) }
    var frame by remember { mutableLongStateOf(0L) }
    var score by remember { mutableIntStateOf(0) }
    var phase by remember { mutableIntStateOf(READY) }
    var best by remember { mutableIntStateOf(prefs.getInt("best", 0)) }
    var benchOn by remember { mutableStateOf(false) }
    var benchLeft by remember { mutableIntStateOf(0) }
    var benchResult by remember { mutableStateOf<BenchStats?>(null) }
    val times = remember { ArrayList<Double>(10000) }
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val sfx = remember { Sfx(ctx) }
    val watch = remember { Sfx.Watch() }
    DisposableEffect(Unit) { onDispose { sfx.release() } }

    LaunchedEffect(Unit) {
        var last = 0L
        var benchMs = 0.0
        while (true) {
            withFrameNanos { now ->
                val dtMs = if (last == 0L) 0.0 else (now - last) / 1e6
                last = now
                game.advance((dtMs / 1000).toFloat())
                val ev = watch.diff(game.flapAt, game.score, game.stars, game.phase == DEAD, game.landed, game.theme)
                if (!game.bot) sfx.events(ev)
                if (benchOn && dtMs > 0) {
                    times.add(dtMs); benchMs += dtMs
                    benchLeft = 60 - (benchMs / 1000).toInt()
                    if (benchMs >= 60000) {
                        benchOn = false; benchResult = benchStats(times).also { r -> android.util.Log.i("FlappyBench", "RESULT framework=kotlin-compose | avg %.1f fps | 1%% low %.0f | dropped %.1f%% | p50 %.1f | p95 %.1f | p99 %.1f | max %.1f ms | frames %d | display %d Hz".format(r.avgFps, r.low1Fps, r.droppedPct, r.p50, r.p95, r.p99, r.worst, r.frames, r.refreshHz)) }; benchMs = 0.0
                        game.bot = false; game.reset()
                    }
                } else if (!benchOn) benchMs = 0.0
                if (game.score != score) score = game.score
                if (game.phase != phase) {
                    phase = game.phase
                    if (phase == DEAD && !game.bot && game.score > best) { best = game.score; prefs.edit().putInt("best", best).apply() }
                }
                frame++
            }
        }
    }

    Box(
        Modifier.fillMaxSize().background(Color(0xFFC9ECFF))
            .onSizeChanged { game.resize(it.width / (it.height / WORLD_H)) }
            .pointerInput(Unit) {
                awaitEachGesture {
                    awaitFirstDown()
                    if (!game.bot && benchResult == null) {
                        if (game.phase == DEAD) { if (game.canRestart()) game.reset() } else game.flap()
                    }
                }
            },
    ) {
        Canvas(Modifier.fillMaxSize()) {
            @Suppress("UNUSED_EXPRESSION") frame // redraw every frame
            drawScene(game, art)
        }
        Column(Modifier.fillMaxSize().statusBarsPadding().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (benchOn) {
                Text("Benchmark · ${benchLeft}s · ⭐ $score", style = bubble(18))
            } else if (phase == PLAYING) {
                Text("$score", style = bubble(64))
            } else if (phase == READY && benchResult == null) {
                Spacer(Modifier.height(60.dp))
                Text("Flappy", style = bubble(56))
                Text("Dash", style = bubble(42).copy(color = Color(0xFFFFD36B)))
                Spacer(Modifier.height(16.dp))
                Text("Tap to flap · Best $best", style = bubble(18))
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = { times.clear(); game.reset(); game.seed = 1234; game.time = 0f; game.bot = true; benchResult = null; benchOn = true },
                    colors = ButtonDefaults.buttonColors(containerColor = MINT), shape = RoundedCornerShape(50),
                ) { Text("⏱ Benchmark (60 s)", fontWeight = FontWeight.Bold, fontSize = 18.sp) }
                Text("Kotlin + Jetpack Compose", style = bubble(14), modifier = Modifier.padding(top = 10.dp))
            } else if (phase == DEAD) {
                Spacer(Modifier.height(140.dp))
                Text("Game over", style = bubble(44).copy(shadow = Shadow(Color(0xFFE2679A), Offset(0f, 4f), 1f)))
                Spacer(Modifier.height(12.dp))
                Box(Modifier.background(Color.White, RoundedCornerShape(28.dp)).padding(24.dp)) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("SCORE $score", color = INKC, fontSize = 30.sp, fontWeight = FontWeight.Black)
                        Text("BEST $best", color = INKC, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.height(12.dp))
                Text("Tap to retry", style = bubble(20))
            }
            benchResult?.let { r ->
                Spacer(Modifier.height(60.dp))
                Column(
                    Modifier.fillMaxWidth().background(Color.White, RoundedCornerShape(28.dp)).padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text("Benchmark", color = INKC, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text("avg ${"%.1f".format(r.avgFps)} fps · 1% low ${"%.0f".format(r.low1Fps)} · dropped ${"%.1f".format(r.droppedPct)}%", color = INKC, fontSize = 16.sp)
                    Text("display ≈ ${r.refreshHz} Hz · ${r.frames} frames in ${"%.1f".format(r.seconds)} s", color = INKC, fontSize = 14.sp)
                    Text("frame ms p50 ${"%.1f".format(r.p50)} · p95 ${"%.1f".format(r.p95)} · p99 ${"%.1f".format(r.p99)} · max ${"%.1f".format(r.worst)}", color = INKC, fontSize = 14.sp)
                    Text("dropped ${r.dropped} · janky ${r.jank}", color = INKC, fontSize = 14.sp)
                    Text("${Build.MANUFACTURER} ${Build.MODEL} · Android ${Build.VERSION.RELEASE} · Kotlin/Compose", color = Color(0xFF7C6A98), fontSize = 12.sp)
                    Button(onClick = { benchResult = null }, colors = ButtonDefaults.buttonColors(containerColor = PINK), shape = RoundedCornerShape(50)) { Text("Done") }
                }
            }
        }
    }
}
