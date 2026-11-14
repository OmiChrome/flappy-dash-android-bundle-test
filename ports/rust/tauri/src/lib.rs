//! Flappy Dash - Tauri v2 port. The UI is the Expo web build (HTML/JS/WebAssembly) shown in the
//! system WebView; Rust is only the native shell around it. Same idea as the Capacitor port,
//! but the shell is Rust instead of Java, so the two together show the cost of the shell.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Flappy Dash (Tauri)");
}
