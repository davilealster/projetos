// "Ver scout" dentro do Mercado: o mesmo perfil do Olheiro, compacto, sem sair da tela.
import { useEffect, useReducer, useState } from "react";
import "./scout.css";
import { navigate } from "../router";
import type { MarketPlayer } from "../market/types";
import { CONTRACT_CUT, FREE_CUTOFF, leagueName, groupOf, loadScoutPlayer } from "./data";
import { evaluate, toProspect, type ScoutPlayer } from "./metrics";
import { PlayerSheet } from "./PlayerSheet";
import { isFree } from "./searches";
import { loadScoutState, saveScoutState, scoutReducer } from "./state";
import { Drawer } from "./ui";

type Props = {
  slug: string;
  league: string;
  /** jogador do mercado (ou do elenco) para quando a liga não tem estatística */
  player: Pick<MarketPlayer, "id" | "name" | "pos" | "age" | "value" | "contract" | "nat" | "foreign" | "photo">;
  club: string;
  onClose: () => void;
};

export default function ScoutPeek({ slug, league, player, club, onClose }: Props) {
  const [st, dispatch] = useReducer(scoutReducer, slug, loadScoutState);
  useEffect(() => saveScoutState(slug, st), [slug, st]);
  const [x, setX] = useState<ScoutPlayer | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    loadScoutPlayer(league, player.id).then((found) => {
      if (!alive) return;
      if (found) return setX(found);
      // sem estatística: perfil só com os dados do mercado
      const p = toProspect(
        { ...player, club: 0, posName: null },
        { id: league, name: leagueName(league), group: groupOf(league) ?? "", clubs: [{ name: club }] },
        null,
        null,
      );
      setX(evaluate([p], { contractCut: CONTRACT_CUT })[0]);
    });
    return () => {
      alive = false;
    };
  }, [league, player, club]);

  if (!x)
    return (
      <Drawer label="Relatório do olheiro" onClose={onClose}>
        <p className="sc-loadingsheet">Abrindo o relatório do olheiro…</p>
      </Drawer>
    );
  return (
    <PlayerSheet
      x={x}
      st={st}
      dispatch={dispatch}
      onClose={onClose}
      free={isFree(x, FREE_CUTOFF)}
      contractCut={CONTRACT_CUT}
      compact
      onOpenScout={() => navigate(`/olheiro/${slug}`)}
    />
  );
}
