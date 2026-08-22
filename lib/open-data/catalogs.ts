export type OpenDataCatalog = {
  id: string
  name: string
  searchUrl: string
  jurisdiction: string
}

// Authoritative public metadata catalogues. Dataset records are fetched live.
export const OPEN_DATA_CATALOGS: readonly OpenDataCatalog[] = [
  {
    id: 'data-europa-eu',
    name: 'European Data Portal',
    searchUrl: 'https://data.europa.eu/api/hub/search/ckan/package_search',
    jurisdiction: 'EU',
  },
  {
    id: 'data-gov-us',
    name: 'Data.gov',
    searchUrl: 'https://catalog.data.gov/api/3/action/package_search',
    jurisdiction: 'US',
  },
  {
    id: 'hdx',
    name: 'Humanitarian Data Exchange',
    searchUrl: 'https://data.humdata.org/api/3/action/package_search',
    jurisdiction: 'Global humanitarian',
  },
] as const
