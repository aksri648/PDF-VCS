#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

struct BackendProcess(Mutex<Option<CommandChild>>);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            let sidecar = app
                .shell()
                .sidecar("pdf-vcs-backend")
                .expect("sidecar binary missing")
                .env("PORT", "3001");

            let (mut rx, child) = sidecar.spawn().expect("failed to spawn backend");

            let state = app.state::<BackendProcess>();
            *state.0.lock().unwrap() = Some(child);

            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    if let tauri_plugin_shell::process::CommandEvent::Stdout(line) = &event {
                        eprintln!("[backend] {}", String::from_utf8_lossy(line));
                    }
                    if let tauri_plugin_shell::process::CommandEvent::Stderr(line) = &event {
                        eprintln!("[backend:err] {}", String::from_utf8_lossy(line));
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                let state = app_handle.state::<BackendProcess>();
                if let Some(child) = state.0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
