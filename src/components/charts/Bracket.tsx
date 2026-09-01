const QF_Y = [20, 92, 164, 236];
const SF_Y = [56, 200];
const QF_X = 210;
const QF_W = 150;
const QF_H = 46;
const SF_X = 450;
const SF_W = 150;
const SF_H = 46;
const F_X = 700;
const F_W = 170;
const F_H = 56;
const F_Y = 122;

function Box({
  x,
  y,
  w,
  h,
  label,
  sub,
  color,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  color: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="transparent" stroke={color} strokeWidth={1.5} />
      <text
        x={x + w / 2}
        y={y + h / 2 - 3}
        textAnchor="middle"
        fill="var(--color-text-primary)"
        fontFamily="'Manrope',sans-serif"
        fontWeight={700}
        fontSize={12}
      >
        {label}
      </text>
      {sub && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 13}
          textAnchor="middle"
          fill="var(--color-text-muted)"
          fontFamily="'JetBrains Mono',monospace"
          fontSize={9.5}
        >
          {sub}
        </text>
      )}
    </g>
  );
}

function ElbowLine({ x1, y1, x2, y2, color }: { x1: number; y1: number; x2: number; y2: number; color: string }) {
  return <path d={`M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={1.5} />;
}

export function Bracket() {
  const poolColor = 'var(--color-ev-ms)';
  const koColor = 'var(--color-accent)';
  const mutedCol = 'var(--color-text-muted)';

  return (
    <svg
      viewBox="0 0 990 300"
      role="img"
      aria-label="Tournament structure: round robin pool stage feeding a single elimination knockout bracket of quarterfinals, semifinals, and a final"
      className="block w-full h-auto min-w-[640px]"
    >
      <Box x={10} y={110} w={150} h={80} label="Pool Stage" sub="Round robin, pools of 4" color={poolColor} />

      <path d="M 160 150 L 200 150" fill="none" stroke={mutedCol} strokeWidth={1.5} strokeDasharray="3 3" />
      <text x={196} y={154} fill={mutedCol} fontSize={12}>
        ▸
      </text>

      {QF_Y.map((yy, i) => (
        <Box key={i} x={QF_X} y={yy} w={QF_W} h={QF_H} label={`QF ${i + 1}`} sub="Top 2 per pool" color={koColor} />
      ))}

      {SF_Y.map((yy, i) => (
        <Box key={i} x={SF_X} y={yy} w={SF_W} h={SF_H} label={`Semifinal ${i + 1}`} color={koColor} />
      ))}

      {QF_Y.map((qy, i) => (
        <ElbowLine
          key={i}
          x1={QF_X + QF_W}
          y1={qy + QF_H / 2}
          x2={QF_X + QF_W + 30}
          y2={SF_Y[Math.floor(i / 2)] + SF_H / 2}
          color={mutedCol}
        />
      ))}
      <path
        d={`M ${QF_X + QF_W + 30} ${QF_Y[0] + QF_H / 2} L ${QF_X + QF_W + 30} ${QF_Y[1] + QF_H / 2}`}
        fill="none"
        stroke={mutedCol}
        strokeWidth={1.5}
      />
      <path
        d={`M ${QF_X + QF_W + 30} ${QF_Y[2] + QF_H / 2} L ${QF_X + QF_W + 30} ${QF_Y[3] + QF_H / 2}`}
        fill="none"
        stroke={mutedCol}
        strokeWidth={1.5}
      />

      <Box x={F_X} y={F_Y} w={F_W} h={F_H} label="Final" sub="Best of 3, to 21" color={koColor} />
      {SF_Y.map((sy, j) => (
        <ElbowLine key={j} x1={SF_X + SF_W} y1={sy + SF_H / 2} x2={SF_X + SF_W + 30} y2={F_Y + F_H / 2} color={mutedCol} />
      ))}
      <path
        d={`M ${SF_X + SF_W + 30} ${SF_Y[0] + SF_H / 2} L ${SF_X + SF_W + 30} ${SF_Y[1] + SF_H / 2}`}
        fill="none"
        stroke={mutedCol}
        strokeWidth={1.5}
      />

      <text
        x={F_X + F_W + 18}
        y={F_Y + F_H / 2 + 4}
        fill="var(--color-gold)"
        fontFamily="'Anton',sans-serif"
        fontSize={13}
      >
        CHAMPION
      </text>
    </svg>
  );
}
