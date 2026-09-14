import test from "node:test";
import assert from "node:assert/strict";
import { CROQUI_SOULBRADO, chaveUnidade, PADRAO_POR_TIPO } from "../.test-build/croqui.js";

const { posicoes, zonas } = CROQUI_SOULBRADO;

/** Tamanho do marcador em unidades do desenho (o CSS usa % da largura). */
function tamanho(tipo) {
  return tipo === "LOUNGE" ? 9 : 8.5;
}

function doTipo(tipo) {
  return posicoes.filter((p) => p.tipo === tipo);
}

test("o croqui tem 15 lounges, 15 bistros e 3 mesas", () => {
  assert.equal(doTipo("LOUNGE").length, 15);
  assert.equal(doTipo("BISTRO").length, 15);
  assert.equal(doTipo("MESA").length, 3);
  assert.equal(posicoes.length, 33);
});

test("a numeracao bate com a planta da casa", () => {
  const numeros = (tipo) => doTipo(tipo).map((p) => Number(p.numero)).sort((a, b) => a - b);
  assert.deepEqual(numeros("LOUNGE"), Array.from({ length: 15 }, (_, i) => i)); // 00..14
  assert.deepEqual(numeros("BISTRO"), Array.from({ length: 15 }, (_, i) => i + 1)); // 01..15
  assert.deepEqual(numeros("MESA"), [1, 2, 3]);
});

test("todo numero e' formatado com dois digitos", () => {
  for (const p of posicoes) {
    assert.match(p.numero, /^\d{2}$/, `${p.tipo} ${p.numero}`);
  }
});

test("nao ha duas posicoes com a mesma chave", () => {
  const chaves = posicoes.map((p) => chaveUnidade(p.tipo, p.numero));
  assert.equal(new Set(chaves).size, chaves.length);
});

test("chaveUnidade ignora zero a esquerda", () => {
  assert.equal(chaveUnidade("LOUNGE", "00"), chaveUnidade("LOUNGE", "0"));
  assert.equal(chaveUnidade("BISTRO", "07"), chaveUnidade("BISTRO", 7));
  assert.notEqual(chaveUnidade("LOUNGE", "01"), chaveUnidade("BISTRO", "01"));
});

test("nenhum marcador sai do desenho", () => {
  for (const p of posicoes) {
    const meio = tamanho(p.tipo) / 2;
    assert.ok(p.x - meio >= 0 && p.x + meio <= 100, `${p.tipo} ${p.numero} sai na horizontal`);
    assert.ok(p.y - meio >= 0 && p.y + meio <= 118, `${p.tipo} ${p.numero} sai na vertical`);
  }
});

test("marcadores nao se sobrepoem", () => {
  // As unidades de x e y sao quadradas em pixel (aspect-ratio 100/118),
  // entao da' para comparar distancia direto.
  for (let i = 0; i < posicoes.length; i++) {
    for (let j = i + 1; j < posicoes.length; j++) {
      const a = posicoes[i];
      const b = posicoes[j];
      const distancia = Math.hypot(a.x - b.x, a.y - b.y);
      const minimo = (tamanho(a.tipo) + tamanho(b.tipo)) / 2;
      assert.ok(
        distancia >= minimo,
        `${a.tipo} ${a.numero} encosta em ${b.tipo} ${b.numero} (${distancia.toFixed(1)} < ${minimo})`,
      );
    }
  }
});

test("todo marcador cai dentro do deck", () => {
  const deck = zonas.find((z) => z.tom === "deck");
  assert.ok(deck, "o croqui precisa de uma zona de deck");
  for (const p of posicoes) {
    const meio = tamanho(p.tipo) / 2;
    assert.ok(p.x - meio >= deck.x, `${p.tipo} ${p.numero} vaza pela esquerda`);
    assert.ok(p.x + meio <= deck.x + deck.largura, `${p.tipo} ${p.numero} vaza pela direita`);
    assert.ok(p.y - meio >= deck.y, `${p.tipo} ${p.numero} vaza por cima`);
    assert.ok(p.y + meio <= deck.y + deck.altura, `${p.tipo} ${p.numero} vaza por baixo`);
  }
});

test("nenhum marcador fica em cima do palco", () => {
  const palco = zonas.find((z) => z.rotulo === "PALCO");
  for (const p of posicoes) {
    const meio = tamanho(p.tipo) / 2;
    const cruza =
      p.x + meio > palco.x &&
      p.x - meio < palco.x + palco.largura &&
      p.y + meio > palco.y &&
      p.y - meio < palco.y + palco.altura;
    assert.ok(!cruza, `${p.tipo} ${p.numero} invade o palco`);
  }
});

test("todo tipo do croqui tem capacidade padrao", () => {
  for (const tipo of new Set(posicoes.map((p) => p.tipo))) {
    const padrao = PADRAO_POR_TIPO[tipo];
    assert.ok(padrao, `falta padrao para ${tipo}`);
    assert.ok(Number(padrao.capacidade) > 0, `capacidade invalida em ${tipo}`);
  }
});

test("o molde nao carrega preco: quem cobra e' o evento", () => {
  for (const padrao of Object.values(PADRAO_POR_TIPO)) {
    assert.equal(padrao.valor, undefined);
  }
});
