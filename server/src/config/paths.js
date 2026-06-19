import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// server/src/config -> server
const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Where rendered videos are written and served from. */
export const OUTPUT_DIR = join(serverRoot, 'output')
export const VIDEO_ROUTE_PREFIX = '/videos/'

/** Static trending-audio library + its catalog (see assets/audio/catalog.json). */
export const AUDIO_DIR = join(serverRoot, 'assets', 'audio')
export const AUDIO_CATALOG = join(AUDIO_DIR, 'catalog.json')
