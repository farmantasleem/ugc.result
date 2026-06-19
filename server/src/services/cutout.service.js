import { writeFile, rm } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

const exec = promisify(execFile)
const workerPath = join(dirname(fileURLToPath(import.meta.url)), 'cutout.worker.js')

/**
 * Removes the background from each frame, leaving the person on transparency.
 * Returns RGBA PNGs written to `outDir`, renumbered contiguously so ffmpeg can
 * read them as an image sequence.
 *
 * The actual matting runs in a child process (see cutout.worker.js): onnxruntime
 * can abort the process natively ("munmap_chunk(): invalid pointer"), which an
 * in-process try/catch cannot catch  it would take the whole API server down.
 * Running it isolated turns such a crash into a non-zero exit the caller can
 * catch and fall back from (compositing the raw frames instead).
 *
 * @param {string[]} framePaths  input frame PNG paths, in order
 * @param {string} outDir        where to write cut-out frames
 * @returns {Promise<string[]>}  output frame paths
 */
export async function cutoutFrames(framePaths, outDir) {
  const jobPath = join(tmpdir(), `ugc-cutout-${randomUUID().slice(0, 8)}.json`)
  await writeFile(jobPath, JSON.stringify({ framePaths, outDir }))
  try {
    const { stdout } = await exec(process.execPath, [workerPath, jobPath], {
      maxBuffer: 1024 * 1024 * 16,
    })
    return JSON.parse(stdout)
  } finally {
    await rm(jobPath, { force: true })
  }
}
