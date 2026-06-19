import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { removeBackground } from '@imgly/background-removal-node'

/**
 * Isolated background-removal worker. Run as its own process so a native crash
 * in onnxruntime (e.g. "munmap_chunk(): invalid pointer" / "Aborted (core
 * dumped)") takes down only this worker, not the API server.
 *
 * Invoked as:  node cutout.worker.js <jobJsonPath>
 * where the JSON file holds { framePaths: string[], outDir: string }.
 * On success it writes f_0001.png... into outDir and prints the resulting
 * paths as JSON on stdout; on failure it exits non-zero.
 */
async function main() {
  const jobPath = process.argv[2]
  if (!jobPath) throw new Error('cutout.worker: missing job file argument')

  const { framePaths, outDir } = JSON.parse(await readFile(jobPath, 'utf8'))
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
  process.stdout.write(JSON.stringify(out))
}

main().catch((err) => {
  process.stderr.write(String(err?.stack ?? err))
  process.exit(1)
})
