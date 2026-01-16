# EasyGGS - GoGame Service

A TypeScript-based HTTP service for Go (Weiqi) game AI and board analysis.

## Features

- **NPC AI Service**: Get AI-calculated moves for black or white stones
- **Influence Calculation**: Analyze board influence and territory estimation

## API Endpoints

### GET /npc/:color

Get an AI-calculated move for the specified color.

**Parameters:**
- `color`: "black" or "white"
- `size`: Board size (e.g., "19" for 19x19, "5x7" for 5x7, optional - inferred from board data)
- `board`: Comma-separated row data (required)

**Board Data Format:**

The API supports multiple board data formats:

1. **Legacy Format** (comma-separated integers):
   ```
   board=128,512,4,8,24
   ```
   Each row is encoded as an integer where each position uses 2 bits:
   - `00` (0): Empty
   - `01` (1): Black stone  
   - `10` (2): White stone

2. **New Format** (semicolon-separated rows):
   ```
   board=row1;row2;row3;...
   ```
   Each row can be either:
   - **Comma-separated cells**: `B,W,.,B,W` (B=black, W=white, .=empty)
   - **Bigint with 2-bits per cell**: Same as legacy format but for individual rows

**Response:** `row,column` (1-based indexing)

**Examples:**
```bash
# Legacy format
curl "http://localhost:3000/npc/black?size=5&board=128,512,4,8,24"

# New format - comma-separated cells
curl "http://localhost:3000/npc/black?board=B,W,.;.,B,W;W,.,B"

# New format - mixed (cells and bigint)
curl "http://localhost:3000/npc/white?board=B,W,.;8;.,B,W"

# New format - pure bigint with semicolons
curl "http://localhost:3000/npc/black?board=128;512;4;8;24&size=5"
```

### GET /influence

Calculate board influence and territory estimation.

**Parameters:**
- `board`: Board data in any supported format (required)
- `size`: Board size (optional - inferred from board data)

**Response:** JSON object with influence data
```json
{
  "blackInfluence": [[...], [...], ...],
  "whiteInfluence": [[...], [...], ...],
  "territory": [[...], [...], ...]
}
```

**Example:**
```bash
curl "http://localhost:3000/influence?board=128,512,4,8,24"
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "easyggs"
}
```

## Installation & Usage

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start the server:
```bash
npm start
```

Or for development:
```bash
npm run dev
```

The server will start on port 3000 by default (configurable via PORT environment variable).

## Board Encoding Example

For a 5x5 board with the pattern:
```
+O+++  (O = white, # = black, + = empty)
O++++
+++#+
+++O#
++#O+
```

The encoding process:
1. Convert each position to 2-bit values
2. Pack into integers row by row
3. Result: `128,512,4,8,24`

## Development

- `npm run dev`: Start development server with hot reload
- `npm run build`: Build TypeScript to JavaScript
- `npm test`: Run tests
- `npm run test:watch`: Run tests in watch mode
- `npm run test:coverage`: Run tests with coverage report

## Testing

The project includes comprehensive test suites:

- **Unit Tests**: Board parser, NPC AI, influence adapter
- **Integration Tests**: API endpoints, error handling, CORS
- **Test Coverage**: 41/44 tests passing with good coverage

Run tests with:
```bash
npm test
```

## Deployment

### Deploy to Vercel

1. Install Vercel CLI (if not already installed):
```bash
npm install -g vercel
```

2. Deploy using the provided script:
```bash
npm run deploy
```

Or deploy manually:
```bash
vercel --prod
```

### Deployment Configuration

The project includes:
- `vercel.json`: Vercel deployment configuration
- `api/index.ts`: Serverless function entry point
- `.vercelignore`: Files to exclude from deployment

### Environment Variables

No environment variables are required for basic deployment. The server will run on the port provided by Vercel.

## Architecture

- **BoardParser**: Handles board data encoding/decoding
- **NPCAI**: AI move calculation with Go strategy heuristics
- **InfluenceAdapter**: Territory and influence analysis
- **Express Server**: HTTP API endpoints with error handling

## Performance Testing

### GGSPerf Tool

The project includes `ggsperf`, a comprehensive performance testing tool available in two implementations:

#### Python Version (Recommended - Fast)
```bash
# Fast Python implementation - starts immediately
python3 ggsperf/ggsperf.py -s 19 -n 100 -o report.html http://localhost:3000

# Quick test with smaller board  
python3 ggsperf/ggsperf.py -s 9 -n 10 -o test.html http://localhost:3000
```

#### TypeScript Version (Legacy)
```bash
# Original TypeScript implementation
npm run ggsperf -- -s 19 -n 100 -o report.html http://localhost:3000
```

**Performance Comparison:**
- **Python**: 20-30x faster startup, 3x less memory usage
- **TypeScript**: Better integration with Node.js projects

**Features:**
- Full game simulation with alternating moves
- Performance metrics (response times, game duration)
- HTML reports with interactive charts and **game playback**
- **Interactive game replay** with visual board and move controls
- **Move-by-move analysis** with response time tracking
- Configurable board sizes and test counts
- Real-time progress monitoring

See [docs/ggsperf.md](docs/ggsperf.md) and [ggsperf/README.md](ggsperf/README.md) for detailed documentation.

## Project Structure

```
├── src/
│   ├── server.ts          # Main Express server
│   ├── boardParser.ts     # Board data parsing utilities
│   ├── npcAI.ts          # AI move calculation
│   ├── influenceAdapter.ts # Influence calculation adapter
│   ├── influence.ts       # Core influence calculation engine
│   ├── ggsperf.ts        # Performance testing tool
│   └── types.ts          # TypeScript type definitions
├── tests/
│   ├── boardParser.test.ts
│   ├── npcAI.test.ts
│   ├── influenceAdapter.test.ts
│   ├── server.test.ts
│   └── setup.ts
├── bin/
│   └── ggsperf           # Executable performance tester (TypeScript)
├── ggsperf/
│   ├── ggsperf.py        # Fast Python performance tester
│   ├── requirements.txt  # Python dependencies
│   ├── setup.py          # Python package setup
│   └── README.md         # Python version documentation
├── docs/
│   └── ggsperf.md        # Performance testing documentation
├── api/
│   └── index.ts          # Vercel serverless entry point
├── scripts/
│   └── deploy.sh         # Deployment script
├── vercel.json           # Vercel configuration
└── jest.config.js        # Test configuration
```
