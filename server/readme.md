# UGC Studio  Server

Fastify backend. Step 1: understand a GIF so it can later be matched to a product
and dropped into a UGC-style video.

## Run

```bash
cd server
npm install
cp .env.example .env      # then add OPENAI_API_KEY and GIPHY_API_KEY
npm run dev               # http://localhost:3001
```

## The pipeline routes

```
POST /internal/ugc/draft    # picks + understands assets, no video
POST /internal/ugc/render   # draft + assembles the MP4
{ "query": "I'm building CalAI, a calorie app. calai.app", "sampleCount": 4 }
```

From one chat query it runs the whole chain:

1. **Learn the product**  pull the URL out of the query, scrape the page, ask
   OpenAI what it does (also returns meme GIF search terms).
2. **Find a GIF**  search Giphy with those terms, pick randomly from the top
   results (relevant but varied), skipping recently-used ones.
3. **Understand the GIF**  `ffprobe` counts frames, `ffmpeg` tiles N evenly
   spaced ones into a single **contact sheet** PNG, OpenAI vision reads it.
4. **Write the line**  a funny ≤15-word overlay tying the GIF to the product.
5. **Find a background**  search Pexels (portrait) for a fitting scene.
6. **(render only) Assemble the MP4**  see below.

Why one contact sheet instead of N frames: the model still sees the motion of
the meme, but we pay for ~1 cheap image instead of 3–4  roughly 5–8× cheaper.

### Video assembly (`/render`)

Composites a 1080×1920, ~5s MP4 from the picked assets:

1. **Background**  Pexels image cover-cropped to 9:16 and darkened (`sharp`).
2. **Person**  GIF → frames → background removed per frame
   (`@imgly/background-removal-node`) → looping alpha clip. Falls back to the raw
   frames if the matting model is unavailable.
3. **Caption**  rendered as a transparent PNG via `sharp` + SVG (reliable fonts
   and wrapping, no ffmpeg `drawtext`).
4. **Composite**  ffmpeg stacks background ← person ← caption.

The file lands in `server/output/` and is served at `/videos/<file>.mp4`, so the
response gives you a clickable URL. Matting is the slow part (~2s/frame, capped
at 36 frames), so a render takes roughly 30–60s.

Sample response:

```json
{
  "product": { "name": "CalAI", "website": "calai.app", "description": "...", "category": "calorie tracker" },
  "gif": { "id": "...", "url": "https://.../giphy.gif", "title": "...", "searchedFor": "hungry cravings" },
  "understanding": { "description": "...", "mood": "...", "tags": ["..."], "isMeme": true },
  "line": "CalAI: because guessing your calories is a workout too.",
  "frames": { "total": 44, "sampled": 4, "grid": "2x2" }
}
```

## Layout

```
src/
  server.js                 entry  starts the app
  app.js                    builds Fastify (cors, error handler, routes)
  config/env.js             loads + validates env
  config/paths.js           output dir + /videos route prefix
  routes/ugc.routes.js      POST /internal/ugc/{draft,render}
  services/
    product.service.js      query URL → scrape → product + search terms
    giphy.service.js        search terms → a fitting, non-repeating GIF
    background.service.js    search terms → a fitting Pexels background (9:16)
    gifFrames.service.js    download → sample frames → contact sheet (ffmpeg)
    vision.service.js       contact sheet → OpenAI → structured understanding
    copy.service.js         product + understanding → funny ≤15-word line
    cutout.service.js       per-frame background removal (imgly)
    textLayer.service.js    caption → transparent PNG (sharp + SVG)
    assembly.service.js     compose bg + person + caption → MP4 (ffmpeg)
  lib/
    webpage.js              extract URL + scrape page text
    ffmpeg.js               ffmpeg/ffprobe runners
    httpError.js            typed errors mapped to HTTP responses
```

ffmpeg/ffprobe ship as the `ffmpeg-static` / `ffprobe-static` npm packages  no
system install needed. We reuse them for final video assembly in a later step.
