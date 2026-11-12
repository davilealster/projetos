// Último clube escolhido (Home, prancheta ou mercado). Só App.tsx e Home usam.
const KEY = "mando:clube";

export function getLastClub(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setLastClub(slug: string | null): void {
  try {
    if (slug) localStorage.setItem(KEY, slug);
    else localStorage.removeItem(KEY);
  } catch {
    /* armazenamento indisponível: segue sem lembrar */
  }
}
