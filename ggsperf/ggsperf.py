#!/usr/bin/env python3
"""
GGSPerf - GoGame Service Performance Tester (Python Implementation)
Fast performance testing tool for EasyGGS servers.
"""

import argparse
import json
import time
import statistics
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
import requests
import sys


class Stone(Enum):
    NONE = 0
    BLACK = 1
    WHITE = 2


@dataclass
class GameMove:
    row: int
    column: int
    color: str
    response_time: float
    move_number: int


@dataclass
class GameResult:
    game_number: int
    total_moves: int
    total_time: float
    average_response_time: float
    moves: List[GameMove]
    winner: str
    end_reason: str
    final_board: List[List[int]]  # 2D array with sequence numbers (1-based, 0=empty)


@dataclass
class PerformanceStats:
    total_games: int
    total_moves: int
    total_time: float
    average_game_time: float
    average_response_time: float
    min_response_time: float
    max_response_time: float
    min_game_time: float
    max_game_time: float
    response_times: List[float]
    game_times: List[float]
    games: List[GameResult]


class Board:
    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        self.grid = [[Stone.NONE for _ in range(width)] for _ in range(height)]
        self.sequence_grid = [[0 for _ in range(width)] for _ in range(height)]  # Track move sequence numbers
    
    def is_valid_position(self, row: int, col: int) -> bool:
        return 0 <= row < self.height and 0 <= col < self.width
    
    def is_empty(self, row: int, col: int) -> bool:
        return self.grid[row][col] == Stone.NONE
    
    def set_stone(self, row: int, col: int, stone: Stone, sequence_num: int = 0):
        if self.is_valid_position(row, col):
            self.grid[row][col] = stone
            self.sequence_grid[row][col] = sequence_num
    
    def get_stone(self, row: int, col: int) -> Stone:
        if self.is_valid_position(row, col):
            return self.grid[row][col]
        return Stone.NONE
    
    def to_string(self) -> str:
        """Convert board to semicolon-separated format with comma-separated cells"""
        rows = []
        for row in range(self.height):
            cells = []
            for col in range(self.width):
                stone = self.grid[row][col]
                if stone == Stone.BLACK:
                    cells.append('B')
                elif stone == Stone.WHITE:
                    cells.append('W')
                else:
                    cells.append('.')
            rows.append(','.join(cells))
        return ';'.join(rows)


class GoGameSimulator:
    def __init__(self, server_url: str, board_size: int = 19):
        self.server_url = server_url.rstrip('/')
        self.board_size = board_size
        self.board = Board(board_size, board_size)
        self.max_moves = board_size * board_size
        self.session = requests.Session()
        self.session.timeout = 30
    
    def make_npc_move(self, color: str) -> Tuple[int, int, float]:
        """Make an NPC move and return (row, col, response_time)"""
        board_data = self.board.to_string()
        url = f"{self.server_url}/npc/{color}"
        params = {'board': board_data}
        
        start_time = time.time()
        
        try:
            response = self.session.get(url, params=params)
            end_time = time.time()
            response_time = (end_time - start_time) * 1000  # Convert to milliseconds
            
            if response.status_code == 200:
                if ',' in response.text:
                    row, col = map(int, response.text.strip().split(','))
                    return row, col, response_time
                else:
                    data = response.json()
                    if 'message' in data and 'No valid moves' in data['message']:
                        raise Exception('No valid moves available')
            
            raise Exception(f"HTTP {response.status_code}: {response.text}")
            
        except requests.exceptions.Timeout:
            end_time = time.time()
            response_time = (end_time - start_time) * 1000
            raise Exception(f"Request timeout after {response_time:.0f}ms")
        except requests.exceptions.RequestException as e:
            end_time = time.time()
            response_time = (end_time - start_time) * 1000
            raise Exception(f"Request failed: {str(e)}")
    
    def is_valid_move(self, row: int, col: int) -> bool:
        """Check if move is valid (1-based indexing from server)"""
        board_row = row - 1  # Convert to 0-based
        board_col = col - 1
        return (self.board.is_valid_position(board_row, board_col) and 
                self.board.is_empty(board_row, board_col))
    
    def make_move(self, row: int, col: int, color: str, move_number: int):
        """Make a move on the board (1-based indexing from server)"""
        board_row = row - 1  # Convert to 0-based
        board_col = col - 1
        stone = Stone.BLACK if color == 'black' else Stone.WHITE
        self.board.set_stone(board_row, board_col, stone, move_number)
    
    def is_game_over(self) -> Tuple[bool, str, str]:
        """Check if game is over, return (is_over, winner, reason)"""
        empty_spaces = 0
        black_stones = 0
        white_stones = 0
        
        for row in range(self.board.height):
            for col in range(self.board.width):
                stone = self.board.get_stone(row, col)
                if stone == Stone.NONE:
                    empty_spaces += 1
                elif stone == Stone.BLACK:
                    black_stones += 1
                elif stone == Stone.WHITE:
                    white_stones += 1
        
        total_spaces = self.board.width * self.board.height
        
        # Game over if board is nearly full (less than 10% empty)
        if empty_spaces < total_spaces * 0.1:
            if black_stones > white_stones:
                return True, 'black', 'territory'
            elif white_stones > black_stones:
                return True, 'white', 'territory'
            else:
                return True, 'draw', 'territory'
        
        return False, 'draw', ''
    
    def simulate_game(self) -> GameResult:
        """Simulate a complete game"""
        self.board = Board(self.board_size, self.board_size)  # Reset board
        moves = []
        current_color = 'black'
        move_number = 1
        game_start_time = time.time()
        
        print(f"Starting new game...")
        
        while move_number <= self.max_moves:
            try:
                row, col, response_time = self.make_npc_move(current_color)
                
                if not self.is_valid_move(row, col):
                    print(f"Invalid move suggested: {row},{col}")
                    break
                
                self.make_move(row, col, current_color, move_number)
                
                moves.append(GameMove(
                    row=row,
                    column=col,
                    color=current_color,
                    response_time=response_time,
                    move_number=move_number
                ))
                
                print(f"Move {move_number}: {current_color} plays {row},{col} ({response_time:.0f}ms)")
                
                # Check if game is over
                is_over, winner, reason = self.is_game_over()
                if is_over:
                    total_time = (time.time() - game_start_time) * 1000  # Convert to ms
                    avg_response_time = sum(m.response_time for m in moves) / len(moves)
                    
                    return GameResult(
                        game_number=0,  # Will be set by caller
                        total_moves=len(moves),
                        total_time=total_time,
                        average_response_time=avg_response_time,
                        moves=moves,
                        winner=winner,
                        end_reason=reason,
                        final_board=self.board.sequence_grid
                    )
                
                # Switch colors
                current_color = 'white' if current_color == 'black' else 'black'
                move_number += 1
                
            except Exception as e:
                print(f"Game ended due to error: {str(e)}")
                break
        
        # Game ended due to max moves or error
        total_time = (time.time() - game_start_time) * 1000
        avg_response_time = sum(m.response_time for m in moves) / len(moves) if moves else 0
        
        return GameResult(
            game_number=0,  # Will be set by caller
            total_moves=len(moves),
            total_time=total_time,
            average_response_time=avg_response_time,
            moves=moves,
            winner='draw',
            end_reason='maxMoves',
            final_board=self.board.sequence_grid
        )


class PerformanceTester:
    def __init__(self, server_url: str, board_size: int, num_games: int):
        self.simulator = GoGameSimulator(server_url, board_size)
        self.num_games = num_games
    
    def run_tests(self) -> PerformanceStats:
        """Run performance tests"""
        games = []
        response_times = []
        game_times = []
        
        print(f"Starting performance test: {self.num_games} games")
        print("=" * 50)
        
        for i in range(1, self.num_games + 1):
            print(f"\nGame {i}/{self.num_games}")
            
            try:
                game_result = self.simulator.simulate_game()
                game_result.game_number = i
                games.append(game_result)
                
                game_times.append(game_result.total_time)
                response_times.extend(move.response_time for move in game_result.moves)
                
                print(f"Game {i} completed: {game_result.total_moves} moves, "
                      f"{game_result.total_time:.0f}ms total, "
                      f"avg {game_result.average_response_time:.1f}ms per move")
                
            except Exception as e:
                print(f"Game {i} failed: {str(e)}")
        
        # Calculate statistics
        total_moves = sum(game.total_moves for game in games)
        total_time = sum(game.total_time for game in games)
        
        return PerformanceStats(
            total_games=len(games),
            total_moves=total_moves,
            total_time=total_time,
            average_game_time=total_time / len(games) if games else 0,
            average_response_time=sum(response_times) / len(response_times) if response_times else 0,
            min_response_time=min(response_times) if response_times else 0,
            max_response_time=max(response_times) if response_times else 0,
            min_game_time=min(game_times) if game_times else 0,
            max_game_time=max(game_times) if game_times else 0,
            response_times=response_times,
            game_times=game_times,
            games=games
        )


class HTMLReportGenerator:
    @staticmethod
    def generate(stats: PerformanceStats, board_size: int, server_url: str) -> str:
        """Generate HTML report"""
        timestamp = datetime.now().isoformat()
        
        # Convert game times from ms to seconds for display
        game_times_seconds = [t / 1000 for t in stats.game_times]
        
        # Serialize game data for JavaScript
        games_data = []
        for game in stats.games:
            game_data = {
                'game_number': game.game_number,
                'total_moves': game.total_moves,
                'total_time': game.total_time,
                'winner': game.winner,
                'end_reason': game.end_reason,
                'final_board': game.final_board,  # 2D array with sequence numbers
                'moves': [
                    {
                        'move_number': move.move_number,
                        'row': move.row,
                        'column': move.column,
                        'color': move.color,
                        'response_time': move.response_time
                    }
                    for move in game.moves
                ]
            }
            games_data.append(game_data)
        
        return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GGS Performance Test Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h1, h2 {{
            color: #333;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 10px;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }}
        .stat-card {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #4CAF50;
        }}
        .stat-value {{
            font-size: 2em;
            font-weight: bold;
            color: #4CAF50;
        }}
        .stat-label {{
            color: #666;
            margin-top: 5px;
        }}
        .chart-container {{
            margin: 30px 0;
            height: 400px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background-color: #4CAF50;
            color: white;
        }}
        tr:hover {{
            background-color: #f5f5f5;
        }}
        .metadata {{
            background: #e3f2fd;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }}
        .python-badge {{
            background: #3776ab;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-left: 10px;
        }}
        .game-playback {{
            margin: 30px 0;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            background: #fafafa;
        }}
        .game-selector {{
            margin-bottom: 20px;
        }}
        .game-selector select {{
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            margin-right: 10px;
        }}
        .playback-controls {{
            margin: 15px 0;
            text-align: center;
        }}
        .playback-controls button {{
            padding: 8px 16px;
            margin: 0 5px;
            border: none;
            border-radius: 4px;
            background: #4CAF50;
            color: white;
            cursor: pointer;
            font-size: 14px;
        }}
        .playback-controls button:hover {{
            background: #45a049;
        }}
        .playback-controls button:disabled {{
            background: #ccc;
            cursor: not-allowed;
        }}
        .game-board {{
            display: inline-block;
            background: #DEB887;
            margin: 20px auto;
            border-radius: 8px;
            padding: 20px;
            position: relative;
            border: 3px solid #8B4513;
        }}
        .board-grid {{
            position: relative;
            display: inline-block;
        }}
        .board-line {{
            position: absolute;
            background: #8B4513;
        }}
        .board-line.horizontal {{
            height: 2px;
            width: 100%;
        }}
        .board-line.vertical {{
            width: 2px;
            height: 100%;
        }}
        .board-intersection {{
            position: absolute;
            width: 32px;
            height: 32px;
            margin: -16px 0 0 -16px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            z-index: 10;
        }}
        .board-intersection.black {{
            background: radial-gradient(circle, #000 85%, #333 100%);
            color: white;
            box-shadow: 2px 2px 4px rgba(0,0,0,0.4);
        }}
        .board-intersection.white {{
            background: radial-gradient(circle, #fff 85%, #ddd 100%);
            color: black;
            box-shadow: 2px 2px 4px rgba(0,0,0,0.2);
            border: 1px solid #ccc;
        }}
        .board-intersection.last-move {{
            box-shadow: 0 0 0 3px #ff4444, 2px 2px 4px rgba(0,0,0,0.4);
            animation: pulse 1s infinite;
        }}
        .board-cell.last-move {{
            box-shadow: inset 0 0 0 3px #ff4444;
        }}
        .move-info {{
            margin: 15px 0;
            padding: 10px;
            background: white;
            border-radius: 4px;
            border: 1px solid #ddd;
        }}
        .move-counter {{
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }}
        .game-info {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }}
        .info-card {{
            background: white;
            padding: 15px;
            border-radius: 4px;
            border: 1px solid #ddd;
        }}
        .speed-control {{
            margin: 10px 0;
        }}
        .speed-control input {{
            width: 100px;
        }}
        .final-board {{
            display: inline-block;
            border: 1px solid #8B4513;
            background: #DEB887;
            margin: 5px;
        }}
        .final-board {{
            display: inline-block;
            background: #DEB887;
            border-radius: 4px;
            padding: 10px;
            position: relative;
            border: 2px solid #8B4513;
        }}
        .final-board-grid {{
            position: relative;
            display: inline-block;
        }}
        .final-board-line {{
            position: absolute;
            background: #8B4513;
        }}
        .final-board-line.horizontal {{
            height: 1px;
            width: 100%;
        }}
        .final-board-line.vertical {{
            width: 1px;
            height: 100%;
        }}
        .final-board-intersection {{
            position: absolute;
            width: 16px;
            height: 16px;
            margin: -8px 0 0 -8px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            font-weight: bold;
            z-index: 10;
        }}
        .final-board-intersection.black {{
            background: radial-gradient(circle, #000 85%, #333 100%);
            color: white;
            box-shadow: 1px 1px 2px rgba(0,0,0,0.4);
        }}
        .final-board-intersection.white {{
            background: radial-gradient(circle, #fff 85%, #ddd 100%);
            color: black;
            box-shadow: 1px 1px 2px rgba(0,0,0,0.2);
            border: 1px solid #ccc;
        }}
        .playback-btn {{
            background: #2196F3;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            margin-left: 5px;
        }}
        .playback-btn:hover {{
            background: #1976D2;
        }}
        .game-result-cell {{
            text-align: center;
            vertical-align: middle;
        }}
        .modal {{
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }}
        .modal-content {{
            background-color: white;
            margin: 5% auto;
            padding: 20px;
            border-radius: 10px;
            width: 80%;
            max-width: 800px;
            max-height: 80%;
            overflow-y: auto;
        }}
        .close {{
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }}
        .close:hover {{
            color: black;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 GGS Performance Test Report <span class="python-badge">Python v2.0</span></h1>
        
        <div class="metadata">
            <strong>Test Configuration:</strong><br>
            Server: {server_url}<br>
            Board Size: {board_size}x{board_size}<br>
            Games Tested: {stats.total_games}<br>
            Generated: {timestamp}<br>
            Tool: GGSPerf Python v2.0 (Fast Implementation)
        </div>

        <h2>📊 Performance Statistics</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">{stats.total_games}</div>
                <div class="stat-label">Total Games</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{stats.total_moves}</div>
                <div class="stat-label">Total Moves</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{stats.average_game_time / 1000:.1f}s</div>
                <div class="stat-label">Average Game Time</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{stats.average_response_time:.1f}ms</div>
                <div class="stat-label">Average Response Time</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{stats.min_response_time:.0f}ms</div>
                <div class="stat-label">Min Response Time</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{stats.max_response_time:.0f}ms</div>
                <div class="stat-label">Max Response Time</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{stats.min_game_time / 1000:.1f}s</div>
                <div class="stat-label">Fastest Game</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{stats.max_game_time / 1000:.1f}s</div>
                <div class="stat-label">Slowest Game</div>
            </div>
        </div>

        <h2>📈 Response Time Distribution</h2>
        <div class="chart-container">
            <canvas id="responseTimeChart"></canvas>
        </div>

        <h2>⏱️ Game Duration Distribution</h2>
        <div class="chart-container">
            <canvas id="gameTimeChart"></canvas>
        </div>

        <h2>🎮 Game Playback</h2>
        <div class="game-playback">
            <div class="game-selector">
                <label for="gameSelect">Select Game:</label>
                <select id="gameSelect">
                    <option value="">Choose a game to replay...</option>
                </select>
                <span id="gameStats"></span>
            </div>
            
            <div id="gamePlaybackContent" style="display: none;">
                <div class="game-info">
                    <div class="info-card">
                        <h4>Game Information</h4>
                        <div id="gameInfo"></div>
                    </div>
                    <div class="info-card">
                        <h4>Current Move</h4>
                        <div id="currentMoveInfo"></div>
                    </div>
                </div>
                
                <div class="playback-controls">
                    <button id="firstMove">⏮️ First</button>
                    <button id="prevMove">⏪ Previous</button>
                    <button id="playPause">▶️ Play</button>
                    <button id="nextMove">⏩ Next</button>
                    <button id="lastMove">⏭️ Last</button>
                </div>
                
                <div class="speed-control">
                    <label for="playbackSpeed">Playback Speed:</label>
                    <input type="range" id="playbackSpeed" min="100" max="2000" value="1000" step="100">
                    <span id="speedLabel">1.0s</span>
                </div>
                
                <div class="move-counter">
                    <span id="moveCounter">Move 0 of 0</span>
                </div>
                
                <div style="text-align: center;">
                    <div id="gameBoard" class="game-board"></div>
                </div>
                
                <div class="move-info">
                    <div id="moveDetails"></div>
                </div>
            </div>
        </div>

        <h2>📋 Game Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Game #</th>
                    <th>Final Board</th>
                    <th>Moves</th>
                    <th>Duration</th>
                    <th>Avg Response</th>
                    <th>Winner</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="gameResultsTable">
                <!-- Game results will be populated by JavaScript -->
            </tbody>
        </table>
        
        <!-- Modal for game playback -->
        <div id="gameModal" class="modal">
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2 id="modalTitle">Game Playback</h2>
                <div id="modalGameContent">
                    <!-- Playback content will be inserted here -->
                </div>
            </div>
        </div>
    </div>

    <script>
        // Embedded game data
        const gamesData = {json.dumps(games_data)};
        const boardSize = {board_size};
        
        // Game playback state
        let currentGame = null;
        let currentMoveIndex = 0;
        let isPlaying = false;
        let playbackInterval = null;
        let playbackSpeed = 1000; // milliseconds
        
        // Response Time Histogram
        const responseTimeData = {json.dumps(stats.response_times)};
        const responseTimeBins = createHistogramBins(responseTimeData, 20);
        
        new Chart(document.getElementById('responseTimeChart'), {{
            type: 'bar',
            data: {{
                labels: responseTimeBins.labels,
                datasets: [{{
                    label: 'Response Time Distribution',
                    data: responseTimeBins.counts,
                    backgroundColor: 'rgba(76, 175, 80, 0.6)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 1
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                scales: {{
                    y: {{
                        beginAtZero: true,
                        title: {{
                            display: true,
                            text: 'Frequency'
                        }}
                    }},
                    x: {{
                        title: {{
                            display: true,
                            text: 'Response Time (ms)'
                        }}
                    }}
                }}
            }}
        }});

        // Game Time Chart
        const gameTimeData = {json.dumps(game_times_seconds)};
        
        new Chart(document.getElementById('gameTimeChart'), {{
            type: 'line',
            data: {{
                labels: Array.from({{length: gameTimeData.length}}, (_, i) => i + 1),
                datasets: [{{
                    label: 'Game Duration (seconds)',
                    data: gameTimeData,
                    borderColor: 'rgba(33, 150, 243, 1)',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.1
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                scales: {{
                    y: {{
                        beginAtZero: true,
                        title: {{
                            display: true,
                            text: 'Duration (seconds)'
                        }}
                    }},
                    x: {{
                        title: {{
                            display: true,
                            text: 'Game Number'
                        }}
                    }}
                }}
            }}
        }});

        function createHistogramBins(data, numBins) {{
            const min = Math.min(...data);
            const max = Math.max(...data);
            const binSize = (max - min) / numBins;
            
            const bins = Array(numBins).fill(0);
            const labels = [];
            
            for (let i = 0; i < numBins; i++) {{
                const binStart = min + i * binSize;
                const binEnd = min + (i + 1) * binSize;
                labels.push(`${{binStart.toFixed(0)}}-${{binEnd.toFixed(0)}}`);
            }}
            
            data.forEach(value => {{
                const binIndex = Math.min(Math.floor((value - min) / binSize), numBins - 1);
                bins[binIndex]++;
            }});
            
            return {{ labels, counts: bins }};
        }}

        // Game playback functions
        function initializeGamePlayback() {{
            const gameSelect = document.getElementById('gameSelect');
            
            // Populate game selector
            gamesData.forEach(game => {{
                const option = document.createElement('option');
                option.value = game.game_number;
                option.textContent = `Game ${{game.game_number}} (${{game.total_moves}} moves, ${{game.winner}} wins)`;
                gameSelect.appendChild(option);
            }});
            
            // Populate game results table
            populateGameResultsTable();
            
            // Event listeners
            gameSelect.addEventListener('change', selectGame);
            document.getElementById('firstMove').addEventListener('click', goToFirstMove);
            document.getElementById('prevMove').addEventListener('click', goToPreviousMove);
            document.getElementById('playPause').addEventListener('click', togglePlayback);
            document.getElementById('nextMove').addEventListener('click', goToNextMove);
            document.getElementById('lastMove').addEventListener('click', goToLastMove);
            
            const speedSlider = document.getElementById('playbackSpeed');
            speedSlider.addEventListener('input', updatePlaybackSpeed);
            updateSpeedLabel();
            
            // Modal event listeners
            const modal = document.getElementById('gameModal');
            const closeBtn = document.querySelector('.close');
            closeBtn.addEventListener('click', closeModal);
            window.addEventListener('click', (event) => {{
                if (event.target === modal) {{
                    closeModal();
                }}
            }});
        }}
        
        function populateGameResultsTable() {{
            const tbody = document.getElementById('gameResultsTable');
            tbody.innerHTML = '';
            
            gamesData.forEach(game => {{
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="game-result-cell">${{game.game_number}}</td>
                    <td class="game-result-cell">${{createFinalBoardHTML(game.final_board)}}</td>
                    <td class="game-result-cell">${{game.total_moves}}</td>
                    <td class="game-result-cell">${{(game.total_time / 1000).toFixed(1)}}s</td>
                    <td class="game-result-cell">${{(game.moves.reduce((sum, m) => sum + m.response_time, 0) / game.moves.length).toFixed(1)}}ms</td>
                    <td class="game-result-cell">${{game.winner}}</td>
                    <td class="game-result-cell">
                        <button class="playback-btn" onclick="openGamePlayback(${{game.game_number}})">
                            ▶️ Playback
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            }});
        }}
        
        function createFinalBoardHTML(finalBoard) {{
            const boardSize = finalBoard.length;
            const gridSize = 20; // Smaller grid for final board display
            const boardWidth = (boardSize - 1) * gridSize;
            const boardHeight = (boardSize - 1) * gridSize;
            
            let boardHtml = `<div class="final-board">
                <div class="final-board-grid" style="width: ${{boardWidth}}px; height: ${{boardHeight}}px;">`;
            
            // Create horizontal lines
            for (let row = 0; row < boardSize; row++) {{
                boardHtml += `<div class="final-board-line horizontal" style="top: ${{row * gridSize}}px; left: 0px; width: ${{boardWidth}}px;"></div>`;
            }}
            
            // Create vertical lines
            for (let col = 0; col < boardSize; col++) {{
                boardHtml += `<div class="final-board-line vertical" style="left: ${{col * gridSize}}px; top: 0px; height: ${{boardHeight}}px;"></div>`;
            }}
            
            // Create intersections with stones
            for (let row = 0; row < boardSize; row++) {{
                for (let col = 0; col < boardSize; col++) {{
                    const seqNum = finalBoard[row][col];
                    let intersectionClass = 'final-board-intersection';
                    let content = '';
                    
                    if (seqNum > 0) {{
                        // Odd sequence numbers are black, even are white
                        if (seqNum % 2 === 1) {{
                            intersectionClass += ' black';
                        }} else {{
                            intersectionClass += ' white';
                        }}
                        content = seqNum.toString();
                    }}
                    
                    boardHtml += `<div class="${{intersectionClass}}" style="left: ${{col * gridSize}}px; top: ${{row * gridSize}}px;">${{content}}</div>`;
                }}
            }}
            
            boardHtml += '</div></div>';
            return boardHtml;
        }}
        
        function openGamePlayback(gameNumber) {{
            const game = gamesData.find(g => g.game_number === gameNumber);
            if (!game) return;
            
            currentGame = game;
            currentMoveIndex = 0;
            isPlaying = false;
            
            if (playbackInterval) {{
                clearInterval(playbackInterval);
                playbackInterval = null;
            }}
            
            const modal = document.getElementById('gameModal');
            const modalTitle = document.getElementById('modalTitle');
            const modalContent = document.getElementById('modalGameContent');
            
            modalTitle.textContent = `Game ${{gameNumber}} Playback`;
            
            // Create playback interface in modal
            modalContent.innerHTML = `
                <div class="game-info">
                    <div class="info-card">
                        <h4>Game Information</h4>
                        <div id="modalGameInfo">
                            <strong>Game #${{game.game_number}}</strong><br>
                            Total Moves: ${{game.total_moves}}<br>
                            Duration: ${{(game.total_time / 1000).toFixed(1)}}s<br>
                            Winner: ${{game.winner}}<br>
                            End Reason: ${{game.end_reason}}
                        </div>
                    </div>
                    <div class="info-card">
                        <h4>Current Move</h4>
                        <div id="modalCurrentMoveInfo"></div>
                    </div>
                </div>
                
                <div class="playback-controls">
                    <button id="modalFirstMove">⏮️ First</button>
                    <button id="modalPrevMove">⏪ Previous</button>
                    <button id="modalPlayPause">▶️ Play</button>
                    <button id="modalNextMove">⏩ Next</button>
                    <button id="modalLastMove">⏭️ Last</button>
                </div>
                
                <div class="speed-control">
                    <label for="modalPlaybackSpeed">Playback Speed:</label>
                    <input type="range" id="modalPlaybackSpeed" min="100" max="2000" value="1000" step="100">
                    <span id="modalSpeedLabel">1.0s</span>
                </div>
                
                <div class="move-counter">
                    <span id="modalMoveCounter">Move 0 of ${{game.total_moves}}</span>
                </div>
                
                <div style="text-align: center;">
                    <div id="modalGameBoard" class="game-board"></div>
                </div>
                
                <div class="move-info">
                    <div id="modalMoveDetails"></div>
                </div>
            `;
            
            // Add event listeners for modal controls
            document.getElementById('modalFirstMove').addEventListener('click', goToFirstMove);
            document.getElementById('modalPrevMove').addEventListener('click', goToPreviousMove);
            document.getElementById('modalPlayPause').addEventListener('click', togglePlayback);
            document.getElementById('modalNextMove').addEventListener('click', goToNextMove);
            document.getElementById('modalLastMove').addEventListener('click', goToLastMove);
            
            const modalSpeedSlider = document.getElementById('modalPlaybackSpeed');
            modalSpeedSlider.addEventListener('input', updateModalPlaybackSpeed);
            
            createModalGameBoard();
            updateModalBoardDisplay();
            updateModalMoveInfo();
            updateModalPlaybackControls();
            
            modal.style.display = 'block';
        }}
        
        function closeModal() {{
            const modal = document.getElementById('gameModal');
            modal.style.display = 'none';
            
            if (playbackInterval) {{
                clearInterval(playbackInterval);
                playbackInterval = null;
            }}
            isPlaying = false;
        }}
        
        function createModalGameBoard() {{
            const boardContainer = document.getElementById('modalGameBoard');
            boardContainer.innerHTML = '';
            
            const gridSize = 40; // Space between intersections
            const boardWidth = (boardSize - 1) * gridSize;
            const boardHeight = (boardSize - 1) * gridSize;
            
            // Create grid container
            const gridDiv = document.createElement('div');
            gridDiv.className = 'board-grid';
            gridDiv.style.width = boardWidth + 'px';
            gridDiv.style.height = boardHeight + 'px';
            
            // Create horizontal lines
            for (let row = 0; row < boardSize; row++) {{
                const line = document.createElement('div');
                line.className = 'board-line horizontal';
                line.style.top = (row * gridSize) + 'px';
                line.style.left = '0px';
                line.style.width = boardWidth + 'px';
                gridDiv.appendChild(line);
            }}
            
            // Create vertical lines
            for (let col = 0; col < boardSize; col++) {{
                const line = document.createElement('div');
                line.className = 'board-line vertical';
                line.style.left = (col * gridSize) + 'px';
                line.style.top = '0px';
                line.style.height = boardHeight + 'px';
                gridDiv.appendChild(line);
            }}
            
            // Create intersections for stone placement
            for (let row = 0; row < boardSize; row++) {{
                for (let col = 0; col < boardSize; col++) {{
                    const intersection = document.createElement('div');
                    intersection.className = 'board-intersection';
                    intersection.dataset.row = row;
                    intersection.dataset.col = col;
                    intersection.style.left = (col * gridSize) + 'px';
                    intersection.style.top = (row * gridSize) + 'px';
                    gridDiv.appendChild(intersection);
                }}
            }}
            
            boardContainer.appendChild(gridDiv);
        }}
        
        function updateModalBoardDisplay() {{
            if (!currentGame) return;
            
            // Clear board
            const intersections = document.querySelectorAll('#modalGameBoard .board-intersection');
            intersections.forEach(intersection => {{
                intersection.className = 'board-intersection';
                intersection.textContent = '';
            }});
            
            // Show moves up to current index
            for (let i = 0; i < currentMoveIndex; i++) {{
                const move = currentGame.moves[i];
                const row = move.row - 1; // Convert to 0-based
                const col = move.column - 1;
                const seqNum = i + 1;
                
                const intersection = document.querySelector(`#modalGameBoard .board-intersection[data-row="${{row}}"][data-col="${{col}}"]`);
                if (intersection) {{
                    // Odd sequence numbers are black, even are white
                    if (seqNum % 2 === 1) {{
                        intersection.classList.add('black');
                    }} else {{
                        intersection.classList.add('white');
                    }}
                    intersection.textContent = seqNum.toString();
                    
                    // Highlight last move
                    if (i === currentMoveIndex - 1) {{
                        intersection.classList.add('last-move');
                    }}
                }}
            }}
        }}
        
        function updateModalMoveInfo() {{
            if (!currentGame) return;
            
            const moveCounter = document.getElementById('modalMoveCounter');
            moveCounter.textContent = `Move ${{currentMoveIndex}} of ${{currentGame.total_moves}}`;
            
            const currentMoveInfo = document.getElementById('modalCurrentMoveInfo');
            const moveDetails = document.getElementById('modalMoveDetails');
            
            if (currentMoveIndex === 0) {{
                currentMoveInfo.innerHTML = '<em>Game start - empty board</em>';
                moveDetails.innerHTML = '<em>Select a move to see details</em>';
            }} else {{
                const move = currentGame.moves[currentMoveIndex - 1];
                const seqNum = currentMoveIndex;
                const color = seqNum % 2 === 1 ? 'black' : 'white';
                
                currentMoveInfo.innerHTML = `
                    <strong>Move ${{move.move_number}}</strong><br>
                    Player: ${{color}}<br>
                    Position: ${{move.row}},${{move.column}}<br>
                    Response Time: ${{move.response_time.toFixed(1)}}ms
                `;
                
                moveDetails.innerHTML = `
                    <strong>Move Details:</strong><br>
                    Sequence: #${{seqNum}} (${{color}} stone)<br>
                    Position: Row ${{move.row}}, Column ${{move.column}} (1-based)<br>
                    Response Time: ${{move.response_time.toFixed(1)}}ms<br>
                    Move Number: ${{move.move_number}} of ${{currentGame.total_moves}}
                `;
            }}
        }}
        
        function updateModalPlaybackControls() {{
            if (!currentGame) return;
            
            const firstBtn = document.getElementById('modalFirstMove');
            const prevBtn = document.getElementById('modalPrevMove');
            const playBtn = document.getElementById('modalPlayPause');
            const nextBtn = document.getElementById('modalNextMove');
            const lastBtn = document.getElementById('modalLastMove');
            
            if (firstBtn) firstBtn.disabled = currentMoveIndex === 0;
            if (prevBtn) prevBtn.disabled = currentMoveIndex === 0;
            if (nextBtn) nextBtn.disabled = currentMoveIndex >= currentGame.total_moves;
            if (lastBtn) lastBtn.disabled = currentMoveIndex >= currentGame.total_moves;
            
            if (playBtn) {{
                playBtn.textContent = isPlaying ? '⏸️ Pause' : '▶️ Play';
                playBtn.disabled = currentMoveIndex >= currentGame.total_moves;
            }}
        }}
        
        function updateModalPlaybackSpeed() {{
            const slider = document.getElementById('modalPlaybackSpeed');
            const label = document.getElementById('modalSpeedLabel');
            if (slider && label) {{
                playbackSpeed = parseInt(slider.value);
                label.textContent = `${{(playbackSpeed / 1000).toFixed(1)}}s`;
                
                if (isPlaying) {{
                    stopPlayback();
                    startPlayback();
                }}
            }}
        }}
        
        function selectGame() {{
            const gameSelect = document.getElementById('gameSelect');
            const gameNumber = parseInt(gameSelect.value);
            
            if (!gameNumber) {{
                document.getElementById('gamePlaybackContent').style.display = 'none';
                return;
            }}
            
            currentGame = gamesData.find(g => g.game_number === gameNumber);
            currentMoveIndex = 0;
            isPlaying = false;
            
            if (playbackInterval) {{
                clearInterval(playbackInterval);
                playbackInterval = null;
            }}
            
            document.getElementById('gamePlaybackContent').style.display = 'block';
            updateGameInfo();
            createGameBoard();
            updateBoardDisplay();
            updateMoveInfo();
            updatePlaybackControls();
        }}
        
        function createGameBoard() {{
            const boardContainer = document.getElementById('gameBoard');
            boardContainer.innerHTML = '';
            
            const gridSize = 40; // Space between intersections
            const boardWidth = (boardSize - 1) * gridSize;
            const boardHeight = (boardSize - 1) * gridSize;
            
            // Create grid container
            const gridDiv = document.createElement('div');
            gridDiv.className = 'board-grid';
            gridDiv.style.width = boardWidth + 'px';
            gridDiv.style.height = boardHeight + 'px';
            
            // Create horizontal lines
            for (let row = 0; row < boardSize; row++) {{
                const line = document.createElement('div');
                line.className = 'board-line horizontal';
                line.style.top = (row * gridSize) + 'px';
                line.style.left = '0px';
                line.style.width = boardWidth + 'px';
                gridDiv.appendChild(line);
            }}
            
            // Create vertical lines
            for (let col = 0; col < boardSize; col++) {{
                const line = document.createElement('div');
                line.className = 'board-line vertical';
                line.style.left = (col * gridSize) + 'px';
                line.style.top = '0px';
                line.style.height = boardHeight + 'px';
                gridDiv.appendChild(line);
            }}
            
            // Create intersections for stone placement
            for (let row = 0; row < boardSize; row++) {{
                for (let col = 0; col < boardSize; col++) {{
                    const intersection = document.createElement('div');
                    intersection.className = 'board-intersection';
                    intersection.dataset.row = row;
                    intersection.dataset.col = col;
                    intersection.style.left = (col * gridSize) + 'px';
                    intersection.style.top = (row * gridSize) + 'px';
                    gridDiv.appendChild(intersection);
                }}
            }}
            
            boardContainer.appendChild(gridDiv);
        }}
        
        function parseBoardState(boardState) {{
            const rows = boardState.split(';');
            const board = [];
            
            for (let i = 0; i < rows.length; i++) {{
                const cells = rows[i].split(',');
                board[i] = [];
                for (let j = 0; j < cells.length; j++) {{
                    if (cells[j] === 'B') {{
                        board[i][j] = 'black';
                    }} else if (cells[j] === 'W') {{
                        board[i][j] = 'white';
                    }} else {{
                        board[i][j] = 'empty';
                    }}
                }}
            }}
            
            return board;
        }}
        
        function updateBoardDisplay() {{
            if (!currentGame || currentMoveIndex < 0) {{
                // Show empty board
                const intersections = document.querySelectorAll('.board-intersection');
                intersections.forEach(intersection => {{
                    intersection.className = 'board-intersection';
                    intersection.textContent = '';
                }});
                return;
            }}
            
            const boardState = [];
            for (let i = 0; i < boardSize; i++) {{
                boardState[i] = [];
                for (let j = 0; j < boardSize; j++) {{
                    boardState[i][j] = 0;
                }}
            }}
            
            // Build board state up to current move
            for (let i = 0; i < currentMoveIndex; i++) {{
                const move = currentGame.moves[i];
                const row = move.row - 1;
                const col = move.column - 1;
                boardState[row][col] = i + 1; // sequence number
            }}
            
            let lastMoveRow = -1, lastMoveCol = -1;
            if (currentMoveIndex > 0) {{
                const move = currentGame.moves[currentMoveIndex - 1];
                lastMoveRow = move.row - 1;
                lastMoveCol = move.column - 1;
            }}
            
            const intersections = document.querySelectorAll('.board-intersection');
            intersections.forEach(intersection => {{
                const row = parseInt(intersection.dataset.row);
                const col = parseInt(intersection.dataset.col);
                
                intersection.className = 'board-intersection';
                intersection.textContent = '';
                
                if (boardState[row] && boardState[row][col]) {{
                    const seqNum = boardState[row][col];
                    if (seqNum % 2 === 1) {{
                        intersection.classList.add('black');
                    }} else {{
                        intersection.classList.add('white');
                    }}
                    intersection.textContent = seqNum.toString();
                }}
                
                if (row === lastMoveRow && col === lastMoveCol) {{
                    intersection.classList.add('last-move');
                }}
            }});
        }}
        
        function updateGameInfo() {{
            if (!currentGame) return;
            
            const gameInfo = document.getElementById('gameInfo');
            gameInfo.innerHTML = `
                <strong>Game #${{currentGame.game_number}}</strong><br>
                Total Moves: ${{currentGame.total_moves}}<br>
                Duration: ${{(currentGame.total_time / 1000).toFixed(1)}}s<br>
                Winner: ${{currentGame.winner}}<br>
                End Reason: ${{currentGame.end_reason}}
            `;
        }}
        
        function updateMoveInfo() {{
            if (!currentGame) return;
            
            const moveCounter = document.getElementById('moveCounter');
            moveCounter.textContent = `Move ${{currentMoveIndex}} of ${{currentGame.total_moves}}`;
            
            const currentMoveInfo = document.getElementById('currentMoveInfo');
            const moveDetails = document.getElementById('moveDetails');
            
            if (currentMoveIndex === 0) {{
                currentMoveInfo.innerHTML = '<em>Game start - empty board</em>';
                moveDetails.innerHTML = '<em>Select a move to see details</em>';
            }} else {{
                const move = currentGame.moves[currentMoveIndex - 1];
                currentMoveInfo.innerHTML = `
                    <strong>Move ${{move.move_number}}</strong><br>
                    Player: ${{move.color}}<br>
                    Position: ${{move.row}},${{move.column}}<br>
                    Response Time: ${{move.response_time.toFixed(1)}}ms
                `;
                
                moveDetails.innerHTML = `
                    <strong>Move Details:</strong><br>
                    Player: ${{move.color}} stone<br>
                    Position: Row ${{move.row}}, Column ${{move.column}} (1-based)<br>
                    Response Time: ${{move.response_time.toFixed(1)}}ms<br>
                    Move Number: ${{move.move_number}} of ${{currentGame.total_moves}}
                `;
            }}
        }}
        
        function updatePlaybackControls() {{
            if (!currentGame) return;
            
            const firstBtn = document.getElementById('firstMove');
            const prevBtn = document.getElementById('prevMove');
            const playBtn = document.getElementById('playPause');
            const nextBtn = document.getElementById('nextMove');
            const lastBtn = document.getElementById('lastMove');
            
            firstBtn.disabled = currentMoveIndex === 0;
            prevBtn.disabled = currentMoveIndex === 0;
            nextBtn.disabled = currentMoveIndex >= currentGame.total_moves;
            lastBtn.disabled = currentMoveIndex >= currentGame.total_moves;
            
            playBtn.textContent = isPlaying ? '⏸️ Pause' : '▶️ Play';
            playBtn.disabled = currentMoveIndex >= currentGame.total_moves;
        }}
        
        function goToFirstMove() {{
            currentMoveIndex = 0;
            updateModalBoardDisplay();
            updateModalMoveInfo();
            updateModalPlaybackControls();
        }}
        
        function goToPreviousMove() {{
            if (currentMoveIndex > 0) {{
                currentMoveIndex--;
                updateModalBoardDisplay();
                updateModalMoveInfo();
                updateModalPlaybackControls();
            }}
        }}
        
        function goToNextMove() {{
            if (currentMoveIndex < currentGame.total_moves) {{
                currentMoveIndex++;
                updateModalBoardDisplay();
                updateModalMoveInfo();
                updateModalPlaybackControls();
            }}
            
            if (currentMoveIndex >= currentGame.total_moves && isPlaying) {{
                stopPlayback();
            }}
        }}
        
        function goToLastMove() {{
            currentMoveIndex = currentGame.total_moves;
            updateModalBoardDisplay();
            updateModalMoveInfo();
            updateModalPlaybackControls();
        }}
        
        function togglePlayback() {{
            if (isPlaying) {{
                stopPlayback();
            }} else {{
                startPlayback();
            }}
        }}
        
        function startPlayback() {{
            if (currentMoveIndex >= currentGame.total_moves) {{
                currentMoveIndex = 0;
            }}
            
            isPlaying = true;
            playbackInterval = setInterval(() => {{
                goToNextMove();
            }}, playbackSpeed);
            
            updatePlaybackControls();
        }}
        
        function stopPlayback() {{
            isPlaying = false;
            if (playbackInterval) {{
                clearInterval(playbackInterval);
                playbackInterval = null;
            }}
            updatePlaybackControls();
        }}
        
        function updatePlaybackSpeed() {{
            const slider = document.getElementById('playbackSpeed');
            playbackSpeed = parseInt(slider.value);
            updateSpeedLabel();
            
            if (isPlaying) {{
                stopPlayback();
                startPlayback();
            }}
        }}
        
        function updateSpeedLabel() {{
            const label = document.getElementById('speedLabel');
            label.textContent = `${{(playbackSpeed / 1000).toFixed(1)}}s`;
        }}
        
        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', initializeGamePlayback);
    </script>
</body>
</html>"""


def main():
    parser = argparse.ArgumentParser(
        description='GGSPerf - Fast Python Performance Tester for GoGame Service',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s -s 19 -n 100 -o report.html http://localhost:3000
  %(prog)s -s 9 -n 10 -o test.html http://localhost:3000
  %(prog)s --size 3 --games 5 --output quick.html http://localhost:3000
        """
    )
    
    parser.add_argument('server_url', 
                       help='GGS server URL (e.g., http://localhost:3000)')
    parser.add_argument('-s', '--size', type=int, default=19,
                       help='Board size (e.g., 19 for 19x19) [default: 19]')
    parser.add_argument('-n', '--games', type=int, default=100,
                       help='Number of games to test [default: 100]')
    parser.add_argument('-o', '--output', default='report.html',
                       help='Output HTML report file [default: report.html]')
    parser.add_argument('--version', action='version', version='GGSPerf Python v2.0.0')
    
    args = parser.parse_args()
    
    print(f"🐍 GGS Performance Tester (Python v2.0)")
    print(f"Server: {args.server_url}")
    print(f"Board Size: {args.size}x{args.size}")
    print(f"Games: {args.games}")
    print(f"Output: {args.output}")
    print()
    
    try:
        tester = PerformanceTester(args.server_url, args.size, args.games)
        stats = tester.run_tests()
        
        print('\n' + '=' * 50)
        print('📊 FINAL RESULTS')
        print('=' * 50)
        print(f"Total Games: {stats.total_games}")
        print(f"Total Moves: {stats.total_moves}")
        print(f"Average Game Time: {stats.average_game_time / 1000:.1f}s")
        print(f"Average Response Time: {stats.average_response_time:.1f}ms")
        print(f"Response Time Range: {stats.min_response_time:.0f}ms - {stats.max_response_time:.0f}ms")
        print(f"Game Time Range: {stats.min_game_time / 1000:.1f}s - {stats.max_game_time / 1000:.1f}s")
        
        html_report = HTMLReportGenerator.generate(stats, args.size, args.server_url)
        
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(html_report)
        
        print(f"\n✅ Report generated: {args.output}")
        
    except KeyboardInterrupt:
        print("\n❌ Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
