import type { Metadata } from "next";
import { FormularioLista } from "./formulario";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lista VIP | Feijuca do Papo de Samba",
  description: "Envie os nomes para a lista da portaria.",
  // Link de convite não deve aparecer em busca.
  robots: { index: false, follow: false },
};

export default function PaginaListaPublica({ params }: { params: { token: string } }) {
  return <FormularioLista token={params.token} />;
}
