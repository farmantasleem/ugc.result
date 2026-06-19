import sharp from 'sharp'

/**
 * Renders the caption as a full-frame transparent PNG: bold white text, word
 * wrapped and centered near the top, with a dark outline so it reads over any
 * background. Done with SVG (not ffmpeg drawtext) for reliable fonts + wrapping.
 *
 * @param {string} caption
 * @param {{ width?: number, height?: number, fontSize?: number }} [opts]
 * @returns {Promise<Buffer>} PNG buffer sized width x height
 */
export async function renderCaption(caption, { width = 1080, height = 1920, fontSize = 56 } = {}) {
  const margin = 70
  const maxChars = Math.floor((width - margin * 2) / (fontSize * 0.52))
  const lines = wrap(caption, maxChars)

  const lineHeight = Math.round(fontSize * 1.25)
  const startY = Math.round(height * 0.1) + fontSize // ~10% from top

  const tspans = lines
    .map((line, i) => `<tspan x="${width / 2}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join('')

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text x="${width / 2}" y="${startY}" text-anchor="middle"
          font-family="'Liberation Sans','Arial','Helvetica Neue',sans-serif" font-size="${fontSize}"
          font-weight="700" fill="#ffffff"
          stroke="#000000" stroke-width="6" stroke-linejoin="round" paint-order="stroke">
      ${tspans}
    </text>
  </svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}

/** Greedy word wrap to ~maxChars per line. */
function wrap(text, maxChars) {
  const words = String(text).trim().split(/\s+/)
  const lines = []
  let current = ''
  for (const word of words) {
    if (current && (current + ' ' + word).length > maxChars) {
      lines.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) lines.push(current)
  return lines
}

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]),
  )
}
