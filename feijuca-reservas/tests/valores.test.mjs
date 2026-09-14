import test from "node:test";
import assert from "node:assert/strict";
import {
  valorPadraoDoEvento,
  normalizarValor,
  campoValorDoTipo,
  formatarValorReserva,
  ehCortesia,
} from "../.test-build/valores.js";

function evento(extra = {}) {
  return { valor_lounge: "", valor_bistro: "", valor_mesa: "", ...extra };
}

test("evento sem valores e' cortesia em todos os tipos", () => {
  const e = evento();
  for (const tipo of ["LOUNGE", "BISTRO", "MESA"]) {
    assert.equal(valorPadraoDoEvento(e, tipo), "0");
  }
});

test("cada tipo le' o proprio campo", () => {
  const e = evento({ valor_lounge: "600", valor_bistro: "200", valor_mesa: "250" });
  assert.equal(valorPadraoDoEvento(e, "LOUNGE"), "600");
  assert.equal(valorPadraoDoEvento(e, "BISTRO"), "200");
  assert.equal(valorPadraoDoEvento(e, "MESA"), "250");
  assert.equal(campoValorDoTipo("LOUNGE"), "valor_lounge");
});

test("um tipo cobrado nao contamina os outros", () => {
  const e = evento({ valor_lounge: "600" });
  assert.equal(valorPadraoDoEvento(e, "LOUNGE"), "600");
  assert.equal(valorPadraoDoEvento(e, "BISTRO"), "0");
  assert.equal(valorPadraoDoEvento(e, "MESA"), "0");
});

test("lixo e valor negativo caem para cortesia, nunca para NaN", () => {
  for (const bruto of ["", "  ", "abc", "-50", "0", null, undefined, "R$"]) {
    assert.equal(normalizarValor(bruto), "0", `falhou em ${JSON.stringify(bruto)}`);
  }
});

test("entende o que a pessoa digita no celular", () => {
  assert.equal(normalizarValor("600"), "600");
  assert.equal(normalizarValor("250,50"), "250.5");
  assert.equal(normalizarValor("250.50"), "250.5");
  assert.equal(normalizarValor("1 200"), "1200");
});

test("nao engole valor escrito como moeda", () => {
  // Digitar "R$ 600,00" nao pode virar cortesia sem aviso.
  assert.equal(normalizarValor("R$ 600,00"), "600");
  assert.equal(normalizarValor("R$600"), "600");
  assert.equal(normalizarValor("1.200"), "1200");
  assert.equal(normalizarValor("1.200,50"), "1200.5");
  assert.equal(normalizarValor("R$ 1.200,00"), "1200");
});

test("zero e vazio aparecem como Gratuito, nao como traco", () => {
  assert.equal(formatarValorReserva("0"), "Gratuito");
  assert.equal(formatarValorReserva(""), "Gratuito");
  assert.equal(formatarValorReserva(0), "Gratuito");
  assert.equal(formatarValorReserva("-10"), "Gratuito");
  assert.equal(ehCortesia("0"), true);
  assert.equal(ehCortesia("600"), false);
});

test("moeda digitada tambem formata certo", () => {
  assert.equal(formatarValorReserva("R$ 600,00"), formatarValorReserva("600"));
  assert.equal(ehCortesia("R$ 0,00"), true);
});

test("valor cobrado aparece em reais", () => {
  const formatado = formatarValorReserva("600");
  assert.match(formatado, /600/);
  assert.match(formatado, /R\$/);
  assert.equal(ehCortesia("600"), false);
});
