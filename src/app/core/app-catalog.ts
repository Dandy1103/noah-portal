export interface CatalogSystem {
  repo: string;
  name?: string;
  url: string;
  online: boolean;
}

interface AppCatalog {
  systems: CatalogSystem[];
}

const LOCAL_ORIGINS: Record<string, string> = {
  'noah-portal': 'http://localhost:4200/',
  'noah-hrm': 'http://localhost:4201/',
  'noah-apps': 'http://localhost:4200/apps/',
};

let catalogRequest: Promise<AppCatalog | null> | null = null;
let catalogResult: AppCatalog | null | undefined;

function catalogUrl(): string {
  if (location.hostname === 'noah-platform.dandy-cheng.com') {
    return new URL('/api/apps/catalog', location.origin).href;
  }
  return 'https://noah-platform.dandy-cheng.com/api/apps/catalog';
}

export function loadCatalog(signal?: AbortSignal): Promise<AppCatalog | null> {
  if (signal?.aborted) return Promise.resolve(catalogResult ?? null);
  if (!catalogRequest) {
    catalogRequest = fetch(catalogUrl(), { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        const body: unknown = await response.json();
        if (!body || typeof body !== 'object') return null;
        const systems = (body as { systems?: unknown }).systems;
        return Array.isArray(systems) ? { systems: systems as CatalogSystem[] } : null;
      })
      .then((catalog) => {
        catalogResult = catalog;
        return catalog;
      })
      .catch(() => {
        catalogResult = null;
        return null;
      });
  }
  return catalogRequest;
}

export function appHref(repo: string, path: string, systems: CatalogSystem[] | null): string | null {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (local && LOCAL_ORIGINS[repo]) return new URL(path, LOCAL_ORIGINS[repo]).toString();
  const system = systems?.find((item) => item.repo === repo);
  if (!system || system.online !== true || !system.url) return null;
  try {
    const root = new URL(system.url, location.origin);
    const folder = root.pathname.endsWith('/') ? root.pathname : `${root.pathname}/`;
    return new URL(path, `${root.origin}${folder}`).toString();
  } catch {
    return null;
  }
}
