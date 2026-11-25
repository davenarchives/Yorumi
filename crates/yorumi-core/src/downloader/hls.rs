use std::fs::File;
use std::io::Write;
use std::path::Path;
use reqwest::header::{HeaderValue, ACCEPT, ORIGIN, REFERER, USER_AGENT};
use url::Url;

use crate::media::demask_mpegts;

const DEFAULT_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

fn build_origin(referer: &str) -> Option<String> {
    Url::parse(referer)
        .ok()
        .map(|u| u.origin().ascii_serialization())
        .filter(|o| o != "null")
}

/// Downloads an HLS (.m3u8) or direct video stream to `dest_path`.
/// Returns `(total_bytes, is_hls_mpegts)`.
pub async fn download_hls_stream<F>(
    client: &reqwest::Client,
    stream_url: &str,
    referer: Option<&str>,
    dest_path: &Path,
    mut on_progress: F,
) -> Result<(u64, bool), String>
where
    F: FnMut(f32, u64, u64) + Send,
{
    let parsed_stream_url = Url::parse(stream_url).map_err(|e| format!("Invalid stream URL: {}", e))?;
    let default_referer = format!("{}/", parsed_stream_url.origin().ascii_serialization());
    let effective_referer = referer
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&default_referer);
    let effective_origin = build_origin(effective_referer);

    // 1. Fetch playlist or video file
    let mut req = client
        .get(stream_url)
        .header(USER_AGENT, HeaderValue::from_static(DEFAULT_USER_AGENT))
        .header(REFERER, HeaderValue::from_str(effective_referer).unwrap_or(HeaderValue::from_static("")))
        .header(ACCEPT, HeaderValue::from_static("*/*"));
    if let Some(ref origin) = effective_origin {
        if let Ok(val) = HeaderValue::from_str(origin) {
            req = req.header(ORIGIN, val);
        }
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Failed to fetch stream: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Stream server returned HTTP {}", resp.status()));
    }

    let content_type = resp.headers()
        .get("content-type")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("")
        .to_lowercase();

    let looks_like_m3u8 = stream_url.to_lowercase().contains(".m3u8")
        || stream_url.to_lowercase().contains("m3u8")
        || content_type.contains("mpegurl")
        || content_type.contains("x-mpegurl")
        || content_type.contains("vnd.apple.mpegurl");

    // Case A: Direct video file (.mp4, etc.)
    if !looks_like_m3u8 {
        let total_size = resp.content_length().unwrap_or(0);
        let bytes = resp.bytes().await.map_err(|e| format!("Failed to read stream bytes: {}", e))?;
        // Some CDNs serve HLS manifests without .m3u8 extension or mpegurl content-type
        if !bytes.starts_with(b"#EXTM3U") {
            let mut file = File::create(dest_path).map_err(|e| format!("Failed to create destination file: {}", e))?;
            file.write_all(&bytes).map_err(|e| format!("Failed to write file: {}", e))?;
            let len = bytes.len() as u64;
            on_progress(100.0, len, total_size.max(len));
            return Ok((len, false));
        }
        // Detected #EXTM3U body — handle as HLS below
        let manifest_text = String::from_utf8_lossy(&bytes).to_string();
        return download_hls_from_manifest(
            client,
            stream_url,
            &parsed_stream_url,
            manifest_text,
            effective_referer,
            effective_origin.as_deref(),
            dest_path,
            on_progress,
        )
        .await;
    }

    // Case B: HLS .m3u8 Playlist
    let manifest_text = resp.text().await.map_err(|e| format!("Failed to read manifest text: {}", e))?;
    download_hls_from_manifest(
        client,
        stream_url,
        &parsed_stream_url,
        manifest_text,
        effective_referer,
        effective_origin.as_deref(),
        dest_path,
        on_progress,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
async fn download_hls_from_manifest<F>(
    client: &reqwest::Client,
    stream_url: &str,
    parsed_stream_url: &Url,
    manifest_text: String,
    effective_referer: &str,
    effective_origin: Option<&str>,
    dest_path: &Path,
    mut on_progress: F,
) -> Result<(u64, bool), String>
where
    F: FnMut(f32, u64, u64) + Send,
{
    let mut media_manifest_url = stream_url.to_string();
    let mut media_manifest_text = manifest_text;

    // Check if it's a variant master playlist (contains #EXT-X-STREAM-INF)
    if media_manifest_text.contains("#EXT-X-STREAM-INF") {
        let mut best_variant_url: Option<String> = None;
        let mut best_bandwidth: u64 = 0;
        let mut current_bandwidth: u64 = 0;
        let mut next_is_variant = false;

        for line in media_manifest_text.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("#EXT-X-STREAM-INF") {
                next_is_variant = true;
                current_bandwidth = trimmed
                    .split(',')
                    .find_map(|part| part.trim().strip_prefix("BANDWIDTH="))
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(0);
                continue;
            }
            if next_is_variant && !trimmed.is_empty() && !trimmed.starts_with('#') {
                next_is_variant = false;
                if best_variant_url.is_none() || current_bandwidth >= best_bandwidth {
                    best_bandwidth = current_bandwidth;
                    best_variant_url = Some(trimmed.to_string());
                }
            }
        }

        if let Some(variant_line) = best_variant_url {
            let variant_url = parsed_stream_url
                .join(&variant_line)
                .map_err(|e| format!("Failed to resolve variant URL: {}", e))?
                .to_string();

            let mut v_req = client
                .get(&variant_url)
                .header(USER_AGENT, HeaderValue::from_static(DEFAULT_USER_AGENT))
                .header(REFERER, HeaderValue::from_str(effective_referer).unwrap_or(HeaderValue::from_static("")));
            if let Some(origin) = effective_origin {
                if let Ok(val) = HeaderValue::from_str(origin) {
                    v_req = v_req.header(ORIGIN, val);
                }
            }

            let variant_resp = v_req
                .send()
                .await
                .map_err(|e| format!("Failed to fetch variant manifest: {}", e))?;

            if !variant_resp.status().is_success() {
                return Err(format!("Variant manifest returned HTTP {}", variant_resp.status()));
            }

            media_manifest_text = variant_resp.text().await.map_err(|e| format!("Failed to read variant manifest: {}", e))?;
            media_manifest_url = variant_url;
        }
    }

    let parsed_media_url = Url::parse(&media_manifest_url).map_err(|e| format!("Invalid media manifest URL: {}", e))?;

    // Parse segment URLs
    let mut segment_urls = Vec::new();
    for line in media_manifest_text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Ok(abs_url) = parsed_media_url.join(trimmed) {
            segment_urls.push(abs_url.to_string());
        }
    }

    if segment_urls.is_empty() {
        return Err("No playable segments found in HLS manifest".to_string());
    }

    let total_segments = segment_urls.len();
    let mut file = File::create(dest_path).map_err(|e| format!("Failed to create destination file: {}", e))?;
    let mut total_downloaded_bytes = 0u64;

    for (index, segment_url) in segment_urls.into_iter().enumerate() {
        let mut last_err = String::new();
        let mut raw_bytes_opt = None;

        for attempt in 0..3 {
            let mut seg_req = client
                .get(&segment_url)
                .header(USER_AGENT, HeaderValue::from_static(DEFAULT_USER_AGENT))
                .header(REFERER, HeaderValue::from_str(effective_referer).unwrap_or(HeaderValue::from_static("")));
            if let Some(origin) = effective_origin {
                if let Ok(val) = HeaderValue::from_str(origin) {
                    seg_req = seg_req.header(ORIGIN, val);
                }
            }

            match seg_req.send().await {
                Ok(seg_resp) if seg_resp.status().is_success() => {
                    match seg_resp.bytes().await {
                        Ok(bytes) => {
                            raw_bytes_opt = Some(bytes);
                            break;
                        }
                        Err(e) => {
                            last_err = format!("Failed to read segment {}: {}", index, e);
                        }
                    }
                }
                Ok(seg_resp) => {
                    last_err = format!("Segment {} returned HTTP {}", index, seg_resp.status());
                }
                Err(e) => {
                    last_err = format!("Failed to fetch segment {}: {}", index, e);
                }
            }

            if attempt < 2 {
                tokio::time::sleep(std::time::Duration::from_millis(350 * (attempt as u64 + 1))).await;
            }
        }

        let raw_bytes = raw_bytes_opt.ok_or(last_err)?;
        let clean_chunk = demask_mpegts(&raw_bytes);

        file.write_all(clean_chunk).map_err(|e| format!("Failed to write segment {} to disk: {}", index, e))?;
        total_downloaded_bytes += clean_chunk.len() as u64;

        let pct = ((index + 1) as f32 / total_segments as f32) * 100.0;
        on_progress(pct, total_downloaded_bytes, total_downloaded_bytes);
    }

    file.flush().map_err(|e| format!("Failed to flush file: {}", e))?;
    Ok((total_downloaded_bytes, true))
}
