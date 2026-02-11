import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins in development
app.use(cors());

// Rate limiting: Track last request time and enforce minimum delay
const MIN_REQUEST_DELAY_MS = 500; // Minimum 500ms between requests
let lastRequestTime = 0;
let requestQueue = Promise.resolve();

// Middleware to throttle requests to Yahoo Finance
const throttleMiddleware = (req, res, next) => {
  requestQueue = requestQueue.then(async () => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < MIN_REQUEST_DELAY_MS) {
      const delay = MIN_REQUEST_DELAY_MS - timeSinceLastRequest;
      console.log(`⏱️  Throttling request for ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    lastRequestTime = Date.now();
    next();
  });
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy endpoint for Yahoo Finance chart data
app.get('/api/chart/:symbol', throttleMiddleware, async (req, res) => {
  const { symbol } = req.params;
  const { period1, period2, interval } = req.query;
  
  // Validate required parameters
  if (!period1 || !period2 || !interval) {
    return res.status(400).json({ 
      error: 'Missing required query parameters: period1, period2, interval' 
    });
  }
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=${interval}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Yahoo Finance API returned status ${response.status}` 
      });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(`Error fetching chart for ${symbol}:`, error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch chart data' 
    });
  }
});

// Proxy endpoint for Yahoo Finance quote data
app.get('/api/quote/:symbol', throttleMiddleware, async (req, res) => {
  const { symbol } = req.params;
  const { interval = '1d', range = '1d' } = req.query;
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Yahoo Finance API returned status ${response.status}` 
      });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch quote data' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server running on http://localhost:${PORT}`);
  console.log(`📊 Endpoints:`);
  console.log(`   - GET /health`);
  console.log(`   - GET /api/chart/:symbol?period1=X&period2=Y&interval=Z`);
  console.log(`   - GET /api/quote/:symbol?interval=X&range=Y`);
});
