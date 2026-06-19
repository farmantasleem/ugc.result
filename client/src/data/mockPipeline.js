/*
 * Stages shown while the backend assembles the video. The real work is one
 * request (~30-60s for rendering + matting), so these are walked on a timeline
 * for feedback and then marked done when the response lands  the last stage
 * just holds until then.
 */

/** Ordered stages shown while the video is being assembled. */
export const PIPELINE_STAGES = [
  { id: 'read', label: 'Reading the product page', ms: 2500 },
  { id: 'gif', label: 'Finding a meme GIF', ms: 4000 },
  { id: 'understand', label: 'Understanding the GIF', ms: 4000 },
  { id: 'script', label: 'Writing the caption', ms: 3000 },
  { id: 'render', label: 'Rendering & uploading the video', ms: 12000 },
]
