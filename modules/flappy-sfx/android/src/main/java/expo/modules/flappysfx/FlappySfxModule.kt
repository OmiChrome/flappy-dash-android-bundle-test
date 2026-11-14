package expo.modules.flappysfx

import android.media.AudioAttributes
import android.media.SoundPool
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Low-latency game sounds: Android's SoundPool decodes every clip once into memory and plays it
// from a shared, already-open audio stream. A media player (expo-audio) instead re-opens an audio
// track per play, which on many phones adds ~100-200 ms and can swallow very short clips.
class FlappySfxModule : Module() {
  private var pool: SoundPool? = null
  private val ids = HashMap<String, Int>()

  private fun pool(): SoundPool = pool ?: SoundPool.Builder()
    .setMaxStreams(8)
    .setAudioAttributes(
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_GAME)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
    )
    .build()
    .also { pool = it }

  override fun definition() = ModuleDefinition {
    Name("FlappySfx")

    // uri: a file:// path from expo-asset's downloadAsync()
    Function("load") { name: String, uri: String ->
      val path = Uri.parse(uri).path ?: uri
      ids[name] = pool().load(path, 1)
    }

    Function("play") { name: String, volume: Double ->
      val id = ids[name] ?: return@Function
      val v = volume.toFloat().coerceIn(0f, 1f)
      pool?.play(id, v, v, 1, 0, 1f)
    }

    OnDestroy {
      pool?.release()
      pool = null
      ids.clear()
    }
  }
}
