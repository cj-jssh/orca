import { noteProviderCacheAnswer } from './hosted-review-provider-read'

export type HostedPullRequestPageFetcher<TRaw> = (page: number) => Promise<TRaw[] | null>

type ScanEntry<TRaw> = {
  expiresAt: number
  expirationTimer: ReturnType<typeof setTimeout>
  pullRequests: TRaw[]
}

// Absorb card-refresh bursts while promptly discovering externally created PRs.
const SCAN_TTL_MS = 30_000
// Retry failures sooner than successful listings so outages do not look like durable misses.
const FAILED_SCAN_RETRY_MS = 3_000
// Each payload can retain hundreds of PRs; TTL alone does not bound session memory.
const MAX_SCAN_CACHE_ENTRIES = 32

const scanCache = new Map<string, ScanEntry<unknown>>()
const inFlightScans = new Map<string, Promise<unknown[]>>()
// Fence in-flight scans so invalidation cannot recache pre-create listings.
const scanGenerations = new Map<string, number>()
const activeScanCounts = new Map<string, number>()

function removeScanCacheEntry(repoKey: string, expected?: ScanEntry<unknown>): void {
  const entry = scanCache.get(repoKey)
  if (!entry || (expected && entry !== expected)) {
    return
  }
  clearTimeout(entry.expirationTimer)
  scanCache.delete(repoKey)
}

function rememberScanCacheEntry(repoKey: string, pullRequests: unknown[], ttlMs: number): void {
  removeScanCacheEntry(repoKey)
  let entry!: ScanEntry<unknown>
  const expirationTimer = setTimeout(() => removeScanCacheEntry(repoKey, entry), ttlMs)
  expirationTimer.unref()
  entry = {
    expiresAt: Date.now() + ttlMs,
    expirationTimer,
    pullRequests
  }
  scanCache.set(repoKey, entry)
  while (scanCache.size > MAX_SCAN_CACHE_ENTRIES) {
    const oldestKey = scanCache.keys().next().value
    if (oldestKey === undefined) {
      break
    }
    removeScanCacheEntry(oldestKey)
  }
}

function reusableScanCacheEntry(repoKey: string): ScanEntry<unknown> | null {
  const entry = scanCache.get(repoKey)
  if (!entry) {
    return null
  }
  if (Date.now() >= entry.expiresAt) {
    removeScanCacheEntry(repoKey, entry)
    return null
  }
  // Refresh recency for users switching among repositories.
  scanCache.delete(repoKey)
  scanCache.set(repoKey, entry)
  return entry
}

/**
 * PRs of providers without head-branch filtering need a full listing, so card bursts
 * share one paginated scan per repository instead of one request per card.
 */
export async function scanHostedPullRequests<TRaw>(
  repoKey: string,
  fetchPage: HostedPullRequestPageFetcher<TRaw>,
  pageLimit: number,
  maxPages: number
): Promise<TRaw[]> {
  const cached = reusableScanCacheEntry(repoKey)
  if (cached) {
    noteProviderCacheAnswer()
    return cached.pullRequests as TRaw[]
  }
  const running = inFlightScans.get(repoKey)
  if (running) {
    noteProviderCacheAnswer()
    return running as Promise<TRaw[]>
  }
  const generation = scanGenerations.get(repoKey) ?? 0
  activeScanCounts.set(repoKey, (activeScanCounts.get(repoKey) ?? 0) + 1)
  const scan = (async () => {
    const pullRequests: TRaw[] = []
    let completed = true
    for (let page = 1; page <= maxPages; page++) {
      const list = await fetchPage(page)
      if (!list) {
        completed = false
        break
      }
      pullRequests.push(...list)
      if (list.length < pageLimit) {
        break
      }
    }
    if ((scanGenerations.get(repoKey) ?? 0) === generation) {
      rememberScanCacheEntry(repoKey, pullRequests, completed ? SCAN_TTL_MS : FAILED_SCAN_RETRY_MS)
    }
    return pullRequests
  })()
  inFlightScans.set(repoKey, scan)
  try {
    return await scan
  } finally {
    if (inFlightScans.get(repoKey) === scan) {
      inFlightScans.delete(repoKey)
    }
    const activeScans = (activeScanCounts.get(repoKey) ?? 1) - 1
    if (activeScans > 0) {
      activeScanCounts.set(repoKey, activeScans)
    } else {
      activeScanCounts.delete(repoKey)
      scanGenerations.delete(repoKey)
    }
  }
}

/** Invalidate after mutations to prevent stale missing-review results. */
export function invalidateHostedPullRequestScan(repoKey: string): void {
  removeScanCacheEntry(repoKey)
  inFlightScans.delete(repoKey)
  if ((activeScanCounts.get(repoKey) ?? 0) > 0) {
    scanGenerations.set(repoKey, (scanGenerations.get(repoKey) ?? 0) + 1)
  } else {
    scanGenerations.delete(repoKey)
  }
}

/** @internal - exposed for tests only */
export function resetHostedPullRequestScanCache(): void {
  for (const repoKey of scanCache.keys()) {
    removeScanCacheEntry(repoKey)
  }
  inFlightScans.clear()
  scanGenerations.clear()
  activeScanCounts.clear()
}

/** @internal - exposed for tests only */
export function hostedPullRequestScanCacheSize(): number {
  return scanCache.size
}
