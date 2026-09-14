"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "./contexto";
import { classes, Folha, useToast } from "./ui";
import { formatarData } from "@/lib/formato";
import { api } from "@/lib/cliente";
import {
  IconeAtualizar,
  IconeBistro,
  IconeCalendario,
  IconeCasa,
  IconeFechar,
  IconeLista,
  IconeLounge,
  IconeMapa,
  IconeMenu,
  IconeMesa,
  IconeSair,
  IconeSeta,
  IconeUsuarios,
} from "./icones";

/** Barra inferior: o que a equipe usa durante o evento. */
const ABAS = [
  { href: "/", rotulo: "Inicio", Icone: IconeCasa },
  { href: "/mapa", rotulo: "Mapa", Icone: IconeMapa },
  { href: "/vip", rotulo: "Lista VIP", Icone: IconeLista },
  { href: "/lounge", rotulo: "Lounge", Icone: IconeLounge },
  { href: "/bistro", rotulo: "Bistro", Icone: IconeBistro },
];

/** Telas secundarias, so' na gaveta. */
const ABAS_GAVETA = [
  { href: "/mesas", rotulo: "Mesas únicas", Icone: IconeMesa },
  { href: "/eventos", rotulo: "Eventos", Icone: IconeCalendario },
];

const PAPEIS: Record<string, string> = {
  ADMIN: "Administrador",
  VENDAS: "Vendas",
  PORTARIA: "Portaria",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { usuario, evento, eventos, trocarEvento, ehAdmin, atualizar } = useApp();
  const [menuAberto, setMenuAberto] = useState(false);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const avisar = useToast();

  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  async function sair() {
    await api.post("/api/auth/logout");
    router.replace("/login");
    router.refresh();
  }

  const ativa = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ------------------------------ Topo ------------------------------ */}
      <header className="sticky top-0 z-40 border-b border-pds-line bg-black/85 pt-[var(--safe-top)] backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-3">
          <button
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            className="rounded-xl p-2.5 text-white transition hover:bg-white/10"
          >
            <IconeMenu />
          </button>

          <button
            onClick={() => setSeletorAberto(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-1 text-left transition hover:bg-white/5"
          >
            <Image
              src="/logo.jpg"
              alt="Familia Papo de Samba"
              width={40}
              height={40}
              priority
              className="h-10 w-10 shrink-0 rounded-full ring-1 ring-pds-orange/50"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold leading-tight">
                {evento ? evento.nome : "Feijuca PDS"}
              </span>
              <span className="block truncate text-xs text-pds-muted">
                {evento ? `${formatarData(evento.data)} · trocar evento` : "Nenhum evento ativo"}
              </span>
            </span>
            <IconeSeta className="shrink-0 rotate-90 text-pds-muted" width={16} height={16} />
          </button>

          <button
            onClick={() => {
              atualizar();
              avisar("Dados atualizados.");
            }}
            aria-label="Atualizar dados"
            className="rounded-xl p-2.5 text-pds-muted transition hover:bg-white/10 hover:text-white"
          >
            <IconeAtualizar />
          </button>
        </div>
      </header>

      {/* ---------------------------- Conteudo ---------------------------- */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-[calc(6.5rem+var(--safe-bottom))] pt-4">
        {children}
      </main>

      {/* --------------------------- Barra baixo -------------------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-pds-line bg-black/90 pb-[var(--safe-bottom)] backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-stretch">
          {ABAS.map(({ href, rotulo, Icone }) => {
            const on = ativa(href);
            return (
              <Link
                key={href}
                href={href}
                className={classes(
                  "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-bold uppercase tracking-wide transition",
                  on ? "text-pds-orange" : "text-pds-muted hover:text-white",
                )}
              >
                {on ? (
                  <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-pds-orange" />
                ) : null}
                <Icone width={22} height={22} />
                {rotulo}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ----------------------------- Gaveta ----------------------------- */}
      {menuAberto ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Fechar menu"
            onClick={() => setMenuAberto(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <aside className="animate-slide-in absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col border-r border-pds-line bg-pds-ink pt-[var(--safe-top)]">
            <div className="flex items-center gap-3 border-b border-pds-line px-5 py-5">
              <Image
                src="/logo.jpg"
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 rounded-full ring-1 ring-pds-orange/50"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{usuario?.nome}</p>
                <p className="text-xs text-pds-orange">
                  {PAPEIS[usuario?.papel ?? ""] ?? usuario?.papel}
                </p>
              </div>
              <button
                onClick={() => setMenuAberto(false)}
                aria-label="Fechar"
                className="rounded-full p-2 text-pds-muted hover:bg-white/5 hover:text-white"
              >
                <IconeFechar width={20} height={20} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3">
              {[...ABAS, ...ABAS_GAVETA].map(({ href, rotulo, Icone }) => (
                <Link
                  key={href}
                  href={href}
                  className={classes(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition",
                    ativa(href)
                      ? "bg-pds-orange/15 text-pds-orange"
                      : "text-white/85 hover:bg-white/5",
                  )}
                >
                  <Icone width={20} height={20} />
                  {rotulo}
                </Link>
              ))}
              {ehAdmin ? (
                <>
                  <p className="px-4 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wider text-pds-muted">
                    Administracao
                  </p>
                  <Link
                    href="/usuarios"
                    className={classes(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition",
                      ativa("/usuarios")
                        ? "bg-pds-orange/15 text-pds-orange"
                        : "text-white/85 hover:bg-white/5",
                    )}
                  >
                    <IconeUsuarios width={20} height={20} />
                    Usuarios
                  </Link>
                </>
              ) : null}
            </nav>

            <div className="border-t border-pds-line p-3 pb-[calc(0.75rem+var(--safe-bottom))]">
              <button
                onClick={sair}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/10"
              >
                <IconeSair width={20} height={20} />
                Sair
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {/* ------------------------ Seletor de evento ----------------------- */}
      <Folha
        aberta={seletorAberto}
        aoFechar={() => setSeletorAberto(false)}
        titulo="Escolher evento"
        subtitulo="Cada evento tem lista, bistros e lounges proprios."
      >
        <div className="space-y-2">
          {eventos.length === 0 ? (
            <p className="py-6 text-center text-sm text-pds-muted">
              Nenhum evento cadastrado ainda.
            </p>
          ) : null}
          {eventos.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                trocarEvento(e.id);
                setSeletorAberto(false);
              }}
              className={classes(
                "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
                e.id === evento?.id
                  ? "border-pds-orange bg-pds-orange/10"
                  : "border-pds-line bg-black/40 hover:border-white/25",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{e.nome}</p>
                <p className="text-xs text-pds-muted">
                  {formatarData(e.data)} · {e.status.toLowerCase()}
                </p>
              </div>
              {e.id === evento?.id ? (
                <span className="text-xs font-bold text-pds-orange">atual</span>
              ) : null}
            </button>
          ))}
          <Link
            href="/eventos"
            onClick={() => setSeletorAberto(false)}
            className="btn-secundario mt-2 w-full"
          >
            Gerenciar eventos
          </Link>
        </div>
      </Folha>
    </div>
  );
}
