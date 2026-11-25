use regex::Regex;
use url::Url;

/// Rewrites an HLS M3U8 manifest so that sub-playlists, video segments, and encryption
/// keys are fetched through the `yorumi-media` proxy with spoofed headers.
pub fn rewrite_hls_manifest(
    manifest_body: &str,
    target_url: &str,
    referer: Option<&str>,
    cookie: Option<&str>,
    proxy_media_segments: bool,
    mask_check: bool,
    requested_audio: Option<&str>,
    proxy_prefix: &str,
) -> String {
    let parsed_target = Url::parse(target_url).ok();
    let uri_regex = Regex::new(r#"URI=["']([^"']+)["']"#).unwrap();
    let audio_regex = Regex::new(r"(?i)#EXT-X-MEDIA:TYPE=AUDIO[^\n]*").unwrap();
    let lang_regex = Regex::new(r#"(?i)\bLANGUAGE=["']?([^"',]+)["']?"#).unwrap();

    let next_referer = referer
        .map(|r| r.to_string())
        .or_else(|| parsed_target.as_ref().map(|u| format!("{}/", u.origin().ascii_serialization())))
        .unwrap_or_default();

    // 1. Optional audio filter
    let filtered_body = if let Some(audio_lang) = requested_audio {
        let clean_lang = audio_lang.trim().to_lowercase();
        if clean_lang.len() >= 2 && clean_lang.len() <= 3 {
            let mut matched = false;
            let replaced = audio_regex.replace_all(manifest_body, |caps: &regex::Captures| {
                let line = caps.get(0).unwrap().as_str();
                if let Some(l_cap) = lang_regex.captures(line) {
                    if let Some(lang) = l_cap.get(1) {
                        if lang.as_str().to_lowercase() == clean_lang {
                            matched = true;
                            return line
                                .replace("DEFAULT=NO", "DEFAULT=YES")
                                .replace("AUTOSELECT=NO", "AUTOSELECT=YES");
                        }
                    }
                }
                String::new()
            });
            if matched {
                replaced.to_string()
            } else {
                manifest_body.to_string()
            }
        } else {
            manifest_body.to_string()
        }
    } else {
        manifest_body.to_string()
    };

    let build_proxy_link = |abs_url: &str| -> String {
        let mut link = format!("{}?url={}", proxy_prefix, urlencoding::encode(abs_url));
        if !next_referer.is_empty() {
            link.push_str(&format!("&referer={}", urlencoding::encode(&next_referer)));
        }
        if let Some(c) = cookie {
            if !c.is_empty() {
                link.push_str(&format!("&cookie={}", urlencoding::encode(c)));
            }
        }
        if proxy_media_segments {
            link.push_str("&proxyMedia=1");
        }
        if mask_check {
            link.push_str("&maskCheck=1");
        }
        if let Some(a) = requested_audio {
            if !a.is_empty() {
                link.push_str(&format!("&audio={}", urlencoding::encode(a)));
            }
        }
        link
    };

    let mut output_lines = Vec::new();

    for line in filtered_body.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            output_lines.push(String::new());
            continue;
        }

        // Tag line with URI (e.g. #EXT-X-KEY:METHOD=AES-128,URI="enc.key" or #EXT-X-MEDIA:TYPE=AUDIO,...,URI="...")
        if trimmed.starts_with('#') {
            if trimmed.contains("URI=") {
                let rewritten = uri_regex.replace_all(trimmed, |caps: &regex::Captures| {
                    let raw_uri = caps.get(1).unwrap().as_str();
                    let abs_uri = if let Some(base) = &parsed_target {
                        base.join(raw_uri).map(|u| u.to_string()).unwrap_or_else(|_| raw_uri.to_string())
                    } else {
                        raw_uri.to_string()
                    };
                    format!("URI=\"{}\"", build_proxy_link(&abs_uri))
                });
                output_lines.push(rewritten.to_string());
            } else {
                output_lines.push(trimmed.to_string());
            }
            continue;
        }

        // Segment or sub-playlist URL line
        let abs_url = if let Some(base) = &parsed_target {
            base.join(trimmed).map(|u| u.to_string()).unwrap_or_else(|_| trimmed.to_string())
        } else {
            trimmed.to_string()
        };

        output_lines.push(build_proxy_link(&abs_url));
    }

    output_lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rewrite_hls_manifest() {
        let sample = r#"#EXTM3U
#EXT-X-VERSION:3
#EXT-X-KEY:METHOD=AES-128,URI="key.php?id=123"
#EXTINF:4.000,
segment0.ts
#EXTINF:4.000,
https://cdn.example.com/segment1.ts
"#;

        let rewritten = rewrite_hls_manifest(
            sample,
            "https://upstream.example.com/hls/master.m3u8",
            Some("https://upstream.example.com/"),
            None,
            true,
            false,
            None,
            "yorumi-media://stream",
        );

        assert!(rewritten.contains("URI=\"yorumi-media://stream?url=https%3A%2F%2Fupstream.example.com%2Fhls%2Fkey.php%3Fid%3D123"));
        assert!(rewritten.contains("yorumi-media://stream?url=https%3A%2F%2Fupstream.example.com%2Fhls%2Fsegment0.ts"));
        assert!(rewritten.contains("yorumi-media://stream?url=https%3A%2F%2Fcdn.example.com%2Fsegment1.ts"));
    }
}

