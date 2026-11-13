// "Ver scout" dentro do Mercado: o relatório do olheiro, sem sair da tela.
// Na etapa 2 recebe o estado da Minha lista (st/dispatch) de quem abriu; no elenco (own) lê o próprio.
import { useEffect, useReducer, useState } from "react";
import "./scout.css";
import type { MarketPlayer } from "../market/types";
import { CONTRACT_CUT, FREE_CUTOFF, leagueName, groupOf, loadScoutPlayer } from "./data";
import { evaluate, toProspect, type ScoutPlayer } from "./metrics";
import { PlayerSheet } from "./PlayerSheet";
import { isFree } from "./searches";
import { loadScoutState, saveScoutState, scoutReducer, type ScoutAction, type ScoutState } from "./state";
import { Drawer } from "./ui";

type Props = {
  slug: string;
  league: string;
  /** jogador do mercado (ou do elenco) para quando a liga não tem estatística */
  player: Pick<MarketPlayer, "id" | "name" | "pos" | "age" | "value" | "contract" | "nat" | "foreign" | "photo">;
  club: string;
  onClose: () => void;
  /** jogador do elenco do clube */
  own?: boolean;
  st?: ScoutState;
  dispatch?: (a: ScoutAction) => void;
  foot?: React.ReactNode;
};

export default function ScoutPeek({ slug, league, player, club, onClose, own = false, st: outerSt, dispatch: outerDispatch, foot }: Props) {
  const [innerSt, innerDispatch] = useReducer(scoutReducer, slug, loadScoutState);
  const external = !!outerSt && !!outerDispatch;
  useEffect(() => {
    if (!external) saveScoutState(slug, innerSt);
  }, [slug, innerSt, external]);
  const st = external ? outerSt! : innerSt;
  const dispatch = external ? outerDispatch! : innerDispatch;
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
      own={own}
      foot={foot}
    />
  );
}
