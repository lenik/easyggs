/**
 * Go (Weiqi) board influence / territory estimation.
 *
 * This is NOT an exact scoring engine. It computes a *heuristic*:
 * - Influence fields for Black/White (float values per intersection)
 * - A territory guess per empty intersection (B / W / Neutral)
 * - A coarse territory count (not including captures/komi)
 *
 * Approach:
 * 1) Build an influence field by summing contributions from all stones.
 * 2) Contribution decays with Manhattan distance and is weakened when
 *    a straight line is blocked by opponent stones (simple occlusion).
 *
 * Works well as a fast "heatmap" /势力估算 for UI or analysis, not for rules-accurate scoring.
 */

export type Color = "B" | "W";
export type Cell = "B" | "W" | ".";

export interface InfluenceParams {
  /** Base strength contributed by a stone at distance 0. */
  stoneStrength: number; // e.g. 10
  /** Decay per step of Manhattan distance. Must be in (0,1). */
  decay: number; // e.g. 0.80
  /**
   * Optional hard cutoff for influence range (performance).
   * If omitted, will use board size (max manhattan distance).
   */
  maxDistance?: number; // e.g. 10..14
  /**
   * Occlusion factor applied when line-of-sight is blocked by opponent stones.
   * 0 => fully blocked, 1 => no occlusion effect.
   */
  occlusionFactor: number; // e.g. 0.35
  /**
   * Threshold on net influence to label empty point as territory.
   * net = black - white. If |net| < threshold => neutral.
   */
  territoryThreshold: number; // e.g. 1.2
}

export interface InfluenceResult {
  size: number;
  /** Influence fields per intersection. */
  black: number[][];
  white: number[][];
  /** Net influence = black - white. */
  net: number[][];
  /** Territory guess per intersection: "B" | "W" | "." (neutral/unknown). */
  territory: Cell[][];
  /** Coarse territory count: only empty points guessed as territory. */
  territoryCount: { B: number; W: number; neutral: number };
}

export interface BoardInput {
  size: number; // usually 19
  /**
   * board[y][x]:
   * "B" = black stone, "W" = white stone, "." = empty.
   */
  board: Cell[][];
}

function assertBoard(input: BoardInput): void {
  const { size, board } = input;
  if (board.length !== size) throw new Error(`board height must be ${size}`);
  for (let y = 0; y < size; y++) {
    if (board[y].length !== size) throw new Error(`board width must be ${size} at row ${y}`);
    for (let x = 0; x < size; x++) {
      const c = board[y][x];
      if (c !== "B" && c !== "W" && c !== ".") {
        throw new Error(`invalid cell at (${x},${y}): ${String(c)}`);
      }
    }
  }
}

function manhattan(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy);
}

/**
 * A very simple "occlusion" heuristic:
 * If we march from (sx,sy) toward (tx,ty) using a Manhattan path,
 * count opponent stones encountered. More opponent stones => more blocking.
 *
 * This is intentionally cheap and approximate (not true line-of-sight).
 */
function occlusionPenalty(
  board: Cell[][],
  size: number,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  stoneColor: Color,
  occlusionFactor: number
): number {
  const opp: Color = stoneColor === "B" ? "W" : "B";

  let x = sx;
  let y = sy;
  let blocks = 0;

  // Greedy Manhattan walk: step in x direction, then y direction.
  // You could randomize or try both orders; this is a deterministic, fast choice.
  while (x !== tx || y !== ty) {
    if (x !== tx) x += x < tx ? 1 : -1;
    else if (y !== ty) y += y < ty ? 1 : -1;

    // Skip endpoints: the stone itself and the target intersection.
    if ((x === sx && y === sy) || (x === tx && y === ty)) continue;

    const c = board[y][x];
    if (c === opp) blocks++;
  }

  // Convert blocks into a multiplicative penalty.
  // 0 blocks => 1.0
  // 1+ blocks => occlusionFactor^blocks
  if (blocks <= 0) return 1.0;
  return Math.pow(occlusionFactor, blocks);
}

/**
 * Main API.
 */
export function computeInfluence(input: BoardInput, params: InfluenceParams): InfluenceResult {
  assertBoard(input);

  const { size, board } = input;

  if (!(params.decay > 0 && params.decay < 1)) {
    throw new Error("params.decay must be in (0,1)");
  }
  if (!(params.occlusionFactor >= 0 && params.occlusionFactor <= 1)) {
    throw new Error("params.occlusionFactor must be in [0,1]");
  }

  const maxD = params.maxDistance ?? (size - 1) * 2;

  const black: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  const white: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  const net: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  const territory: Cell[][] = Array.from({ length: size }, () => Array(size).fill("."));

  // Collect stones for iteration.
  const stones: Array<{ x: number; y: number; c: Color }> = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = board[y][x];
      if (c === "B" || c === "W") stones.push({ x, y, c });
    }
  }

  // Influence accumulation:
  // For each stone, add a decayed contribution to points within maxDistance.
  for (const s of stones) {
    // Bounding box for performance.
    const minX = Math.max(0, s.x - maxD);
    const maxX = Math.min(size - 1, s.x + maxD);
    const minY = Math.max(0, s.y - maxD);
    const maxY = Math.min(size - 1, s.y + maxD);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = manhattan(s.x, s.y, x, y);
        if (d > maxD) continue;

        // Base decay by distance.
        const base = params.stoneStrength * Math.pow(params.decay, d);

        // Optional occlusion: penalize if opponent stones lie on a simple path.
        const occ = occlusionPenalty(board, size, s.x, s.y, x, y, s.c, params.occlusionFactor);

        const contribution = base * occ;

        if (s.c === "B") black[y][x] += contribution;
        else white[y][x] += contribution;
      }
    }
  }

  // Net + territory labeling on empty points.
  let bTerr = 0;
  let wTerr = 0;
  let nTerr = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      net[y][x] = black[y][x] - white[y][x];

      // Keep stones as-is in territory output.
      if (board[y][x] === "B" || board[y][x] === "W") {
        territory[y][x] = board[y][x];
        continue;
      }

      const v = net[y][x];
      if (v >= params.territoryThreshold) {
        territory[y][x] = "B";
        bTerr++;
      } else if (v <= -params.territoryThreshold) {
        territory[y][x] = "W";
        wTerr++;
      } else {
        territory[y][x] = ".";
        nTerr++;
      }
    }
  }

  return {
    size,
    black,
    white,
    net,
    territory,
    territoryCount: { B: bTerr, W: wTerr, neutral: nTerr },
  };
}

/**
 * Convenience: parse an ASCII board (rows of "BW.").
 * Example row length must match size. Whitespace is ignored.
 */
export function parseAsciiBoard(size: number, ascii: string): BoardInput {
  const lines = ascii
    .split("\n")
    .map((l) => l.replace(/\s+/g, ""))
    .filter((l) => l.length > 0);

  if (lines.length !== size) {
    throw new Error(`expected ${size} lines, got ${lines.length}`);
  }

  const board: Cell[][] = lines.map((line, y) => {
    if (line.length !== size) throw new Error(`line ${y} must have length ${size}`);
    return Array.from(line).map((ch, x) => {
      if (ch === "B" || ch === "W" || ch === ".") return ch;
      throw new Error(`invalid char '${ch}' at (${x},${y})`);
    });
  });

  return { size, board };
}

/**
 * Example parameters (reasonable defaults for 19x19 UI heatmaps).
 */
export const DEFAULT_INFLUENCE_PARAMS: InfluenceParams = {
  stoneStrength: 10,
  decay: 0.82,
  maxDistance: 12,
  occlusionFactor: 0.35,
  territoryThreshold: 1.2,
};

