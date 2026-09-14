import test from "node:test";
import assert from "node:assert/strict";
import { validarTroca, hojeISO } from "../.test-build/regras.js";

function dataDaqui(dias) {
  const [a, m, d] = hojeISO().split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

const evento = (extra = {}) => ({
  id: "evt", data: dataDaqui(10), lounges_liberados: "NAO",
  prioridade_aniversariante_dias: "1", ...extra,
});

const lado = (id, nome, tipo, unidade, destinoId, destinoTipo, extra = {}) => ({
  reserva: {
    id, nome_cliente: nome, tipo, unidade_id: unidade,
    qtd_pessoas: extra.pessoas ?? "4", aniversariante: extra.aniversariante ?? "NAO",
  },
  destino: {
    id: destinoId, numero: destinoId, tipo: destinoTipo,
    capacidade: extra.capacidade ?? "8", status: extra.status ?? "DISPONIVEL",
  },
});

test("troca simples entre dois bistros passa", () => {
  const a = lado("r1", "Ana", "BISTRO", "b1", "b2", "BISTRO");
  const b = lado("r2", "Bruno", "BISTRO", "b2", "b1", "BISTRO");
  assert.deepEqual(validarTroca(evento(), a, b), { ok: true });
});

test("os destinos precisam ser cruzados", () => {
  const a = lado("r1", "Ana", "BISTRO", "b1", "b3", "BISTRO");
  const b = lado("r2", "Bruno", "BISTRO", "b2", "b1", "BISTRO");
  const r = validarTroca(evento(), a, b);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /cada reserva assume o lugar da outra/);
});

test("nao da' para trocar uma reserva com ela mesma", () => {
  const a = lado("r1", "Ana", "BISTRO", "b1", "b1", "BISTRO");
  assert.equal(validarTroca(evento(), a, a).ok, false);
});

test("quem ja' esta num lounge pode trocar de lounge sem ser aniversariante", () => {
  const a = lado("r1", "Ana", "LOUNGE", "l1", "l2", "LOUNGE");
  const b = lado("r2", "Bruno", "LOUNGE", "l2", "l1", "LOUNGE");
  assert.deepEqual(validarTroca(evento(), a, b), { ok: true });
});

test("entrar num lounge vindo do bistro respeita a prioridade", () => {
  const a = lado("r1", "Ana", "BISTRO", "b1", "l1", "LOUNGE");
  const b = lado("r2", "Bruno", "LOUNGE", "l1", "b1", "BISTRO");
  const r = validarTroca(evento(), a, b);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /^Ana: /);
  assert.match(r.motivo, /exclusivo de aniversariante/);
});

test("aniversariante entra no lounge mesmo longe da vespera", () => {
  const a = lado("r1", "Ana", "BISTRO", "b1", "l1", "LOUNGE", { aniversariante: "SIM" });
  const b = lado("r2", "Bruno", "LOUNGE", "l1", "b1", "BISTRO");
  assert.deepEqual(validarTroca(evento(), a, b), { ok: true });
});

test("na vespera qualquer um entra no lounge", () => {
  const a = lado("r1", "Ana", "BISTRO", "b1", "l1", "LOUNGE");
  const b = lado("r2", "Bruno", "LOUNGE", "l1", "b1", "BISTRO");
  assert.deepEqual(validarTroca(evento({ data: dataDaqui(1) }), a, b), { ok: true });
});

test("grupo maior que o lugar de destino barra a troca", () => {
  const a = lado("r1", "Ana", "BISTRO", "b1", "b2", "BISTRO", { pessoas: "10" });
  const b = lado("r2", "Bruno", "BISTRO", "b2", "b1", "BISTRO", { capacidade: "8" });
  const r = validarTroca(evento(), a, b);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /Ana tem 10 pessoas/);
});

test("destino bloqueado barra a troca", () => {
  const a = lado("r1", "Ana", "BISTRO", "b1", "b2", "BISTRO", { status: "BLOQUEADO" });
  const b = lado("r2", "Bruno", "BISTRO", "b2", "b1", "BISTRO");
  assert.equal(validarTroca(evento(), a, b).ok, false);
});
