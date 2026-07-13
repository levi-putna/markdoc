import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * Resolves the Vercel AI Gateway API key for optional live integration tests.
 * Checks `process.env` first, then `.env` in the project root (not loaded in CI).
 */
export function getAiGatewayApiKey(): string | undefined {
  const fromEnv = process.env.AI_GATEWAY_API_KEY?.trim()
  if (fromEnv) return fromEnv

  const envPath = join(process.cwd(), '.env')
  if (!existsSync(envPath)) return undefined

  const match = readFileSync(envPath, 'utf-8').match(/^AI_GATEWAY_API_KEY=(.+)$/m)
  return match?.[1]?.trim() || undefined
}

/**
 * Whether live AI Gateway tests should run (key present locally or in env).
 */
export function hasAiGatewayApiKey(): boolean {
  return Boolean(getAiGatewayApiKey())
}
