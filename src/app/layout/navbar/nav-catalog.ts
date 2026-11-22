export interface CatalogSystem {
  repo: string;
  name?: string;
  url: string;
  online: boolean;
}

export interface CatalogLink {
  label: string;
  app: string | null;
  path: string;
}

export interface CatalogSection {
  title: string;
  links: CatalogLink[];
}

export interface CatalogGroup {
  label: string;
  app: string | null;
  sections: CatalogSection[];
}

export interface NavCatalog {
  systems: CatalogSystem[];
  groups: CatalogGroup[];
}

export interface NavLink {
  label: string;
  href: string | null;
}

export interface NavSection {
  title: string;
  links: NavLink[];
}

export interface NavGroup {
  label: string;
  sections: NavSection[];
}

const LOCAL_ORIGINS: Record<string, string> = {
  'noah-portal': 'http://localhost:4200/',
  'noah-hrm': 'http://localhost:4201/',
  'noah-apps': 'http://localhost:4202/',
};

export function catalogUrl(): string {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return local ? 'http://localhost:3002/api/apps/catalog' : '/api/apps/catalog';
}

export function loadCatalog(signal: AbortSignal): Promise<NavCatalog | null> {
  return fetch(catalogUrl(), { signal })
    .then(async (response) => {
      if (!response.ok) return null;
      const body: unknown = await response.json();
      return isNavCatalog(body) ? body : null;
    })
    .catch(() => null);
}

export function applyNav(catalog: NavCatalog, self: string, hrmUrl: string): NavGroup[] {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const systems = new Map<string, CatalogSystem>();
  for (const system of catalog.systems) {
    if (!system || typeof system.repo !== 'string') continue;
    systems.set(system.repo, system);
  }
  const groups: NavGroup[] = [];
  for (const group of catalog.groups) {
    if (!group || typeof group.label !== 'string' || !Array.isArray(group.sections)) continue;
    const sections: NavSection[] = [];
    for (const section of group.sections) {
      if (!section || typeof section.title !== 'string' || !Array.isArray(section.links)) continue;
      const links: NavLink[] = [];
      for (const link of section.links) {
        if (!link || typeof link.label !== 'string') continue;
        links.push({ label: link.label, href: hrefFor(link, systems, self, hrmUrl, local) });
      }
      sections.push({ title: section.title, links });
    }
    const named = typeof group.app === 'string' ? systems.get(group.app) : undefined;
    const label = named && typeof named.name === 'string' && named.name.trim() ? named.name.trim() : group.label;
    groups.push({ label, sections });
  }
  return groups;
}

function hrefFor(
  link: CatalogLink,
  systems: Map<string, CatalogSystem>,
  self: string,
  hrmUrl: string,
  local: boolean,
): string | null {
  const app = typeof link.app === 'string' ? link.app : '';
  const path = typeof link.path === 'string' ? link.path : '';
  if (!app) return null;
  if (app === self) return new URL(path, document.baseURI).pathname;
  if (app === 'noah-hrm' && hrmUrl) return hrmHref(path, hrmUrl);
  if (local && LOCAL_ORIGINS[app]) return new URL(path, LOCAL_ORIGINS[app]).toString();
  const system = systems.get(app);
  if (!system || system.online !== true || !system.url) return null;
  const base = system.url.endsWith('/') ? system.url : `${system.url}/`;
  return new URL(path, base).toString();
}

function hrmHref(path: string, hrmUrl: string): string | null {
  try {
    const root = new URL(hrmUrl, location.origin);
    const folder = root.pathname.endsWith('/') ? root.pathname : `${root.pathname}/`;
    return new URL(path, `${root.origin}${folder}`).toString();
  } catch {
    return null;
  }
}

function isNavCatalog(value: unknown): value is NavCatalog {
  if (!value || typeof value !== 'object') return false;
  const record = value as { systems?: unknown; groups?: unknown };
  return Array.isArray(record.systems) && Array.isArray(record.groups);
}
