import test from "node:test";
import assert from "node:assert/strict";
import { montarTextoWhatsapp, contarOcupadas } from "../.test-build/lista-whatsapp.js";

function unidade(numero, nome, aniversariante = false) {
  return {
    id: `u${numero}`,
    numero: String(numero).padStart(2, "0"),
    ocupado: Boolean(nome),
    reserva: nome
      ? { nome_cliente: nome, aniversariante: aniversariante ? "SIM" : "NAO", status: "CONFIRMADA" }
      : null,
  };
}

const EVENTO = { data: "2026-09-12" };

test("reproduz o formato usado hoje no grupo", () => {
  const grupos = {
    LOUNGE: [
      unidade(0, "PDS/CONVIDADO"),
      unidade(1, "Rafael Rizzi"),
      unidade(2, "Douglas PDS", true),
      unidade(3, ""),
    ],
    MESA: [unidade(1, "Rodrigo Guedes"), unidade(2, "")],
    BISTRO: [unidade(1, "Dani Espiuca"), unidade(2, "")],
  };

  assert.equal(
    montarTextoWhatsapp(EVENTO, grupos),
    [
      "FEIJUCA PDS",
      "RESERVAS - 12/09/2026",
      "",
      "🟠 LOUNGE",
      "00 - PDS/CONVIDADO",
      "01 - Rafael Rizzi",
      "02 - Douglas PDS🎂",
      "03 -",
      "",
      "⚪️ MESA",
      "01 - Rodrigo Guedes",
      "02 -",
      "",
      "🟢 BISTRÔ",
      "01 - Dani Espiuca",
      "02 -",
    ].join("\n"),
  );
});

test("a ordem das secoes e' sempre lounge, mesa, bistro", () => {
  const texto = montarTextoWhatsapp(EVENTO, {
    BISTRO: [unidade(1, "B")],
    MESA: [unidade(1, "M")],
    LOUNGE: [unidade(1, "L")],
  });
  assert.ok(texto.indexOf("🟠 LOUNGE") < texto.indexOf("⚪️ MESA"));
  assert.ok(texto.indexOf("⚪️ MESA") < texto.indexOf("🟢 BISTRÔ"));
});

test("secao sem nenhuma unidade cadastrada nao aparece", () => {
  const texto = montarTextoWhatsapp(EVENTO, { LOUNGE: [unidade(1, "L")], MESA: [], BISTRO: [] });
  assert.ok(texto.includes("🟠 LOUNGE"));
  assert.ok(!texto.includes("MESA"));
  assert.ok(!texto.includes("BISTRÔ"));
});

test("numero sempre com dois digitos e ordenado", () => {
  const texto = montarTextoWhatsapp(EVENTO, {
    LOUNGE: [unidade(10, "Dez"), unidade(2, "Dois"), unidade(1, "Um")],
    MESA: [],
    BISTRO: [],
  });
  const linhas = texto.split("\n").slice(4); // titulo, data, linha em branco, secao
  assert.deepEqual(linhas, ["01 - Um", "02 - Dois", "10 - Dez"]);
});

test("posicao livre sai com o numero e o traco, sem sobra", () => {
  const texto = montarTextoWhatsapp(EVENTO, { LOUNGE: [unidade(7, "")], MESA: [], BISTRO: [] });
  assert.ok(texto.includes("\n07 -"));
  assert.ok(!texto.includes("07 - \n"));
});

test("posicao bloqueada nao se passa por livre", () => {
  const bloqueada = { ...unidade(7, ""), status: "BLOQUEADO" };
  const texto = montarTextoWhatsapp(EVENTO, { LOUNGE: [bloqueada], MESA: [], BISTRO: [] });
  assert.ok(texto.includes("07 - indisponível"));
});

test("data invalida nao quebra o cabecalho", () => {
  const texto = montarTextoWhatsapp({ data: "" }, { LOUNGE: [unidade(1, "A")], MESA: [], BISTRO: [] });
  assert.ok(texto.startsWith("FEIJUCA PDS\nRESERVAS - "));
});

test("conta so' as posicoes ocupadas", () => {
  assert.equal(
    contarOcupadas({
      LOUNGE: [unidade(1, "A"), unidade(2, "")],
      MESA: [unidade(1, "B")],
      BISTRO: [unidade(1, ""), unidade(2, "C")],
    }),
    3,
  );
});
