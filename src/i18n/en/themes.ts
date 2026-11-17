/** One theme an official theme plugin adds, as its manifest names it. */
export interface GalleryTheme {
  /** The theme plugin's folder under `plugins/`. */
  folder: string
  /** The theme's ID in that plugin's manifest. */
  id: string
  title: string
  appearance: 'light' | 'dark'
  /** Describes the preview image of the theme. */
  alt: string
}

const theme = (
  folder: string,
  id: string,
  title: string,
  appearance: GalleryTheme['appearance'],
): GalleryTheme => ({
  folder,
  id,
  title,
  appearance,
  alt: `${title} in Devot: the sidebar, the note list and an open note`,
})

export const themesCopy = {
  themes: {
    title: 'Devot: colour themes for your Markdown notes',
    description:
      'Eighteen colour themes for Devot, the Markdown notes app for Mac and iPhone: Catppuccin, Dracula, Nord, Gruvbox, Solarized, Tokyo Night and more.',
    heading: 'Themes',
    intro:
      'Colour themes for Devot, each a small plugin at no extra cost. A theme colours the whole app: the sidebar, the note list, the editor, code blocks and highlights.',
    install: {
      lead: 'In Devot 1.1.8 or later, open Settings > Plugins and install a theme from Official Plugins, or download its archive here and choose Install from Archive. Then pick it in Settings > Appearance, for Light Mode, Dark Mode or both. ',
      more: 'More on plugins',
    },
    light: 'Light Mode',
    dark: 'Dark Mode',
    download: 'Download',
    listLabel: 'Theme plugins',
    gallery: [
      theme('catppuccin', 'latte', 'Catppuccin Latte', 'light'),
      theme('catppuccin', 'frappe', 'Catppuccin Frappé', 'dark'),
      theme('catppuccin', 'macchiato', 'Catppuccin Macchiato', 'dark'),
      theme('catppuccin', 'mocha', 'Catppuccin Mocha', 'dark'),
      theme('tokyo-night', 'light', 'Tokyo Night Light', 'light'),
      theme('tokyo-night', 'night', 'Tokyo Night', 'dark'),
      theme('tokyo-night', 'storm', 'Tokyo Night Storm', 'dark'),
      theme('dracula', 'dracula', 'Dracula', 'dark'),
      theme('nord', 'nord', 'Nord', 'dark'),
      theme('gruvbox', 'light', 'Gruvbox Light', 'light'),
      theme('gruvbox', 'dark', 'Gruvbox Dark', 'dark'),
      theme('solarized', 'light', 'Solarized Light', 'light'),
      theme('solarized', 'dark', 'Solarized Dark', 'dark'),
      theme('rose-pine', 'dawn', 'Rosé Pine Dawn', 'light'),
      theme('rose-pine', 'main', 'Rosé Pine', 'dark'),
      theme('rose-pine', 'moon', 'Rosé Pine Moon', 'dark'),
      theme('one', 'light', 'One Light', 'light'),
      theme('one', 'dark', 'One Dark', 'dark'),
    ] satisfies GalleryTheme[],
  },
}
