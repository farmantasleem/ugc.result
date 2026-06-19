import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import ugcRoutes from './routes/ugc.routes.js'
import { HttpError } from './lib/httpError.js'
import { mkdirSync } from 'node:fs'
import { OUTPUT_DIR, VIDEO_ROUTE_PREFIX } from './config/paths.js'

/**
 * Builds and configures the Fastify instance. Kept separate from `server.js`
 * so it can be imported in tests without binding a port.
 */
export function buildApp() {
  const app = Fastify({ logger: true })

  app.register(cors, { origin: true })

  // Serve rendered videos from /videos/<file>.mp4 so they're viewable in a browser.
  mkdirSync(OUTPUT_DIR, { recursive: true })
  app.register(fastifyStatic, { root: OUTPUT_DIR, prefix: VIDEO_ROUTE_PREFIX })

  // Map our typed HttpErrors to clean responses; everything else is a 500.
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({ error: err.message })
    }
    if (err.validation) {
      return reply.status(400).send({ error: err.message })
    }
    app.log.error(err)
    return reply.status(500).send({ error: 'Internal Server Error' })
  })

  app.get('/health', async () => ({ ok: true }))
  app.register(ugcRoutes)

  return app
}
