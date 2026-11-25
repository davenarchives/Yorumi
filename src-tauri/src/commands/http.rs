use std::collections::HashMap;
use std::time::Duration;
use reqwest::header::{HeaderName, HeaderValue};
use tauri::State;
use crate::state::AppState;

const DEFAULT_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/// Native HTTP GET used by the webview's source adapters (HiAnime / Zoko).
/// Routed through Rust so there is no CORS restriction and `Referer` /
/// `User-Agent` / `X-Requested-With` headers are fully controllable.
#[tauri::command]
pub async fn http_fetch_text(
    url: String,
    headers: Option<HashMap<String, String>>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let client = state.client.client().clone();
    let mut req = client
        .get(&url)
        .timeout(Duration::from_secs(15))
        .header(reqwest::header::USER_AGENT, DEFAULT_USER_AGENT)
        .header(reqwest::header::ACCEPT, "*/*");

    if let Some(map) = headers {
        for (key, value) in map {
            if let (Ok(name), Ok(val)) = (
                HeaderName::from_bytes(key.as_bytes()),
                HeaderValue::from_str(&value),
            ) {
                req = req.header(name, val);
            }
        }
    }

    let resp = req.send().await.map_err(|e| format!("request failed for {}: {}", url, e))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("HTTP {} for {}", status.as_u16(), url));
    }
    resp.text().await.map_err(|e| format!("failed reading body for {}: {}", url, e))
}

/// Native HTTP POST used by the webview's source adapters (AniList / AllManga).
/// Routed through reqwest so there is no CORS restriction and headers like `Referer`
/// and `Origin` are fully controllable.
#[tauri::command]
pub async fn http_fetch_post(
    url: String,
    body: String,
    headers: Option<HashMap<String, String>>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let client = state.client.client().clone();
    let mut has_accept = false;
    let mut has_content_type = false;
    let mut has_user_agent = false;

    let mut req = client
        .post(&url)
        .timeout(Duration::from_secs(20))
        .body(body);

    if let Some(map) = headers {
        for (key, value) in map {
            let lower = key.to_ascii_lowercase();
            if lower == "accept" { has_accept = true; }
            if lower == "content-type" { has_content_type = true; }
            if lower == "user-agent" { has_user_agent = true; }
            if let (Ok(name), Ok(val)) = (
                HeaderName::from_bytes(key.as_bytes()),
                HeaderValue::from_str(&value),
            ) {
                req = req.header(name, val);
            }
        }
    }

    if !has_user_agent {
        req = req.header(reqwest::header::USER_AGENT, DEFAULT_USER_AGENT);
    }
    if !has_accept {
        req = req.header(reqwest::header::ACCEPT, "application/json");
    }
    if !has_content_type {
        req = req.header(reqwest::header::CONTENT_TYPE, "application/json");
    }

    let resp = req.send().await.map_err(|e| format!("POST failed for {}: {}", url, e))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("HTTP {} for {}", status.as_u16(), url));
    }
    resp.text().await.map_err(|e| format!("failed reading body for {}: {}", url, e))
}


