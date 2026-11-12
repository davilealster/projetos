import { createContext, useContext } from "react";
import type { DepthRow } from "../market/logic";
import type { SquadPlayer } from "../market/types";
import type { ScoutPlayer } from "./metrics";
import type { ScoutAction, ScoutState } from "./state";

/** O que todas as abas do Olheiro compartilham. */
export interface ScoutCtx {
  slug: string;
  clubName: string;
  st: ScoutState;
  dispatch: (a: ScoutAction) => void;
  /** jogadores avaliados já carregados, por "liga:id" */
  byKey: Map<string, ScoutPlayer>;
  balance: number;
  depth: DepthRow[];
  squad: SquadPlayer[];
  ownIds: Set<string>;
  signedIds: Set<string>;
  isMobile: boolean;
  open: (key: string) => void;
  addToMarket: (keys: string[]) => void;
}

export const ScoutContext = createContext<ScoutCtx | null>(null);
export const useScout = () => useContext(ScoutContext)!;
