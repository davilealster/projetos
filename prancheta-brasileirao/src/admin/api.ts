import type { OverridesDoc, PlayerOverride, TeamOverride } from "../lib/overrides";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as { error?: string }).error ?? `Erro ${res.status}`), { status: res.status });
  return body as T;
}

export const adminApi = {
  me: () => call<{ user: string }>("/api/admin/me"),
  login: (user: string, password: string) =>
    call<{ user: string }>("/api/admin/login", { method: "POST", body: JSON.stringify({ user, password }) }),
  logout: () => call("/api/admin/logout", { method: "POST" }),
  changePassword: (current: string, user: string, password: string) =>
    call<{ user: string }>("/api/admin/password", { method: "POST", body: JSON.stringify({ current, user, password }) }),
  overrides: () => call<OverridesDoc>("/api/admin/overrides"),
  patch: (patch: { players?: Record<string, PlayerOverride | null>; teams?: Record<string, TeamOverride | null> }) =>
    call<OverridesDoc>("/api/admin/overrides", { method: "PUT", body: JSON.stringify(patch) }),
};

/** Linha do JSON gerado por build-data (src/data/admin/{slug}.json). */
export interface AdminPlayer {
  id: number;
  apiName: string;
  apiPos: string | null;
  apiNumber: number | null;
  photo: string | null;
  name: string;
  number: number | null;
  pos: import("../types").Pos;
  alt: import("../types").Pos[];
  hidden: boolean;
  source: "override" | "draft" | "sportsdb" | "api";
  note: string | null;
}

const loaders = import.meta.glob<{ default: { slug: string; updatedAt: string; players: AdminPlayer[] } }>("../data/admin/*.json");
export const loadAdminTeam = async (slug: string) => (await loaders[`../data/admin/${slug}.json`]()).default;
