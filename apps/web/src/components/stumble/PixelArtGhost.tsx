const GHOST_PIXEL = 16;

// 0 = transparent, 1 = body, 2 = eye
const GHOST_GRID = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 2, 1, 1, 2, 1, 1],
  [1, 1, 2, 1, 1, 2, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 1, 0, 1, 0, 0, 0],
];

interface PixelArtGhostProps {
  bodyColor?: string;
  eyeColor?: string;
}

export default function PixelArtGhost({
  bodyColor = 'var(--base-text)',
  eyeColor = 'var(--base-highlight)',
}: PixelArtGhostProps) {
  function ghostColorOf(cell: number): string | null {
    if (cell === 1) return bodyColor;
    if (cell === 2) return eyeColor;
    return null;
  }

  return (
    <svg
      width={8 * GHOST_PIXEL}
      height={8 * GHOST_PIXEL}
      viewBox={`0 0 ${8 * GHOST_PIXEL} ${8 * GHOST_PIXEL}`}
      aria-label="A friendly pixel-art ghost"
      role="img"
      style={{ imageRendering: 'pixelated' }}
    >
      {GHOST_GRID.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const fill = ghostColorOf(cell);
          if (!fill) return null;
          return (
            <rect
              key={`${rowIndex}-${colIndex}`}
              x={colIndex * GHOST_PIXEL}
              y={rowIndex * GHOST_PIXEL}
              width={GHOST_PIXEL}
              height={GHOST_PIXEL}
              fill={fill}
            />
          );
        }),
      )}
    </svg>
  );
}
