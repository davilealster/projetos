import type { Colors, Player } from "../types";
import { initials } from "../lib/color";

/** Foto do jogador ou, sem foto (ou em modo seguro), iniciais nas cores do clube. */
export function Avatar({
  player,
  colors,
  size,
  safe = false,
  blank = false,
}: {
  player: Player;
  colors: Colors;
  size: number;
  safe?: boolean;
  /** só o círculo nas cores do clube, sem foto nem iniciais */
  blank?: boolean;
}) {
  const style = {
    width: size,
    height: size,
    background: colors.primary,
    color: colors.secondary === colors.primary ? "#fff" : colors.secondary,
    borderColor: colors.secondary,
    fontSize: size * 0.36,
  };
  if (blank) return <span className="avatar avatar--blank" style={style} />;
  if (player.photo && !safe) {
    return (
      <span className="avatar" style={style}>
        <img src={player.photo} alt="" width={size} height={size} loading="lazy" draggable={false} />
      </span>
    );
  }
  return (
    <span className="avatar avatar--initials" style={style}>
      {initials(player.name)}
    </span>
  );
}
