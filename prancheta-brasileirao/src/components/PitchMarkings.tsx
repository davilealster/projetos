/** Campo 105x68 com marcações oficiais. Desenhado sempre na horizontal e girado no modo vertical. */
export function PitchMarkings({ vertical, stripes = true }: { vertical: boolean; stripes?: boolean }) {
  const W = 105;
  const H = 68;
  const line = { fill: "none", stroke: "rgba(255,255,255,.82)", strokeWidth: 0.32 };
  const box = (x: number, w: number, h: number) => <rect x={x} y={(H - h) / 2} width={w} height={h} {...line} />;
  const content = (
    <>
      {stripes &&
        Array.from({ length: 14 }, (_, i) => (
          <rect key={i} x={(i * W) / 14} y={0} width={W / 14} height={H} fill={i % 2 ? "var(--grass-b)" : "var(--grass-a)"} />
        ))}
      <rect x={0} y={0} width={W} height={H} {...line} />
      <line x1={W / 2} y1={0} x2={W / 2} y2={H} {...line} />
      <circle cx={W / 2} cy={H / 2} r={9.15} {...line} />
      <circle cx={W / 2} cy={H / 2} r={0.4} fill="rgba(255,255,255,.85)" />
      {box(0, 16.5, 40.32)}
      {box(W - 16.5, 16.5, 40.32)}
      {box(0, 5.5, 18.32)}
      {box(W - 5.5, 5.5, 18.32)}
      <circle cx={11} cy={H / 2} r={0.35} fill="rgba(255,255,255,.85)" />
      <circle cx={W - 11} cy={H / 2} r={0.35} fill="rgba(255,255,255,.85)" />
      <path d={`M 16.5 ${H / 2 - 7.31} A 9.15 9.15 0 0 1 16.5 ${H / 2 + 7.31}`} {...line} />
      <path d={`M ${W - 16.5} ${H / 2 - 7.31} A 9.15 9.15 0 0 0 ${W - 16.5} ${H / 2 + 7.31}`} {...line} />
      <rect x={-1.6} y={H / 2 - 3.66} width={1.6} height={7.32} {...line} />
      <rect x={W} y={H / 2 - 3.66} width={1.6} height={7.32} {...line} />
      {[
        [0, 0, 0, 90],
        [W, 0, 90, 180],
        [W, H, 180, 270],
        [0, H, 270, 360],
      ].map(([cx, cy, a0, a1], i) => {
        const r = 1;
        const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
        const [x0, y0] = p(a0);
        const [x1, y1] = p(a1);
        return <path key={i} d={`M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`} {...line} />;
      })}
    </>
  );
  return (
    <svg
      className="pitch__markings"
      viewBox={vertical ? `-2 -2 ${H + 4} ${W + 4}` : `-2 -2 ${W + 4} ${H + 4}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* vertical: nosso gol embaixo (u=0 → y=105) */}
      <g transform={vertical ? `translate(0 ${W}) rotate(-90)` : undefined}>{content}</g>
    </svg>
  );
}
