export enum Stone {
  NONE = 0,
  BLACK = 1,
  WHITE = 2
}

export type Color = 'black' | 'white';

export interface Position {
  row: number;
  column: number;
}

export interface BoardSize {
  width: number;
  height: number;
}

export interface InfluenceResult {
  blackInfluence: number[][];
  whiteInfluence: number[][];
  territory: number[][];
}

export class Board {
  public stones: Stone[][];
  public width: number;
  public height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.stones = Array(height).fill(null).map(() => Array(width).fill(Stone.NONE));
  }

  getStone(row: number, col: number): Stone {
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) {
      return Stone.NONE;
    }
    return this.stones[row][col];
  }

  setStone(row: number, col: number, stone: Stone): void {
    if (row >= 0 && row < this.height && col >= 0 && col < this.width) {
      this.stones[row][col] = stone;
    }
  }

  isEmpty(row: number, col: number): boolean {
    return this.getStone(row, col) === Stone.NONE;
  }

  isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < this.height && col >= 0 && col < this.width;
  }
}
