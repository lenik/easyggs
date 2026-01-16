import { Board, Stone, InfluenceResult as GGSInfluenceResult } from './types';
import { computeInfluence, DEFAULT_INFLUENCE_PARAMS, BoardInput, Cell } from './influence';

export class InfluenceAdapter {
  /**
   * Convert our Board format to the influence system's BoardInput format
   */
  static boardToInfluenceInput(board: Board): BoardInput {
    const cells: Cell[][] = [];
    
    for (let row = 0; row < board.height; row++) {
      const cellRow: Cell[] = [];
      for (let col = 0; col < board.width; col++) {
        const stone = board.getStone(row, col);
        switch (stone) {
          case Stone.NONE:
            cellRow.push('.');
            break;
          case Stone.BLACK:
            cellRow.push('B');
            break;
          case Stone.WHITE:
            cellRow.push('W');
            break;
          default:
            cellRow.push('.');
            break;
        }
      }
      cells.push(cellRow);
    }

    return {
      size: board.width, // Assuming square board for influence calculation
      board: cells
    };
  }

  /**
   * Calculate influence for a board and return in GGS format
   */
  static calculateInfluence(board: Board): GGSInfluenceResult {
    const boardInput = this.boardToInfluenceInput(board);
    const result = computeInfluence(boardInput, DEFAULT_INFLUENCE_PARAMS);

    // Convert territory format from Cell[][] to number[][]
    const territoryNumbers: number[][] = [];
    for (let row = 0; row < result.size; row++) {
      const territoryRow: number[] = [];
      for (let col = 0; col < result.size; col++) {
        const cell = result.territory[row][col];
        switch (cell) {
          case 'B':
            territoryRow.push(1); // Black territory
            break;
          case 'W':
            territoryRow.push(2); // White territory
            break;
          default:
            territoryRow.push(0); // Neutral/unknown
            break;
        }
      }
      territoryNumbers.push(territoryRow);
    }

    return {
      blackInfluence: result.black,
      whiteInfluence: result.white,
      territory: territoryNumbers
    };
  }
}
