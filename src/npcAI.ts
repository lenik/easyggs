import { Board, Stone, Position, Color } from './types';

export class NPCAI {
  /**
   * Calculate the best move for the given color
   */
  static calculateMove(board: Board, color: Color): Position | null {
    const playerStone = color === 'black' ? Stone.BLACK : Stone.WHITE;
    const opponentStone = color === 'black' ? Stone.WHITE : Stone.BLACK;

    // Get all empty positions
    const emptyPositions: Position[] = [];
    for (let row = 0; row < board.height; row++) {
      for (let col = 0; col < board.width; col++) {
        if (board.isEmpty(row, col)) {
          emptyPositions.push({ row, column: col });
        }
      }
    }

    if (emptyPositions.length === 0) {
      return null; // No moves available
    }

    // Score each empty position
    let bestMove: Position | null = null;
    let bestScore = -Infinity;

    for (const pos of emptyPositions) {
      const score = this.evaluateMove(board, pos.row, pos.column, playerStone, opponentStone);
      if (score > bestScore) {
        bestScore = score;
        bestMove = pos;
      }
    }

    // Convert to 1-based indexing for response
    if (bestMove) {
      return {
        row: bestMove.row + 1,
        column: bestMove.column + 1
      };
    }

    return null;
  }

  /**
   * Evaluate a potential move at the given position
   */
  private static evaluateMove(
    board: Board, 
    row: number, 
    col: number, 
    playerStone: Stone, 
    opponentStone: Stone
  ): number {
    let score = 0;

    // URGENT: Immediate captures (highest priority)
    const captureScore = this.getCaptureScore(board, row, col, playerStone, opponentStone);
    if (captureScore > 0) {
      score += captureScore * 3; // Triple weight for captures
    }

    // URGENT: Save our groups from capture (second highest priority)
    const defenseScore = this.getDefenseScore(board, row, col, playerStone, opponentStone);
    if (defenseScore > 0) {
      score += defenseScore * 2.5; // High weight for defense
    }

    // URGENT: Block opponent's threats
    score += NPCAI.getBlockingScore(board, row, col, playerStone, opponentStone);

    // Strategic: Territory and influence
    score += NPCAI.getTerritoryScore(board, row, col, playerStone, opponentStone);

    // Strategic: Connection opportunities
    score += this.getConnectionScore(board, row, col, playerStone);

    // Strategic: Opening patterns for early game
    score += NPCAI.getOpeningScore(board, row, col, playerStone);

    // Basic position scoring (lowest priority)
    score += this.getPositionScore(board, row, col) * 0.5;

    // Add some randomness to avoid predictable play
    score += (Math.random() - 0.5) * 2;

    return score;
  }

  /**
   * Basic position scoring - corners and edges are generally valuable
   */
  private static getPositionScore(board: Board, row: number, col: number): number {
    let score = 0;

    // For small boards, prefer corners and edges less aggressively
    const boardSize = Math.min(board.width, board.height);
    
    // Corner positions
    if ((row === 0 || row === board.height - 1) && (col === 0 || col === board.width - 1)) {
      score += boardSize > 9 ? 8 : 4;
    }
    // Edge positions
    else if (row === 0 || row === board.height - 1 || col === 0 || col === board.width - 1) {
      score += boardSize > 9 ? 4 : 2;
    }
    // Center positions - more valuable on larger boards
    else {
      const centerRow = Math.floor(board.height / 2);
      const centerCol = Math.floor(board.width / 2);
      const distanceFromCenter = Math.abs(row - centerRow) + Math.abs(col - centerCol);
      score += Math.max(0, Math.floor(boardSize / 3) - distanceFromCenter);
    }

    return score;
  }

  /**
   * Score for blocking opponent's threats and extensions
   */
  private static getBlockingScore(
    board: Board, 
    row: number, 
    col: number, 
    playerStone: Stone, 
    opponentStone: Stone
  ): number {
    let score = 0;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    // Check if this move blocks opponent's extension or connection
    for (const [dr, dc] of directions) {
      const adjRow = row + dr;
      const adjCol = col + dc;

      if (board.isValidPosition(adjRow, adjCol) && 
          board.getStone(adjRow, adjCol) === opponentStone) {
        
        // Check if opponent has a strong position we should block
        const opponentLiberties = this.countLiberties(board, adjRow, adjCol, opponentStone);
        const opponentGroupSize = this.getGroupSize(board, adjRow, adjCol, opponentStone);
        
        if (opponentLiberties > 2 && opponentGroupSize >= 2) {
          score += 10; // Block strong opponent groups
        }
        
        // Check for opponent's potential connections
        score += this.checkOpponentConnections(board, row, col, adjRow, adjCol, opponentStone);
      }
    }

    return score;
  }

  /**
   * Score for territory control and influence
   */
  private static getTerritoryScore(
    board: Board, 
    row: number, 
    col: number, 
    playerStone: Stone, 
    opponentStone: Stone
  ): number {
    let score = 0;
    const radius = 2;

    // Count friendly vs enemy stones in surrounding area
    let friendlyInfluence = 0;
    let enemyInfluence = 0;
    let emptySpaces = 0;

    for (let r = Math.max(0, row - radius); r <= Math.min(board.height - 1, row + radius); r++) {
      for (let c = Math.max(0, col - radius); c <= Math.min(board.width - 1, col + radius); c++) {
        if (r === row && c === col) continue;
        
        const distance = Math.abs(r - row) + Math.abs(c - col);
        const weight = Math.max(1, radius + 1 - distance);
        
        const stone = board.getStone(r, c);
        if (stone === playerStone) {
          friendlyInfluence += weight;
        } else if (stone === opponentStone) {
          enemyInfluence += weight;
        } else {
          emptySpaces += weight;
        }
      }
    }

    // Prefer areas where we have more influence
    if (friendlyInfluence > enemyInfluence) {
      score += (friendlyInfluence - enemyInfluence) * 2;
    }
    
    // Bonus for expanding into empty territory
    score += emptySpaces * 0.5;

    return score;
  }

  /**
   * Score for good opening moves
   */
  private static getOpeningScore(board: Board, row: number, col: number, playerStone: Stone): number {
    let score = 0;
    
    // Count total stones on board to determine game phase
    let totalStones = 0;
    for (let r = 0; r < board.height; r++) {
      for (let c = 0; c < board.width; c++) {
        if (board.getStone(r, c) !== Stone.NONE) {
          totalStones++;
        }
      }
    }

    const boardSize = board.width * board.height;
    const gamePhase = totalStones / boardSize;

    // Early game (first 25% of moves)
    if (gamePhase < 0.25) {
      // Prefer strategic points based on board size
      if (board.width >= 9) {
        // Standard Go opening principles for larger boards
        const isStarPoint = this.isStarPoint(board, row, col);
        if (isStarPoint) {
          score += 15;
        }
        
        // Prefer 3-3, 3-4, 4-4 points in corners
        const cornerDistance = this.getCornerDistance(board, row, col);
        if (cornerDistance <= 3) {
          score += 8 - cornerDistance;
        }
      } else {
        // For smaller boards, prefer center and near-center positions
        const centerRow = Math.floor(board.height / 2);
        const centerCol = Math.floor(board.width / 2);
        const distanceFromCenter = Math.abs(row - centerRow) + Math.abs(col - centerCol);
        
        if (distanceFromCenter <= 1) {
          score += 12;
        } else if (distanceFromCenter <= 2) {
          score += 6;
        }
      }
    }

    return score;
  }

  /**
   * Check if position is a star point (traditional Go opening points)
   */
  private static isStarPoint(board: Board, row: number, col: number): boolean {
    if (board.width < 9) return false;
    
    const starPoints = [];
    const size = board.width;
    
    if (size >= 13) {
      const offset = size >= 19 ? 3 : 2;
      starPoints.push(
        [offset, offset], [offset, size - 1 - offset], [size - 1 - offset, offset], [size - 1 - offset, size - 1 - offset]
      );
      
      if (size % 2 === 1) {
        const center = Math.floor(size / 2);
        starPoints.push([center, center]);
        if (size >= 19) {
          starPoints.push([offset, center], [center, offset], [size - 1 - offset, center], [center, size - 1 - offset]);
        }
      }
    }
    
    return starPoints.some(([r, c]) => r === row && c === col);
  }

  /**
   * Get minimum distance to any corner
   */
  private static getCornerDistance(board: Board, row: number, col: number): number {
    const corners = [
      [0, 0], [0, board.width - 1], [board.height - 1, 0], [board.height - 1, board.width - 1]
    ];
    
    return Math.min(...corners.map(([r, c]) => Math.abs(row - r) + Math.abs(col - c)));
  }

  /**
   * Check for opponent connection opportunities we should block
   */
  private static checkOpponentConnections(
    board: Board, 
    row: number, 
    col: number, 
    opponentRow: number, 
    opponentCol: number, 
    opponentStone: Stone
  ): number {
    let score = 0;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    // Check if blocking this position prevents opponent from connecting groups
    for (const [dr, dc] of directions) {
      const checkRow = opponentRow + dr;
      const checkCol = opponentCol + dc;
      
      if (board.isValidPosition(checkRow, checkCol) && 
          board.getStone(checkRow, checkCol) === opponentStone &&
          (checkRow !== row || checkCol !== col)) {
        
        // This would block a potential connection
        score += 8;
      }
    }

    return score;
  }

  /**
   * Score based on potential captures
   */
  private static getCaptureScore(
    board: Board, 
    row: number, 
    col: number, 
    playerStone: Stone, 
    opponentStone: Stone
  ): number {
    let score = 0;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of directions) {
      const adjRow = row + dr;
      const adjCol = col + dc;

      if (board.isValidPosition(adjRow, adjCol) && 
          board.getStone(adjRow, adjCol) === opponentStone) {
        
        // Check if this move would capture the adjacent opponent group
        const liberties = this.countLiberties(board, adjRow, adjCol, opponentStone);
        if (liberties === 1) {
          // This move would capture!
          const groupSize = this.getGroupSize(board, adjRow, adjCol, opponentStone);
          score += groupSize * 20; // High value for captures
        }
      }
    }

    return score;
  }

  /**
   * Score based on defensive needs
   */
  private static getDefenseScore(
    board: Board, 
    row: number, 
    col: number, 
    playerStone: Stone, 
    opponentStone: Stone
  ): number {
    let score = 0;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of directions) {
      const adjRow = row + dr;
      const adjCol = col + dc;

      if (board.isValidPosition(adjRow, adjCol) && 
          board.getStone(adjRow, adjCol) === playerStone) {
        
        // Check if our adjacent group is in danger
        const liberties = this.countLiberties(board, adjRow, adjCol, playerStone);
        if (liberties <= 2) {
          // Our group needs help!
          score += (3 - liberties) * 15;
        }
      }
    }

    return score;
  }

  /**
   * Score based on connection opportunities
   */
  private static getConnectionScore(board: Board, row: number, col: number, playerStone: Stone): number {
    let score = 0;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    let friendlyNeighbors = 0;
    for (const [dr, dc] of directions) {
      const adjRow = row + dr;
      const adjCol = col + dc;

      if (board.isValidPosition(adjRow, adjCol) && 
          board.getStone(adjRow, adjCol) === playerStone) {
        friendlyNeighbors++;
      }
    }

    // Bonus for connecting to existing stones
    score += friendlyNeighbors * 8;

    return score;
  }

  /**
   * Score based on eye formation potential
   */
  private static getEyeScore(board: Board, row: number, col: number, playerStone: Stone): number {
    let score = 0;
    
    // Check if this position could form an eye (surrounded by friendly stones)
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let friendlyCount = 0;
    let totalNeighbors = 0;

    for (const [dr, dc] of directions) {
      const adjRow = row + dr;
      const adjCol = col + dc;

      if (board.isValidPosition(adjRow, adjCol)) {
        totalNeighbors++;
        if (board.getStone(adjRow, adjCol) === playerStone) {
          friendlyCount++;
        }
      }
    }

    if (friendlyCount === totalNeighbors && totalNeighbors > 0) {
      score += 12; // Potential eye formation
    }

    return score;
  }

  /**
   * Count liberties (empty adjacent spaces) for a group
   */
  private static countLiberties(board: Board, row: number, col: number, stone: Stone): number {
    const visited = new Set<string>();
    const liberties = new Set<string>();

    this.floodFillLiberties(board, row, col, stone, visited, liberties);

    return liberties.size;
  }

  /**
   * Get the size of a connected group
   */
  private static getGroupSize(board: Board, row: number, col: number, stone: Stone): number {
    const visited = new Set<string>();
    return this.floodFillGroup(board, row, col, stone, visited);
  }

  /**
   * Flood fill to find all liberties of a group
   */
  private static floodFillLiberties(
    board: Board, 
    row: number, 
    col: number, 
    stone: Stone, 
    visited: Set<string>, 
    liberties: Set<string>
  ): void {
    const key = `${row},${col}`;
    if (visited.has(key) || !board.isValidPosition(row, col)) {
      return;
    }

    visited.add(key);

    if (board.getStone(row, col) === Stone.NONE) {
      liberties.add(key);
      return;
    }

    if (board.getStone(row, col) !== stone) {
      return;
    }

    // Continue flood fill in all directions
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) {
      this.floodFillLiberties(board, row + dr, col + dc, stone, visited, liberties);
    }
  }

  /**
   * Flood fill to count group size
   */
  private static floodFillGroup(
    board: Board, 
    row: number, 
    col: number, 
    stone: Stone, 
    visited: Set<string>
  ): number {
    const key = `${row},${col}`;
    if (visited.has(key) || !board.isValidPosition(row, col) || board.getStone(row, col) !== stone) {
      return 0;
    }

    visited.add(key);
    let size = 1;

    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) {
      size += this.floodFillGroup(board, row + dr, col + dc, stone, visited);
    }

    return size;
  }
}
