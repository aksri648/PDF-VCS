#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;

use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, RunEvent, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::oneshot;
use tokio::time::timeout;

#[derive(Default)]
struct BackendState(Mutex<Option<CommandChild>>);

#[derive(Clone, Serialize)]
struct LogEvent {
    stream: &'static str,
    line: String,
}

const READY_MARKER: &str = "MongoDB connected";
const STARTUP_TIMEOUT_SECS: u64 = 30;

#[tauri::command]
fn get_config(app: AppHandle) -> config::Config {
    config::read(&app)
}

#[tauri::command]
fn save_config(app: AppHandle, cfg: config::Config) -> Result<(), String> {
    config::write(&app, &cfg).map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_backend(
    app: AppHandle,
    state: State<'_, BackendState>,
    uri: String,
) -> Result<(), String> {
    if state.0.lock().unwrap().is_some() {
        return Err("backend already running".into());
    }

    let sidecar = app
        .shell()
        .sidecar("pdf-vcs-backend")
        .map_err(|e| format!("sidecar binary missing: {e}"))?
        .env("MONGODB_URI", &uri)
        .env("PORT", "3001");

    let (mut rx, child) = sidecar.spawn().map_err(|e| format!("failed to spawn backend: {e}"))?;
    *state.0.lock().unwrap() = Some(child);

    let (ready_tx, ready_rx) = oneshot::channel::<Result<(), String>>();
    let app_for_task = app.clone();

    tauri::async_runtime::spawn(async move {
        let mut ready_tx = Some(ready_tx);
        let mut stderr_tail: Vec<String> = Vec::new();

        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).to_string();
                    let _ = app_for_task.emit("backend://log", LogEvent { stream: "stdout", line: line.clone() });
                    if line.contains(READY_MARKER) {
                        if let Some(tx) = ready_tx.take() {
                            let _ = tx.send(Ok(()));
                        }
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).to_string();
                    let _ = app_for_task.emit("backend://log", LogEvent { stream: "stderr", line: line.clone() });
                    stderr_tail.push(line);
                    if stderr_tail.len() > 50 {
                        stderr_tail.remove(0);
                    }
                }
                CommandEvent::Terminated(payload) => {
                    let code = payload.code.map(|c| c.to_string()).unwrap_or_else(|| "?".into());
                    let summary = if stderr_tail.is_empty() {
                        format!("backend exited (code {code}) before reporting a successful connection")
                    } else {
                        format!("backend exited (code {code}):\n{}", stderr_tail.join(""))
                    };
                    let _ = app_for_task.emit("backend://exited", &summary);
                    if let Some(tx) = ready_tx.take() {
                        let _ = tx.send(Err(summary));
                    }
                    if let Some(state) = app_for_task.try_state::<BackendState>() {
                        *state.0.lock().unwrap() = None;
                    }
                    break;
                }
                _ => {}
            }
        }
    });

    match timeout(Duration::from_secs(STARTUP_TIMEOUT_SECS), ready_rx).await {
        Ok(Ok(Ok(()))) => Ok(()),
        Ok(Ok(Err(msg))) => {
            kill_child(&state);
            Err(msg)
        }
        Ok(Err(_)) => {
            kill_child(&state);
            Err("backend ready channel dropped".into())
        }
        Err(_) => {
            kill_child(&state);
            Err(format!(
                "timed out after {STARTUP_TIMEOUT_SECS}s waiting for the backend to connect to MongoDB"
            ))
        }
    }
}

#[tauri::command]
fn stop_backend(state: State<'_, BackendState>) {
    kill_child(&state);
}

#[tauri::command]
async fn restart_backend(
    app: AppHandle,
    state: State<'_, BackendState>,
    uri: String,
) -> Result<(), String> {
    kill_child(&state);
    // give the OS a moment to release the port
    tokio::time::sleep(Duration::from_millis(300)).await;
    start_backend(app, state, uri).await
}

fn kill_child(state: &State<'_, BackendState>) {
    if let Some(child) = state.0.lock().unwrap().take() {
        let _ = child.kill();
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BackendState::default())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            start_backend,
            stop_backend,
            restart_backend,
        ])
        .build(tauri::generate_context!())
        .expect("error while building application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                let state = app_handle.state::<BackendState>();
                if let Some(child) = state.0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
