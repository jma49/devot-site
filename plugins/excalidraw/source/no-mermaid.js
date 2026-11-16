// Mermaid's converter would add 3 MB to a plugin whose files Devot caps at 5 MiB each; Devot draws Mermaid itself.
export async function parseMermaidToExcalidraw() {
  throw new Error('E_EXCALIDRAW_MERMAID_OFF')
}
