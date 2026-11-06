import { useEffect, useState } from "react";
import { getPref, setPref } from "../lib/state";
import type { TeamSummary } from "../types";

/** Placar e cronômetro editáveis, para o topo do Modo Live. */
export function Scoreboard({ home, away }: { home: TeamSummary; away: TeamSummary | null }) {
  const key = `score:${home.slug}`;
  const saved = (() => {
    try {
      return JSON.parse(getPref(key) ?? "") as { h: number; a: number; secs: number };
    } catch {
      return { h: 0, a: 0, secs: 0 };
    }
  })();
  const [h, setH] = useState(saved.h);
  const [a, setA] = useState(saved.a);
  const [secs, setSecs] = useState(saved.secs);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => setPref(key, JSON.stringify({ h, a, secs })), [key, h, a, secs]);

  const bump = (set: (f: (n: number) => number) => void) => ({
    onClick: () => set((n) => n + 1),
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      set((n) => Math.max(0, n - 1));
    },
  });
  const mm = Math.floor(secs / 60);

  return (
    <div className="scoreboard" title="Clique no placar para somar, botão direito para tirar. Clique no tempo para iniciar/pausar.">
      <span className="scoreboard__team">
        {home.crest && <img src={home.crest} alt="" />}
        {home.shortName}
      </span>
      <button className="scoreboard__n" {...bump(setH)}>{h}</button>
      <span className="scoreboard__x">×</span>
      <button className="scoreboard__n" {...bump(setA)}>{a}</button>
      <span className="scoreboard__team">
        {away?.crest && <img src={away.crest} alt="" />}
        {away?.shortName ?? "ADV"}
      </span>
      <button
        className={`scoreboard__clock ${running ? "is-running" : ""}`}
        onClick={() => setRunning((r) => !r)}
        onDoubleClick={() => (setRunning(false), setSecs(0))}
      >
        {mm}'
      </button>
    </div>
  );
}
