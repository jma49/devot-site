# Charts

A Devot plugin, listed at https://devot.online/docs/plugins.

A fenced code block marked `chart` shows as a chart in the preview; the note keeps the block as written.

````markdown
```chart
type: line
title: Visitors
month, web, app
Jan, 120, 40
Feb, 180, 65
Mar, 150, 90
```
````

- Each row is a label and one or more numbers, split by commas, tabs or semicolons; a first row without numbers names the series.
- `type: bar` (the default) or `type: line`, and `title:`, go before the rows.
- The chart is drawn in the colours of the theme on screen, and its description reads the data out for VoiceOver.
- It draws the first 200 rows.

It asks for one permission, `preview`, and reads no note and changes none.
