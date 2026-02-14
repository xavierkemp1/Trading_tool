import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins in development
app.use(cors());

// Enable JSON body parsing for POST requests
app.use(express.json({ limit: '10mb' }));

// Rate limiting: Track last request time and enforce minimum delay
const MIN_REQUEST_DELAY_MS = 500; // Minimum 500ms between requests
let lastRequestTime = 0;
let requestQueue = Promise.resolve();

// Middleware to throttle requests to Yahoo Finance
const throttleMiddleware = (req, res, next) => {
  requestQueue = requestQueue
    .then(async () => {
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      
      if (timeSinceLastRequest < MIN_REQUEST_DELAY_MS) {
        const delay = MIN_REQUEST_DELAY_MS - timeSinceLastRequest;
        console.log(`⏱️  Throttling request for ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      lastRequestTime = Date.now();
      next();
    })
    .catch((error) => {
      console.error('Error in throttle middleware:', error);
      next(error);
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
  
  // Validate interval parameter
  const validIntervals = ['1m', '5m', '15m', '30m', '1h', '1d', '5d', '1wk', '1mo', '3mo'];
  if (!validIntervals.includes(interval)) {
    return res.status(400).json({ error: 'Invalid interval parameter' });
  }
  
  // Validate periods are numeric timestamps
  if (isNaN(period1) || isNaN(period2)) {
    return res.status(400).json({ error: 'Invalid period parameters - must be numeric timestamps' });
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
  
  // Validate interval and range parameters
  const validIntervals = ['1d', '5d', '1wk', '1mo', '3mo'];
  const validRanges = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', 'ytd', 'max'];
  
  if (!validIntervals.includes(interval)) {
    return res.status(400).json({ error: 'Invalid interval parameter' });
  }
  
  if (!validRanges.includes(range)) {
    return res.status(400).json({ error: 'Invalid range parameter' });
  }
  
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

// Proxy endpoint for Reddit API
app.get('/api/reddit', throttleMiddleware, async (req, res) => {
  const { subreddit, sort = 'hot', limit = 20, t } = req.query;
  
  // Validate required parameters
  if (!subreddit) {
    return res.status(400).json({ error: 'Missing required query parameter: subreddit' });
  }
  
  // Validate subreddit name (alphanumeric and underscores only)
  if (!/^[a-zA-Z0-9_]+$/.test(subreddit)) {
    return res.status(400).json({ error: 'Invalid subreddit parameter' });
  }
  
  // Validate sort parameter
  const validSorts = ['hot', 'top', 'new', 'rising'];
  if (!validSorts.includes(sort)) {
    return res.status(400).json({ error: 'Invalid sort parameter' });
  }
  
  // Validate limit parameter (1-100)
  const limitNum = parseInt(limit, 10);
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({ error: 'Invalid limit parameter - must be between 1 and 100' });
  }
  
  // Validate time range parameter if provided
  // Note: Reddit only uses 't' parameter with 'top' sort
  if (t) {
    const validTimeRanges = ['hour', 'day', 'week', 'month', 'year', 'all'];
    if (!validTimeRanges.includes(t)) {
      return res.status(400).json({ error: 'Invalid time range parameter' });
    }
  }
  
  // Build URL with query parameters
  let url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limitNum}`;
  if (t && sort === 'top') {
    url += `&t=${t}`;
  }
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'web:trading-app:v1.0.0 (for educational/research purposes)'
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Reddit API returned status ${response.status}` 
      });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(`Error fetching Reddit data for r/${subreddit}:`, error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch Reddit data' 
    });
  }
});

// Proxy endpoint for individual Reddit posts
app.get('/api/reddit/post', throttleMiddleware, async (req, res) => {
  const { subreddit, postId } = req.query;
  
  if (!subreddit || !postId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  // Validate subreddit and postId format
  if (!/^[a-zA-Z0-9_]+$/.test(subreddit)) {
    return res.status(400).json({ error: 'Invalid subreddit parameter' });
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(postId)) {
    return res.status(400).json({ error: 'Invalid postId parameter' });
  }
  
  const url = `https://www.reddit.com/r/${subreddit}/comments/${postId}.json`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'web:trading-app:v1.0.0 (for educational/research purposes)'
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Reddit API returned status ${response.status}` 
      });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint for Twitter API (placeholder for future implementation)
app.get('/api/twitter', throttleMiddleware, async (req, res) => {
  // Twitter API integration would go here
  // For now, return a message indicating it's not implemented
  res.status(501).json({ 
    error: 'Twitter API proxy not yet implemented. Using mock data in client.' 
  });
});

// ============= OPENAI API ENDPOINTS (SECURE) =============

/**
 * POST /api/ai/position-review
 * Generate AI review for a single position
 * Body: { positionData: object, model: string }
 */
app.post('/api/ai/position-review', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'OpenAI API key not configured on server. Set OPENAI_API_KEY environment variable.' 
    });
  }
  
  const { positionData, systemPrompt, model = 'gpt-4o-mini' } = req.body;
  
  if (!positionData || !systemPrompt) {
    return res.status(400).json({ 
      error: 'Missing required fields: positionData and systemPrompt' 
    });
  }
  
  try {
    const inputJson = JSON.stringify(positionData, null, 2);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: inputJson
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      return res.status(response.status).json({ 
        error: `OpenAI API error: ${error.error?.message || response.statusText}` 
      });
    }
    
    const result = await response.json();
    const outputMd = result.choices?.[0]?.message?.content || '';
    
    if (!outputMd) {
      return res.status(500).json({ error: 'Empty response from OpenAI API' });
    }
    
    res.json({ result: outputMd });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate position review' 
    });
  }
});

/**
 * POST /api/ai/portfolio-review
 * Generate AI review for entire portfolio
 * Body: { portfolioData: object, model: string }
 */
app.post('/api/ai/portfolio-review', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'OpenAI API key not configured on server. Set OPENAI_API_KEY environment variable.' 
    });
  }
  
  const { portfolioData, systemPrompt, model = 'gpt-4o-mini' } = req.body;
  
  if (!portfolioData || !systemPrompt) {
    return res.status(400).json({ 
      error: 'Missing required fields: portfolioData and systemPrompt' 
    });
  }
  
  try {
    const inputJson = JSON.stringify(portfolioData, null, 2);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: inputJson
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      return res.status(response.status).json({ 
        error: `OpenAI API error: ${error.error?.message || response.statusText}` 
      });
    }
    
    const result = await response.json();
    const outputMd = result.choices?.[0]?.message?.content || '';
    
    if (!outputMd) {
      return res.status(500).json({ error: 'Empty response from OpenAI API' });
    }
    
    res.json({ result: outputMd });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate portfolio review' 
    });
  }
});

/**
 * POST /api/ai/analyze
 * Generic OpenAI analysis endpoint
 * Body: { systemPrompt: string, userPrompt: string, model: string }
 */
app.post('/api/ai/analyze', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'OpenAI API key not configured on server. Set OPENAI_API_KEY environment variable.' 
    });
  }
  
  const { systemPrompt, userPrompt, model = 'gpt-4o-mini', maxTokens = 2000 } = req.body;
  
  if (!userPrompt) {
    return res.status(400).json({ 
      error: 'Missing required field: userPrompt' 
    });
  }
  
  try {
    const messages = systemPrompt 
      ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
      : [{ role: 'user', content: userPrompt }];
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: maxTokens
      })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      return res.status(response.status).json({ 
        error: `OpenAI API error: ${error.error?.message || response.statusText}` 
      });
    }
    
    const result = await response.json();
    const outputMd = result.choices?.[0]?.message?.content || '';
    
    if (!outputMd) {
      return res.status(500).json({ error: 'Empty response from OpenAI API' });
    }
    
    res.json({ result: outputMd });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to analyze content' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server running on http://localhost:${PORT}`);
  console.log(`📊 Endpoints:`);
  console.log(`   - GET /health`);
  console.log(`   - GET /api/chart/:symbol?period1=X&period2=Y&interval=Z`);
  console.log(`   - GET /api/quote/:symbol?interval=X&range=Y`);
  console.log(`   - GET /api/reddit?subreddit=X&sort=Y&limit=Z`);
  console.log(`   - GET /api/reddit/post?subreddit=X&postId=Y`);
  console.log(`   - GET /api/twitter (not yet implemented)`);
  console.log(`   - POST /api/ai/position-review`);
  console.log(`   - POST /api/ai/portfolio-review`);
  console.log(`   - POST /api/ai/analyze`);
});
