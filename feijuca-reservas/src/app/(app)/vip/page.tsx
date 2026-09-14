"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/contexto";
import { useDados } from "@/components/usar-dados";
import { SemEvento } from "@/components/aviso-sem-evento";
import {
  AreaTexto,
  Campo,
  Esqueleto,
  Etiqueta,
  Folha,
  Selecao,
  Vazio,
  classes,
  useConfirmacao,
  useToast,
} from "@/components/ui";
import {
  IconeBusca,
  IconeCheck,
  IconeLink,
  IconeLixeira,
  IconeMais,
  IconeWhatsapp,
} from "@/components/icones";
import { api } from "@/lib/cliente";
import { formatarHora, formatarTelefone, linkWhatsapp } from "@/lib/formato";
import type { TipoVip, Vip } from "@/lib/types";

type Filtro = "TODOS" | "PENDENTE" | "CHECKIN";

const TIPOS: TipoVip[] = ["VIP", "CORTESIA", "DESCONTO", "ANIVERSARIANTE"];

const COR_TIPO: Record<TipoVip, "laranja" | "verde" | "azul" | "cinza"> = {
  VIP: "laranja",
  CORTESIA: "verde",
  DESCONTO: "azul",
  ANIVERSARIANTE: "laranja",
};

export default function PaginaVip() {
  const { evento, carregando: carregandoApp, podeVender, ehAdmin, atualizar } = useApp();
  const { dados, carregando, erro } = useDados<{ vips: Vip[] }>(
    evento ? `/api/vip?evento_id=${evento.id}` : null,
  );

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [novoAberto, setNovoAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<Vip | null>(null);

  const vips = useMemo(() => (dados?.vips ?? []).filter((v) => v.status !== "CANCELADO"), [dados]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return vips.filter((v) => {
      if (filtro !== "TODOS" && v.status !== filtro) return false;
      if (!termo) return true;
      return (
        v.nome.toLowerCase().includes(termo) ||
        v.documento.toLowerCase().includes(termo) ||
        v.instagram.toLowerCase().includes(termo) ||
        v.promoter.toLowerCase().includes(termo)
      );
    });
  }, [vips, busca, filtro]);

  if (carregandoApp) return <Esqueleto linhas={4} />;
  if (!evento) return <SemEvento />;

  const pessoas = vips.reduce((t, v) => t + 1 + (Number(v.acompanhantes) || 0), 0);
  const checkins = vips.filter((v) => v.status === "CHECKIN").length;
  const limite = Number(evento.capacidade_lista_vip) || 0;

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold">Lista VIP</h1>
          <p className="text-sm text-pds-muted">
            {vips.length} nomes · {pessoas} pessoas
            {limite ? ` de ${limite}` : ""} · {checkins} check-in
          </p>
        </div>
        {podeVender ? (
          <Link
            href="/listas"
            aria-label="Links de lista"
            className="shrink-0 rounded-xl border border-pds-line bg-pds-card p-2.5 text-pds-muted transition hover:border-pds-orange/60 hover:text-pds-orange"
          >
            <IconeLink width={20} height={20} />
          </Link>
        ) : null}
      </header>

      <div className="relative">
        <IconeBusca
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-pds-muted"
          width={18}
          height={18}
        />
        <input
          className="campo pl-11"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nome, documento, @ ou promoter"
          inputMode="search"
        />
      </div>

      <div className="sem-barra -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(
          [
            { chave: "TODOS", rotulo: `Todos (${vips.length})` },
            { chave: "PENDENTE", rotulo: `Aguardando (${vips.length - checkins})` },
            { chave: "CHECKIN", rotulo: `Entraram (${checkins})` },
          ] as { chave: Filtro; rotulo: string }[]
        ).map((f) => (
          <button
            key={f.chave}
            onClick={() => setFiltro(f.chave)}
            className={classes(
              "whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition",
              filtro === f.chave
                ? "border-pds-orange bg-pds-orange text-black"
                : "border-pds-line bg-pds-card text-pds-muted hover:text-white",
            )}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {erro ? (
        <p className="card px-4 py-3 text-sm text-red-300">{erro}</p>
      ) : carregando ? (
        <Esqueleto linhas={4} />
      ) : visiveis.length === 0 ? (
        <Vazio
          titulo={busca ? "Ninguém encontrado" : "Lista vazia"}
          descricao={
            busca
              ? "Confira a grafia ou tente buscar só o primeiro nome."
              : "Adicione o primeiro nome na lista da portaria deste evento."
          }
        />
      ) : (
        <ul className="space-y-2">
          {visiveis.map((vip) => (
            <LinhaVip
              key={vip.id}
              vip={vip}
              aoAbrir={() => setSelecionado(vip)}
              aoAtualizar={atualizar}
            />
          ))}
        </ul>
      )}

      <button
        onClick={() => setNovoAberto(true)}
        className="fixed bottom-[calc(5.5rem+var(--safe-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-pds-orange text-black shadow-glow transition active:scale-95"
        aria-label="Adicionar nome na lista"
      >
        <IconeMais width={26} height={26} />
      </button>

      <Folha
        aberta={novoAberto}
        aoFechar={() => setNovoAberto(false)}
        titulo="Novo nome na lista"
        subtitulo={evento.nome}
      >
        <FormularioVip
          eventoId={evento.id}
          aoSalvar={() => {
            setNovoAberto(false);
            atualizar();
          }}
        />
      </Folha>

      {selecionado ? (
        <Folha
          aberta
          aoFechar={() => setSelecionado(null)}
          titulo={selecionado.nome}
          subtitulo={`${selecionado.tipo} · ${Number(selecionado.acompanhantes) || 0} acompanhante(s)`}
        >
          <DetalheVip
            vip={selecionado}
            podeEditar={podeVender}
            podeApagar={ehAdmin || podeVender}
            aoSalvar={() => {
              setSelecionado(null);
              atualizar();
            }}
          />
        </Folha>
      ) : null}
    </div>
  );
}

function LinhaVip({
  vip,
  aoAbrir,
  aoAtualizar,
}: {
  vip: Vip;
  aoAbrir: () => void;
  aoAtualizar: () => void;
}) {
  const avisar = useToast();
  const [ocupado, setOcupado] = useState(false);
  const entrou = vip.status === "CHECKIN";
  const acompanhantes = Number(vip.acompanhantes) || 0;

  async function alternar(e: React.MouseEvent) {
    e.stopPropagation();
    setOcupado(true);
    try {
      await api.patch(`/api/vip/${vip.id}`, { status: entrou ? "PENDENTE" : "CHECKIN" });
      avisar(entrou ? `Check-in de ${vip.nome} desfeito.` : `${vip.nome} entrou. Bom samba!`);
      aoAtualizar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha no check-in.", "erro");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={aoAbrir}
        onKeyDown={(e) => e.key === "Enter" && aoAbrir()}
        className={classes(
          "card flex cursor-pointer items-center gap-3 px-4 py-3 transition",
          entrou && "border-emerald-500/35 bg-emerald-500/5",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className={classes("truncate font-bold", entrou && "text-emerald-300")}>{vip.nome}</p>
          <p className="truncate text-xs text-pds-muted">
            {acompanhantes > 0 ? `+${acompanhantes} · ` : ""}
            {vip.tipo}
            {vip.promoter ? ` · ${vip.promoter}` : ""}
            {entrou && vip.checkin_em ? ` · entrou ${formatarHora(vip.checkin_em)}` : ""}
          </p>
        </div>

        <button
          onClick={alternar}
          disabled={ocupado}
          aria-label={entrou ? "Desfazer check-in" : "Fazer check-in"}
          className={classes(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition active:scale-95",
            entrou
              ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
              : "border-pds-line bg-black/40 text-pds-muted hover:border-pds-orange hover:text-pds-orange",
          )}
        >
          <IconeCheck width={20} height={20} />
        </button>
      </div>
    </li>
  );
}

function FormularioVip({
  eventoId,
  vip,
  aoSalvar,
}: {
  eventoId: string;
  vip?: Vip;
  aoSalvar: () => void;
}) {
  const avisar = useToast();
  const [form, setForm] = useState({
    nome: vip?.nome ?? "",
    documento: vip?.documento ?? "",
    telefone: vip?.telefone ?? "",
    instagram: vip?.instagram ?? "",
    acompanhantes: vip?.acompanhantes ?? "0",
    tipo: (vip?.tipo ?? "VIP") as TipoVip,
    promoter: vip?.promoter ?? "",
    observacoes: vip?.observacoes ?? "",
  });
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((atual) => ({ ...atual, [campo]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      if (vip) {
        await api.patch(`/api/vip/${vip.id}`, form);
        avisar("Nome atualizado.");
      } else {
        await api.post("/api/vip", { ...form, evento_id: eventoId });
        avisar(`${form.nome} entrou na lista.`);
      }
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao salvar.", "erro");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Campo rotulo="Nome completo *" value={form.nome} onChange={mudar("nome")} required autoFocus={!vip} />

      <div className="grid grid-cols-2 gap-3">
        <Selecao rotulo="Tipo" value={form.tipo} onChange={mudar("tipo")}>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Selecao>
        <Campo
          rotulo="Acompanhantes"
          value={form.acompanhantes}
          onChange={mudar("acompanhantes")}
          inputMode="numeric"
          placeholder="0"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="WhatsApp" value={form.telefone} onChange={mudar("telefone")} inputMode="tel" />
        <Campo rotulo="Documento" value={form.documento} onChange={mudar("documento")} placeholder="RG/CPF" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Instagram" value={form.instagram} onChange={mudar("instagram")} placeholder="@perfil" />
        <Campo rotulo="Quem indicou" value={form.promoter} onChange={mudar("promoter")} />
      </div>

      <AreaTexto rotulo="Observações" value={form.observacoes} onChange={mudar("observacoes")} />

      <button type="submit" disabled={enviando} className="btn-primario w-full">
        {enviando ? "Salvando..." : vip ? "Salvar alterações" : "Adicionar na lista"}
      </button>
    </form>
  );
}

function DetalheVip({
  vip,
  podeEditar,
  podeApagar,
  aoSalvar,
}: {
  vip: Vip;
  podeEditar: boolean;
  podeApagar: boolean;
  aoSalvar: () => void;
}) {
  const avisar = useToast();
  const confirmar = useConfirmacao();
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const whatsapp = linkWhatsapp(
    vip.telefone,
    `Fala ${vip.nome.split(" ")[0]}! Você está na lista da Feijuca do Papo de Samba.`,
  );

  if (editando) {
    return <FormularioVip eventoId={vip.evento_id} vip={vip} aoSalvar={aoSalvar} />;
  }

  async function remover() {
    const certeza = await confirmar({
      titulo: `Remover ${vip.nome} da lista?`,
      descricao: "O nome sai da lista da portaria deste evento.",
      confirmar: "Remover",
      perigo: true,
    });
    if (!certeza) return;
    setOcupado(true);
    try {
      await api.delete(`/api/vip/${vip.id}`);
      avisar("Nome removido da lista.");
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao remover.", "erro");
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Etiqueta cor={COR_TIPO[vip.tipo] ?? "cinza"}>{vip.tipo}</Etiqueta>
        <Etiqueta cor={vip.status === "CHECKIN" ? "verde" : "cinza"}>
          {vip.status === "CHECKIN" ? `Entrou ${formatarHora(vip.checkin_em)}` : "Aguardando"}
        </Etiqueta>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <Dado titulo="Acompanhantes" valor={vip.acompanhantes || "0"} />
        <Dado titulo="Documento" valor={vip.documento || "-"} />
        <Dado titulo="WhatsApp" valor={vip.telefone ? formatarTelefone(vip.telefone) : "-"} />
        <Dado titulo="Instagram" valor={vip.instagram ? `@${vip.instagram}` : "-"} />
        <Dado titulo="Indicado por" valor={vip.promoter || "-"} />
        <Dado titulo="Cadastrado por" valor={vip.criado_por || "-"} />
      </dl>

      {vip.observacoes ? (
        <p className="rounded-xl border border-pds-line bg-black/40 px-3.5 py-3 text-sm text-white/85">
          {vip.observacoes}
        </p>
      ) : null}

      <div className="grid gap-2">
        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noreferrer" className="btn-secundario w-full">
            <IconeWhatsapp width={18} height={18} /> Chamar no WhatsApp
          </a>
        ) : null}
        {podeEditar ? (
          <button onClick={() => setEditando(true)} className="btn-secundario w-full">
            Editar dados
          </button>
        ) : null}
        {podeApagar ? (
          <button onClick={remover} disabled={ocupado} className="btn-perigo w-full">
            <IconeLixeira width={18} height={18} /> Remover da lista
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Dado({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-pds-line bg-black/40 px-3.5 py-2.5">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-pds-muted">{titulo}</dt>
      <dd className="mt-0.5 truncate text-sm font-bold">{valor}</dd>
    </div>
  );
}
