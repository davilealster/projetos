// GET /api/img?u=<url> — repassa fotos do Transfermarkt para que possam entrar nas imagens geradas
// no navegador (o CDN deles não libera CORS). Só aceita o host de fotos do Transfermarkt.
const ALLOWED = "img.a.transfermarkt.technology";

export async function GET(req: Request): Promise<Response> {
  const raw = new URL(req.url).searchParams.get("u") ?? "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("url inválida", { status: 400 });
  }
  if (target.protocol !== "https:" || target.hostname !== ALLOWED) return new Response("host não permitido", { status: 400 });
  const res = await fetch(target, { headers: { "user-agent": "Mozilla/5.0 (PranchetaBrasileirao)" } });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) return new Response("imagem indisponível", { status: 502 });
  return new Response(await res.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
      "access-control-allow-origin": "*",
    },
  });
}
