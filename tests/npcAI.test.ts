import { NPCAI } from '../src/npcAI';
import { Board, Stone } from '../src/types';

describe('NPCAI', () => {
  describe('calculateMove', () => {
    test('should return a valid move for black on example board', () => {
      // Example board from requirements
      const board = new Board(5, 5);
      
      // Set up the board: +O+++, O++++, +++#+, +++O#, ++#O+
      board.setStone(0, 1, Stone.WHITE);  // Row 1, Col 2: O
      board.setStone(1, 0, Stone.WHITE);  // Row 2, Col 1: O
      board.setStone(2, 3, Stone.BLACK);  // Row 3, Col 4: #
      board.setStone(3, 3, Stone.WHITE);  // Row 4, Col 4: O
      board.setStone(3, 4, Stone.BLACK);  // Row 4, Col 5: #
      board.setStone(4, 2, Stone.BLACK);  // Row 5, Col 3: #
      board.setStone(4, 3, Stone.WHITE);  // Row 5, Col 4: O

      const move = NPCAI.calculateMove(board, 'black');

      expect(move).not.toBeNull();
      expect(move!.row).toBeGreaterThan(0);
      expect(move!.row).toBeLessThanOrEqual(5);
      expect(move!.column).toBeGreaterThan(0);
      expect(move!.column).toBeLessThanOrEqual(5);
    });

    test('should return a valid move for white', () => {
      const board = new Board(3, 3);
      board.setStone(1, 1, Stone.BLACK);  // Center black stone

      const move = NPCAI.calculateMove(board, 'white');

      expect(move).not.toBeNull();
      expect(move!.row).toBeGreaterThan(0);
      expect(move!.row).toBeLessThanOrEqual(3);
      expect(move!.column).toBeGreaterThan(0);
      expect(move!.column).toBeLessThanOrEqual(3);
    });

    test('should return null when no moves available (full board)', () => {
      const board = new Board(2, 2);
      
      // Fill the entire board
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          board.setStone(row, col, row + col % 2 === 0 ? Stone.BLACK : Stone.WHITE);
        }
      }

      const move = NPCAI.calculateMove(board, 'black');
      expect(move).toBeNull();
    });

    test('should prefer corner positions on empty board', () => {
      const board = new Board(5, 5);
      const move = NPCAI.calculateMove(board, 'black');

      expect(move).not.toBeNull();
      // Should prefer corners or edges
      const isCornerOrEdge = (
        move!.row === 1 || move!.row === 5 || 
        move!.column === 1 || move!.column === 5
      );
      expect(isCornerOrEdge).toBe(true);
    });

    test('should defend against captures', () => {
      const board = new Board(5, 5);
      
      // Set up a situation where black stone is in atari (1 liberty)
      board.setStone(1, 1, Stone.BLACK);  // Black stone
      board.setStone(0, 1, Stone.WHITE);  // White attacking
      board.setStone(1, 0, Stone.WHITE);  // White attacking
      board.setStone(2, 1, Stone.WHITE);  // White attacking
      // Position (1,2) is the only liberty for black stone

      const move = NPCAI.calculateMove(board, 'black');

      expect(move).not.toBeNull();
      // Should defend by playing at (1,2) - the last liberty
      expect(move!.row).toBe(2);  // 1-based indexing
      expect(move!.column).toBe(3);  // 1-based indexing
    });

    test('should capture opponent stones when possible', () => {
      const board = new Board(5, 5);
      
      // Set up a situation where white stone can be captured
      board.setStone(1, 1, Stone.WHITE);  // White stone in atari
      board.setStone(0, 1, Stone.BLACK);  // Black attacking
      board.setStone(1, 0, Stone.BLACK);  // Black attacking  
      board.setStone(2, 1, Stone.BLACK);  // Black attacking
      // Position (1,2) would capture the white stone

      const move = NPCAI.calculateMove(board, 'black');

      expect(move).not.toBeNull();
      // Should capture by playing at (1,2)
      expect(move!.row).toBe(2);  // 1-based indexing
      expect(move!.column).toBe(3);  // 1-based indexing
    });
  });

  describe('edge cases', () => {
    test('should handle 1x1 board', () => {
      const board = new Board(1, 1);
      const move = NPCAI.calculateMove(board, 'black');

      expect(move).not.toBeNull();
      expect(move!.row).toBe(1);
      expect(move!.column).toBe(1);
    });

    test('should handle rectangular board', () => {
      const board = new Board(3, 5);  // 3 wide, 5 tall
      const move = NPCAI.calculateMove(board, 'white');

      expect(move).not.toBeNull();
      expect(move!.row).toBeGreaterThan(0);
      expect(move!.row).toBeLessThanOrEqual(5);
      expect(move!.column).toBeGreaterThan(0);
      expect(move!.column).toBeLessThanOrEqual(3);
    });

    test('should handle board with only one empty space', () => {
      const board = new Board(3, 3);
      
      // Fill all but one position
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (!(row === 1 && col === 1)) {  // Leave center empty
            board.setStone(row, col, (row + col) % 2 === 0 ? Stone.BLACK : Stone.WHITE);
          }
        }
      }

      const move = NPCAI.calculateMove(board, 'black');

      expect(move).not.toBeNull();
      expect(move!.row).toBe(2);  // 1-based indexing for center
      expect(move!.column).toBe(2);
    });
  });
});
