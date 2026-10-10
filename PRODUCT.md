# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Rendered inside WebView2 in a Tauri 2 Windows desktop app. Windows 11 is the only target; the UI should respect Windows desktop conventions such as the title bar, Segoe UI and keyboard shortcuts.)

## Stack

Tauri 2 (Rust backend + system WebView2 frontend). User chose it on 2026-10-10 from three offered options (Tauri 2, .NET WPF + WebView2, pure native renderer) because it gives a small, fast-starting native binary while keeping Markdown Preview Enhanced-level rendering.

## Users

One primary user: the repository owner on this Windows PC. They do not write or read code themselves; AI coding agents do the coding, and the user reviews the agents' natural-language output. The job is reading Markdown files that live in project folders under `D:\repos`: README files, `docs/`, specs, tickets, ADRs, agent instruction files (`CLAUDE.md`, `AGENTS.md`) and agent reports.

## Product Purpose

A pure read-only Markdown viewer. Open a folder, browse its Markdown files in a left-side directory tree, and read the selected file rendered with the readability of VS Code's Markdown Preview Enhanced. Success: the user can open a project folder and read any of its documents faster and more comfortably than in VS Code, with no editor in the way.

## Positioning

A viewer, not an editor: no editing features at all. It is lighter and faster to start than VS Code or Electron-based Markdown apps, and its whole surface is spent on reading and moving between documents.

## Operating Context

- Folders are git repositories with many Markdown files mixed among code files.
- Documents are mostly agent-authored: headings, tables, code blocks, task lists, blockquotes, links between documents, sometimes YAML front matter.
- The user often has little time and skims (see their working preference for short summaries), so wayfinding inside long documents matters.

## Capabilities and Constraints

- Read-only: no editing, no saving.
- Left directory explorer.
- Rendering reference: VS Code Markdown Preview Enhanced and similar readability plugins (GitHub-flavored Markdown, syntax-highlighted code, tables, task lists, table of contents).
- Native app, as light and fast as possible.
- Undecided: Mermaid and math (KaTeX) support scope, file-watch live reload, file associations, search.

## Product Principles

1. Reading first: chrome recedes, the document owns the window.
2. Fast is a feature: cold start and file switching should feel instant.
3. Familiar where it counts: Windows and VS Code users should recognize every control.
4. Never modify the user's files.
