import { OPEN_DATA_CATALOGS, type OpenDataCatalog } from './catalogs'

type CKANPackage = {
  id?: string
  name?: string
  title?: string
  notes?: string
  metadata_modified?: string
  license_title?: string
  url?: string
  resources?: Array<{ url?: string; format?: string; name?: string }>
}

type CKANResponse = {
  success?: boolean
  result?: { count?: number; results?: CKANPackage[] }
}

export type FederatedDataset = {
  id: string
  title: string
  description: string | null
  catalogId: string
  catalogName: string
  jurisdiction: string
  license: string | null
  modifiedAt: string | null
  landingPage: string | null
  resources: Array<{ url: string; format: string | null; name: string | null }>
}

type CatalogResult = {
  catalog: Pick<OpenDataCatalog, 'id' | 'name' | 'jurisdiction'>
  total: number
  latencyMs: number
  datasets: FederatedDataset[]
  error?: string
}

const cache = new Map<string, { expiresAt: number; value: CatalogResult[] }>()

async function searchCatalog(catalog: OpenDataCatalog, query: string, rows: number, start: number): Promise<CatalogResult> {
  const url = new URL(catalog.searchUrl)
  url.searchParams.set('q', query)
  url.searchParams.set('rows', String(rows))
  url.searchParams.set('start', String(start))
  const startedAt = performance.now()

  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(Number(process.env.OPEN_DATA_TIMEOUT_MS || '8000')),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json() as CKANResponse
    if (payload.success === false || !payload.result) throw new Error('Invalid CKAN response')
    const datasets = (payload.result.results || []).flatMap((item): FederatedDataset[] => {
      const id = item.id || item.name
      const title = item.title || item.name
      if (!id || !title) return []
      return [{
        id,
        title,
        description: item.notes || null,
        catalogId: catalog.id,
        catalogName: catalog.name,
        jurisdiction: catalog.jurisdiction,
        license: item.license_title || null,
        modifiedAt: item.metadata_modified || null,
        landingPage: item.url || null,
        resources: (item.resources || []).flatMap((resource) => resource.url ? [{
          url: resource.url,
          format: resource.format || null,
          name: resource.name || null,
        }] : []),
      }]
    })
    return {
      catalog: { id: catalog.id, name: catalog.name, jurisdiction: catalog.jurisdiction },
      total: typeof payload.result.count === 'number' ? payload.result.count : datasets.length,
      latencyMs: Math.round(performance.now() - startedAt),
      datasets,
    }
  } catch (error) {
    return {
      catalog: { id: catalog.id, name: catalog.name, jurisdiction: catalog.jurisdiction },
      total: 0,
      latencyMs: Math.round(performance.now() - startedAt),
      datasets: [],
      error: error instanceof Error ? error.message : 'Catalog unavailable',
    }
  }
}

export async function searchOpenData(query: string, rows = 20, start = 0) {
  const safeRows = Math.max(1, Math.min(rows, 100))
  const safeStart = Math.max(0, start)
  const cacheKey = `${query}\u0000${safeRows}\u0000${safeStart}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const results = await Promise.all(
    OPEN_DATA_CATALOGS.map((catalog) => searchCatalog(catalog, query, safeRows, safeStart))
  )
  cache.set(cacheKey, {
    expiresAt: Date.now() + Number(process.env.OPEN_DATA_CACHE_TTL_MS || '30000'),
    value: results,
  })
  return results
}
