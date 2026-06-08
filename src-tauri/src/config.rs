use std::fs;
use std::io;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mongo_uri: Option<String>,
}

fn config_dir(app: &AppHandle) -> io::Result<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn config_path(app: &AppHandle) -> io::Result<PathBuf> {
    Ok(config_dir(app)?.join("config.json"))
}

pub fn read(app: &AppHandle) -> Config {
    let Ok(path) = config_path(app) else {
        return Config::default();
    };
    match fs::read_to_string(&path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => Config::default(),
    }
}

pub fn write(app: &AppHandle, cfg: &Config) -> io::Result<()> {
    let path = config_path(app)?;
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_string_pretty(cfg)
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
    fs::write(&tmp, json)?;
    fs::rename(&tmp, &path)?;
    Ok(())
}
