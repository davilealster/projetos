import test from "node:test";
import assert from "node:assert/strict";
import { pode, papeisCom } from "../.test-build/permissoes.js";

test("vendas mexe em reserva e faz check-in de mesa", () => {
  assert.equal(pode("VENDAS", "reservas"), true);
  assert.equal(pode("VENDAS", "checkinReserva"), true);
});

test("vendas nao encosta na lista VIP", () => {
  for (const cap of ["verVip", "incluirVip", "editarVip", "linksLista"]) {
    assert.equal(pode("VENDAS", cap), false, `vendas nao deveria poder ${cap}`);
  }
});

test("vendas nao administra evento, unidade nem usuario", () => {
  assert.equal(pode("VENDAS", "administrar"), false);
});

test("portaria cuida da lista e do check-in, sem reservar", () => {
  assert.equal(pode("PORTARIA", "verVip"), true);
  assert.equal(pode("PORTARIA", "incluirVip"), true);
  assert.equal(pode("PORTARIA", "checkinReserva"), true);
  assert.equal(pode("PORTARIA", "reservas"), false);
  assert.equal(pode("PORTARIA", "editarVip"), false);
  assert.equal(pode("PORTARIA", "administrar"), false);
});

test("admin pode tudo", () => {
  for (const cap of ["reservas", "checkinReserva", "verVip", "incluirVip", "editarVip", "linksLista", "administrar"]) {
    assert.equal(pode("ADMIN", cap), true, `admin deveria poder ${cap}`);
  }
});

test("sem papel nao pode nada", () => {
  for (const papel of [undefined, null, ""]) {
    assert.equal(pode(papel, "reservas"), false);
    assert.equal(pode(papel, "verVip"), false);
  }
});

test("quem pode editar a lista tambem pode ver", () => {
  for (const papel of ["ADMIN", "VENDAS", "PORTARIA"]) {
    if (pode(papel, "editarVip") || pode(papel, "incluirVip")) {
      assert.equal(pode(papel, "verVip"), true, `${papel} edita a lista sem poder ve-la`);
    }
  }
});

test("papeisCom devolve a lista pronta para o exigirSessao", () => {
  assert.deepEqual(papeisCom("reservas").sort(), ["ADMIN", "VENDAS"]);
  assert.deepEqual(papeisCom("verVip").sort(), ["ADMIN", "PORTARIA"]);
  assert.deepEqual(papeisCom("administrar"), ["ADMIN"]);
});

test("papeisCom devolve copia: mexer no retorno nao muda a matriz", () => {
  papeisCom("administrar").push("VENDAS");
  assert.equal(pode("VENDAS", "administrar"), false);
});
