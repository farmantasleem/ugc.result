import { SparkIcon } from './icons.jsx'

/** App bar. `onReset` clears the conversation. */
export function Header({ onReset, canReset }) {
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-contrast">
          <SparkIcon />
        </span>
        <div className="leading-tight">
          <h1 className="font-display text-sm font-semibold sm:text-base">
            UGC Studio
          </h1>
          <p className="text-xs text-muted">Product link → short UGC video</p>
        </div>
      </div>

      {canReset && (
        <button
          onClick={onReset}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:text-content"
        >
          New chat
        </button>
      )}
    </header>
  )
}
