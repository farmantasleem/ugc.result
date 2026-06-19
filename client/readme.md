# UGC Studio  client

A chat interface that turns a product message (description + URL) into a short
UGC-style video and drops the video link back into the chat.

> **Status:** frontend only. The video pipeline is currently **static**  it
> simulates reading the page, understanding the product, scripting, and
> rendering, then returns a sample clip. Shapes match the planned backend so
> wiring it up later is a drop-in change.

## Stack

- **Vite** + **React 18**
- **Tailwind CSS** with a single token-based theme (`src/theme/theme.css`)

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

## Structure

```
src/
  theme/theme.css        Design tokens (semantic colors as CSS variables)
  lib/productParser.js   Heuristic extraction of product name + URL from text
  data/mockPipeline.js   Static pipeline stages + sample video result
  hooks/useChat.js       Chat state + (simulated) pipeline timeline
  components/            Presentational, theme-based UI pieces
    Header, MessageList, ChatBubble, PipelineStatus,
    VideoCard, ChatInput, EmptyState, icons
  App.jsx
```

## Going live later

Replace the timed walk in `hooks/useChat.js` with a `fetch` to the backend and
update the pipeline message in place  components consume the same message
shapes (`text` | `pipeline` | `video`), so no UI changes are needed.
