import 'dotenv/config'

/**
 * Loads and validates environment once, so the rest of the app reads a typed
 * config object instead of reaching into `process.env` everywhere.
 */
function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name} (see .env.example)`)
  }
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  openai: {
    apiKey: required('OPENAI_API_KEY'),
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },
  giphy: {
    apiKey: required('GIPHY_API_KEY'),
    rating: process.env.GIPHY_RATING ?? 'pg-13',
  },
  pexels: {
    apiKey: required('PEXELS_API_KEY'),
  },
  // Background removal (onnxruntime) is heavy and can crash natively on some
  // hosts. Set UGC_DISABLE_CUTOUT=true to skip it and composite raw GIF frames.
  cutout: {
    enabled: process.env.UGC_DISABLE_CUTOUT !== 'true',
  },
  // Optional: if all three are set, rendered videos are uploaded to ImageKit and
  // the response returns that URL; otherwise videos are served locally.
  imagekit: {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY ?? '',
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY ?? '',
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT ?? '',
    get enabled() {
      return Boolean(this.publicKey && this.privateKey && this.urlEndpoint)
    },
  },
}
