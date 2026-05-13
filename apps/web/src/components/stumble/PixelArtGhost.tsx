const GHOST_PIXEL = 16;
const GHOST_BODY_COLOR = '#bae6fd';
const GHOST_EYE_COLOR = '#0c4a6e';

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

function ghostColorOf(cell: number): string | null {
  if (cell === 1) return GHOST_BODY_COLOR;
  if (cell === 2) return GHOST_EYE_COLOR;
  return null;
}

/**
 * 8×8 pixel-art ghost rendered as an SVG. Each logical pixel is 16×16 CSS
 * pixels. The palette is a sky-blue body (#bae6fd) with dark-blue eyes
 * (#0c4a6e).
 */
export default function PixelArtGhost() {
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
