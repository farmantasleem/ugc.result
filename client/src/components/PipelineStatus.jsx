import { CheckIcon } from './icons.jsx'

/**
 * Renders the live progress of the video pipeline inside an assistant bubble.
 * Stages before `activeStage` are complete, the one at `activeStage` is in
 * progress, and the rest are pending.
 */
export function PipelineStatus({ stages, activeStage, done }) {
  return (
    <ul className="space-y-2.5">
      {stages.map((stage, i) => {
        const isComplete = done || i < activeStage
        const isActive = !done && i === activeStage
        return (
          <li key={stage.id} className="flex items-center gap-3">
            <StageMarker complete={isComplete} active={isActive} />
            <span
              className={
                isComplete
                  ? 'text-content'
                  : isActive
                    ? 'text-content'
                    : 'text-muted'
              }
            >
              {stage.label}
              {isActive && <AnimatedDots />}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function StageMarker({ complete, active }) {
  if (complete) {
    return (
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast">
        <CheckIcon className="h-3 w-3" />
      </span>
    )
  }
  return (
    <span
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
        active ? 'border-accent' : 'border-border'
      }`}
    >
      {active && <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />}
    </span>
  )
}

function AnimatedDots() {
  return (
    <span className="ml-1 inline-flex gap-0.5 align-middle">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-1 animate-pulse-dot rounded-full bg-muted"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}
