import { SparkIcon } from './icons.jsx'

const SUGGESTIONS = [
  "I'm building CalAI, a calorie-tracking app. Here's the site: calai.app",
  'Make a UGC video for Notion  notion.so',
  'Promote my coffee brand BrewBox at brewbox.coffee',
]

/** Shown before the first message: pitch + clickable example prompts. */
export function EmptyState({ onPickSuggestion }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-10 text-center">
      <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-contrast shadow-glow">
        <SparkIcon className="h-7 w-7" />
      </span>
      <h2 className="font-display text-xl font-semibold sm:text-2xl">
        Turn a product link into a UGC video
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted">
        Describe your product and drop its URL. I'll read the page, understand
        the product, and assemble a short UGC-style video  then send the link
        right back here.
      </p>

      <div className="mt-7 grid w-full gap-2">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            onClick={() => onPickSuggestion(text)}
            className="card px-4 py-3 text-left text-sm text-muted transition hover:border-accent hover:text-content"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
