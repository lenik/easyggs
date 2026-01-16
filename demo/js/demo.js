// Demo game data will be injected by server
let gameData = null;
let boardSize = 0;

// Playback state
let currentMoveIndex = 0; // Will be set to gameData.total_moves after data loads
let isPlaying = false;
let playbackInterval = null;
let playbackSpeed = 1000;

// Initialize the demo
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing demo...');
    
    // Initialize UI with loading state
    updateGameInfo();
    updateMoveInfo();
    updatePlaybackControls();
    
    // Game data will be loaded via API call
    loadGameData();
});

async function loadGameData() {
    let apiUrl = '';
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const size = urlParams.get('size') || '19';
        const maxMoves = urlParams.get('maxMoves') || '';
        
        apiUrl = `/api/demo-data?size=${size}`;
        if (maxMoves) {
            apiUrl += `&maxMoves=${maxMoves}`;
        }
        
        console.log('Loading game data from:', apiUrl);
        const response = await fetch(apiUrl);
        console.log('Response received:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Game data loaded successfully:', data);
        
        gameData = data;
        boardSize = parseInt(size);
        currentMoveIndex = gameData.totalMoves; // Start at last move
        
        // Update game info
        updateGameInfo();
        
        // Initialize board
        createGameBoard();
        updateBoardDisplay();
        updateMoveInfo();
        updatePlaybackControls();
        
        // Event listeners
        document.getElementById('firstMove').addEventListener('click', goToFirstMove);
        document.getElementById('prevMove').addEventListener('click', goToPreviousMove);
        document.getElementById('playPause').addEventListener('click', togglePlayback);
        document.getElementById('nextMove').addEventListener('click', goToNextMove);
        document.getElementById('lastMove').addEventListener('click', goToLastMove);
        
        const speedSlider = document.getElementById('playbackSpeed');
        speedSlider.addEventListener('input', updatePlaybackSpeed);
        
    } catch (error) {
        console.error('Failed to load game data:', error);
        console.error('API URL was:', apiUrl);
        document.getElementById('gameInfo').innerHTML = `<strong>Error:</strong> Failed to load game data<br><small>${error.message}</small>`;
    }
}

function updateGameInfo() {
    if (!gameData) {
        document.getElementById('gameInfo').innerHTML = '<em>Loading game data...</em>';
        return;
    }
    
    document.getElementById('gameInfo').innerHTML = `
        <strong>Board Size:</strong> ${boardSize}x${boardSize}<br>
        <strong>Total Moves:</strong> ${gameData.totalMoves}<br>
        <strong>Winner:</strong> ${gameData.winner}<br>
        <strong>End Reason:</strong> ${gameData.endReason}
    `;
}

function createGameBoard() {
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
    for (let row = 0; row < boardSize; row++) {
        const line = document.createElement('div');
        line.className = 'board-line horizontal';
        line.style.top = (row * gridSize) + 'px';
        line.style.left = '0px';
        line.style.width = boardWidth + 'px';
        gridDiv.appendChild(line);
    }
    
    // Create vertical lines
    for (let col = 0; col < boardSize; col++) {
        const line = document.createElement('div');
        line.className = 'board-line vertical';
        line.style.left = (col * gridSize) + 'px';
        line.style.top = '0px';
        line.style.height = boardHeight + 'px';
        gridDiv.appendChild(line);
    }
    
    // Create intersections for stone placement
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            const intersection = document.createElement('div');
            intersection.className = 'board-intersection';
            intersection.dataset.row = row;
            intersection.dataset.col = col;
            intersection.style.left = (col * gridSize) + 'px';
            intersection.style.top = (row * gridSize) + 'px';
            gridDiv.appendChild(intersection);
        }
    }
    
    boardContainer.appendChild(gridDiv);
}

function updateBoardDisplay() {
    // Clear board
    const intersections = document.querySelectorAll('.board-intersection');
    intersections.forEach(intersection => {
        intersection.className = 'board-intersection';
        intersection.textContent = '';
    });
    
    // Check if gameData is available
    if (!gameData || !gameData.moves) {
        console.log('No game data available for board display');
        return;
    }
    
    // Apply influence visualization for current move
    if (gameData.influences && gameData.influences[currentMoveIndex]) {
        applyInfluenceVisualization(gameData.influences[currentMoveIndex]);
    }
    
    // Show board state for current move index
    if (gameData.boardStates && gameData.boardStates[currentMoveIndex]) {
        displayBoardState(gameData.boardStates[currentMoveIndex]);
    }
    
    // Show moves up to current index using move objects
    for (let i = 0; i < Math.min(currentMoveIndex, gameData.moves.length); i++) {
        const move = gameData.moves[i];
        const intersection = document.querySelector(`.board-intersection[data-row="${move.row - 1}"][data-col="${move.column - 1}"]`);
        
        if (intersection) {
            // Add stone color
            intersection.classList.add(move.color);
            intersection.textContent = move.moveNumber.toString();
            
            // Highlight last move
            if (i === currentMoveIndex - 1) {
                intersection.classList.add('last-move');
            }
        }
    }
    
    // Show capture animations if any
    if (currentMoveIndex > 0 && currentMoveIndex <= gameData.moves.length) {
        const currentMove = gameData.moves[currentMoveIndex - 1];
        if (currentMove && currentMove.capturedStones && currentMove.capturedStones.length > 0) {
            showCaptureAnimations(currentMove.capturedStones);
        }
    }
}

function updateMoveInfo() {
    const moveCounter = document.getElementById('moveCounter');
    
    if (!gameData) {
        moveCounter.textContent = 'Loading...';
        return;
    }
    
    moveCounter.textContent = `Move ${currentMoveIndex} of ${gameData.totalMoves}`;
    
    const currentMoveInfo = document.getElementById('currentMoveInfo');
    const moveDetails = document.getElementById('moveDetails');
    
    if (currentMoveIndex === 0) {
        currentMoveInfo.innerHTML = '<em>Game start - empty board</em>';
        moveDetails.innerHTML = '<em>Watch as two AI players strategically compete for territory</em>';
    } else if (currentMoveIndex <= gameData.moves.length) {
        const move = gameData.moves[currentMoveIndex - 1];
        
        currentMoveInfo.innerHTML = `
            <strong>Move ${move.moveNumber}</strong><br>
            Player: ${move.color.toUpperCase()}<br>
            Position: ${move.row},${move.column}<br>
            Captures: ${move.capturedStones.length} stones
        `;
        
        const koInfo = move.koPosition ? `<br>Ko position: ${move.koPosition.row},${move.koPosition.column}` : '';
        
        moveDetails.innerHTML = `
            <strong>AI Move Analysis:</strong><br>
            Sequence: #${move.moveNumber} (${move.color} stone)<br>
            Position: Row ${move.row}, Column ${move.column} (1-based)<br>
            Captured stones: ${move.capturedStones.length}<br>
            Strategic Phase: ${getGamePhase(currentMoveIndex, gameData.totalMoves)}${koInfo}
        `;
    }
}

function getGamePhase(moveIndex, totalMoves) {
    const progress = moveIndex / totalMoves;
    if (progress < 0.3) return 'Opening (Territory establishment)';
    if (progress < 0.7) return 'Middle Game (Fighting & connections)';
    return 'End Game (Territory completion)';
}

function updatePlaybackControls() {
    const firstBtn = document.getElementById('firstMove');
    const prevBtn = document.getElementById('prevMove');
    const playBtn = document.getElementById('playPause');
    const nextBtn = document.getElementById('nextMove');
    const lastBtn = document.getElementById('lastMove');
    
    if (!gameData) {
        // Disable all controls when no game data
        firstBtn.disabled = true;
        prevBtn.disabled = true;
        playBtn.disabled = true;
        nextBtn.disabled = true;
        lastBtn.disabled = true;
        playBtn.textContent = '▶️ Play';
        return;
    }
    
    firstBtn.disabled = currentMoveIndex === 0;
    prevBtn.disabled = currentMoveIndex === 0;
    nextBtn.disabled = currentMoveIndex >= gameData.totalMoves;
    lastBtn.disabled = currentMoveIndex >= gameData.totalMoves;
    
    playBtn.textContent = isPlaying ? '⏸️ Pause' : '▶️ Play';
    playBtn.disabled = currentMoveIndex >= gameData.totalMoves;
}

function goToFirstMove() {
    currentMoveIndex = 0;
    updateBoardDisplay();
    updateMoveInfo();
    updatePlaybackControls();
}

function goToPreviousMove() {
    if (currentMoveIndex > 0) {
        currentMoveIndex--;
        updateBoardDisplay();
        updateMoveInfo();
        updatePlaybackControls();
    }
}

function goToNextMove() {
    if (!gameData) return;
    
    if (currentMoveIndex < gameData.totalMoves) {
        currentMoveIndex++;
        updateBoardDisplay();
        updateMoveInfo();
        updatePlaybackControls();
    }
    
    if (currentMoveIndex >= gameData.totalMoves && isPlaying) {
        stopPlayback();
    }
}

function goToLastMove() {
    if (!gameData) return;
    
    currentMoveIndex = gameData.totalMoves;
    updateBoardDisplay();
    updateMoveInfo();
    updatePlaybackControls();
}

function togglePlayback() {
    if (isPlaying) {
        stopPlayback();
    } else {
        startPlayback();
    }
}

function startPlayback() {
    if (!gameData || currentMoveIndex >= gameData.totalMoves) return;
    
    isPlaying = true;
    playbackInterval = setInterval(() => {
        goToNextMove();
    }, playbackSpeed);
    
    updatePlaybackControls();
}

function stopPlayback() {
    isPlaying = false;
    if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
    }
    updatePlaybackControls();
}

function updatePlaybackSpeed() {
    const slider = document.getElementById('playbackSpeed');
    const label = document.getElementById('speedLabel');
    playbackSpeed = parseInt(slider.value);
    label.textContent = `${(playbackSpeed / 1000).toFixed(1)}s`;
    
    if (isPlaying) {
        stopPlayback();
        startPlayback();
    }
}

// Helper functions for influence and capture visualization
function displayBoardState(boardState) {
    if (!boardState) return;
    
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            const intersection = document.querySelector(`.board-intersection[data-row="${row}"][data-col="${col}"]`);
            if (intersection && boardState[row] && boardState[row][col] !== undefined) {
                const state = boardState[row][col];
                
                // Handle different board states
                if (state === 'x') {
                    // Ko forbidden position
                    intersection.classList.add('ko-forbidden');
                    intersection.textContent = '×';
                } else if (state === 'B') {
                    intersection.classList.add('black');
                } else if (state === 'W') {
                    intersection.classList.add('white');
                }
                // '.' positions remain empty
            }
        }
    }
}

function applyInfluenceVisualization(influenceMap) {
    if (!influenceMap) return;
    
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            const intersection = document.querySelector(`.board-intersection[data-row="${row}"][data-col="${col}"]`);
            if (intersection && influenceMap[row] && influenceMap[row][col] !== undefined) {
                const influence = influenceMap[row][col];
                
                // Apply influence styling based on territory value
                // 1 = Black territory, 2 = White territory, 0 = Neutral
                if (influence === 1) {
                    intersection.classList.add('black-influence');
                } else if (influence === 2) {
                    intersection.classList.add('white-influence');
                }
            }
        }
    }
}

function showCaptureAnimations(capturedPositions) {
    if (!capturedPositions || capturedPositions.length === 0) return;
    
    capturedPositions.forEach(([row, col]) => {
        const intersection = document.querySelector(`.board-intersection[data-row="${row}"][data-col="${col}"]`);
        if (intersection) {
            intersection.classList.add('captured');
            
            // Remove the animation class after animation completes
            setTimeout(() => {
                intersection.classList.remove('captured');
            }, 500);
        }
    });
}
