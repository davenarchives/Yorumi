use futures_util::FutureExt;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use tauri::http::{header, Request, Response, StatusCode};
use tauri::{UriSchemeResponder, Url};
use yorumi_core::media::{proxy_media_request, MediaProxyResponse};

fn to_tauri_response(res: MediaProxyResponse) -> Response<Vec<u8>> {
    let mut builder = Response::builder()
        .status(StatusCode::from_u16(res.status).unwrap_or(StatusCode::OK));
    for (k, v) in res.headers {
        builder = builder.header(k, v);
    }
    let body = res.body;
    builder.body(body.clone()).unwrap_or_else(|_| Response::new(body))
}

fn serve_local_file(uri_str: &str, client_range: Option<&str>) -> Response<Vec<u8>> {
    let parsed = match Url::parse(uri_str) {
        Ok(u) => u,
        Err(_) => {
            return Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(b"Invalid local-file URI".to_vec())
                .unwrap_or_else(|_| Response::new(Vec::new()));
        }
    };

    let file_path = match parsed.query_pairs().find(|(k, _)| k == "path").map(|(_, v)| v.into_owned()) {
        Some(p) if !p.trim().is_empty() => p,
        _ => {
            return Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(b"Missing path parameter".to_vec())
                .unwrap_or_else(|_| Response::new(Vec::new()));
        }
    };

    let path = Path::new(&file_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    if !matches!(ext.as_str(), "mp4" | "ts" | "mkv" | "webm" | "vtt" | "srt" | "m3u8") {
        return Response::builder()
            .status(StatusCode::FORBIDDEN)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(b"Unsupported local media file type".to_vec())
            .unwrap_or_else(|_| Response::new(Vec::new()));
    }

    let mut file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => {
            return Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(b"Local media file not found".to_vec())
                .unwrap_or_else(|_| Response::new(Vec::new()));
        }
    };

    let file_size = match file.metadata() {
        Ok(m) => m.len(),
        Err(_) => 0,
    };

    let content_type = match ext.as_str() {
        "ts" => "video/mp2t",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "vtt" => "text/vtt; charset=utf-8",
        "m3u8" => "application/vnd.apple.mpegurl",
        _ => "video/mp4",
    };

    if let Some(range_header) = client_range {
        if let Some(spec) = range_header.strip_prefix("bytes=") {
            let mut parts = spec.split('-');
            let start_str = parts.next().unwrap_or("").trim();
            let end_str = parts.next().unwrap_or("").trim();

            if let Ok(start) = start_str.parse::<u64>() {
                if start < file_size {
                    let max_chunk = 8 * 1024 * 1024; // Cap per-range chunk at 8 MB for smooth seeking
                    let requested_end = end_str
                        .parse::<u64>()
                        .ok()
                        .map(|e| e.min(file_size.saturating_sub(1)))
                        .unwrap_or_else(|| (start + max_chunk - 1).min(file_size.saturating_sub(1)));
                    let end = requested_end.max(start);
                    let length = (end - start + 1) as usize;
                    let mut buf = vec![0u8; length];
                    if file.seek(SeekFrom::Start(start)).is_ok() && file.read_exact(&mut buf).is_ok() {
                        return Response::builder()
                            .status(StatusCode::PARTIAL_CONTENT)
                            .header(header::CONTENT_TYPE, content_type)
                            .header(header::ACCEPT_RANGES, "bytes")
                            .header(header::CONTENT_LENGTH, length.to_string())
                            .header(
                                header::CONTENT_RANGE,
                                format!("bytes {}-{}/{}", start, end, file_size),
                            )
                            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                            .body(buf)
                            .unwrap_or_else(|_| Response::new(Vec::new()));
                    }
                }
            }
        }
    }

    let mut buf = Vec::with_capacity(file_size.min(64 * 1024 * 1024) as usize);
    if file.read_to_end(&mut buf).is_err() {
        return Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(b"Failed to read local media file".to_vec())
            .unwrap_or_else(|_| Response::new(Vec::new()));
    }

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_LENGTH, buf.len().to_string())
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(buf)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

/// Backwards-compatible wrapper used by integration tests.
pub async fn proxy_request(
    client: reqwest::Client,
    uri_str: String,
    client_range: Option<String>,
) -> Response<Vec<u8>> {
    to_tauri_response(proxy_media_request(client, uri_str, client_range, None).await)
}

pub fn handle_media_protocol(
    client: reqwest::Client,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    if request.method() == tauri::http::Method::OPTIONS {
        responder.respond(to_tauri_response(MediaProxyResponse::options_ok()));
        return;
    }

    let uri_str = request.uri().to_string();
    let is_local_file = request.uri().path() == "/local-file" || uri_str.contains("/local-file?");
    let client_range = request
        .headers()
        .get(header::RANGE)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    if is_local_file {
        tauri::async_runtime::spawn_blocking(move || {
            let res = serve_local_file(&uri_str, client_range.as_deref());
            responder.respond(res);
        });
        return;
    }

    tauri::async_runtime::spawn(async move {
        let res = match std::panic::AssertUnwindSafe(proxy_media_request(
            client,
            uri_str,
            client_range,
            None,
        ))
        .catch_unwind()
        .await
        {
            Ok(response) => to_tauri_response(response),
            Err(e) => {
                eprintln!("[MediaProxy] Panic caught in proxy_media_request: {:?}", e);
                Response::builder()
                    .status(StatusCode::BAD_GATEWAY)
                    .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
                    .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .body(b"Media proxy internal error".to_vec())
                    .unwrap_or_else(|_| Response::new(b"Media proxy internal error".to_vec()))
            }
        };
        responder.respond(res);
    });
}
