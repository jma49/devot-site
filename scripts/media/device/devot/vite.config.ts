import type { PluginOption, UserConfig } from 'vite'
import { mediaBridge } from './bridge.ts'

// Devot's own Vite config with the media bridge added: `pnpm media:device` starts Devot's dev
// server with this file, from the Devot checkout DEVOT_DIR names (its Vite runs it).
const dir = process.env['DEVOT_DIR']
if (!dir) throw new Error('E_MEDIA_DEVOT_DIR')
const devot = ((await import(`${dir}/vite.config.ts`)) as { default: UserConfig }).default

export default {
  ...devot,
  root: `${dir}/src/renderer`,
  envDir: dir,
  plugins: [...((devot.plugins ?? []) as PluginOption[]), mediaBridge()],
} satisfies UserConfig
