"use client";

import { useState } from "react";
import { useApp } from "@/components/contexto";
import { useDados } from "@/components/usar-dados";
import { Campo, Esqueleto, Etiqueta, Folha, Selecao, Vazio, useToast } from "@/components/ui";
import { IconeMais } from "@/components/icones";
import { api } from "@/lib/cliente";
import type { Papel } from "@/lib/types";

type UsuarioLista = {
  id: string;
  nome: string;
  usuario: string;
  papel: Papel;
  ativo: string;
  criado_em: string;
};

const PAPEIS: { valor: Papel; rotulo: string; descricao: string }[] = [
  { valor: "ADMIN", rotulo: "Administrador", descricao: "Tudo, inclusive eventos e usuarios" },
  { valor: "VENDAS", rotulo: "Vendas", descricao: "Reservas e lista VIP" },
  { valor: "PORTARIA", rotulo: "Portaria", descricao: "Somente check-in e incluir nomes" },
];

export default function PaginaUsuarios() {
  const { ehAdmin, usuario: eu, atualizar } = useApp();
  const { dados, carregando, erro } = useDados<{ usuarios: UsuarioLista[] }>(
    ehAdmin ? "/api/usuarios" : null,
  );
  const [novoAberto, setNovoAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<UsuarioLista | null>(null);

  if (!ehAdmin) {
    return (
      <Vazio
        titulo="Area restrita"
        descricao="Somente administradores podem gerenciar os usuarios do app."
      />
    );
  }

  if (carregando) return <Esqueleto linhas={4} />;
  if (erro) return <p className="card px-4 py-3 text-sm text-red-300">{erro}</p>;

  const usuarios = dados?.usuarios ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold">Usuarios</h1>
        <p className="text-sm text-pds-muted">Quem pode acessar o app e o que cada um faz.</p>
      </header>

      <ul className="space-y-2">
        {usuarios.map((u) => (
          <li key={u.id}>
            <button
              onClick={() => setSelecionado(u)}
              className="card flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:scale-[.99]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pds-orange/15 text-base font-extrabold text-pds-orange">
                {u.nome.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {u.nome}
                  {u.id === eu?.id ? <span className="text-pds-muted"> (voce)</span> : null}
                </p>
                <p className="truncate text-xs text-pds-muted">@{u.usuario}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Etiqueta cor={u.papel === "ADMIN" ? "laranja" : "cinza"}>{u.papel}</Etiqueta>
                {u.ativo !== "SIM" ? <Etiqueta cor="vermelho">Inativo</Etiqueta> : null}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={() => setNovoAberto(true)}
        className="fixed bottom-[calc(5.5rem+var(--safe-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-pds-orange text-black shadow-glow transition active:scale-95"
        aria-label="Novo usuario"
      >
        <IconeMais width={26} height={26} />
      </button>

      <Folha
        aberta={novoAberto}
        aoFechar={() => setNovoAberto(false)}
        titulo="Novo usuario"
        subtitulo="A senha pode ser trocada depois."
      >
        <FormularioUsuario
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
          subtitulo={`@${selecionado.usuario}`}
        >
          <EditarUsuario
            usuario={selecionado}
            ehVoce={selecionado.id === eu?.id}
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

function FormularioUsuario({ aoSalvar }: { aoSalvar: () => void }) {
  const avisar = useToast();
  const [form, setForm] = useState({ nome: "", usuario: "", senha: "", papel: "VENDAS" as Papel });
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((atual) => ({ ...atual, [campo]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post("/api/usuarios", form);
      avisar("Usuario criado.");
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao criar usuario.", "erro");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Campo rotulo="Nome *" value={form.nome} onChange={mudar("nome")} required />
      <Campo
        rotulo="Login *"
        value={form.usuario}
        onChange={mudar("usuario")}
        autoCapitalize="none"
        placeholder="sem espacos"
        required
      />
      <Campo
        rotulo="Senha *"
        type="password"
        value={form.senha}
        onChange={mudar("senha")}
        dica="Minimo de 6 caracteres."
        required
      />
      <Selecao rotulo="Perfil" value={form.papel} onChange={mudar("papel")}>
        {PAPEIS.map((p) => (
          <option key={p.valor} value={p.valor}>
            {p.rotulo} — {p.descricao}
          </option>
        ))}
      </Selecao>
      <button type="submit" disabled={enviando} className="btn-primario w-full">
        {enviando ? "Criando..." : "Criar usuario"}
      </button>
    </form>
  );
}

function EditarUsuario({
  usuario,
  ehVoce,
  aoSalvar,
}: {
  usuario: UsuarioLista;
  ehVoce: boolean;
  aoSalvar: () => void;
}) {
  const avisar = useToast();
  const [nome, setNome] = useState(usuario.nome);
  const [papel, setPapel] = useState<Papel>(usuario.papel);
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.patch(`/api/usuarios/${usuario.id}`, {
        nome,
        papel,
        ...(senha ? { senha } : {}),
      });
      avisar("Usuario atualizado.");
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao salvar.", "erro");
      setEnviando(false);
    }
  }

  async function alternarAtivo() {
    try {
      await api.patch(`/api/usuarios/${usuario.id}`, {
        ativo: usuario.ativo === "SIM" ? "NAO" : "SIM",
      });
      avisar(usuario.ativo === "SIM" ? "Acesso desativado." : "Acesso reativado.");
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao salvar.", "erro");
    }
  }

  async function apagar() {
    if (!confirm(`Apagar o usuario ${usuario.nome}?`)) return;
    try {
      await api.delete(`/api/usuarios/${usuario.id}`);
      avisar("Usuario apagado.");
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao apagar.", "erro");
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      <Selecao rotulo="Perfil" value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
        {PAPEIS.map((p) => (
          <option key={p.valor} value={p.valor}>
            {p.rotulo} — {p.descricao}
          </option>
        ))}
      </Selecao>
      <Campo
        rotulo="Nova senha"
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        dica="Deixe em branco para manter a senha atual."
      />
      <button type="submit" disabled={enviando} className="btn-primario w-full">
        {enviando ? "Salvando..." : "Salvar"}
      </button>

      {!ehVoce ? (
        <>
          <button type="button" onClick={alternarAtivo} className="btn-secundario w-full">
            {usuario.ativo === "SIM" ? "Desativar acesso" : "Reativar acesso"}
          </button>
          <button type="button" onClick={apagar} className="btn-perigo w-full">
            Apagar usuario
          </button>
        </>
      ) : null}
    </form>
  );
}
