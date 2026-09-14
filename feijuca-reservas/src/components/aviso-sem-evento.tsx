"use client";

import Link from "next/link";
import { Vazio } from "./ui";

export function SemEvento() {
  return (
    <Vazio
      titulo="Nenhum evento selecionado"
      descricao="Crie a próxima Feijuca ou escolha um evento no topo da tela para começar."
      acao={
        <Link href="/eventos" className="btn-primario">
          Ir para eventos
        </Link>
      }
    />
  );
}
