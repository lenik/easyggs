# GGSPerf - GoGame Service Performance Tester

A comprehensive performance testing tool for the EasyGGS (GoGame Service) that simulates full Go games and measures NPC response times.

## Features

- **Full Game Simulation**: Plays complete Go games using the NPC AI
- **Performance Metrics**: Measures response times, game duration, and statistics
- **HTML Reports**: Generates detailed reports with charts and visualizations
- **Configurable Testing**: Supports different board sizes and test counts
- **Real-time Monitoring**: Shows progress and statistics during testing

## Installation

The tool is included with the EasyGGS package. No additional installation required.

## Usage

```bash
# Basic usage
npm run ggsperf -- -s 19 -n 100 -o report.html http://localhost:3000

# Or use the direct executable
./bin/ggsperf -s 19 -n 100 -o report.html http://localhost:3000
```

### Command Line Options

- `-s, --size <number>`: Board size (e.g., 19 for 19x19) [default: 19]
- `-n, --games <number>`: Number of games to test [default: 100]
- `-o, --output <file>`: Output HTML report file [default: report.html]
- `<server-url>`: GGS server URL (e.g., http://localhost:3000)

### Examples

```bash
# Test 19x19 board with 100 games
ggsperf -s 19 -n 100 -o performance-report.html http://localhost:3000

# Quick test with 3x3 board and 10 games
ggsperf -s 3 -n 10 -o quick-test.html http://localhost:3000

# Test production server
ggsperf -s 19 -n 50 -o prod-test.html https://your-ggs-server.vercel.app

# Large scale test
ggsperf -s 19 -n 500 -o comprehensive-report.html http://localhost:3000
```

## How It Works

1. **Game Simulation**: Creates a new board and alternates between black and white moves
2. **NPC Requests**: Makes HTTP requests to the `/npc/:color` endpoint for each move
3. **Performance Measurement**: Records response times and game statistics
4. **Game End Conditions**: 
   - Board becomes 90% full (territory-based ending)
   - Maximum moves reached
   - Server errors or invalid moves
5. **Report Generation**: Creates an HTML report with detailed statistics and charts

## Report Contents

The generated HTML report includes:

### Performance Statistics
- Total games played
- Total moves made
- Average game time
- Average response time per move
- Min/max response times
- Min/max game durations

### Visualizations
- **Response Time Distribution**: Histogram showing response time patterns
- **Game Duration Chart**: Line chart showing game duration trends
- **Game Results Table**: Detailed breakdown of each game

### Interactive Features
- Responsive charts using Chart.js
- Sortable game results table
- Mobile-friendly design

## Performance Metrics

### Key Metrics Measured

1. **Response Time**: Time taken for each NPC move request
2. **Game Duration**: Total time to complete a full game
3. **Move Count**: Number of moves per game
4. **Success Rate**: Percentage of successful games completed

### Statistical Analysis

- **Average**: Mean values for all metrics
- **Min/Max**: Range of performance values
- **Distribution**: Histogram analysis of response times
- **Trends**: Game-by-game performance patterns

## Troubleshooting

### Common Issues

1. **Connection Errors**
   ```
   Error: ECONNREFUSED
   ```
   - Ensure the GGS server is running
   - Check the server URL is correct
   - Verify network connectivity

2. **Timeout Errors**
   ```
   Request timeout after 30000ms
   ```
   - Server may be overloaded
   - Reduce the number of concurrent games
   - Check server performance

3. **Invalid Move Errors**
   ```
   Invalid move suggested: 1,1
   ```
   - Usually indicates a bug in the NPC AI
   - Check server logs for details
   - May occur near game end when few moves available

### Performance Tips

1. **Start Small**: Begin with smaller board sizes (3x3, 9x9) for initial testing
2. **Monitor Resources**: Watch server CPU and memory usage during tests
3. **Network Latency**: Consider network delays when interpreting results
4. **Concurrent Testing**: Avoid running multiple ggsperf instances simultaneously

## Sample Output

```
🎯 GGS Performance Tester
Server: http://localhost:3000
Board Size: 19x19
Games: 100
Output: report.html

Starting performance test: 100 games
==================================================

Game 1/100
Starting new game...
Move 1: black plays 4,4 (156ms)
Move 2: white plays 16,16 (89ms)
...
Game 1 completed: 234 moves, 15.2s total, avg 65ms per move

...

==================================================
📊 FINAL RESULTS
==================================================
Total Games: 100
Total Moves: 23,456
Average Game Time: 14.8s
Average Response Time: 63.2ms
Response Time Range: 12ms - 245ms
Game Time Range: 8.3s - 28.7s

✅ Report generated: /home/cursor/eggs/report.html
```

## Integration with CI/CD

You can integrate ggsperf into your continuous integration pipeline:

```yaml
# Example GitHub Actions workflow
- name: Performance Test
  run: |
    npm run dev &
    sleep 5
    npm run ggsperf -- -s 9 -n 20 -o ci-report.html http://localhost:3000
    
- name: Upload Report
  uses: actions/upload-artifact@v3
  with:
    name: performance-report
    path: ci-report.html
```

## API Compatibility

GGSPerf works with any server that implements the EasyGGS API:

- `GET /npc/:color?board=<board_data>` - Returns move in "row,column" format
- Supports all board data formats (legacy and new semicolon-separated)
- Handles error responses gracefully

## Development

To modify or extend ggsperf:

1. **Source Code**: Located in `src/ggsperf.ts`
2. **Build**: Run `npm run build` to compile
3. **Test**: Use small board sizes for quick testing
4. **Debug**: Add console.log statements for detailed debugging

### Architecture

- **GoGameSimulator**: Handles game logic and board state
- **PerformanceTester**: Orchestrates multiple games and collects statistics
- **HTMLReportGenerator**: Creates the final HTML report with charts
- **CLI Interface**: Uses Commander.js for command-line argument parsing
