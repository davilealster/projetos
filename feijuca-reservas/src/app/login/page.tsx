import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { FormularioLogin } from "./formulario";

export const dynamic = "force-dynamic";

export default async function PaginaLogin() {
  if (await sessaoAtual()) redirect("/");
  return <FormularioLogin />;
}
