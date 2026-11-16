# Note Query

A Devot plugin, listed at https://devot.online/docs/plugins. It needs Devot 1.1.8 or later.

A fenced code block marked `query` (or `dataview`) shows, in the preview, the notes that match it as a table or a list, each linked to its note.
The result follows the notes: it is drawn again a moment after any note changes.

```query
TABLE status, due AS "Due date"
FROM #work OR "Projects"
WHERE status != "completed" AND due <= 2026-12-31
SORT due, updated DESC
LIMIT 20
```

- `TABLE` names the columns after the note's link; `LIST` shows the links alone.
- `FROM` keeps notes with a tag (nested tags included) or in a notebook, by name; several are joined with `OR`.
- `WHERE` compares a field with `=`, `!=`, `<`, `>`, `<=`, `>=` or `contains`, or tests that it is set; conditions join with `AND` and `OR` (`AND` first), and `NOT` turns one around.
- `SORT` orders by one or more fields, `ASC` (the default) or `DESC`; `LIMIT` keeps the first notes.

Fields are `title`, `notebook`, `created`, `updated` (as `YYYY-MM-DD`), `tags`, `status` and `pinned`, and any front matter property by its name.
Values are numbers, `true` or `false`, dates as `YYYY-MM-DD`, and text in quotes.
At most 500 notes are looked at, the front matter of the first 200, and 200 rows shown.

It asks for two permissions, `preview` and `notes.read`: it reads notes outside Templates and the Trash, and changes none.
