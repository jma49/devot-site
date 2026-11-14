import type { APIRoute, GetStaticPaths } from 'astro'
import { pluginArchive, pluginPackages } from '../../lib/plugin-packages.ts'

export const getStaticPaths = (() =>
  [...pluginPackages().keys()].map((folder) => ({ params: { folder } }))) satisfies GetStaticPaths

export const GET: APIRoute = ({ params }) =>
  new Response(pluginArchive(String(params.folder)), {
    headers: { 'content-type': 'application/zip' },
  })
