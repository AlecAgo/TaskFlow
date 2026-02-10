# FocusFlow (Vanilla HTML/CSS/JS)

A clean, Apple-like productivity web app with **Tasks** and **Calendar** sections.

## Features
- Two sections: **Tasks** and **Calendar** (navigate with arrows or swipe).
- Tasks: category (editable), priority, due date, notes. Mark complete, edit, delete.
- Calendar: month view with event dots and due-task badges; day drawer shows events + due tasks.
- Fully offline: stores data in `localStorage`.
- Import/Export JSON (bottom bar).
- Smooth transitions + glassy iOS-style UI.

## Run
Just open `index.html` in a modern browser.

For best results (and to avoid CORS limitations for some features in stricter browsers), run a tiny local server:

```bash
# Python 3
python -m http.server 8000
```

Then open: `http://localhost:8000`

## Files
- `index.html` — layout
- `css/styles.css` — Apple-like styling
- `js/app.js` — logic (tasks, categories, calendar, storage)

## Notes
- Data is stored locally in your browser only.
- Undo delete: after deleting an item, press **Ctrl/Cmd+Z** within ~5 seconds.

Enjoy ✨
