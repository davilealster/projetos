export function Footer({ updatedAt }: { updatedAt?: string }) {
  const date = updatedAt ? new Date(`${updatedAt}T12:00:00`).toLocaleDateString("pt-BR") : null;
  return (
    <footer className="footer">
      {date && <p>Elenco atualizado em {date}.</p>}
      <p>
        Faz live? <a href="/creator">Use a prancheta na sua transmissão</a>.
      </p>
      <p>
        Projeto independente, sem vínculo com CBF ou clubes. Imagens pertencem aos respectivos detentores.
      </p>
    </footer>
  );
}
