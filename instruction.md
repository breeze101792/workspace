### Project Summary

You are building **an AI-native Workspace**, not a chat application and not a traditional whiteboard.

The workspace is a visual desktop where both the human and AI work together.

Each conversation/project is represented by a **Workspace**, and each Workspace corresponds to a folder on the server.

The folder stores:

```
workspace/
├── workspace.json      # layout, window positions, metadata
├── chat.json           # optional conversation history
├── markdown/
├── html/
├── files/
├── images/
└── cache/
```

The browser is the primary interface for humans.

The AI interacts with the same workspace through MCP (and future protocols if needed), rather than directly manipulating random files.

Everything inside the workspace is represented as movable windows.

Version 1 only supports:

* Markdown
* Plain Text
* HTML
* PDF Viewer
* File Upload
* Images

No audio or video yet.

The AI must always know the current UI context, including:

* active workspace
* focused window
* selected objects
* opened files
* viewport position
* current zoom
* current selection

This allows users to naturally say things like:

> Fix this.

> Move this over here.

> Rewrite this paragraph.

without needing to explain which object they're referring to.

The workspace should feel like an operating system desktop instead of a document editor.

---

# Prompt for the Coding Agent

```text
You are building an AI-native Workspace platform.

This is NOT a chat application.
This is NOT a whiteboard.
This is NOT a note-taking app.

Think of it as an operating system desktop shared between a human and an AI.

----------------------------------------
Core Concept
----------------------------------------

Every project is a Workspace.

Every Workspace maps directly to a folder on the server.

Example:

workspace/
    workspace.json
    markdown/
    html/
    images/
    files/
    pdf/

workspace.json stores:

- window positions
- window sizes
- z-index
- opened files
- metadata
- workspace settings

Actual content lives as normal files inside the workspace folder.

The AI should never rely on hidden internal state.

Everything important should exist as files.

----------------------------------------
Version 1 Features
----------------------------------------

Implement a desktop-style workspace with draggable and resizable windows.

Supported window types:

- Markdown
- Plain Text
- HTML Preview
- PDF Viewer
- Image Viewer
- File Explorer

Support:

- drag & drop
- resize
- minimize
- maximize
- close
- multiple windows
- upload files
- save automatically

----------------------------------------
AI Context
----------------------------------------

Every AI request should include the current UI state.

For example:

- active workspace
- focused window
- selected window
- selected objects
- opened files
- viewport position
- zoom level

The AI should understand references like:

"Fix this."

"Move this."

"Rewrite this."

without requiring the user to repeat filenames.

----------------------------------------
Architecture
----------------------------------------

Frontend:
- Desktop workspace
- Window manager
- Infinite canvas
- File upload
- Local state management

Backend:
- Workspace management
- File storage
- Workspace JSON persistence
- MCP integration
- API endpoints

The backend owns the workspace.

The frontend renders it.

The AI accesses it through APIs/MCP.

----------------------------------------
UI Philosophy
----------------------------------------

The UI is NOT a later enhancement.

The futuristic design is a core product requirement.

Design language:

- JARVIS
- Iron Man HUD
- clean
- minimal
- premium
- dark theme
- cyan / blue accent
- glass panels
- subtle glow
- smooth animations

Avoid gaming aesthetics.

Avoid excessive neon effects.

Prioritize readability and professionalism.

The application should feel like a futuristic operating system rather than a website.

----------------------------------------
Engineering Principles
----------------------------------------

- Modular architecture
- Extensible window types
- Plugin-friendly
- Strong separation between UI, Workspace, and AI
- Everything should be easy to extend in future versions

Future window types may include:

- Video
- Audio
- Browser
- Terminal
- Live Preview
- Code Editor
- Whiteboard
- AI Widgets

Design the architecture so these can be added without major refactoring.
