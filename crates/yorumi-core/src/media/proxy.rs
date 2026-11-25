use std::collections::HashMap;
use std::net::SocketAddr;
use std::time::Duration;

use axum::body::Body;
use axum::extract::State;
use axum::http::{header, HeaderMap, Method, Response, StatusCode, Uri};
use axum::routing::any;
use axum::Router;
use reqwest::header::{HeaderValue, ACCEPT, RANGE, REFERER, USER_AGENT};
use tokio::net::TcpListener;
use tokio::task::JoinHandle;
use url::Url;

use crate::media::demask::demask_mpegts;
use crate::media::manifest::rewrite_hls_manifest;

const DEFAULT_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/// Platform-agnostic HTTP response produced by `proxy_media_request`.
pub struct MediaProxyResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl MediaProxyResponse {
    fn text(status: StatusCode, body: &[u8]) -> Self {
        Self {
            status: status.as_u16(),
            headers: vec![
                ("content-type".to_string(), "text/plain; charset=utf-8".to_string()),
                ("access-control-allow-origin".to_string(), "*".to_string()),
            ],
            body: body.to_vec(),
        }
    }

    pub fn options_ok() -> Self {
        Self {
            status: StatusCode::OK.as_u16(),
            headers: vec![
                ("access-control-allow-origin".to_string(), "*".to_string()),
                (
                    "access-control-allow-methods".to_string(),
                    "GET, HEAD, OPTIONS".to_string(),
                ),
                ("access-control-allow-headers".to_string(), "*".to_string()),
                ("access-control-max-age".to_string(), "86400".to_string()),
            ],
            body: Vec::new(),
        }
    }
}

/// Core proxy logic shared by Tauri's `yorumi-media://` protocol and the local `127.0.0.1` HTTP server.
pub async fn proxy_media_request(
    client: reqwest::Client,
    uri_str: String,
    client_range: Option<String>,
    proxy_prefix_override: Option<String>,
) -> MediaProxyResponse {
    let parsed_uri = match Url::parse(&uri_str).or_else(|_| {
        let prefix = if uri_str.starts_with('/') {
            "http://yorumi-media.localhost"
        } else {
            "http://yorumi-media.localhost/"
        };
        Url::parse(&format!("{}{}", prefix, uri_str))
    }) {
        Ok(u) => u,
        Err(_) => {
            return MediaProxyResponse::text(StatusCode::BAD_REQUEST, b"Invalid media protocol URI");
        }
    };

    let query_pairs: HashMap<String, String> = parsed_uri.query_pairs().into_owned().collect();

    let target_url = match query_pairs.get("url") {
        Some(u) if !u.trim().is_empty() => u.trim().to_string(),
        _ => {
            return MediaProxyResponse::text(
                StatusCode::BAD_REQUEST,
                b"Missing url query parameter",
            );
        }
    };

    let requested_referer = query_pairs.get("referer").map(|s| s.as_str());
    let requested_cookie = query_pairs.get("cookie").map(|s| s.as_str());
    let proxy_media = query_pairs
        .get("proxyMedia")
        .map(|s| s == "1" || s == "true")
        .unwrap_or(false);
    let mask_check = query_pairs
        .get("maskCheck")
        .map(|s| s == "1" || s == "true")
        .unwrap_or(false);
    let requested_audio = query_pairs.get("audio").map(|s| s.as_str());

    let mut referer_candidates = Vec::new();
    if let Some(r) = requested_referer {
        if !r.is_empty() {
            referer_candidates.push(r.to_string());
        }
    }
    if let Ok(target_parsed) = Url::parse(&target_url) {
        let origin = format!("{}/", target_parsed.origin().ascii_serialization());
        if !referer_candidates.contains(&origin) {
            referer_candidates.push(origin);
        }
    }
    if referer_candidates.is_empty() {
        referer_candidates.push("https://megacloud.blog/".to_string());
    }

    let is_m3u8 = target_url.contains(".m3u8");
    let client_range = client_range.as_deref();
    let mut upstream_resp = None;

    for referer in &referer_candidates {
        let timeout_secs = if target_url.contains("hianime.") { 5 } else { 60 };
        let mut req = client
            .get(&target_url)
            .timeout(Duration::from_secs(timeout_secs))
            .header(USER_AGENT, HeaderValue::from_static(DEFAULT_USER_AGENT))
            .header(ACCEPT, HeaderValue::from_static("*/*"))
            .header(
                REFERER,
                HeaderValue::from_str(referer).unwrap_or(HeaderValue::from_static("")),
            );

        if target_url.contains("/api/") || target_url.contains("/ajax/") {
            req = req.header(
                "X-Requested-With",
                HeaderValue::from_static("XMLHttpRequest"),
            );
        }

        if let Some(cookie) = requested_cookie {
            if let Ok(val) = HeaderValue::from_str(cookie) {
                req = req.header("Cookie", val);
            }
        }

        if !is_m3u8 {
            if let Some(range_val) = client_range {
                if let Ok(val) = HeaderValue::from_str(range_val) {
                    req = req.header(RANGE, val);
                }
            }
        }

        match req.send().await {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() || status.as_u16() == 206 {
                    upstream_resp = Some(resp);
                    break;
                }
                if status.as_u16() != 403 && status.as_u16() != 401 {
                    upstream_resp = Some(resp);
                    break;
                }
            }
            Err(_) => continue,
        }
    }

    let resp = match upstream_resp {
        Some(r) => r,
        None => {
            return MediaProxyResponse::text(
                StatusCode::BAD_GATEWAY,
                b"Failed to fetch upstream media stream",
            );
        }
    };

    let status = resp.status();
    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("")
        .to_string();

    let lower_url = target_url.to_lowercase();
    let is_subtitle = lower_url.contains(".vtt") || lower_url.contains(".srt");

    if is_subtitle {
        let sub_content_type = if lower_url.contains(".vtt") {
            "text/vtt; charset=utf-8"
        } else {
            "text/plain; charset=utf-8"
        };
        let body = resp.bytes().await.unwrap_or_default().to_vec();
        return MediaProxyResponse {
            status: StatusCode::OK.as_u16(),
            headers: vec![
                ("content-type".to_string(), sub_content_type.to_string()),
                ("access-control-allow-origin".to_string(), "*".to_string()),
                (
                    "cache-control".to_string(),
                    "no-store, no-cache, must-revalidate".to_string(),
                ),
            ],
            body,
        };
    }

    let is_manifest =
        is_m3u8 || content_type.contains("mpegurl") || content_type.contains("m3u8");

    if is_manifest {
        let body_text = match resp.text().await {
            Ok(t) => t,
            Err(_) => {
                return MediaProxyResponse::text(
                    StatusCode::BAD_GATEWAY,
                    b"Failed to read HLS manifest body",
                );
            }
        };

        let proxy_prefix = proxy_prefix_override.unwrap_or_else(|| {
            let port_part = parsed_uri
                .port()
                .map(|p| format!(":{}", p))
                .unwrap_or_default();
            format!(
                "{}://{}{}/stream",
                parsed_uri.scheme(),
                parsed_uri.host_str().unwrap_or("localhost"),
                port_part
            )
        });

        let rewritten = rewrite_hls_manifest(
            &body_text,
            &target_url,
            requested_referer,
            requested_cookie,
            proxy_media,
            mask_check,
            requested_audio,
            &proxy_prefix,
        );

        return MediaProxyResponse {
            status: StatusCode::OK.as_u16(),
            headers: vec![
                (
                    "content-type".to_string(),
                    "application/vnd.apple.mpegurl".to_string(),
                ),
                ("access-control-allow-origin".to_string(), "*".to_string()),
                (
                    "access-control-expose-headers".to_string(),
                    "Content-Length, Content-Range, Accept-Ranges".to_string(),
                ),
                (
                    "cache-control".to_string(),
                    "no-store, no-cache, must-revalidate".to_string(),
                ),
            ],
            body: rewritten.into_bytes(),
        };
    }

    let upstream_headers = resp.headers().clone();
    let bytes = resp.bytes().await.unwrap_or_default().to_vec();

    // Only scan/demask disguised MPEG-TS segments when explicitly requested by HLS proxy,
    // never on normal manga/cover images (avoids scanning & cloning multi-MB image buffers).
    let is_image_ext = lower_url.ends_with(".jpg")
        || lower_url.ends_with(".jpeg")
        || lower_url.ends_with(".png")
        || lower_url.ends_with(".webp")
        || lower_url.ends_with(".gif")
        || lower_url.contains(".jpg?")
        || lower_url.contains(".jpeg?")
        || lower_url.contains(".png?")
        || lower_url.contains(".webp?");
    let is_plain_image = (content_type.starts_with("image/") || is_image_ext) && !mask_check && !proxy_media;
    let final_bytes = if mask_check || proxy_media {
        demask_mpegts(&bytes).to_vec()
    } else {
        bytes
    };

    let out_content_type = if !is_plain_image && final_bytes.starts_with(&[0x47]) {
        "video/mp2t".to_string()
    } else if content_type.starts_with("image/") {
        content_type
    } else if is_image_ext {
        if lower_url.contains(".png") {
            "image/png".to_string()
        } else if lower_url.contains(".webp") {
            "image/webp".to_string()
        } else if lower_url.contains(".gif") {
            "image/gif".to_string()
        } else {
            "image/jpeg".to_string()
        }
    } else if !content_type.is_empty() {
        content_type
    } else {
        "application/octet-stream".to_string()
    };

    let mut headers = vec![
        ("access-control-allow-origin".to_string(), "*".to_string()),
        (
            "access-control-expose-headers".to_string(),
            "Content-Length, Content-Range, Accept-Ranges".to_string(),
        ),
        ("content-type".to_string(), out_content_type),
        ("content-length".to_string(), final_bytes.len().to_string()),
    ];

    if is_plain_image {
        headers.push((
            "cache-control".to_string(),
            "public, max-age=86400, immutable".to_string(),
        ));
    }

    if let Some(range) = upstream_headers.get("content-range") {
        if let Ok(val) = range.to_str() {
            headers.push(("content-range".to_string(), val.to_string()));
        }
    }
    if let Some(accept) = upstream_headers.get("accept-ranges") {
        if let Ok(val) = accept.to_str() {
            headers.push(("accept-ranges".to_string(), val.to_string()));
        }
    } else {
        headers.push(("accept-ranges".to_string(), "bytes".to_string()));
    }

    MediaProxyResponse {
        status: status.as_u16(),
        headers,
        body: final_bytes,
    }
}

#[derive(Clone)]
struct ProxyServerState {
    client: reqwest::Client,
    base_url: String,
}

/// Lightweight local `127.0.0.1` HTTP server for native players (`libmpv`, Android Media3, iOS AVPlayer).
pub struct LocalMediaProxy {
    addr: SocketAddr,
    task: JoinHandle<()>,
}

impl LocalMediaProxy {
    pub async fn start(client: reqwest::Client) -> Result<Self, std::io::Error> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let addr = listener.local_addr()?;
        let base_url = format!("http://127.0.0.1:{}", addr.port());

        let state = ProxyServerState {
            client,
            base_url: base_url.clone(),
        };

        let app = Router::new()
            .route("/stream", any(handle_axum_stream))
            .route("/health", any(|| async { StatusCode::OK }))
            .with_state(state);

        let task = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });

        Ok(Self { addr, task })
    }

    pub fn port(&self) -> u16 {
        self.addr.port()
    }

    pub fn base_url(&self) -> String {
        format!("http://127.0.0.1:{}", self.addr.port())
    }

    /// Build a ready-to-play local proxy URL for `libmpv`, ExoPlayer/Media3, or AVPlayer.
    pub fn build_stream_url(
        &self,
        target_url: &str,
        referer: Option<&str>,
        proxy_media: bool,
        mask_check: bool,
    ) -> String {
        let mut url = format!(
            "http://127.0.0.1:{}/stream?url={}",
            self.addr.port(),
            urlencoding::encode(target_url)
        );
        if let Some(r) = referer {
            if !r.is_empty() {
                url.push_str(&format!("&referer={}", urlencoding::encode(r)));
            }
        }
        if proxy_media {
            url.push_str("&proxyMedia=1");
        }
        if mask_check {
            url.push_str("&maskCheck=1");
        }
        url
    }
}

impl Drop for LocalMediaProxy {
    fn drop(&mut self) {
        self.task.abort();
    }
}

async fn handle_axum_stream(
    State(state): State<ProxyServerState>,
    method: Method,
    uri: Uri,
    req_headers: HeaderMap,
) -> Response<Body> {
    if method == Method::OPTIONS {
        return to_axum_response(MediaProxyResponse::options_ok());
    }

    let full_uri = format!("{}{}", state.base_url, uri);
    let client_range = req_headers
        .get(header::RANGE)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());
    let prefix = format!("{}/stream", state.base_url);

    let res = proxy_media_request(state.client.clone(), full_uri, client_range, Some(prefix)).await;
    to_axum_response(res)
}

fn to_axum_response(res: MediaProxyResponse) -> Response<Body> {
    let mut builder = Response::builder()
        .status(StatusCode::from_u16(res.status).unwrap_or(StatusCode::OK));
    for (k, v) in res.headers {
        builder = builder.header(k, v);
    }
    builder
        .body(Body::from(res.body))
        .unwrap_or_else(|_| Response::new(Body::empty()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn local_media_proxy_starts_and_responds_health() {
        let client = reqwest::Client::new();
        let proxy = LocalMediaProxy::start(client.clone()).await.unwrap();
        let health_url = format!("{}/health", proxy.base_url());
        let resp = client.get(&health_url).send().await.unwrap();
        assert_eq!(resp.status(), reqwest::StatusCode::OK);

        let stream_url = proxy.build_stream_url(
            "https://example.com/master.m3u8",
            Some("https://megacloud.blog/"),
            true,
            true,
        );
        assert!(stream_url.starts_with(&format!("http://127.0.0.1:{}/stream?url=", proxy.port())));
        assert!(stream_url.contains("proxyMedia=1"));
        assert!(stream_url.contains("maskCheck=1"));
    }
}
