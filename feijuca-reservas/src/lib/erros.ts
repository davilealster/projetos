/** Erro de API com status HTTP. Fica fora de auth.ts para que modulos
 *  usados no navegador nao arrastem next/headers para o bundle. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
