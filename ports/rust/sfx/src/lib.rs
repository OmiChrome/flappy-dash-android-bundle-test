//! Sound effects + vibration for the native Rust ports. Mirrors src/lib/sfx.ts and the event rules in
//! src/app/play.tsx: feed it `Game::take_events()` once per frame with `on_events`.
//! Audio: the game's 16-bit mono .wav files, mixed in a cpal output stream (AAudio on Android).
//! Vibration (Android only): Vibrator.vibrate through JNI; needs the VIBRATE permission.
use flappy_core::{EV_FLAP, EV_HIT, EV_LAND, EV_SCORE, EV_STAR, EV_THEME};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Sfx { Flap, Score, Star, Hit, Land, Best, Theme }

/// The .wav files, embedded in the binary.
pub const WAVS: [(Sfx, &[u8], f32); 7] = [
    (Sfx::Flap, include_bytes!("../../../../assets/sfx/flap.wav"), 0.45),
    (Sfx::Score, include_bytes!("../../../../assets/sfx/score.wav"), 0.7),
    (Sfx::Star, include_bytes!("../../../../assets/sfx/star.wav"), 0.7),
    (Sfx::Hit, include_bytes!("../../../../assets/sfx/hit.wav"), 0.8),
    (Sfx::Land, include_bytes!("../../../../assets/sfx/land.wav"), 0.6),
    (Sfx::Best, include_bytes!("../../../../assets/sfx/best.wav"), 0.8),
    (Sfx::Theme, include_bytes!("../../../../assets/sfx/theme.wav"), 0.5),
];

/// What a frame's events should sound and feel like: (sounds, vibration in ms or 0).
pub fn reactions(ev: u8) -> (Vec<Sfx>, u32) {
    let mut s = Vec::new();
    let mut buzz = 0;
    if ev & EV_FLAP != 0 { s.push(Sfx::Flap); buzz = 12; }
    if ev & EV_STAR != 0 { s.push(Sfx::Star); } else if ev & EV_SCORE != 0 { s.push(Sfx::Score); buzz = buzz.max(8); }
    if ev & EV_THEME != 0 { s.push(Sfx::Theme); }
    if ev & EV_HIT != 0 { s.push(Sfx::Hit); buzz = 45; }
    if ev & EV_LAND != 0 && ev & EV_HIT == 0 { s.push(Sfx::Land); }
    (s, buzz)
}

/// Plays the sounds and vibration for one frame's events. Cheap when `ev == 0`.
pub fn on_events(ev: u8) {
    if ev == 0 { return; }
    let (sounds, buzz) = reactions(ev);
    for s in sounds { play(s); }
    if buzz > 0 { vibrate(buzz); }
}

/// Decodes a PCM .wav (16-bit) into mono f32 samples + sample rate.
pub fn decode_wav(b: &[u8]) -> Option<(Vec<f32>, u32)> {
    if b.len() < 12 || &b[0..4] != b"RIFF" || &b[8..12] != b"WAVE" { return None; }
    let (mut i, mut rate, mut ch, mut bits) = (12usize, 0u32, 1u16, 16u16);
    while i + 8 <= b.len() {
        let id = &b[i..i + 4];
        let n = u32::from_le_bytes(b[i + 4..i + 8].try_into().ok()?) as usize;
        let body = b.get(i + 8..(i + 8 + n).min(b.len()))?;
        if id == b"fmt " && body.len() >= 16 {
            ch = u16::from_le_bytes([body[2], body[3]]);
            rate = u32::from_le_bytes(body[4..8].try_into().ok()?);
            bits = u16::from_le_bytes([body[14], body[15]]);
        } else if id == b"data" {
            if bits != 16 || rate == 0 { return None; }
            let frames = body.chunks_exact(2 * ch as usize);
            let out = frames.map(|f| i16::from_le_bytes([f[0], f[1]]) as f32 / 32768.0).collect();
            return Some((out, rate));
        }
        i += 8 + n + (n & 1);
    }
    None
}

#[cfg(feature = "audio")]
mod audio {
    use super::*;
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    use std::sync::{Mutex, OnceLock};

    struct Clip { data: Vec<f32>, rate: u32, vol: f32 }
    struct Voice { clip: usize, pos: f64 }
    struct Mixer { clips: Vec<Clip>, voices: Mutex<Vec<Voice>> }

    static MIXER: OnceLock<Option<&'static Mixer>> = OnceLock::new();

    fn mixer() -> Option<&'static Mixer> {
        *MIXER.get_or_init(|| {
            let clips = WAVS.iter().filter_map(|(_, b, v)| decode_wav(b).map(|(data, rate)| Clip { data, rate, vol: *v })).collect();
            let m: &'static Mixer = Box::leak(Box::new(Mixer { clips, voices: Mutex::new(Vec::with_capacity(16)) }));
            // the stream lives on its own thread (it isn't Send on every platform) for the app's lifetime
            let (tx, rx) = std::sync::mpsc::channel();
            std::thread::Builder::new().name("sfx".into()).spawn(move || {
                let ok = start(m).map(|s| { let _ = tx.send(true); s });
                match ok { Some(_stream) => loop { std::thread::park(); }, None => { let _ = tx.send(false); } }
            }).ok()?;
            rx.recv().ok().filter(|ok| *ok).map(|_| m)
        })
    }

    fn start(m: &'static Mixer) -> Option<cpal::Stream> {
        let dev = cpal::default_host().default_output_device()?;
        let cfg = dev.default_output_config().ok()?;
        let (ch, rate) = (cfg.channels() as usize, cfg.sample_rate() as f64);
        let fmt = cfg.sample_format();
        let cfg: cpal::StreamConfig = cfg.into();
        let fill = move |out: &mut [f32]| {
            out.fill(0.0);
            let Ok(mut vs) = m.voices.lock() else { return };
            vs.retain_mut(|v| {
                let c = &m.clips[v.clip];
                let step = c.rate as f64 / rate;
                for frame in out.chunks_mut(ch) {
                    let i = v.pos as usize;
                    if i >= c.data.len() { return false; }
                    let s = c.data[i] * c.vol;
                    for o in frame.iter_mut() { *o += s; }
                    v.pos += step;
                }
                true
            });
            for o in out.iter_mut() { *o = o.clamp(-1.0, 1.0); }
        };
        let err = |e: cpal::Error| eprintln!("sfx stream error: {e}");
        let stream = match fmt {
            cpal::SampleFormat::F32 => dev.build_output_stream(cfg, move |o: &mut [f32], _: &_| fill(o), err, None).ok()?,
            cpal::SampleFormat::I16 => {
                let mut buf = Vec::new();
                dev.build_output_stream(cfg, move |o: &mut [i16], _: &_| {
                    buf.resize(o.len(), 0.0);
                    fill(&mut buf);
                    for (d, s) in o.iter_mut().zip(&buf) { *d = (*s * 32767.0) as i16; }
                }, err, None).ok()?
            }
            _ => return None,
        };
        stream.play().ok()?;
        Some(stream)
    }

    pub fn init() { let _ = mixer(); }

    pub fn play(s: Sfx) {
        let Some(m) = mixer() else { return };
        let Some(clip) = WAVS.iter().position(|(k, _, _)| *k == s) else { return };
        if let Ok(mut vs) = m.voices.lock() {
            if vs.len() >= 12 { vs.remove(0); }
            vs.push(Voice { clip, pos: 0.0 });
        }
    }
}

/// Opens the audio device early so the first flap isn't delayed.
pub fn init() {
    #[cfg(feature = "audio")]
    audio::init();
}

pub fn play(_s: Sfx) {
    #[cfg(feature = "audio")]
    audio::play(_s);
}

#[cfg(target_os = "android")]
mod haptics {
    use jni::objects::{GlobalRef, JObject, JValue};
    use jni::JavaVM;
    use std::sync::OnceLock;

    struct Ctx { vm: JavaVM, vibrator: GlobalRef }
    static CTX: OnceLock<Option<Ctx>> = OnceLock::new();
    static OVERRIDE: OnceLock<(usize, usize)> = OnceLock::new();

    pub unsafe fn use_context(vm: *mut std::ffi::c_void, activity: *mut std::ffi::c_void) {
        let _ = OVERRIDE.set((vm as usize, activity as usize));
    }

    fn ctx() -> Option<&'static Ctx> {
        CTX.get_or_init(|| {
            let (vm, act) = match OVERRIDE.get() {
                Some(&(vm, act)) => (vm as *mut _, act as *mut _),
                None => { let c = ndk_context::android_context(); (c.vm(), c.context()) }
            };
            let vm = unsafe { JavaVM::from_raw(vm.cast()) }.ok()?;
            let vibrator = {
                let mut env = vm.attach_current_thread_permanently().ok()?;
                let activity = unsafe { JObject::from_raw(act.cast()) };
                let name = env.new_string("vibrator").ok()?;
                let v = env.call_method(&activity, "getSystemService", "(Ljava/lang/String;)Ljava/lang/Object;", &[JValue::Object(&name)]).ok()?.l().ok()?;
                if v.is_null() { return None; }
                env.new_global_ref(v).ok()?
            };
            Some(Ctx { vm, vibrator })
        }).as_ref()
    }

    pub fn vibrate(ms: u32) {
        let Some(c) = ctx() else { return };
        let Ok(mut env) = c.vm.attach_current_thread_permanently() else { return };
        // VibrationEffect.createOneShot(ms, DEFAULT_AMPLITUDE) - Android 8+
        let eff = env.call_static_method("android/os/VibrationEffect", "createOneShot", "(JI)Landroid/os/VibrationEffect;", &[JValue::Long(ms as i64), JValue::Int(-1)]);
        let ok = match eff.and_then(|e| e.l()) {
            Ok(e) => env.call_method(c.vibrator.as_obj(), "vibrate", "(Landroid/os/VibrationEffect;)V", &[JValue::Object(&e)]).is_ok(),
            Err(_) => false,
        };
        if !ok || env.exception_check().unwrap_or(false) { let _ = env.exception_clear(); }
    }
}

/// Short vibration (Android only; does nothing elsewhere).
pub fn vibrate(_ms: u32) {
    #[cfg(target_os = "android")]
    haptics::vibrate(_ms);
}

/// For apps whose Android glue doesn't fill `ndk_context` (macroquad): pass the JavaVM and Activity.
///
/// # Safety
/// Both pointers must be valid for the life of the app.
#[allow(unused_variables)]
pub unsafe fn use_android_context(vm: *mut std::ffi::c_void, activity: *mut std::ffi::c_void) {
    #[cfg(target_os = "android")]
    haptics::use_context(vm, activity);
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn decodes_every_wav() {
        for (s, b, _) in WAVS { let (d, r) = decode_wav(b).unwrap_or_else(|| panic!("{s:?}")); assert!(d.len() > 100 && r > 8000); }
    }
    #[test]
    fn rules_match_expo() {
        assert_eq!(reactions(EV_FLAP), (vec![Sfx::Flap], 12));
        assert_eq!(reactions(EV_STAR | EV_SCORE).0, vec![Sfx::Star]);
        assert_eq!(reactions(EV_HIT | EV_LAND), (vec![Sfx::Hit], 45));
    }
}
