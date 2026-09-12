import test from "node:test";
import assert from "node:assert/strict";
import {
  diasParaEvento,
  hojeISO,
  statusPrioridadeLounge,
  validarReservaLounge,
  montarMapa,
  ehAniversariante,
} from "../.test-build/regras.js";
import { hashSenha, conferirSenha } from "../.test-build/senha.js";

const hoje = hojeISO();
function dataDaqui(dias) {
  const [a, m, d] = hoje.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d + dias));
  return base.toISOString().slice(0, 10);
}

function evento(extra = {}) {
  return {
    id: "evt_1",
    nome: "Feijuca",
    data: dataDaqui(10),
    hora_inicio: "14:00",
    local: "",
    status: "ATIVO",
    lounges_liberados: "NAO",
    prioridade_aniversariante_dias: "1",
    capacidade_lista_vip: "",
    observacoes: "",
    criado_em: "",
    ...extra,
  };
}

test("diasParaEvento conta dias corridos", () => {
  assert.equal(diasParaEvento({ data: hoje }), 0);
  assert.equal(diasParaEvento({ data: dataDaqui(1) }), 1);
  assert.equal(diasParaEvento({ data: dataDaqui(-3) }), -3);
});

test("lounge fica travado longe do evento", () => {
  const s = statusPrioridadeLounge(evento());
  assert.equal(s.liberado, false);
  assert.match(s.mensagem, /Libera para todos em 9 dias/);
});

test("lounge libera na vespera", () => {
  assert.equal(statusPrioridadeLounge(evento({ data: dataDaqui(1) })).liberado, true);
  assert.equal(statusPrioridadeLounge(evento({ data: hoje })).liberado, true);
});

test("admin pode destravar antes do prazo", () => {
  const s = statusPrioridadeLounge(evento({ lounges_liberados: "SIM" }));
  assert.equal(s.liberado, true);
  assert.equal(s.liberadoManualmente, true);
});

test("prazo configuravel de 3 dias", () => {
  const e = evento({ data: dataDaqui(3), prioridade_aniversariante_dias: "3" });
  assert.equal(statusPrioridadeLounge(e).liberado, true);
  const e2 = evento({ data: dataDaqui(4), prioridade_aniversariante_dias: "3" });
  assert.equal(statusPrioridadeLounge(e2).liberado, false);
});

test("aniversariante sempre pode reservar lounge", () => {
  assert.deepEqual(validarReservaLounge(evento(), true), { ok: true });
});

test("nao aniversariante barrado fora do prazo e liberado na vespera", () => {
  const longe = validarReservaLounge(evento(), false);
  assert.equal(longe.ok, false);
  assert.match(longe.motivo, /exclusivo de aniversariante/);
  assert.deepEqual(validarReservaLounge(evento({ data: dataDaqui(1) }), false), { ok: true });
});

test("montarMapa liga reserva ativa e ignora cancelada", () => {
  const unidades = [
    { id: "u2", numero: "2" },
    { id: "u1", numero: "1" },
  ];
  const reservas = [
    { id: "r1", unidade_id: "u1", status: "CONFIRMADA" },
    { id: "r2", unidade_id: "u2", status: "CANCELADA" },
  ];
  const mapa = montarMapa(unidades, reservas);
  assert.deepEqual(mapa.map((u) => u.numero), ["1", "2"]);
  assert.equal(mapa[0].ocupado, true);
  assert.equal(mapa[1].ocupado, false);
});

test("ehAniversariante aceita variacoes", () => {
  assert.equal(ehAniversariante("SIM"), true);
  assert.equal(ehAniversariante("sim"), true);
  assert.equal(ehAniversariante("NAO"), false);
  assert.equal(ehAniversariante(""), false);
});

test("hash de senha valida so' a senha certa", () => {
  const h = hashSenha("pds2026");
  assert.equal(conferirSenha("pds2026", h), true);
  assert.equal(conferirSenha("outra", h), false);
  assert.equal(conferirSenha("pds2026", "lixo"), false);
});

test("hashes do seed da planilha conferem", () => {
  assert.equal(
    conferirSenha(
      "pds2026",
      "scrypt$6cbc642fce879178e7725757$53ee4ab0bf8335393abc586aafe930d4e1bc9e737b17d6681282365072de53b8",
    ),
    true,
  );
  assert.equal(
    conferirSenha(
      "portaria2026",
      "scrypt$9a91ceb769e3302fd4d2d652$0b12fd5fd8d9cc678d05e5ebaac10c39a4fde77ad446a4924f1b46d1a10889c0",
    ),
    true,
  );
});
