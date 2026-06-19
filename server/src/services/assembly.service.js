import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { runFfmpeg, probe } from '../lib/ffmpeg.js'
import { renderCaption } from './textLayer.service.js'
import { cutoutFrames } from './cutout.service.js'
import { badGateway } from '../lib/httpError.js'

const W = 1080
const H = 1920
const MAX_CUTOUT_FRAMES = 36 // cap matting cost; motion speed is preserved

/**
 * Assembles the UGC video: darkened background, cut-out person from the GIF, and
 * the caption on top. Writes an MP4 into `outDir` and returns its file name.
 *
 * @param {object} args
 * @param {string} args.backgroundUrl
 * @param {string} args.gifUrl
 * @param {string} args.caption
 * @param {string} args.outDir
 * @param {number} [args.durationSec=5]
 * @param {boolean} [args.removeGifBg=true]
 * @param {string} [args.audioPath]      // local mp3 to mux in (optional)
 * @param {number} [args.audioStartSec=0] // where to start the cut from
 * @returns {Promise<{ fileName: string, durationSec: number, cutout: boolean }>}
 */
export async function assembleVideo({
  backgroundUrl,
  gifUrl,
  caption,
  outDir,
  durationSec = 5,
  removeGifBg = true,
  audioPath,
  audioStartSec = 0,
}) {
  const work = await mkdtemp(join(tmpdir(), 'ugc-build-'))
  const framesDir = join(work, 'frames')
  const cutDir = join(work, 'cut')
  await mkdir(framesDir, { recursive: true })
  await mkdir(cutDir, { recursive: true })
  await mkdir(outDir, { recursive: true })

  try {
    // --- Background: cover-crop to 9:16 and darken for legibility ---------
    const bgPath = join(work, 'bg.png')
    await writeFile(bgPath, await buildBackground(backgroundUrl))

    // --- Caption: transparent full-frame PNG ------------------------------
    const textPath = join(work, 'text.png')
    await writeFile(textPath, await renderCaption(caption, { width: W, height: H }))

    // --- Person: GIF -> frames -> (cut-out) -> looping alpha clip ----------
    const gifPath = join(work, 'in.gif')
    await writeFile(gifPath, await download(gifUrl))

    await runFfmpeg(['-i', gifPath, '-vsync', '0', join(framesDir, 'f_%04d.png')])
    let frames = (await readdir(framesDir)).sort().map((f) => join(framesDir, f))
    if (frames.length === 0) throw badGateway('GIF produced no frames')

    const meta = await probe(gifPath)
    const gifDuration = meta.duration ?? frames.length / 12

    let cutout = false
    let personFps = frames.length / gifDuration
    if (removeGifBg) {
      const sampled = sampleEven(frames, MAX_CUTOUT_FRAMES)
      try {
        frames = await cutoutFrames(sampled, cutDir)
        personFps = frames.length / gifDuration
        cutout = true
      } catch {
        // Model/runtime unavailable  fall back to the raw frames.
        frames = (await readdir(framesDir)).sort().map((f) => join(framesDir, f))
      }
    }

    const personDir = cutout ? cutDir : framesDir
    const personClip = join(work, 'person.mov')
    await runFfmpeg([
      '-framerate', String(personFps || 12),
      '-i', join(personDir, 'f_%04d.png'),
      '-c:v', 'qtrle', // RLE in MOV keeps the alpha channel
      '-pix_fmt', 'argb',
      '-y', personClip,
    ])

    // --- Composite: bg <- person (lower-center) <- caption ----------------
    const fileName = `ugc-${randomUUID().slice(0, 8)}.mp4`
    const outPath = join(outDir, fileName)

    // Optional audio track, cut to the video length with a quick fade-out.
    const hasAudio = Boolean(audioPath)
    const audioInput = hasAudio
      ? ['-ss', String(Math.max(0, audioStartSec)), '-t', String(durationSec), '-i', audioPath]
      : []
    const audioFilter = hasAudio
      ? `;[3:a]afade=t=out:st=${Math.max(0, durationSec - 0.4)}:d=0.4[a]`
      : ''
    const audioMap = hasAudio
      ? ['-map', '[a]', '-c:a', 'aac', '-b:a', '192k', '-shortest']
      : ['-an']

    await runFfmpeg([
      '-loop', '1', '-t', String(durationSec), '-i', bgPath,
      '-stream_loop', '-1', '-i', personClip,
      '-loop', '1', '-t', String(durationSec), '-i', textPath,
      ...audioInput,
      '-filter_complex',
      '[1:v]scale=1000:1180:force_original_aspect_ratio=decrease[p];' +
        '[0:v][p]overlay=(W-w)/2:H-h-120:shortest=0[b];' +
        '[b][2:v]overlay=0:0,format=yuv420p[v]' +
        audioFilter,
      '-map', '[v]',
      ...audioMap,
      '-t', String(durationSec),
      '-r', '30',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-y', outPath,
    ])

    return { fileName, durationSec, cutout, audio: hasAudio }
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

/** Fetches the background and produces a darkened 1080x1920 cover crop. */
async function buildBackground(url) {
  const buf = await download(url)
  const cover = await sharp(buf).resize(W, H, { fit: 'cover', position: 'centre' }).toBuffer()
  return sharp(cover)
    .composite([
      {
        input: {
          create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.38 } },
        },
      },
    ])
    .png()
    .toBuffer()
}

async function download(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw badGateway(`Failed to fetch asset (${res.status}): ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Evenly samples at most `max` items from an array, preserving order. */
function sampleEven(items, max) {
  if (items.length <= max) return items
  const step = items.length / max
  const out = []
  for (let i = 0; i < max; i++) out.push(items[Math.floor(i * step)])
  return out
}
