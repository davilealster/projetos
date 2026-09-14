/**
 * Leitura da lista que a pessoa cola no formulário público.
 *
 * O texto vem do WhatsApp, então chega de tudo: numeração, travessão,
 * bolinha, a linha de cabeçalho "Lista do Fulano (8 nomes)" e linhas em
 * branco. O objetivo é aproveitar o que a pessoa mandou em vez de exigir
 * que ela formate.
 */

export const LIMITE_POR_ENVIO = 60;
export const TAMANHO_MAXIMO_NOME = 80;

/** Marcadores de lista no começo da linha: "1.", "1)", "-", "•", "*". */
const MARCADOR = /^\s*(?:\d{1,3}\s*[.)\-–—]\s*|[-–—•*·]\s+)/;

/** "Lista do Davi", "LISTA DA ANA (8 nomes)", "minha lista:" */
const CABECALHO = /^\s*(?:minha\s+)?lista\b.*$/i;

function limpar(linha: string): string {
  return linha
    .replace(MARCADOR, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAMANHO_MAXIMO_NOME);
}

export interface NomesExtraidos {
  nomes: string[];
  /** Repetidos dentro do próprio texto colado. */
  duplicados: string[];
  /** Linhas descartadas por parecerem cabeçalho da mensagem. */
  ignoradas: string[];
}

export function extrairNomes(texto: string): NomesExtraidos {
  const nomes: string[] = [];
  const duplicados: string[] = [];
  const ignoradas: string[] = [];
  const vistos = new Set<string>();

  for (const bruta of String(texto ?? "").split(/\r?\n/)) {
    const linha = limpar(bruta);
    if (!linha) continue;

    // Cabeçalho só é descartado enquanto nenhum nome entrou: numa lista de
    // verdade ninguém se chama "Lista do Davi", mas depois do primeiro nome
    // é mais seguro não adivinhar.
    if (!nomes.length && CABECALHO.test(linha)) {
      ignoradas.push(linha);
      continue;
    }

    const chave = linha.toLocaleLowerCase("pt-BR");
    if (vistos.has(chave)) {
      duplicados.push(linha);
      continue;
    }
    vistos.add(chave);
    nomes.push(linha);
  }

  return { nomes, duplicados, ignoradas };
}
