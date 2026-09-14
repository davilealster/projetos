import test from "node:test";
import assert from "node:assert/strict";
import { extrairNomes, LIMITE_POR_ENVIO, TAMANHO_MAXIMO_NOME } from "../.test-build/nomes.js";

test("um nome por linha, sem sobra de espaço", () => {
  const { nomes } = extrairNomes("  Ana Silva \n\nBruno Costa\n  \nCarla  Dias  ");
  assert.deepEqual(nomes, ["Ana Silva", "Bruno Costa", "Carla Dias"]);
});

test("tira numeração e marcadores que vêm do WhatsApp", () => {
  const { nomes } = extrairNomes("1. Ana\n2) Bruno\n- Carla\n• Diego\n* Eduarda\n3 - Fábio");
  assert.deepEqual(nomes, ["Ana", "Bruno", "Carla", "Diego", "Eduarda", "Fábio"]);
});

test("descarta o cabeçalho da mensagem colada", () => {
  const { nomes, ignoradas } = extrairNomes("Lista do Davi (3 nomes)\nAna\nBruno");
  assert.deepEqual(nomes, ["Ana", "Bruno"]);
  assert.deepEqual(ignoradas, ["Lista do Davi (3 nomes)"]);
});

test("não confunde nome com cabeçalho depois que a lista começou", () => {
  const { nomes } = extrairNomes("Ana\nLista Pereira\nBruno");
  assert.deepEqual(nomes, ["Ana", "Lista Pereira", "Bruno"]);
});

test("repetido no mesmo texto entra uma vez só", () => {
  const { nomes, duplicados } = extrairNomes("Ana Silva\nBruno\nana silva\nANA SILVA");
  assert.deepEqual(nomes, ["Ana Silva", "Bruno"]);
  assert.equal(duplicados.length, 2);
});

test("nome absurdamente longo é cortado, não rejeitado", () => {
  const { nomes } = extrairNomes("A".repeat(200));
  assert.equal(nomes[0].length, TAMANHO_MAXIMO_NOME);
});

test("texto vazio não vira nome vazio", () => {
  assert.deepEqual(extrairNomes("").nomes, []);
  assert.deepEqual(extrairNomes("\n\n   \n").nomes, []);
  assert.deepEqual(extrairNomes(null).nomes, []);
});

test("hífen dentro do nome sobrevive", () => {
  const { nomes } = extrairNomes("Ana-Maria Souza\n- João-Pedro");
  assert.deepEqual(nomes, ["Ana-Maria Souza", "João-Pedro"]);
});

test("o limite por envio é um número utilizável", () => {
  assert.ok(LIMITE_POR_ENVIO >= 20 && LIMITE_POR_ENVIO <= 200);
});
