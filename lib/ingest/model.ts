import { createAnthropic } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'

/**
 * Where extraction calls go.
 *
 * Vercel AI Gateway is the default: OIDC authentication means no provider key
 * lives in the repo or in env, and it gives per-call cost and latency tracking
 * for free. Gateway access to Anthropic models needs paid credits on the team,
 * though, so a direct `ANTHROPIC_API_KEY` takes precedence when one is set —
 * that path needs no Vercel billing at all.
 *
 * Either way the model id is one string, and nothing else in the app knows or
 * cares which route was taken.
 */
export const MODEL_ID = process.env.EXTRACTION_MODEL ?? 'claude-opus-5'

export function extractionModel(): LanguageModel {
  const key = process.env.ANTHROPIC_API_KEY
  if (key) {
    return createAnthropic({ apiKey: key })(MODEL_ID)
  }
  // A plain "provider/model" string routes through AI Gateway automatically.
  return `anthropic/${MODEL_ID}`
}

export function routeDescription(): string {
  return process.env.ANTHROPIC_API_KEY
    ? `${MODEL_ID} (direct Anthropic API)`
    : `anthropic/${MODEL_ID} (Vercel AI Gateway)`
}
