import { readFile } from 'node:fs/promises'
import ImageKit from 'imagekit'
import { env } from '../config/env.js'
import { badGateway } from '../lib/httpError.js'

// Only constructed when fully configured  otherwise we serve videos locally.
const client = env.imagekit.enabled
  ? new ImageKit({
      publicKey: env.imagekit.publicKey,
      privateKey: env.imagekit.privateKey,
      urlEndpoint: env.imagekit.urlEndpoint,
    })
  : null

export const uploadEnabled = () => client !== null

/**
 * Uploads a rendered video to ImageKit and returns its hosted URL.
 * @param {string} filePath  local path to the MP4
 * @param {string} fileName  name to store it under
 * @returns {Promise<string>} the ImageKit URL
 */
export async function uploadVideo(filePath, fileName) {
  if (!client) throw badGateway('ImageKit is not configured')
  try {
    const file = await readFile(filePath)
    const res = await client.upload({ file, fileName, folder: '/ugc' })
    return res.url
  } catch (err) {
    throw badGateway(`ImageKit upload failed: ${err.message}`)
  }
}
