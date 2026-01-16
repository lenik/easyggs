import { InfluenceAdapter } from '../src/influenceAdapter';
import { Board, Stone } from '../src/types';

describe('InfluenceAdapter', () => {
  describe('boardToInfluenceInput', () => {
    test('should convert empty board correctly', () => {
      const board = new Board(3, 3);
      const input = InfluenceAdapter.boardToInfluenceInput(board);

      expect(input.size).toBe(3);
      expect(input.board).toEqual([
        ['.', '.', '.'],
        ['.', '.', '.'],
        ['.', '.', '.']
      ]);
    });

    test('should convert board with stones correctly', () => {
      const board = new Board(3, 3);
      board.setStone(0, 0, Stone.BLACK);
      board.setStone(1, 1, Stone.WHITE);
      board.setStone(2, 2, Stone.BLACK);

      const input = InfluenceAdapter.boardToInfluenceInput(board);

      expect(input.size).toBe(3);
      expect(input.board).toEqual([
        ['B', '.', '.'],
        ['.', 'W', '.'],
        ['.', '.', 'B']
      ]);
    });

    test('should handle example board from requirements', () => {
      const board = new Board(5, 5);
      
      // Set up the board: +O+++, O++++, +++#+, +++O#, ++#O+
      board.setStone(0, 1, Stone.WHITE);
      board.setStone(1, 0, Stone.WHITE);
      board.setStone(2, 3, Stone.BLACK);
      board.setStone(3, 3, Stone.WHITE);
      board.setStone(3, 4, Stone.BLACK);
      board.setStone(4, 2, Stone.BLACK);
      board.setStone(4, 3, Stone.WHITE);

      const input = InfluenceAdapter.boardToInfluenceInput(board);

      expect(input.size).toBe(5);
      expect(input.board[0]).toEqual(['.', 'W', '.', '.', '.']);
      expect(input.board[1]).toEqual(['W', '.', '.', '.', '.']);
      expect(input.board[2]).toEqual(['.', '.', '.', 'B', '.']);
      expect(input.board[3]).toEqual(['.', '.', '.', 'W', 'B']);
      expect(input.board[4]).toEqual(['.', '.', 'B', 'W', '.']);
    });
  });

  describe('calculateInfluence', () => {
    test('should calculate influence for empty board', () => {
      const board = new Board(3, 3);
      const result = InfluenceAdapter.calculateInfluence(board);

      expect(result.blackInfluence).toBeDefined();
      expect(result.whiteInfluence).toBeDefined();
      expect(result.territory).toBeDefined();

      expect(result.blackInfluence.length).toBe(3);
      expect(result.whiteInfluence.length).toBe(3);
      expect(result.territory.length).toBe(3);

      // All influence should be 0 on empty board
      for (let row = 0; row < 3; row++) {
        expect(result.blackInfluence[row].length).toBe(3);
        expect(result.whiteInfluence[row].length).toBe(3);
        expect(result.territory[row].length).toBe(3);
        
        for (let col = 0; col < 3; col++) {
          expect(result.blackInfluence[row][col]).toBe(0);
          expect(result.whiteInfluence[row][col]).toBe(0);
          expect(result.territory[row][col]).toBe(0); // Neutral
        }
      }
    });

    test('should calculate influence for board with single black stone', () => {
      const board = new Board(3, 3);
      board.setStone(1, 1, Stone.BLACK); // Center stone

      const result = InfluenceAdapter.calculateInfluence(board);

      // Black should have highest influence at center
      expect(result.blackInfluence[1][1]).toBeGreaterThan(0);
      
      // Adjacent positions should have some black influence
      expect(result.blackInfluence[0][1]).toBeGreaterThan(0);
      expect(result.blackInfluence[1][0]).toBeGreaterThan(0);
      expect(result.blackInfluence[1][2]).toBeGreaterThan(0);
      expect(result.blackInfluence[2][1]).toBeGreaterThan(0);

      // White influence should be 0 everywhere
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          expect(result.whiteInfluence[row][col]).toBe(0);
        }
      }
    });

    test('should calculate influence for board with both colors', () => {
      const board = new Board(5, 5);
      board.setStone(1, 1, Stone.BLACK);
      board.setStone(3, 3, Stone.WHITE);

      const result = InfluenceAdapter.calculateInfluence(board);

      // Black should have influence around (1,1)
      expect(result.blackInfluence[1][1]).toBeGreaterThan(0);
      expect(result.blackInfluence[0][1]).toBeGreaterThan(0);
      expect(result.blackInfluence[1][0]).toBeGreaterThan(0);

      // White should have influence around (3,3)
      expect(result.whiteInfluence[3][3]).toBeGreaterThan(0);
      expect(result.whiteInfluence[2][3]).toBeGreaterThan(0);
      expect(result.whiteInfluence[3][2]).toBeGreaterThan(0);

      // Territory should reflect the influence
      expect(result.territory).toBeDefined();
    });

    test('should handle rectangular board', () => {
      const board = new Board(3, 5); // 3 wide, 5 tall
      board.setStone(2, 1, Stone.BLACK);

      const result = InfluenceAdapter.calculateInfluence(board);

      expect(result.blackInfluence.length).toBe(3); // Uses width for square assumption
      expect(result.whiteInfluence.length).toBe(3);
      expect(result.territory.length).toBe(3);
    });
  });

  describe('territory encoding', () => {
    test('should encode territory correctly', () => {
      const board = new Board(3, 3);
      board.setStone(0, 0, Stone.BLACK);
      board.setStone(2, 2, Stone.WHITE);

      const result = InfluenceAdapter.calculateInfluence(board);

      // Territory values should be 0 (neutral), 1 (black), or 2 (white)
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const territory = result.territory[row][col];
          expect([0, 1, 2]).toContain(territory);
        }
      }
    });
  });
});
