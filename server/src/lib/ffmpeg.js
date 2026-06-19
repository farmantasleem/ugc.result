import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

const exec = promisify(execFile)

export const ffmpegPath = ffmpegStatic
export const ffprobePath = ffprobeStatic.path

/** Runs ffmpeg with the given args. Large stdout (none expected) is discarded. */
export async function runFfmpeg(args) {
  await exec(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 64 })
}

/** Runs ffprobe and returns parsed JSON. */
export async function probe(inputPath) {
  const { stdout } = await exec(ffprobePath, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-count_frames',
    '-show_entries', 'stream=nb_read_frames,duration,avg_frame_rate',
    '-of', 'json',
    inputPath,
  ])
  const stream = JSON.parse(stdout)?.streams?.[0] ?? {}
  const frames = parseInt(stream.nb_read_frames, 10)
  const duration = parseFloat(stream.duration)
  return {
    frames: Number.isFinite(frames) && frames > 0 ? frames : null,
    duration: Number.isFinite(duration) && duration > 0 ? duration : null,
    avgFrameRate: stream.avg_frame_rate ?? null,
  }
}
