import { useState } from 'react'
import { CheckIcon, CopyIcon, LinkIcon } from './icons.jsx'

/**
 * The final deliverable: an inline video player plus the shareable URL that
 * gets "dropped back into the chat". `result` matches buildVideoResult().
 */
export function VideoCard({ result }) {
  const { name, videoUrl, durationSec, caption } = result

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Here's a UGC-style video for <span className="font-semibold">{name}</span> 🎬
      </p>

      <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-xl border border-border bg-black">
        <video
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          className="aspect-[9/16] w-full bg-black"
        />
      </div>

      <p className="text-xs text-muted">{caption}</p>

      <VideoUrlBar url={videoUrl} durationSec={durationSec} />
    </div>
  )
}

function VideoUrlBar({ url, durationSec }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard may be blocked in some contexts  link is still visible */
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2">
      <LinkIcon className="h-4 w-4 shrink-0 text-accent" />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex-1 truncate text-xs text-content hover:underline"
        title={url}
      >
        {url}
      </a>
      <span className="hidden shrink-0 text-[11px] text-muted sm:inline">
        {durationSec}s
      </span>
      <button
        onClick={copy}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-muted transition hover:text-content"
      >
        {copied ? (
          <>
            <CheckIcon className="h-3.5 w-3.5" /> Copied
          </>
        ) : (
          <>
            <CopyIcon className="h-3.5 w-3.5" /> Copy
          </>
        )}
      </button>
    </div>
  )
}
