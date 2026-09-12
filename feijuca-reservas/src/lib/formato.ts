export function formatarData(iso: string): string {
  if (!iso) return "-";
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataExtenso(iso: string): string {
  if (!iso) return "-";
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, (mes ?? 1) - 1, dia ?? 1));
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  }).format(data);
}

export function formatarMoeda(valor: string | number): string {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero === 0) return "-";
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarHora(iso: string): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

export function somenteDigitos(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

export function linkWhatsapp(telefone: string, mensagem?: string): string | null {
  const digitos = somenteDigitos(telefone);
  if (digitos.length < 10) return null;
  const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : "";
  return `https://wa.me/${numero}${texto}`;
}

export function formatarTelefone(valor: string): string {
  const d = somenteDigitos(valor);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor;
}
