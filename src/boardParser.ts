import { Board, Stone, BoardSize } from './types';

export class BoardParser {
  /**
   * Parse board data supporting multiple formats:
   * 1. Legacy: comma-separated row integers (e.g., "128,512,4,8,24")
   * 2. New: semicolon-separated rows where each row can be:
   *    - Comma-separated cells: "B,W,.,B,W" (B=black, W=white, .=empty)
   *    - Bigint with 2-bits per cell: "128" (00=none, 01=black, 10=white)
   */
  static parseBoard(boardData: string, size?: string): Board {
    // Determine format based on presence of semicolons
    const hasSemicolons = boardData.includes(';');
    
    if (hasSemicolons) {
      return this.parseNewFormat(boardData, size);
    } else {
      return this.parseLegacyFormat(boardData, size);
    }
  }

  /**
   * Parse new format: row1;row2;...
   */
  private static parseNewFormat(boardData: string, size?: string): Board {
    const rowStrings = boardData.split(';').map(s => s.trim());
    
    let boardSize: BoardSize;
    if (size) {
      boardSize = this.parseSize(size);
    } else {
      // Infer dimensions from first row
      const firstRow = rowStrings[0];
      if (firstRow.includes(',')) {
        // Comma-separated cells
        const width = firstRow.split(',').length;
        boardSize = { width, height: rowStrings.length };
      } else {
        // Assume square board from row count
        const height = rowStrings.length;
        boardSize = { width: height, height };
      }
    }

    const board = new Board(boardSize.width, boardSize.height);

    for (let row = 0; row < Math.min(rowStrings.length, boardSize.height); row++) {
      const rowString = rowStrings[row];
      
      if (rowString.includes(',')) {
        // Parse comma-separated cells (B/W/.)
        this.parseRowCells(board, row, rowString, boardSize.width);
      } else {
        // Parse as bigint with 2-bits per cell
        this.parseRowBigint(board, row, rowString, boardSize.width);
      }
    }

    return board;
  }

  /**
   * Parse legacy format: comma-separated row integers
   */
  private static parseLegacyFormat(boardData: string, size?: string): Board {
    const rows = boardData.split(',').map(s => parseInt(s.trim()));
    
    let boardSize: BoardSize;
    if (size) {
      boardSize = this.parseSize(size);
    } else {
      // Infer square board from row count
      const height = rows.length;
      boardSize = { width: height, height };
    }

    const board = new Board(boardSize.width, boardSize.height);

    for (let row = 0; row < Math.min(rows.length, boardSize.height); row++) {
      const rowValue = rows[row];
      this.parseRowBigint(board, row, rowValue.toString(), boardSize.width);
    }

    return board;
  }

  /**
   * Parse a row with comma-separated cells (B/W/.)
   */
  private static parseRowCells(board: Board, row: number, rowString: string, width: number): void {
    const cells = rowString.split(',').map(s => s.trim());
    
    for (let col = 0; col < Math.min(cells.length, width); col++) {
      const cell = cells[col].toUpperCase();
      let stone: Stone;
      
      switch (cell) {
        case 'B':
          stone = Stone.BLACK;
          break;
        case 'W':
          stone = Stone.WHITE;
          break;
        case '.':
        default:
          stone = Stone.NONE;
          break;
      }
      
      board.setStone(row, col, stone);
    }
  }

  /**
   * Parse a row as bigint with 2-bits per cell
   * Bits are packed from left to right: position 0 uses the leftmost 2 bits
   */
  private static parseRowBigint(board: Board, row: number, rowString: string, width: number): void {
    const rowValue = parseInt(rowString);
    
    for (let col = 0; col < width; col++) {
      // Extract 2 bits for this column (from left to right)
      // Position 0 uses bits at position (width-1)*2, position 1 uses bits at (width-2)*2, etc.
      const bitPosition = (width - 1 - col) * 2;
      const stoneBits = (rowValue >> bitPosition) & 0b11;
      
      let stone: Stone;
      switch (stoneBits) {
        case 0b00:
          stone = Stone.NONE;
          break;
        case 0b01:
          stone = Stone.BLACK;
          break;
        case 0b10:
          stone = Stone.WHITE;
          break;
        default:
          stone = Stone.NONE;
          break;
      }
      
      board.setStone(row, col, stone);
    }
  }

  /**
   * Parse size parameter: either "N" for NxN or "WxH" for WxH
   */
  static parseSize(size: string): BoardSize {
    if (size.includes('x')) {
      const [width, height] = size.split('x').map(s => parseInt(s.trim()));
      return { width, height };
    } else {
      const n = parseInt(size.trim());
      return { width: n, height: n };
    }
  }

  /**
   * Convert board back to encoded format for testing/debugging
   * Bits are packed from left to right: position 0 uses the leftmost 2 bits
   */
  static encodeBoard(board: Board): number[] {
    const rows: number[] = [];
    
    for (let row = 0; row < board.height; row++) {
      let rowValue = 0;
      for (let col = 0; col < board.width; col++) {
        const stone = board.getStone(row, col);
        let stoneBits: number;
        
        switch (stone) {
          case Stone.NONE:
            stoneBits = 0b00;
            break;
          case Stone.BLACK:
            stoneBits = 0b01;
            break;
          case Stone.WHITE:
            stoneBits = 0b10;
            break;
          default:
            stoneBits = 0b00;
            break;
        }
        
        // Position 0 uses leftmost bits, so shift by (width-1-col)*2
        const bitPosition = (board.width - 1 - col) * 2;
        rowValue |= (stoneBits << bitPosition);
      }
      rows.push(rowValue);
    }
    
    return rows;
  }
}
