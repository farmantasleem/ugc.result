import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import { badGateway, badRequest } from '../lib/httpError.js'

const run = promisify(execFile)
const ffprobePath = ffprobeStatic.path

/**
 * Downloads a GIF and reduces it to a single "contact sheet" PNG: N evenly
 * spaced frames tiled into one grid. Sending one low-detail image to the vision
 * model  instead of N separate frames  captures the motion of a meme while
 * costing a fraction as much.
 *
 * @param {string} url
 * @param {{ sampleCount?: number }} [opts]
 * @returns {Promise<{ pngBuffer: Buffer, frameCount: number, sampled: number, grid: string }>}
 */
export async function buildContactSheet(url, { sampleCount = 4 } = {}) {
  const workDir = await mkdtemp(join(tmpdir(), 'ugc-gif-'))
  const inputPath = join(workDir, 'input.gif')
  const outputPath = join(workDir, 'sheet.png')

  try {
    const gif = await downloadGif(url)
    await writeFile(inputPath, gif)

    const frameCount = await countFrames(inputPath)
    const indices = pickFrameIndices(frameCount, sampleCount)
    const grid = gridFor(indices.length)

    await renderSheet(inputPath, outputPath, indices, grid)
    const pngBuffer = await readFile(outputPath)

    return { pngBuffer, frameCount, sampled: indices.length, grid: grid.label }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

/** Fetches the GIF, guarding size and content-type so we don't feed junk to ffmpeg. */
async function downloadGif(url) {
  let res
  try {
    res = await fetch(url, { redirect: 'follow' })
  } catch (err) {
    throw badRequest(`Could not fetch GIF: ${err.message}`)
  }
  if (!res.ok) throw badRequest(`GIF URL returned ${res.status}`)

  const type = res.headers.get('content-type') ?? ''
  if (!/gif|octet-stream/i.test(type)) {
    // Not fatal  some CDNs mislabel  but warn-worthy. ffmpeg will reject if bad.
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0) throw badRequest('GIF URL returned an empty body')
  if (buf.length > 20 * 1024 * 1024) throw badRequest('GIF is larger than 20MB')
  return buf
}

/** Counts decoded video frames via ffprobe. */
async function countFrames(inputPath) {
  try {
    const { stdout } = await run(ffprobePath, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-count_frames',
      '-show_entries', 'stream=nb_read_frames',
      '-of', 'csv=p=0',
      inputPath,
    ])
    const n = parseInt(stdout.trim(), 10)
    return Number.isFinite(n) && n > 0 ? n : 1
  } catch (err) {
    throw badGateway(`ffprobe failed: ${err.message}`)
  }
}

/** Evenly spaced, de-duplicated frame indices across [0, frameCount). */
function pickFrameIndices(frameCount, sampleCount) {
  const count = Math.min(sampleCount, frameCount)
  if (count <= 1) return [0]
  const picks = new Set()
  for (let i = 0; i < count; i++) {
    picks.add(Math.round((i * (frameCount - 1)) / (count - 1)))
  }
  return [...picks].sort((a, b) => a - b)
}

/** Chooses a tidy grid for the number of sampled frames. */
function gridFor(n) {
  if (n <= 1) return { cols: 1, rows: 1, label: '1x1' }
  if (n === 2) return { cols: 2, rows: 1, label: '2x1' }
  if (n <= 4) return { cols: 2, rows: 2, label: '2x2' }
  return { cols: 3, rows: Math.ceil(n / 3), label: `3x${Math.ceil(n / 3)}` }
}

/**
 * Selects the chosen frames, scales them down, and tiles them into one PNG.
 * The select filter keeps only frames whose index is in `indices`.
 */
async function renderSheet(inputPath, outputPath, indices, grid) {
  const select = indices.map((i) => `eq(n\\,${i})`).join('+')
  const filter = `select='${select}',scale=320:-1,tile=${grid.cols}x${grid.rows}`

  try {
    await run(ffmpegPath, [
      '-i', inputPath,
      '-vf', filter,
      '-frames:v', '1',
      '-vsync', '0',
      '-y', outputPath,
    ])
  } catch (err) {
    throw badGateway(`ffmpeg failed to build contact sheet: ${err.message}`)
  }
}
