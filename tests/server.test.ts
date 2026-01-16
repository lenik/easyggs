import request from 'supertest';
import app from '../src/server';

describe('EasyGGS Server', () => {
  describe('GET /', () => {
    test('should return service information', async () => {
      const response = await request(app).get('/');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'easyggs');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('author', 'Lenik <easyggs@bodz.net>');
      expect(response.body).toHaveProperty('license', 'GPL-3.0-or-later');
    });
  });

  describe('GET /health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        service: 'easyggs'
      });
    });
  });

  describe('GET /npc/:color', () => {
    test('should return AI move for black with example board', async () => {
      const response = await request(app)
        .get('/npc/black')
        .query({
          size: '5',
          board: '128,512,4,8,24'
        })
        .expect(200);

      // Should return move in "row,column" format
      expect(response.text).toMatch(/^\d+,\d+$/);
      
      const [row, col] = response.text.split(',').map(Number);
      expect(row).toBeGreaterThan(0);
      expect(row).toBeLessThanOrEqual(5);
      expect(col).toBeGreaterThan(0);
      expect(col).toBeLessThanOrEqual(5);
    });

    test('should return AI move for white', async () => {
      const response = await request(app)
        .get('/npc/white')
        .query({
          size: '3',
          board: '0,2,0'  // Single white stone in center of row 2
        })
        .expect(200);

      expect(response.text).toMatch(/^\d+,\d+$/);
    });

    test('should infer board size when not provided', async () => {
      const response = await request(app)
        .get('/npc/black')
        .query({
          board: '0,0,0'  // 3x3 empty board
        })
        .expect(200);

      expect(response.text).toMatch(/^\d+,\d+$/);
    });

    test('should return 400 for invalid color', async () => {
      const response = await request(app)
        .get('/npc/red')
        .query({
          board: '0,0,0'
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid color');
    });

    test('should return 400 for missing board parameter', async () => {
      const response = await request(app)
        .get('/npc/black')
        .expect(400);

      expect(response.body.error).toContain('Missing or invalid board parameter');
    });

    test('should handle full board (no moves available)', async () => {
      // Create a full 2x2 board: all positions filled
      // Position encoding: 01 10 = 6 (black, white)
      // Position encoding: 10 01 = 9 (white, black)
      const response = await request(app)
        .get('/npc/black')
        .query({
          size: '2',
          board: '6,9'
        })
        .expect(200);

      expect(response.body.message).toContain('No valid moves available');
    });

    test('should handle rectangular board size', async () => {
      const response = await request(app)
        .get('/npc/black')
        .query({
          size: '3x2',
          board: '0,0'
        })
        .expect(200);

      expect(response.text).toMatch(/^\d+,\d+$/);
    });
  });

  describe('GET /influence', () => {
    test('should return influence data for example board', async () => {
      const response = await request(app)
        .get('/influence')
        .query({
          board: '128,512,4,8,24'
        })
        .expect(200);

      expect(response.body).toHaveProperty('blackInfluence');
      expect(response.body).toHaveProperty('whiteInfluence');
      expect(response.body).toHaveProperty('territory');

      expect(Array.isArray(response.body.blackInfluence)).toBe(true);
      expect(Array.isArray(response.body.whiteInfluence)).toBe(true);
      expect(Array.isArray(response.body.territory)).toBe(true);

      // Check dimensions (should be 5x5 for the example)
      expect(response.body.blackInfluence.length).toBe(5);
      expect(response.body.whiteInfluence.length).toBe(5);
      expect(response.body.territory.length).toBe(5);
    });

    test('should return influence data for empty board', async () => {
      const response = await request(app)
        .get('/influence')
        .query({
          size: '3',
          board: '0,0,0'
        })
        .expect(200);

      expect(response.body.blackInfluence.length).toBe(3);
      expect(response.body.whiteInfluence.length).toBe(3);
      expect(response.body.territory.length).toBe(3);

      // Empty board should have zero influence
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          expect(response.body.blackInfluence[row][col]).toBe(0);
          expect(response.body.whiteInfluence[row][col]).toBe(0);
          expect(response.body.territory[row][col]).toBe(0);
        }
      }
    });

    test('should return 400 for missing board parameter', async () => {
      const response = await request(app)
        .get('/influence')
        .expect(400);

      expect(response.body.error).toContain('Missing or invalid board parameter');
    });

    test('should handle board with explicit size parameter', async () => {
      const response = await request(app)
        .get('/influence')
        .query({
          size: '4',
          board: '0,0,0,0'
        })
        .expect(200);

      expect(response.body.blackInfluence.length).toBe(4);
      expect(response.body.whiteInfluence.length).toBe(4);
      expect(response.body.territory.length).toBe(4);
    });
  });

  describe('Error handling', () => {
    test('should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/unknown')
        .expect(404);

      expect(response.body.error).toContain('Endpoint not found');
      expect(response.body.availableEndpoints).toBeDefined();
    });

    test('should handle malformed board data', async () => {
      const response = await request(app)
        .get('/npc/black')
        .query({
          board: 'invalid,data,here'
        });

      // Should either return 500 error or handle gracefully with a valid response
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 500) {
        expect(response.body.error).toContain('Internal server error');
      } else {
        // If handled gracefully, should return a move or no moves message
        expect(response.text).toBeDefined();
      }
    });

    test('should handle invalid size parameter', async () => {
      const response = await request(app)
        .get('/npc/black')
        .query({
          size: 'invalid',
          board: '0,0,0'
        })
        .expect(500);

      expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('CORS', () => {
    test('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });
});
