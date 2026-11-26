use futures_util::StreamExt;
use serde::Serialize;
use std::path::PathBuf;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone, Serialize)]
pub struct UpdateDownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percent: u8,
}

fn is_allowed_update_url(url: &str) -> bool {
    url.starts_with("https://github.com/davenarchives/Yorumi/")
        || url.starts_with("https://objects.githubusercontent.com/")
        || url.starts_with("https://release-assets.githubusercontent.com/")
}

fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
        .collect();
    if cleaned.is_empty() {
        "Yorumi-Setup.exe".to_string()
    } else {
        cleaned
    }
}

#[tauri::command]
pub async fn install_desktop_update(
    app: tauri::AppHandle,
    url: String,
    filename: String,
) -> Result<(), String> {
    if !is_allowed_update_url(&url) {
        return Err("Untrusted update download URL".to_string());
    }

    let safe_name = sanitize_filename(&filename);
    let update_dir: PathBuf = std::env::temp_dir().join("yorumi-updates");
    tokio::fs::create_dir_all(&update_dir)
        .await
        .map_err(|e| format!("Failed to prepare update directory: {e}"))?;
    let target_path = update_dir.join(&safe_name);

    let client = reqwest::Client::builder()
        .user_agent("Yorumi-Updater/1.0")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to download update: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Update server returned HTTP {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut last_percent: u8 = 0;

    let mut file = tokio::fs::File::create(&target_path)
        .await
        .map_err(|e| format!("Failed to create installer file: {e}"))?;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("Download interrupted: {e}"))?;
        file.write_all(&bytes)
            .await
            .map_err(|e| format!("Failed to write installer: {e}"))?;
        downloaded += bytes.len() as u64;

        let percent = if total > 0 {
            ((downloaded.saturating_mul(100)) / total).min(100) as u8
        } else {
            0
        };
        if percent != last_percent || downloaded == total {
            last_percent = percent;
            let _ = app.emit(
                "update-download-progress",
                UpdateDownloadProgress {
                    downloaded,
                    total,
                    percent,
                },
            );
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("Failed to flush installer: {e}"))?;
    drop(file);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;

        let current_exe = std::env::current_exe()
            .ok()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let installer_str = target_path.to_string_lossy().to_string();
        let esc = |s: &str| s.replace('\'', "''");
        let lower = safe_name.to_lowercase();

        // Wait briefly for Yorumi to exit, run silent installer to completion, then relaunch Yorumi
        let install_cmd = if lower.ends_with(".msi") {
            format!(
                "Start-Process -FilePath 'msiexec.exe' -ArgumentList '/i','\"{}\"' ,'/passive' -Wait",
                esc(&installer_str)
            )
        } else {
            format!(
                "Start-Process -FilePath '{}' -ArgumentList '/S' -Wait",
                esc(&installer_str)
            )
        };

        let relaunch_script = format!(
            "Start-Sleep -Milliseconds 600; \
             {install_cmd}; \
             Start-Sleep -Milliseconds 500; \
             $exe = '{exe}'; \
             if (-not $exe -or -not (Test-Path $exe)) {{ \
               $candidates = @( \
                 (Join-Path $env:LOCALAPPDATA 'Yorumi\\Yorumi.exe'), \
                 (Join-Path $env:LOCALAPPDATA 'Programs\\Yorumi\\Yorumi.exe'), \
                 (Join-Path $env:ProgramFiles 'Yorumi\\Yorumi.exe') \
               ); \
               $exe = $candidates | Where-Object {{ Test-Path $_ }} | Select-Object -First 1; \
             }}; \
             if ($exe -and (Test-Path $exe)) {{ Start-Process -FilePath $exe }}",
            install_cmd = install_cmd,
            exe = esc(&current_exe),
        );

        std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-WindowStyle",
                "Hidden",
                "-Command",
                &relaunch_script,
            ])
            .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
            .spawn()
            .map_err(|e| format!("Failed to launch updater helper: {e}"))?;

        app.exit(0);
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&target_path)
            .spawn()
            .map_err(|e| format!("Failed to open DMG: {e}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&target_path)
            .spawn()
            .map_err(|e| format!("Failed to open update package: {e}"))?;
    }

    Ok(())
}
