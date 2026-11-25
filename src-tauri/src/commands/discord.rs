use serde::Deserialize;
#[cfg(not(mobile))]
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
#[cfg(not(mobile))]
use std::sync::Mutex;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Presence {
    #[serde(rename = "type")] kind: Option<u8>, details: Option<String>, state: Option<String>,
    large_image_key: Option<String>, large_image_text: Option<String>, small_image_key: Option<String>, small_image_text: Option<String>,
    start_timestamp: Option<i64>, end_timestamp: Option<i64>,
}

#[cfg(not(mobile))]
#[derive(Default)]
pub struct DiscordState(pub Mutex<Option<DiscordIpcClient>>);

#[cfg(not(mobile))]
#[tauri::command]
pub async fn update_discord_presence(presence: Presence, client_id: String, state: tauri::State<'_, DiscordState>) -> Result<bool, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        let mut client = DiscordIpcClient::new(&client_id);
        if client.connect().is_err() { return Ok(false); }
        *guard = Some(client);
    }
    let mut act = activity::Activity::new().activity_type(if presence.kind == Some(3) { activity::ActivityType::Watching } else { activity::ActivityType::Playing });
    if let Some(v) = presence.details { act = act.details(v); }
    if let Some(v) = presence.state { act = act.state(v); }
    let mut assets = activity::Assets::new();
    if let Some(v) = presence.large_image_key { assets = assets.large_image(v); }
    if let Some(v) = presence.large_image_text { assets = assets.large_text(v); }
    if let Some(v) = presence.small_image_key { assets = assets.small_image(v); }
    if let Some(v) = presence.small_image_text { assets = assets.small_text(v); }
    act = act.assets(assets);
    let mut times = activity::Timestamps::new();
    if let Some(v) = presence.start_timestamp { times = times.start(v); }
    if let Some(v) = presence.end_timestamp { times = times.end(v); }
    act = act.timestamps(times);
    if guard.as_mut().unwrap().set_activity(act).is_err() { *guard = None; return Ok(false); }
    Ok(true)
}

#[cfg(not(mobile))]
#[tauri::command]
pub async fn clear_discord_presence(state: tauri::State<'_, DiscordState>) -> Result<bool, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(client) = guard.as_mut() {
        if client.clear_activity().is_err() { *guard = None; return Ok(false); }
    }
    Ok(true)
}
