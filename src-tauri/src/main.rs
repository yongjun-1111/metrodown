// Hide the console window in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use notify::event::ModifyKind;
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Emitter, Manager, State};

/// Folders that are never scanned or watched: VCS data, dependencies and build output.
const SKIP_DIRS: &[&str] = &[
    ".git", "node_modules", "target", "dist", ".venv", "venv", "__pycache__", ".next", ".nuxt",
    ".cache", ".idea", ".vs", ".gradle",
];
const MAX_DEPTH: usize = 16;
/// Upper bound on directory entries visited per scan, so a huge folder cannot stall the app.
const MAX_ENTRIES: usize = 200_000;
const MAX_FILE_BYTES: u64 = 32 * 1024 * 1024;

#[derive(Serialize, Debug, PartialEq)]
struct Node {
    name: String,
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<Node>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileData {
    text: String,
    modified_ms: u64,
}

#[derive(Clone, Serialize)]
struct FsChange {
    paths: Vec<String>,
    structural: bool,
}

struct Watch(Mutex<Option<RecommendedWatcher>>);

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("md") || e.eq_ignore_ascii_case("markdown"))
        .unwrap_or(false)
}

fn is_skipped_name(name: &str) -> bool {
    SKIP_DIRS.iter().any(|s| s.eq_ignore_ascii_case(name))
}

fn in_skipped_dir(path: &Path) -> bool {
    path.components()
        .any(|c| c.as_os_str().to_str().map(is_skipped_name).unwrap_or(false))
}

/// Builds the Markdown-only tree: folders first, then files, both sorted by name.
/// Folders with no Markdown files anywhere below them are left out.
fn scan_dir(dir: &Path, depth: usize, budget: &mut usize) -> Vec<Node> {
    if depth > MAX_DEPTH || *budget == 0 {
        return Vec::new();
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut dirs = Vec::new();
    let mut files = Vec::new();
    for entry in entries.flatten() {
        if *budget == 0 {
            break;
        }
        *budget -= 1;
        // file_type() does not follow symlinks, so linked folders cannot cause loops.
        let Ok(kind) = entry.file_type() else { continue };
        let name = entry.file_name().to_string_lossy().into_owned();
        let path = entry.path();
        if kind.is_dir() {
            if is_skipped_name(&name) {
                continue;
            }
            let children = scan_dir(&path, depth + 1, budget);
            if !children.is_empty() {
                dirs.push(Node { name, path: path.to_string_lossy().into_owned(), children: Some(children) });
            }
        } else if kind.is_file() && is_markdown(&path) {
            files.push(Node { name, path: path.to_string_lossy().into_owned(), children: None });
        }
    }
    let by_name = |a: &Node, b: &Node| a.name.to_lowercase().cmp(&b.name.to_lowercase());
    dirs.sort_by(by_name);
    files.sort_by(by_name);
    dirs.extend(files);
    dirs
}

fn scan_root(root: &Path) -> Result<Vec<Node>, String> {
    if !root.is_dir() {
        return Err(format!("Folder not found: {}", root.display()));
    }
    let mut budget = MAX_ENTRIES;
    Ok(scan_dir(root, 0, &mut budget))
}

#[tauri::command]
async fn scan_tree(root: String) -> Result<Vec<Node>, String> {
    tauri::async_runtime::spawn_blocking(move || scan_root(Path::new(&root)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn read_file(path: String) -> Result<FileData, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&path);
        let meta = fs::metadata(path).map_err(|e| e.to_string())?;
        if !meta.is_file() {
            return Err(format!("Not a file: {}", path.display()));
        }
        if meta.len() > MAX_FILE_BYTES {
            return Err("This file is larger than 32 MB.".into());
        }
        let bytes = fs::read(path).map_err(|e| e.to_string())?;
        let mut text = String::from_utf8_lossy(&bytes).into_owned();
        if text.starts_with('\u{feff}') {
            text.remove(0);
        }
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        Ok(FileData { text, modified_ms })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Watches the open folder and reports Markdown changes. Read-only: it only listens.
#[tauri::command]
fn watch_root(root: String, app: AppHandle, state: State<Watch>) -> Result<(), String> {
    let mut slot = state.0.lock().map_err(|e| e.to_string())?;
    *slot = None;
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(event) = res else { return };
        let paths: Vec<String> = event
            .paths
            .iter()
            .filter(|p| !in_skipped_dir(p) && (is_markdown(p) || p.extension().is_none()))
            .map(|p| p.to_string_lossy().into_owned())
            .collect();
        if paths.is_empty() {
            return;
        }
        let structural = matches!(
            event.kind,
            EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(ModifyKind::Name(_))
        );
        let _ = app.emit("fs-change", FsChange { paths, structural });
    })
    .map_err(|e| e.to_string())?;
    watcher
        .watch(Path::new(&root), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    *slot = Some(watcher);
    Ok(())
}

#[tauri::command]
fn path_kind(path: String) -> &'static str {
    let path = Path::new(&path);
    if path.is_dir() {
        "dir"
    } else if path.is_file() {
        "file"
    } else {
        "missing"
    }
}

/// Folder to open for a single file: the nearest enclosing git repository, else the file's folder.
fn project_root_for(file: &Path) -> PathBuf {
    let parent = file.parent().unwrap_or(file);
    parent
        .ancestors()
        .find(|dir| dir.join(".git").exists())
        .unwrap_or(parent)
        .to_path_buf()
}

#[tauri::command]
fn project_root(path: String) -> String {
    project_root_for(Path::new(&path)).to_string_lossy().into_owned()
}

/// The folder or file passed on the command line, e.g. from "Open with".
#[tauri::command]
fn launch_path() -> Option<String> {
    std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .find(|p| p.exists())
        .map(|p| std::path::absolute(&p).unwrap_or(p).to_string_lossy().into_owned())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Watch(Mutex::new(None)))
        .setup(|app| {
            // The page shows the window after its first frame. If the page never loads,
            // show it anyway so the app cannot stay running invisibly.
            if let Some(window) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(1500));
                    if !window.is_visible().unwrap_or(true) {
                        let _ = window.show();
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_tree,
            read_file,
            watch_root,
            path_kind,
            project_root,
            launch_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running md-viewer");
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempTree(PathBuf);
    impl TempTree {
        fn new(tag: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("mdv-test-{tag}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&dir);
            fs::create_dir_all(&dir).unwrap();
            TempTree(dir)
        }
        fn file(&self, rel: &str) {
            let p = self.0.join(rel);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(p, "# x").unwrap();
        }
    }
    impl Drop for TempTree {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn names(nodes: &[Node]) -> Vec<&str> {
        nodes.iter().map(|n| n.name.as_str()).collect()
    }

    #[test]
    fn keeps_only_markdown_and_drops_empty_folders() {
        let t = TempTree::new("filter");
        t.file("README.md");
        t.file("notes.txt");
        t.file("src/main.rs");
        t.file("docs/spec.md");
        t.file("docs/img/logo.png");
        t.file("Guide.MARKDOWN");
        let tree = scan_root(&t.0).unwrap();
        assert_eq!(names(&tree), vec!["docs", "Guide.MARKDOWN", "README.md"]);
        assert_eq!(names(tree[0].children.as_ref().unwrap()), vec!["spec.md"]);
    }

    #[test]
    fn skips_dependency_and_build_folders() {
        let t = TempTree::new("skip");
        t.file("node_modules/pkg/README.md");
        t.file(".git/info.md");
        t.file("target/doc.md");
        t.file(".claude/commands/review.md");
        let tree = scan_root(&t.0).unwrap();
        assert_eq!(names(&tree), vec![".claude"]);
    }

    #[test]
    fn sorts_folders_first_case_insensitively() {
        let t = TempTree::new("sort");
        t.file("b.md");
        t.file("A.md");
        t.file("zeta/x.md");
        t.file("Alpha/y.md");
        let tree = scan_root(&t.0).unwrap();
        assert_eq!(names(&tree), vec!["Alpha", "zeta", "A.md", "b.md"]);
    }

    #[test]
    fn single_file_opens_its_repository() {
        let t = TempTree::new("root");
        fs::create_dir_all(t.0.join(".git")).unwrap();
        t.file("docs/adr/0001.md");
        t.file("loose/readme.md");
        assert_eq!(project_root_for(&t.0.join("docs/adr/0001.md")), t.0);
        let outside = std::env::temp_dir().join("mdv-no-repo-file.md");
        assert_eq!(project_root_for(&outside), std::env::temp_dir());
    }

    #[test]
    fn missing_root_is_an_error() {
        assert!(scan_root(Path::new("Z:\\definitely\\missing\\folder")).is_err());
    }

    #[test]
    fn markdown_detection_and_skip_paths() {
        assert!(is_markdown(Path::new("a/b.md")));
        assert!(is_markdown(Path::new("a/b.Markdown")));
        assert!(!is_markdown(Path::new("a/b.mdx")));
        assert!(in_skipped_dir(Path::new("D:\\repo\\node_modules\\x\\a.md")));
        assert!(!in_skipped_dir(Path::new("D:\\repo\\docs\\a.md")));
    }
}
