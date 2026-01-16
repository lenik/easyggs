import express from 'express';
import cors from 'cors';
import { BoardParser } from './boardParser';
import { NPCAI } from './npcAI';
import { InfluenceAdapter } from './influenceAdapter';
import { Color, Board, Stone } from './types';

// Demo game types
interface GameMove {
  moveNumber: number;
  row: number;
  column: number;
  color: 'black' | 'white';
  capturedStones: number[][]; // Positions of stones captured by this move
  boardStateAfter: string[][]; // Full board state after this move (B/W/./x)
  koPosition?: { row: number; column: number }; // Ko position if applicable
}

interface DemoGame {
  moves: GameMove[]; // Complete move history with all details
  influences: number[][][]; // Array of influence maps for each move
  boardStates: string[][][]; // Board state after each move (including forbidden positions)
  totalMoves: number;
  winner: string;
  endReason: string;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static demo files
app.use('/demo', express.static('demo'));

// Root endpoint - service info
app.get('/', (req, res) => {
  const packageInfo = require('../package.json');
  res.json({
    name: packageInfo.name,
    version: packageInfo.version,
    description: packageInfo.description,
    author: packageInfo.author,
    license: packageInfo.license
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'easyggs' });
});

// NPC AI move endpoint
app.get('/npc/:color', (req, res) => {
  try {
    const { color } = req.params;
    const { size, board } = req.query;

    // Validate color parameter
    if (color !== 'black' && color !== 'white') {
      return res.status(400).json({
        error: 'Invalid color. Must be "black" or "white"'
      });
    }

    // Validate board parameter
    if (!board || typeof board !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid board parameter'
      });
    }

    // Parse the board
    const parsedBoard = BoardParser.parseBoard(
      board as string, 
      size as string | undefined
    );

    // Calculate AI move
    const move = NPCAI.calculateMove(parsedBoard, color as Color);

    if (!move) {
      return res.status(200).json({
        message: 'No valid moves available'
      });
    }

    // Return move in "row,column" format (1-based)
    res.send(`${move.row},${move.column}`);

  } catch (error) {
    console.error('Error in /npc endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Influence calculation endpoint
app.get('/influence', (req, res) => {
  try {
    const { board, size } = req.query;

    // Validate board parameter
    if (!board || typeof board !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid board parameter'
      });
    }

    // Parse the board
    const parsedBoard = BoardParser.parseBoard(
      board as string, 
      size as string | undefined
    );

    // Calculate influence
    const influence = InfluenceAdapter.calculateInfluence(parsedBoard);

    res.json(influence);

  } catch (error) {
    console.error('Error in /influence endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions for demo game simulation
function calculateInfluenceMap(board: Board): number[][] {
  try {
    const influence = InfluenceAdapter.calculateInfluence(board);
    
    // Return the territory map directly since it's already a 2D array
    return influence.territory;
  } catch (error) {
    console.error('Error calculating influence:', error);
    // Return empty influence map on error
    return Array(board.height).fill(null).map(() => Array(board.width).fill(0));
  }
}

function cloneBoard(board: Board): Board {
  const cloned = new Board(board.width, board.height);
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      const stone = board.getStone(row, col);
      cloned.setStone(row, col, stone);
    }
  }
  return cloned;
}

function detectCaptures(board: Board, justPlayedRow: number, justPlayedCol: number, playerColor: 'black' | 'white'): number[][] {
  const captures: number[][] = [];
  const opponentStone = playerColor === 'black' ? 2 : 1; // 1 = black, 2 = white
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // up, down, left, right
  
  // Check all adjacent positions to the move just played
  for (const [dr, dc] of directions) {
    const adjRow = justPlayedRow + dr;
    const adjCol = justPlayedCol + dc;
    
    // Skip if out of bounds
    if (adjRow < 0 || adjRow >= board.height || adjCol < 0 || adjCol >= board.width) {
      continue;
    }
    
    const adjStone = board.getStone(adjRow, adjCol);
    
    // If adjacent stone belongs to opponent, check if it should be captured
    if (adjStone === opponentStone) {
      const group = getConnectedGroup(board, adjRow, adjCol, opponentStone);
      if (hasNoLiberties(board, group)) {
        // Add all stones in this group to captures
        group.forEach(([row, col]) => {
          captures.push([row, col]);
        });
      }
    }
  }
  
  return captures;
}

function getConnectedGroup(board: Board, startRow: number, startCol: number, stoneType: number): number[][] {
  const group: number[][] = [];
  const visited = new Set<string>();
  const stack = [[startRow, startCol]];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  
  while (stack.length > 0) {
    const [row, col] = stack.pop()!;
    const key = `${row},${col}`;
    
    if (visited.has(key)) continue;
    visited.add(key);
    
    if (board.getStone(row, col) === stoneType) {
      group.push([row, col]);
      
      // Check all adjacent positions
      for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;
        
        if (newRow >= 0 && newRow < board.height && newCol >= 0 && newCol < board.width) {
          if (!visited.has(`${newRow},${newCol}`)) {
            stack.push([newRow, newCol]);
          }
        }
      }
    }
  }
  
  return group;
}

function hasNoLiberties(board: Board, group: number[][]): boolean {
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  
  for (const [row, col] of group) {
    for (const [dr, dc] of directions) {
      const adjRow = row + dr;
      const adjCol = col + dc;
      
      // Skip if out of bounds
      if (adjRow < 0 || adjRow >= board.height || adjCol < 0 || adjCol >= board.width) {
        continue;
      }
      
      // If any adjacent position is empty, the group has liberties
      if (board.getStone(adjRow, adjCol) === 0) { // 0 = Stone.NONE
        return false;
      }
    }
  }
  
  return true; // No liberties found
}

function boardToStateArray(board: Board, koPosition?: { row: number; column: number }): string[][] {
  const state: string[][] = [];
  
  for (let row = 0; row < board.height; row++) {
    const rowState: string[] = [];
    for (let col = 0; col < board.width; col++) {
      const stone = board.getStone(row, col);
      
      // Check if this position is ko-forbidden
      if (koPosition && koPosition.row === row + 1 && koPosition.column === col + 1) {
        rowState.push('x'); // Ko forbidden position
      } else if (stone === Stone.BLACK) {
        rowState.push('B');
      } else if (stone === Stone.WHITE) {
        rowState.push('W');
      } else {
        rowState.push('.');
      }
    }
    state.push(rowState);
  }
  
  return state;
}

function detectKo(boardBefore: Board, boardAfter: Board, moveRow: number, moveCol: number, capturedStones: number[][]): { row: number; column: number } | undefined {
  // Ko rule: if exactly one stone was captured and the current move would recreate the previous board state
  if (capturedStones.length !== 1) {
    return undefined; // Ko only applies when exactly one stone is captured
  }
  
  const capturedPos = capturedStones[0];
  
  // Check if the captured position would recreate the previous board state if played
  // This is a simplified ko detection - in a full implementation, we'd need to track board history
  return { row: capturedPos[0] + 1, column: capturedPos[1] + 1 };
}

function boardStateToString(board: Board, koPosition?: { row: number; column: number }): string {
  let result = '';
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      if (koPosition && koPosition.row === row + 1 && koPosition.column === col + 1) {
        result += 'x';
      } else {
        const stone = board.getStone(row, col);
        if (stone === Stone.BLACK) result += 'B';
        else if (stone === Stone.WHITE) result += 'W';
        else result += '.';
      }
    }
  }
  return result;
}

async function getNPCMoveWithKo(board: Board, color: 'black' | 'white', boardStateString: string): Promise<{ row: number; column: number } | null> {
  try {
    // For now, use the existing NPCAI but we'll need to enhance it to understand ko positions
    // This is a temporary implementation - the NPCAI would need to be updated to:
    // 1. Parse the boardStateString to identify 'x' positions as forbidden
    // 2. Return {row: -1, column: -1} when no moves possible
    // 3. Return {row: -2, column: -2} for resignation
    
    const npcMove = NPCAI.calculateMove(board, color);
    
    if (!npcMove) {
      // Return special code for no possible moves
      return { row: -1, column: -1 };
    }
    
    // Check if the move would be on a ko-forbidden position
    const moveIndex = (npcMove.row - 1) * board.width + (npcMove.column - 1);
    if (boardStateString[moveIndex] === 'x') {
      // The NPC tried to play on a forbidden position, return no moves
      return { row: -1, column: -1 };
    }
    
    return npcMove;
  } catch (error) {
    console.error('Error getting NPC move:', error);
    return null;
  }
}

// Simulate a game between two NPCs
async function simulateNPCGame(boardSize: number, maxMoves: number): Promise<DemoGame> {
  const board = new Board(boardSize, boardSize);
  let currentColor: 'black' | 'white' = 'black';
  let moveCount = 0;
  let koPosition: { row: number; column: number } | undefined;
  
  const moves: GameMove[] = [];
  const influences: number[][][] = [];
  const boardStates: string[][][] = [];
  
  // Add initial empty board state
  const initialInfluence = calculateInfluenceMap(board);
  influences.push(initialInfluence);
  boardStates.push(boardToStateArray(board));
  
  while (moveCount < maxMoves) {
    // Create board state string for NPC (including ko position)
    const boardStateString = boardStateToString(board, koPosition);
    
    // Get NPC move with current board state (including forbidden positions)
    const npcMove = await getNPCMoveWithKo(board, currentColor, boardStateString);
    
    if (!npcMove) {
      // No valid moves available
      break;
    }
    
    if (npcMove.row === -1 && npcMove.column === -1) {
      // NPC indicates no possible moves
      break;
    }
    
    if (npcMove.row === -2 && npcMove.column === -2) {
      // NPC resigns
      const winner = currentColor === 'black' ? 'white' : 'black';
      return {
        moves,
        influences,
        boardStates,
        totalMoves: moveCount,
        winner,
        endReason: 'resignation'
      };
    }
    
    // Store board state before move for capture detection
    const boardBefore = cloneBoard(board);
    
    // Make the move on the board
    board.setStone(npcMove.row - 1, npcMove.column - 1, currentColor === 'black' ? 1 : 2);
    
    moveCount++;
    
    // Detect captures using proper Go rules (liberties)
    const capturedStones = detectCaptures(board, npcMove.row - 1, npcMove.column - 1, currentColor);
    
    // Actually remove captured stones from the board
    capturedStones.forEach(([row, col]) => {
      board.setStone(row, col, 0); // 0 = empty/Stone.NONE
    });
    
    // Detect ko position for next move
    const newKoPosition = detectKo(boardBefore, board, npcMove.row, npcMove.column, capturedStones);
    
    // Create move record
    const gameMove: GameMove = {
      moveNumber: moveCount,
      row: npcMove.row,
      column: npcMove.column,
      color: currentColor,
      capturedStones,
      boardStateAfter: boardToStateArray(board, newKoPosition),
      koPosition: newKoPosition
    };
    
    moves.push(gameMove);
    
    // Calculate influence map after the move
    const influenceMap = calculateInfluenceMap(board);
    influences.push(influenceMap);
    
    // Store board state after move
    boardStates.push(boardToStateArray(board, newKoPosition));
    
    // Update ko position for next move
    koPosition = newKoPosition;
    
    // Switch players
    currentColor = currentColor === 'black' ? 'white' : 'black';
  }
  
  // Determine winner (simplified - just based on move count)
  const winner = moveCount % 2 === 1 ? 'black' : 'white';
  const endReason = moveCount >= maxMoves ? 'maxMoves' : 'noValidMoves';
  
  return {
    moves,
    influences,
    boardStates,
    totalMoves: moveCount,
    winner,
    endReason
  };
}


// API endpoint for demo game data
app.get('/api/demo-data', async (req, res) => {
  try {
    const size = parseInt(req.query.size as string) || 19;
    const maxMoves = parseInt(req.query.maxMoves as string) || size * size;
    
    // Validate board size
    if (size < 3 || size > 19) {
      return res.status(400).json({
        error: 'Invalid board size',
        message: 'Board size must be between 3 and 19'
      });
    }

    const demoGame = await simulateNPCGame(size, maxMoves);
    res.json(demoGame);

  } catch (error) {
    console.error('Error in /api/demo-data endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /npc/:color?size=<size>&board=<board_data>',
      'GET /influence?board=<board_data>&size=<size>',
      'GET /demo/ (static files)',
      'GET /api/demo-data?size=<size>&maxMoves=<maxMoves>'
    ]
  });
});

// Error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log('🎯 EasyGGS (GoGame Service) running on port', PORT);
    console.log('📋 Available endpoints:');
    console.log('   GET /');
    console.log('   GET /health');
    console.log('   GET /npc/:color?size=<size>&board=<board_data>');
    console.log('   GET /influence?board=<board_data>&size=<size>');
    console.log('   GET /demo/ (static files)');
    console.log('   GET /api/demo-data?size=<size>&maxMoves=<maxMoves>');
    console.log('');
    console.log('📖 Example usage:');
    console.log('   curl "http://localhost:3000/"');
    console.log('   curl "http://localhost:3000/npc/black?size=5&board=128,512,4,8,24"');
    console.log('   curl "http://localhost:3000/influence?board=128,512,4,8,24"');
    console.log('   🤖 Demo: http://localhost:3000/demo/ (default 19x19)');
  });
}

export default app;
