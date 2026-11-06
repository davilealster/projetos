import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * No `npm run dev`, atende /api/* com os mesmos arquivos de api/ que a Vercel usa
 * (handlers no formato Web: export function GET/POST/PUT(request): Response).
 */
function devApi(): Plugin {
  return {
    name: "dev-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (!url.pathname.startsWith("/api/")) return next();
        const file = resolve(__dirname, `.${url.pathname}.ts`);
        if (!existsSync(file) || url.pathname.includes("/_")) {
          res.statusCode = 404;
          return res.end("not found");
        }
        try {
          const mod = await server.ssrLoadModule(file);
          const handler = mod[req.method ?? "GET"];
          if (typeof handler !== "function") {
            res.statusCode = 405;
            return res.end("method not allowed");
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const request = new Request(url, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: body && req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
          });
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          console.error(err);
          res.statusCode = 500;
          res.end("erro interno");
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  test: { include: ["tests/**/*.test.ts"] },
});
