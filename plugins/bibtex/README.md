# BibTeX References

A Devot plugin, listed at https://devot.online/docs/plugins.

- File > Import > BibTeX Library turns each `.bib` file into a note listing its references, with the original entries kept below in a `bibtex` code block.
- A fenced code block marked `bibtex` shows as a reference list in the preview; the note keeps the block as written.

Each reference reads as authors (year), title, where it appeared with volume and pages, then its DOI or URL.
Accents written in LaTeX (`{\"o}`, `\'e`) show as letters, and `@string` abbreviations are filled in.

It asks for two permissions, `import` and `preview`, and reads no note and changes none.
