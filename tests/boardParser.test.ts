import { BoardParser } from '../src/boardParser';
import { Stone } from '../src/types';

describe('BoardParser', () => {
  describe('parseBoard - Legacy Format', () => {
    test('should parse the example board correctly (legacy format)', () => {
      // Corrected patterns based on actual bit encoding:
      // .O...  (row 1: 00 10 00 00 00 = 128)
      // O....  (row 2: 10 00 00 00 00 = 512)
      // ...#.  (row 3: 00 00 00 01 00 = 4)
      // ...O.  (row 4: 00 00 00 10 00 = 8)
      // ..#O.  (row 5: 00 00 01 10 00 = 24)
      const boardData = '128,512,4,8,24';
      const board = BoardParser.parseBoard(boardData, '5');

      expect(board.width).toBe(5);
      expect(board.height).toBe(5);

      // Row 1: .O... (none, white, none, none, none)
      expect(board.getStone(0, 0)).toBe(Stone.NONE);
      expect(board.getStone(0, 1)).toBe(Stone.WHITE);
      expect(board.getStone(0, 2)).toBe(Stone.NONE);
      expect(board.getStone(0, 3)).toBe(Stone.NONE);
      expect(board.getStone(0, 4)).toBe(Stone.NONE);

      // Row 2: O.... (white, none, none, none, none)
      expect(board.getStone(1, 0)).toBe(Stone.WHITE);
      expect(board.getStone(1, 1)).toBe(Stone.NONE);
      expect(board.getStone(1, 2)).toBe(Stone.NONE);
      expect(board.getStone(1, 3)).toBe(Stone.NONE);
      expect(board.getStone(1, 4)).toBe(Stone.NONE);

      // Row 3: ...#. (none, none, none, black, none)
      expect(board.getStone(2, 0)).toBe(Stone.NONE);
      expect(board.getStone(2, 1)).toBe(Stone.NONE);
      expect(board.getStone(2, 2)).toBe(Stone.NONE);
      expect(board.getStone(2, 3)).toBe(Stone.BLACK);
      expect(board.getStone(2, 4)).toBe(Stone.NONE);

      // Row 4: ...O. (none, none, none, white, none)
      expect(board.getStone(3, 0)).toBe(Stone.NONE);
      expect(board.getStone(3, 1)).toBe(Stone.NONE);
      expect(board.getStone(3, 2)).toBe(Stone.NONE);
      expect(board.getStone(3, 3)).toBe(Stone.WHITE);
      expect(board.getStone(3, 4)).toBe(Stone.NONE);

      // Row 5: ..#O. (none, none, black, white, none)
      expect(board.getStone(4, 0)).toBe(Stone.NONE);
      expect(board.getStone(4, 1)).toBe(Stone.NONE);
      expect(board.getStone(4, 2)).toBe(Stone.BLACK);
      expect(board.getStone(4, 3)).toBe(Stone.WHITE);
      expect(board.getStone(4, 4)).toBe(Stone.NONE);
    });

    test('should infer board size from row count when size not provided', () => {
      const boardData = '0,0,0';
      const board = BoardParser.parseBoard(boardData);

      expect(board.width).toBe(3);
      expect(board.height).toBe(3);
    });

    test('should handle rectangular boards', () => {
      const boardData = '0,0,0';
      const board = BoardParser.parseBoard(boardData, '4x3');

      expect(board.width).toBe(4);
      expect(board.height).toBe(3);
    });

    test('should handle empty board', () => {
      const boardData = '0,0,0';
      const board = BoardParser.parseBoard(boardData, '3');

      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          expect(board.getStone(row, col)).toBe(Stone.NONE);
        }
      }
    });

    test('should handle single stone', () => {
      // Black stone at position (0,0): 01 = 1
      const boardData = '1';
      const board = BoardParser.parseBoard(boardData, '1');

      expect(board.getStone(0, 0)).toBe(Stone.BLACK);
    });

    test('should handle white stone', () => {
      // White stone at position (0,0): 10 = 2
      const boardData = '2';
      const board = BoardParser.parseBoard(boardData, '1');

      expect(board.getStone(0, 0)).toBe(Stone.WHITE);
    });
  });

  describe('parseBoard - New Format (Semicolon-separated)', () => {
    test('should parse comma-separated cells format', () => {
      // Same board as legacy example but using B/W/. format
      // +O+++  -> .,W,.,.,.
      // O++++  -> W,.,.,.,.
      // +++#+  -> .,.,.,B,.
      // +++O#  -> .,.,.,W,B
      // ++#O+  -> .,.,B,W,.
      const boardData = '.,W,.,.,.; W,.,.,.,.; .,.,.,B,.; .,.,.,W,B; .,.,B,W,.';
      const board = BoardParser.parseBoard(boardData, '5');

      expect(board.width).toBe(5);
      expect(board.height).toBe(5);

      // Row 1: .,W,.,.,.
      expect(board.getStone(0, 0)).toBe(Stone.NONE);
      expect(board.getStone(0, 1)).toBe(Stone.WHITE);
      expect(board.getStone(0, 2)).toBe(Stone.NONE);
      expect(board.getStone(0, 3)).toBe(Stone.NONE);
      expect(board.getStone(0, 4)).toBe(Stone.NONE);

      // Row 3: .,.,.,B,.
      expect(board.getStone(2, 3)).toBe(Stone.BLACK);

      // Row 4: .,.,.,W,B
      expect(board.getStone(3, 3)).toBe(Stone.WHITE);
      expect(board.getStone(3, 4)).toBe(Stone.BLACK);
    });

    test('should parse mixed format (comma-separated and bigint)', () => {
      // Mix of formats:
      // Row 1: comma-separated cells
      // Row 2: bigint
      // Row 3: comma-separated cells
      const boardData = 'B,W,.; 8; .,B,W';
      const board = BoardParser.parseBoard(boardData);

      expect(board.width).toBe(3);
      expect(board.height).toBe(3);

      // Row 1: B,W,.
      expect(board.getStone(0, 0)).toBe(Stone.BLACK);
      expect(board.getStone(0, 1)).toBe(Stone.WHITE);
      expect(board.getStone(0, 2)).toBe(Stone.NONE);

      // Row 2: bigint 8 = 001000 = 00 10 00 (none, white, none for 3-wide board)
      expect(board.getStone(1, 0)).toBe(Stone.NONE);
      expect(board.getStone(1, 1)).toBe(Stone.WHITE);
      expect(board.getStone(1, 2)).toBe(Stone.NONE);

      // Row 3: .,B,W
      expect(board.getStone(2, 0)).toBe(Stone.NONE);
      expect(board.getStone(2, 1)).toBe(Stone.BLACK);
      expect(board.getStone(2, 2)).toBe(Stone.WHITE);
    });

    test('should parse bigint rows in semicolon format', () => {
      // Same as legacy example but with semicolons
      const boardData = '128; 512; 4; 8; 24';
      const board = BoardParser.parseBoard(boardData, '5');

      expect(board.width).toBe(5);
      expect(board.height).toBe(5);

      // Should match the legacy format results
      expect(board.getStone(0, 1)).toBe(Stone.WHITE); // Row 1, Col 2
      expect(board.getStone(1, 0)).toBe(Stone.WHITE); // Row 2, Col 1
      expect(board.getStone(2, 3)).toBe(Stone.BLACK); // Row 3, Col 4
    });

    test('should infer board size from comma-separated cells', () => {
      const boardData = 'B,W; .,B';
      const board = BoardParser.parseBoard(boardData);

      expect(board.width).toBe(2);
      expect(board.height).toBe(2);

      expect(board.getStone(0, 0)).toBe(Stone.BLACK);
      expect(board.getStone(0, 1)).toBe(Stone.WHITE);
      expect(board.getStone(1, 0)).toBe(Stone.NONE);
      expect(board.getStone(1, 1)).toBe(Stone.BLACK);
    });

    test('should handle case insensitive cell values', () => {
      const boardData = 'b,w,.; B,W,.';
      const board = BoardParser.parseBoard(boardData);

      expect(board.getStone(0, 0)).toBe(Stone.BLACK);
      expect(board.getStone(0, 1)).toBe(Stone.WHITE);
      expect(board.getStone(1, 0)).toBe(Stone.BLACK);
      expect(board.getStone(1, 1)).toBe(Stone.WHITE);
    });

    test('should handle whitespace in semicolon format', () => {
      const boardData = ' B , W ; . , B ';
      const board = BoardParser.parseBoard(boardData);

      expect(board.width).toBe(2);
      expect(board.height).toBe(2);
      expect(board.getStone(0, 0)).toBe(Stone.BLACK);
      expect(board.getStone(0, 1)).toBe(Stone.WHITE);
      expect(board.getStone(1, 0)).toBe(Stone.NONE);
      expect(board.getStone(1, 1)).toBe(Stone.BLACK);
    });
  });

  describe('parseSize', () => {
    test('should parse square size', () => {
      const size = BoardParser.parseSize('19');
      expect(size.width).toBe(19);
      expect(size.height).toBe(19);
    });

    test('should parse rectangular size', () => {
      const size = BoardParser.parseSize('13x19');
      expect(size.width).toBe(13);
      expect(size.height).toBe(19);
    });

    test('should handle whitespace', () => {
      const size = BoardParser.parseSize(' 9 x 13 ');
      expect(size.width).toBe(9);
      expect(size.height).toBe(13);
    });
  });

  describe('encodeBoard', () => {
    test('should encode board back to original format', () => {
      const originalData = '128,512,4,8,24';
      const board = BoardParser.parseBoard(originalData, '5');
      const encoded = BoardParser.encodeBoard(board);

      expect(encoded).toEqual([128, 512, 4, 8, 24]);
    });

    test('should handle empty board encoding', () => {
      const board = BoardParser.parseBoard('0,0,0', '3');
      const encoded = BoardParser.encodeBoard(board);

      expect(encoded).toEqual([0, 0, 0]);
    });
  });
});
