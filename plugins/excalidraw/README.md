# Excalidraw

Draws `excalidraw` code blocks as hand-drawn sketches in the preview, in light and dark.
Edit, on a block in the preview while the note is open for editing, opens the block in Excalidraw's whiteboard in the plugin's panel; Done writes the scene back into the block.

Start a drawing with an empty block:

````markdown
```excalidraw

```
````

The block holds the scene as Excalidraw's JSON, so a drawing stays in the note and goes wherever the note goes.

Excalidraw (https://github.com/excalidraw/excalidraw) is by the Excalidraw authors, under the MIT License in `LICENSE`.
The site's build bundles `source/editor.js` with the pinned `@excalidraw/excalidraw` and React into `excalidraw/` in the package, with Excalidraw's fonts except its CJK handwriting face, which is too large for a plugin; Chinese text falls back to the system font.

Needs Devot 1.1.8 or later.
