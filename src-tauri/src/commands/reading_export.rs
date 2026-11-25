use std::{fs, path::PathBuf};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPage { pub number: u32, pub extension: String, pub bytes: Vec<u8> }

fn component(value: &str) -> String {
    let result: String = value.chars().map(|c| if c.is_control() || "<>:\"/\\|?*".contains(c) { '_' } else { c }).collect();
    let result = result.trim_matches(|c: char| c == '.' || c.is_whitespace());
    if result.is_empty() { "untitled".into() } else { result.chars().take(40).collect() }
}

fn key(value: &str) -> String {
    let hash = value.as_bytes().iter().fold(0xcbf29ce484222325u64, |hash, byte| (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3));
    format!("{hash:016x}")
}

fn chapter_dir(category: &str, title: &str, id: &str, chapter: &str, chapter_id: &str) -> Result<PathBuf, String> {
    let home = if cfg!(windows) { std::env::var_os("USERPROFILE") } else { std::env::var_os("HOME") }.ok_or("Downloads directory unavailable")?;
    Ok(PathBuf::from(home).join("Downloads").join("Yorumi").join(category)
        .join(format!("{} [{}]", component(title), key(id)))
        .join(format!("{} [{}]", component(chapter), key(chapter_id))))
}

#[tauri::command]
pub async fn export_manga_chapter(title: String, id: String, chapter: String, chapter_id: String, pages: Vec<ExportPage>) -> Result<bool, String> {
    if pages.is_empty() { return Err("No manga pages to export".into()); }
    let dir = chapter_dir("Manga", &title, &id, &chapter, &chapter_id)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    for page in pages {
        let ext = match page.extension.as_str() { "png" => "png", "webp" => "webp", _ => "jpg" };
        if page.bytes.is_empty() { return Err("Empty manga page".into()); }
        fs::write(dir.join(format!("{:04}.{ext}", page.number)), page.bytes).map_err(|e| e.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
pub async fn export_novel_chapter(title: String, id: String, chapter: String, chapter_id: String, content: String) -> Result<bool, String> {
    let dir = chapter_dir("LightNovels", &title, &id, &chapter, &chapter_id)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join("chapter.html"), content).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn delete_reading_export(category: String, title: String, id: String, chapter: String, chapter_id: String) -> Result<bool, String> {
    if category != "Manga" && category != "LightNovels" { return Err("Invalid category".into()); }
    let dir = chapter_dir(&category, &title, &id, &chapter, &chapter_id)?;
    match fs::remove_dir_all(dir) { Ok(()) => Ok(true), Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false), Err(e) => Err(e.to_string()) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn path_components_cannot_escape_export_root() {
        assert_eq!(component("../bad\\name"), "_bad_name");
        assert_eq!(component(".."), "untitled");
        assert_ne!(key("chapter/1"), key("chapter/2"));
        assert_eq!(key("chapter/1").len(), 16);
    }
}
