"use client";

import Link from "next/link";
import { useApp } from "@/components/contexto";
import { useDados } from "@/components/usar-dados";
import { SemEvento } from "@/components/aviso-sem-evento";
import { Esqueleto, Etiqueta, classes } from "@/components/ui";
import { formatarDataExtenso, formatarMoeda } from "@/lib/formato";
import type { StatusPrioridade } from "@/lib/regras";
import type { Evento } from "@/lib/types";
import {
  IconeBistro,
  IconeBolo,
  IconeCadeado,
  IconeCadeadoAberto,
  IconeLista,
  IconeLounge,
  IconeMapa,
  IconeMesa,
  IconeSeta,
} from "@/components/icones";

interface Resumo {
  evento: Evento;
  prioridadeLounge: StatusPrioridade;
  lounge: { total: number; ocupados: number; livres: number; aniversariantes: number; checkins: number };
  bistro: { total: number; ocupados: number; livres: number; checkins: number };
  mesa: { total: number; ocupados: number; livres: number; checkins: number };
  vip: { nomes: number; pessoas: number; checkins: number; limite: number };
  pessoasReservadas: number;
  receitaPrevista: number;
}

export default function PaginaInicio() {
  const { evento, carregando: carregandoApp } = useApp();
  const { dados, carregando, erro } = useDados<Resumo>(
    evento ? `/api/resumo?evento_id=${evento.id}` : null,
  );

  if (carregandoApp) return <Esqueleto linhas={4} />;
  if (!evento) return <SemEvento />;

  const diasFalta = dados?.prioridadeLounge.dias ?? 0;

  return (
    <div className="space-y-4">
      {/* Cabecalho do evento */}
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-br from-pds-orange/25 via-pds-orange/5 to-transparent px-5 py-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-pds-orange">
            {evento.status === "ENCERRADO"
              ? "Evento encerrado"
              : diasFalta > 1
                ? `Faltam ${diasFalta} dias`
                : diasFalta === 1
                  ? "É amanhã!"
                  : diasFalta === 0
                    ? "É hoje!"
                    : "Evento passado"}
          </p>
          <h1 className="mt-1 text-xl font-extrabold leading-tight">{evento.nome}</h1>
          <p className="mt-1 text-sm capitalize text-pds-muted">
            {formatarDataExtenso(evento.data)}
            {evento.hora_inicio ? ` · ${evento.hora_inicio}` : ""}
          </p>
          {evento.local ? <p className="text-sm text-pds-muted">{evento.local}</p> : null}
        </div>
      </section>

      {/* Regra do lounge */}
      {dados ? (
        <section
          className={classes(
            "card flex items-start gap-3 px-4 py-4",
            dados.prioridadeLounge.liberado
              ? "border-emerald-500/35 bg-emerald-500/5"
              : "border-pds-orange/40 bg-pds-orange/5",
          )}
        >
          <span
            className={classes(
              "mt-0.5 shrink-0",
              dados.prioridadeLounge.liberado ? "text-emerald-400" : "text-pds-orange",
            )}
          >
            {dados.prioridadeLounge.liberado ? <IconeCadeadoAberto /> : <IconeCadeado />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              {dados.prioridadeLounge.liberado
                ? "Lounges liberados para todos"
                : "Lounges só para aniversariantes"}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-pds-muted">
              {dados.prioridadeLounge.mensagem}
            </p>
          </div>
        </section>
      ) : null}

      {erro ? (
        <p className="card px-4 py-3 text-sm text-red-300">{erro}</p>
      ) : carregando || !dados ? (
        <Esqueleto linhas={3} />
      ) : (
        <>
          <Link
            href="/mapa"
            className="card flex items-center gap-4 border-pds-orange/40 bg-gradient-to-r from-pds-orange/15 to-transparent px-5 py-4 transition active:scale-[.99]"
          >
            <span className="rounded-xl bg-pds-orange/20 p-2.5 text-pds-orange">
              <IconeMapa />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Mapa do salão</p>
              <p className="text-xs text-pds-muted">
                Planta da casa: toque na posição para reservar ou fazer check-in
              </p>
            </div>
            <IconeSeta className="shrink-0 text-pds-muted" width={18} height={18} />
          </Link>

          <div className="grid grid-cols-3 gap-2.5">
            <Cartao
              href="/lounge"
              titulo="Lounges"
              Icone={IconeLounge}
              ocupados={dados.lounge.ocupados}
              total={dados.lounge.total}
              extra={
                <span className="inline-flex items-center gap-1 text-pds-orangeSoft">
                  <IconeBolo width={12} height={12} />
                  {dados.lounge.aniversariantes} aniver.
                </span>
              }
            />
            <Cartao
              href="/bistro"
              titulo="Bistrôs"
              Icone={IconeBistro}
              ocupados={dados.bistro.ocupados}
              total={dados.bistro.total}
              extra={<span>{dados.bistro.livres} livres</span>}
            />
            <Cartao
              href="/mesas"
              titulo="Mesas"
              Icone={IconeMesa}
              ocupados={dados.mesa.ocupados}
              total={dados.mesa.total}
              extra={<span>{dados.mesa.livres} livres</span>}
            />
          </div>

          <Link
            href="/vip"
            className="card flex items-center gap-4 px-5 py-4 transition active:scale-[.99]"
          >
            <span className="rounded-xl bg-pds-orange/15 p-2.5 text-pds-orange">
              <IconeLista />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Lista VIP da portaria</p>
              <p className="text-xs text-pds-muted">
                {dados.vip.nomes} nome{dados.vip.nomes === 1 ? "" : "s"} · {dados.vip.pessoas}{" "}
                pessoa{dados.vip.pessoas === 1 ? "" : "s"}
                {dados.vip.limite ? ` de ${dados.vip.limite}` : ""} · {dados.vip.checkins} check-in
              </p>
            </div>
            <IconeSeta className="shrink-0 text-pds-muted" width={18} height={18} />
          </Link>

          <section className="card grid grid-cols-2 divide-x divide-pds-line">
            <div className="px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-pds-muted">
                Pessoas em mesa
              </p>
              <p className="mt-1 text-2xl font-extrabold">{dados.pessoasReservadas}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-pds-muted">
                Receita prevista
              </p>
              <p className="mt-1 text-2xl font-extrabold text-pds-orange">
                {formatarMoeda(dados.receitaPrevista)}
              </p>
            </div>
          </section>

          <section className="card px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-pds-muted">
              Check-ins de hoje
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Etiqueta cor="verde">Lista VIP: {dados.vip.checkins}</Etiqueta>
              <Etiqueta cor="laranja">Lounge: {dados.lounge.checkins}</Etiqueta>
              <Etiqueta cor="azul">Bistro: {dados.bistro.checkins}</Etiqueta>
              <Etiqueta cor="cinza">Mesas: {dados.mesa.checkins}</Etiqueta>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Cartao({
  href,
  titulo,
  Icone,
  ocupados,
  total,
  extra,
}: {
  href: string;
  titulo: string;
  Icone: (p: React.SVGProps<SVGSVGElement>) => JSX.Element;
  ocupados: number;
  total: number;
  extra: React.ReactNode;
}) {
  const percentual = total > 0 ? Math.round((ocupados / total) * 100) : 0;
  return (
    <Link href={href} className="card px-3 py-3.5 transition active:scale-[.98]">
      <div className="flex items-center gap-1.5 text-pds-orange">
        <Icone width={16} height={16} />
        <span className="text-[10px] font-bold uppercase tracking-wider">{titulo}</span>
      </div>
      <p className="mt-2 text-xl font-extrabold leading-none">
        {ocupados}
        <span className="text-sm font-bold text-pds-muted">/{total}</span>
      </p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-pds-orange transition-all"
          style={{ width: `${percentual}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-pds-muted">{extra}</p>
    </Link>
  );
}
