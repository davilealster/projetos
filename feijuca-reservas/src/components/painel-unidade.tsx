"use client";

import { useState } from "react";
import { AreaTexto, Campo, Etiqueta, Folha, Interruptor, useToast } from "./ui";
import { IconeBolo, IconeCheck, IconeLixeira, IconeWhatsapp } from "./icones";
import { api } from "@/lib/cliente";
import { formatarMoeda, formatarValorReserva, formatarTelefone, linkWhatsapp } from "@/lib/formato";
import type { Reserva, TipoUnidade, UnidadeComReserva } from "@/lib/types";

export const ROTULO: Record<TipoUnidade, { singular: string; plural: string }> = {
  LOUNGE: { singular: "Lounge", plural: "Lounges" },
  BISTRO: { singular: "Bistrô", plural: "Bistrôs" },
  MESA: { singular: "Mesa", plural: "Mesas únicas" },
};

/* --------------------------- Painel da unidade --------------------------- */

export interface PainelProps {
  tipo: TipoUnidade;
  unidade: UnidadeComReserva;
  eventoId: string;
  eventoEncerrado: boolean;
  prioridadeLiberada: boolean;
  motivoBloqueio: string | null;
  podeVender: boolean;
  podeApagar: boolean;
  aoFechar: () => void;
  aoSalvar: () => void;
}

export function PainelUnidade(props: PainelProps) {
  const { unidade, tipo } = props;
  const titulo = `${ROTULO[tipo].singular} ${unidade.numero}`;
  const subtitulo = [
    unidade.capacidade ? `até ${unidade.capacidade} pessoas` : null,
    formatarValorReserva(unidade.valor),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Folha aberta aoFechar={props.aoFechar} titulo={titulo} subtitulo={subtitulo}>
      {unidade.reserva ? (
        <DetalheReserva {...props} reserva={unidade.reserva} />
      ) : (
        <NovaReserva {...props} />
      )}
    </Folha>
  );
}

function NovaReserva({
  tipo,
  unidade,
  eventoId,
  eventoEncerrado,
  prioridadeLiberada,
  motivoBloqueio,
  podeVender,
  aoSalvar,
}: PainelProps) {
  const avisar = useToast();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [pessoas, setPessoas] = useState(unidade.capacidade || "");
  const [aniversariante, setAniversariante] = useState(tipo === "LOUNGE");
  const [dataAniversario, setDataAniversario] = useState("");
  const [valor, setValor] = useState(unidade.valor || "");
  const [sinal, setSinal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);

  const bloqueadoPelaRegra =
    tipo === "LOUNGE" && !aniversariante && !prioridadeLiberada && Boolean(motivoBloqueio);

  if (!podeVender) {
    return (
      <p className="py-8 text-center text-sm text-pds-muted">
        {ROTULO[tipo].singular} livre. Seu perfil nao pode criar reservas — fale com vendas ou com
        um administrador.
      </p>
    );
  }

  if ((unidade.status ?? "").toUpperCase() === "BLOQUEADO") {
    return (
      <p className="py-8 text-center text-sm text-pds-muted">
        Esta unidade esta bloqueada. Um administrador pode liberar na tela de eventos.
      </p>
    );
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post("/api/reservas", {
        evento_id: eventoId,
        tipo,
        unidade_id: unidade.id,
        nome_cliente: nome,
        telefone,
        instagram,
        qtd_pessoas: pessoas,
        aniversariante: aniversariante ? "SIM" : "NAO",
        data_aniversario: dataAniversario,
        valor,
        sinal_pago: sinal,
        observacoes,
      });
      avisar(`${ROTULO[tipo].singular} ${unidade.numero} reservado para ${nome}.`);
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Nao foi possivel reservar.", "erro");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      {eventoEncerrado ? (
        <p className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2.5 text-sm text-red-200">
          Evento encerrado: nao aceita novas reservas.
        </p>
      ) : null}

      {tipo === "LOUNGE" ? (
        <Interruptor
          destaque
          rotulo="E' aniversariante"
          descricao="Aniversariantes tem prioridade nos lounges ate a vespera."
          ativo={aniversariante}
          aoMudar={setAniversariante}
        />
      ) : null}

      {bloqueadoPelaRegra ? (
        <p className="rounded-xl border border-pds-orange/50 bg-pds-orange/10 px-3 py-2.5 text-xs leading-relaxed text-pds-orangeSoft">
          {motivoBloqueio}
        </p>
      ) : null}

      <Campo
        rotulo="Nome do cliente *"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome completo"
        required
      />

      <div className="grid grid-cols-2 gap-3">
        <Campo
          rotulo="WhatsApp"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          inputMode="tel"
          placeholder="(21) 99999-0000"
        />
        <Campo
          rotulo="Pessoas"
          value={pessoas}
          onChange={(e) => setPessoas(e.target.value)}
          inputMode="numeric"
          placeholder={unidade.capacidade || "0"}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo
          rotulo="Instagram"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="@perfil"
        />
        {aniversariante ? (
          <Campo
            rotulo="Data do aniversario"
            type="date"
            value={dataAniversario}
            onChange={(e) => setDataAniversario(e.target.value)}
          />
        ) : (
          <Campo
            rotulo="Valor (R$)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="0 = cortesia"
          />
        )}
      </div>

      {aniversariante ? (
        <div className="grid grid-cols-2 gap-3">
          <Campo
            rotulo="Valor (R$)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="0 = cortesia"
          />
          <Campo
            rotulo="Sinal pago (R$)"
            value={sinal}
            onChange={(e) => setSinal(e.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
        </div>
      ) : (
        <Campo
          rotulo="Sinal pago (R$)"
          value={sinal}
          onChange={(e) => setSinal(e.target.value)}
          inputMode="decimal"
          placeholder="0"
        />
      )}

      <AreaTexto
        rotulo="Observacoes"
        value={observacoes}
        onChange={(e) => setObservacoes(e.target.value)}
        placeholder="Combinados, decoracao, bolo, etc."
      />

      <button
        type="submit"
        disabled={enviando || bloqueadoPelaRegra || eventoEncerrado}
        className="btn-primario w-full"
      >
        {enviando ? "Salvando..." : `Reservar ${ROTULO[tipo].singular.toLowerCase()} ${unidade.numero}`}
      </button>
    </form>
  );
}

function DetalheReserva({
  tipo,
  unidade,
  reserva,
  podeVender,
  podeApagar,
  aoSalvar,
}: PainelProps & { reserva: Reserva }) {
  const avisar = useToast();
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState(false);

  const whatsapp = linkWhatsapp(
    reserva.telefone,
    `Fala ${reserva.nome_cliente.split(" ")[0]}! Aqui e' da Feijuca do Papo de Samba sobre o seu ${ROTULO[
      tipo
    ].singular.toLowerCase()} ${unidade.numero}.`,
  );

  async function mudarStatus(status: Reserva["status"], mensagem: string) {
    setOcupado(true);
    try {
      await api.patch(`/api/reservas/${reserva.id}`, { status });
      avisar(mensagem);
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao atualizar.", "erro");
      setOcupado(false);
    }
  }

  async function apagar() {
    if (!confirm(`Apagar definitivamente a reserva de ${reserva.nome_cliente}?`)) return;
    setOcupado(true);
    try {
      await api.delete(`/api/reservas/${reserva.id}`);
      avisar("Reserva apagada.");
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao apagar.", "erro");
      setOcupado(false);
    }
  }

  if (editando) {
    return (
      <EditarReserva
        reserva={reserva}
        aoCancelar={() => setEditando(false)}
        aoSalvar={aoSalvar}
      />
    );
  }

  const cores: Record<Reserva["status"], "laranja" | "verde" | "azul" | "vermelho"> = {
    PENDENTE: "laranja",
    CONFIRMADA: "azul",
    CHECKIN: "verde",
    CANCELADA: "vermelho",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Etiqueta cor={cores[reserva.status]}>{reserva.status}</Etiqueta>
        {reserva.aniversariante === "SIM" ? (
          <Etiqueta cor="laranja">
            <IconeBolo width={12} height={12} /> Aniversariante
          </Etiqueta>
        ) : null}
      </div>

      <div>
        <p className="text-lg font-extrabold">{reserva.nome_cliente}</p>
        <p className="text-sm text-pds-muted">
          {reserva.qtd_pessoas || "?"} pessoas
          {reserva.telefone ? ` · ${formatarTelefone(reserva.telefone)}` : ""}
          {reserva.instagram ? ` · @${reserva.instagram}` : ""}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <Info titulo="Valor" valor={formatarValorReserva(reserva.valor)} />
        <Info titulo="Sinal pago" valor={formatarMoeda(reserva.sinal_pago)} />
        {reserva.data_aniversario ? (
          <Info titulo="Aniversario" valor={reserva.data_aniversario.split("-").reverse().join("/")} />
        ) : null}
        <Info titulo="Vendido por" valor={reserva.criado_por || "-"} />
      </dl>

      {reserva.observacoes ? (
        <p className="rounded-xl border border-pds-line bg-black/40 px-3.5 py-3 text-sm text-white/85">
          {reserva.observacoes}
        </p>
      ) : null}

      <div className="grid gap-2">
        {reserva.status !== "CHECKIN" ? (
          <button
            disabled={ocupado}
            onClick={() => mudarStatus("CHECKIN", `Check-in de ${reserva.nome_cliente} registrado.`)}
            className="btn-primario w-full"
          >
            <IconeCheck width={18} height={18} /> Fazer check-in
          </button>
        ) : (
          <button
            disabled={ocupado}
            onClick={() => mudarStatus("CONFIRMADA", "Check-in desfeito.")}
            className="btn-secundario w-full"
          >
            Desfazer check-in
          </button>
        )}

        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noreferrer" className="btn-secundario w-full">
            <IconeWhatsapp width={18} height={18} /> Chamar no WhatsApp
          </a>
        ) : null}

        {podeVender ? (
          <>
            {reserva.status === "PENDENTE" ? (
              <button
                disabled={ocupado}
                onClick={() => mudarStatus("CONFIRMADA", "Reserva confirmada.")}
                className="btn-secundario w-full"
              >
                Confirmar reserva
              </button>
            ) : null}
            <button onClick={() => setEditando(true)} className="btn-secundario w-full">
              Editar dados
            </button>
            <button
              disabled={ocupado}
              onClick={() =>
                confirm(`Liberar o ${ROTULO[tipo].singular.toLowerCase()} ${unidade.numero}?`) &&
                mudarStatus("CANCELADA", `${ROTULO[tipo].singular} ${unidade.numero} liberado.`)
              }
              className="btn-perigo w-full"
            >
              Cancelar reserva
            </button>
          </>
        ) : null}

        {podeApagar ? (
          <button disabled={ocupado} onClick={apagar} className="btn-perigo w-full">
            <IconeLixeira width={18} height={18} /> Apagar da planilha
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Info({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-pds-line bg-black/40 px-3.5 py-2.5">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-pds-muted">{titulo}</dt>
      <dd className="mt-0.5 text-sm font-bold">{valor}</dd>
    </div>
  );
}

function EditarReserva({
  reserva,
  aoCancelar,
  aoSalvar,
}: {
  reserva: Reserva;
  aoCancelar: () => void;
  aoSalvar: () => void;
}) {
  const avisar = useToast();
  const [form, setForm] = useState({
    nome_cliente: reserva.nome_cliente,
    telefone: reserva.telefone,
    instagram: reserva.instagram,
    qtd_pessoas: reserva.qtd_pessoas,
    valor: reserva.valor,
    sinal_pago: reserva.sinal_pago,
    data_aniversario: reserva.data_aniversario,
    observacoes: reserva.observacoes,
  });
  const [aniversariante, setAniversariante] = useState(reserva.aniversariante === "SIM");
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((atual) => ({ ...atual, [campo]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.patch(`/api/reservas/${reserva.id}`, {
        ...form,
        aniversariante: aniversariante ? "SIM" : "NAO",
      });
      avisar("Reserva atualizada.");
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao salvar.", "erro");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      {reserva.tipo === "LOUNGE" ? (
        <Interruptor
          rotulo="E' aniversariante"
          ativo={aniversariante}
          aoMudar={setAniversariante}
        />
      ) : null}
      <Campo rotulo="Nome do cliente" value={form.nome_cliente} onChange={mudar("nome_cliente")} required />
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="WhatsApp" value={form.telefone} onChange={mudar("telefone")} inputMode="tel" />
        <Campo rotulo="Pessoas" value={form.qtd_pessoas} onChange={mudar("qtd_pessoas")} inputMode="numeric" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Valor (R$)" value={form.valor} onChange={mudar("valor")} inputMode="decimal" />
        <Campo rotulo="Sinal (R$)" value={form.sinal_pago} onChange={mudar("sinal_pago")} inputMode="decimal" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Instagram" value={form.instagram} onChange={mudar("instagram")} />
        <Campo
          rotulo="Aniversario"
          type="date"
          value={form.data_aniversario}
          onChange={mudar("data_aniversario")}
        />
      </div>
      <AreaTexto rotulo="Observacoes" value={form.observacoes} onChange={mudar("observacoes")} />
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={aoCancelar} className="btn-secundario w-full">
          Voltar
        </button>
        <button type="submit" disabled={enviando} className="btn-primario w-full">
          {enviando ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
