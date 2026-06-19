import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { removeBackground } from '@imgly/background-removal-node'

/**
 * Removes the background from each frame, leaving the person on transparency.
 * Returns RGBA PNGs written to `outDir`, renumbered contiguously so ffmpeg can
 * read them as an image sequence.
 *
 * Per-frame model inference is the slow part, so the caller caps how many frames
 * it sends. Throws if the model/runtime is unavailable  the caller falls back
 * to compositing the raw frames.
 *
 * @param {string[]} framePaths  input frame PNG paths, in order
 * @param {string} outDir        where to write cut-out frames
 * @returns {Promise<string[]>}  output frame paths
 */
export async function cutoutFrames(framePaths, outDir) {
  const out = []
  for (let i = 0; i < framePaths.length; i++) {
    const input = await readFile(framePaths[i])
    // Wrap in a typed Blob  imgly can't sniff the format from a bare Buffer.
    const source = new Blob([input], { type: 'image/png' })
    const blob = await removeBackground(source, { output: { format: 'image/png' } })
    const png = Buffer.from(await blob.arrayBuffer())
    const dest = join(outDir, `f_${String(i + 1).padStart(4, '0')}.png`)
    await writeFile(dest, png)
    out.push(dest)
  }
  return out
}
