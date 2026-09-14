import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { AppProvider } from "@/components/contexto";
import { AppShell } from "@/components/app-shell";
import { ConfirmacaoProvider, ToastProvider } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await sessaoAtual();
  if (!usuario) redirect("/login");

  return (
    <ToastProvider>
      <ConfirmacaoProvider>
        <AppProvider usuario={usuario}>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </ConfirmacaoProvider>
    </ToastProvider>
  );
}
