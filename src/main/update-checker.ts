import { app, net } from 'electron'
import { compareVersions } from '../shared/version'

/** GitHub repository that MarkDoc releases are published from. */
export const REPO_OWNER = 'levi-putna'
export const REPO_NAME = 'markdoc'
export const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`
export const REPO_RELEASES_URL = `${REPO_URL}/releases`

const PACKAGE_JSON_RAW_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/package.json`

export interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string
  isUpdateAvailable: boolean
}

/**
 * Checks whether a newer version of MarkDoc is available by comparing the
 * running app version against the `version` field of `package.json` on the
 * repository's default branch — this is the source of truth for the app
 * version and doesn't require a tagged GitHub release to exist.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()

  const response = await net.fetch(PACKAGE_JSON_RAW_URL)
  if (!response.ok) {
    throw new Error(`Failed to check for updates: HTTP ${response.status}`)
  }

  const { version: latestVersion } = (await response.json()) as { version: string }
  if (!latestVersion) {
    throw new Error('Failed to check for updates: no version found in repository')
  }

  return {
    currentVersion,
    latestVersion,
    isUpdateAvailable: compareVersions(latestVersion, currentVersion) > 0,
  }
}
