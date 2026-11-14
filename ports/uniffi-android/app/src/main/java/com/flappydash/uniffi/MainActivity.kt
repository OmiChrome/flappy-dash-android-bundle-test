// Flappy Dash - UniFFI port. The game runs in Rust (ports/rust/core via ports/rust/uniffi);
// Kotlin + Compose only draws the shapes Rust returns each frame.
package com.flappydash.uniffi

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import uniffi.flappy_uniffi.Engine
import uniffi.flappy_uniffi.Frame

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { GameScreen() }
    }
}

@Composable
fun GameScreen() {
    val engine = remember { Engine(System.nanoTime().toInt()) }
    var frame by remember { mutableStateOf<Frame?>(null) }
    var size by remember { mutableStateOf(androidx.compose.ui.unit.IntSize(1, 1)) }

    LaunchedEffect(Unit) {
        var last = 0L
        while (true) {
            withFrameNanos { now ->
                val dt = if (last == 0L) 0.0 else (now - last) / 1e6
                last = now
                val k = size.height / 640f
                frame = engine.frame(dt, size.width / k)
            }
        }
    }

    Box(
        Modifier.fillMaxSize().background(Color(0xFFC9ECFF))
            .onSizeChanged { size = it }
            .pointerInput(Unit) { awaitEachGesture { awaitFirstDown(); engine.tap() } },
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val f = frame ?: return@Canvas
            val k = this.size.height / 640f
            for (s in f.shapes) {
                val c = Color(0xFF000000L or s.color.toLong()).copy(alpha = s.alpha.coerceIn(0f, 1f))
                if (s.round) drawCircle(c, s.w / 2 * k, Offset(s.x * k, s.y * k))
                else drawRect(c, Offset(s.x * k, s.y * k), Size(s.w * k, s.h * k))
            }
        }
        val f = frame
        Column(Modifier.fillMaxSize().statusBarsPadding().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            val white = Color.White
            when {
                f == null -> {}
                f.result != null -> Column(Modifier.fillMaxWidth().padding(top = 120.dp).background(Color.White, RoundedCornerShape(28.dp)).padding(20.dp)) {
                    f.result!!.forEach { Text(it, color = Color(0xFF4A3763), fontSize = 14.sp) }
                }
                f.benchOn -> Text("Benchmark · ${f.benchLeft}s · ⭐ ${f.score}", color = white, fontSize = 18.sp, fontWeight = FontWeight.Black)
                f.phase.toInt() == 1 -> Text("${f.score}", color = white, fontSize = 64.sp, fontWeight = FontWeight.Black)
                f.phase.toInt() == 0 -> {
                    Spacer(Modifier.height(60.dp))
                    Text("Flappy Dash", color = white, fontSize = 48.sp, fontWeight = FontWeight.Black)
                    Text("Tap to flap · Best ${f.best}", color = white, fontSize = 18.sp)
                    Spacer(Modifier.weight(1f))
                    Button(onClick = { engine.startBench() }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF55BF98)), shape = RoundedCornerShape(50)) {
                        Text("⏱ Benchmark (60 s)", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    }
                    Text("UniFFI · Rust engine + Kotlin UI", color = white, fontSize = 14.sp, modifier = Modifier.padding(top = 10.dp))
                }
                else -> {
                    Spacer(Modifier.height(160.dp))
                    Text("Game over", color = white, fontSize = 44.sp, fontWeight = FontWeight.Black)
                    Text("Score ${f.score} · Best ${f.best} · tap to retry", color = white, fontSize = 18.sp)
                }
            }
        }
    }
}
