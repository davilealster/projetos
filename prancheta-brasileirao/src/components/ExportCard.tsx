import { forwardRef } from "react";
import type { Team } from "../types";
import { Pitch, type TokenRender } from "./Pitch";

export type ExportFormat = "feed" | "story";
export const EXPORT_SIZE: Record<ExportFormat, { w: number; h: number }> = {
  feed: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

const noop = () => {};

/**
 * Cartão fora da tela usado só para gerar a imagem de compartilhamento.
 * Renderizado em 540 px de largura e exportado com pixelRatio 2 (= 1080 px).
 */
export const ExportCard = forwardRef<HTMLDivElement, {
  format: ExportFormat;
  team: Team;
  opp: Team | null;
  formation: string;
  tokens: TokenRender[];
  drawings: Parameters<typeof Pitch>[0]["drawings"];
  creator: string;
  host: string;
}>(function ExportCard({ format, team, opp, formation, tokens, drawings, creator, host }, ref) {
  const { w, h } = EXPORT_SIZE[format];
  // altura útil para o campo (cabeçalho + rodapé + margens ≈ 150 px na escala de 540)
  const ph = Math.min(h / 2 - 150, ((w / 2 - 32) * 109) / 72);
  return (
    <div className="export-host" aria-hidden="true">
      <div ref={ref} className={`export-card export-card--${format}`} style={{ width: w / 2, height: h / 2 }}>
        <header className="export-card__head">
          {team.crest && <img src={team.crest} alt="" />}
          <div>
            <p className="export-card__kicker">Minha escalação</p>
            <h2>{team.shortName}{opp ? <span> x {opp.shortName}</span> : null}</h2>
          </div>
          <span className="export-card__formation">{formation}</span>
        </header>
        <div className="export-card__pitch" style={{ height: ph, width: (ph * 72) / 109 }}>
          <Pitch
            vertical
            tokens={tokens}
            tokenScale={1}
            drawings={drawings}
            drawTool={null}
            drawColor="#fff"
            onAddDrawing={noop}
            onMoveToken={noop}
            onRemoveToken={noop}
            onDropToken={noop}
          />
        </div>
        <footer className="export-card__foot">
          <span>{creator ? `@${creator}` : "Monte a sua"}</span>
          <strong>{host}</strong>
        </footer>
      </div>
    </div>
  );
});
