import { getPositionBySymbol, getAllPositions, getPricesForSymbol, getFundamentals, addReview } from './db';
import { calculateIndicators } from './dataService';
import { positionReviewPrompt, portfolioWeeklyReviewPrompt } from './aiPrompts';
import { getSettings } from './settingsService';

interface PositionData {
  symbol: string;
  qty: number;
  avgCost: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  thesis?: string;
  thesisTag?: string;
  timeHorizon?: string;
  invalidation?: number;
  target?: number;
  priceHistory: {
    date: string;
    close: number;
  }[];
  indicators: {
    sma50?: number;
    sma200?: number;
    rsi14?: number;
    atr14?: number;
  };
  fundamentals?: any;
}

interface PortfolioData {
  totalValue: number;
  positions: PositionData[];
  regime: {
    description: string;
  };
}

export async function generatePositionReview(symbol: string): Promise<string> {
  const settings = getSettings();
  
  if (!settings.openai.enabled) {
    throw new Error('OpenAI integration is disabled in settings');
  }
  
  // Note: API key is exposed in client-side code. For production, use a backend proxy.
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Set VITE_OPENAI_API_KEY in your environment.');
  }
  
  // Get position data
  const position = getPositionBySymbol(symbol);
  if (!position) {
    throw new Error(`Position not found for symbol: ${symbol}`);
  }
  
  // Get price history
  const prices = getPricesForSymbol(symbol, 180); // Last 180 days
  const latestPrice = prices.length > 0 ? prices[0] : null;
  
  if (!latestPrice) {
    throw new Error(`No price data found for symbol: ${symbol}`);
  }
  
  // Get indicators
  const indicators = await calculateIndicators(symbol);
  
  // Get fundamentals
  const fundamentals = getFundamentals(symbol);
  
  // Format position data
  const positionData: PositionData = {
    symbol: position.symbol,
    qty: position.qty,
    avgCost: position.avg_cost,
    currentPrice: latestPrice.close,
    pnl: (latestPrice.close - position.avg_cost) * position.qty,
    pnlPct: ((latestPrice.close - position.avg_cost) / position.avg_cost) * 100,
    thesis: position.thesis,
    thesisTag: position.thesis_tag,
    timeHorizon: position.time_horizon,
    invalidation: position.invalidation,
    target: position.target,
    priceHistory: prices.slice(0, 60).map(p => ({ date: p.date, close: p.close })),
    indicators: {
      sma50: indicators.sma50,
      sma200: indicators.sma200,
      rsi14: indicators.rsi14,
      atr14: indicators.atr14
    },
    fundamentals: fundamentals ? {
      marketCap: fundamentals.market_cap,
      forwardPE: fundamentals.forward_pe,
      revenueGrowth: fundamentals.revenue_growth,
      beta: fundamentals.beta
    } : undefined
  };
  
  const inputJson = JSON.stringify(positionData, null, 2);
  
  // Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.openai.model,
      messages: [
        {
          role: 'system',
          content: positionReviewPrompt
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
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }
  
  const result = await response.json();
  const outputMd = result.choices?.[0]?.message?.content || '';
  
  if (!outputMd) {
    throw new Error('Empty response from OpenAI API');
  }
  
  // Store in database
  addReview({
    created_at: new Date().toISOString(),
    scope: 'position',
    symbol: symbol,
    input_json: inputJson,
    output_md: outputMd
  });
  
  return outputMd;
}

export async function generatePortfolioReview(): Promise<string> {
  const settings = getSettings();
  
  if (!settings.openai.enabled) {
    throw new Error('OpenAI integration is disabled in settings');
  }
  
  // Note: API key is exposed in client-side code. For production, use a backend proxy.
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Set VITE_OPENAI_API_KEY in your environment.');
  }
  
  // Get all positions
  const positions = getAllPositions();
  
  if (positions.length === 0) {
    throw new Error('No positions found to review');
  }
  
  // Build portfolio data
  const positionDataList: PositionData[] = [];
  let totalValue = 0;
  
  for (const position of positions) {
    const prices = getPricesForSymbol(position.symbol, 180);
    const latestPrice = prices.length > 0 ? prices[0] : null;
    
    if (!latestPrice) continue;
    
    const indicators = await calculateIndicators(position.symbol);
    const fundamentals = getFundamentals(position.symbol);
    
    const currentValue = latestPrice.close * position.qty;
    totalValue += currentValue;
    
    positionDataList.push({
      symbol: position.symbol,
      qty: position.qty,
      avgCost: position.avg_cost,
      currentPrice: latestPrice.close,
      pnl: (latestPrice.close - position.avg_cost) * position.qty,
      pnlPct: ((latestPrice.close - position.avg_cost) / position.avg_cost) * 100,
      thesis: position.thesis,
      thesisTag: position.thesis_tag,
      timeHorizon: position.time_horizon,
      invalidation: position.invalidation,
      target: position.target,
      priceHistory: prices.slice(0, 30).map(p => ({ date: p.date, close: p.close })),
      indicators: {
        sma50: indicators.sma50,
        sma200: indicators.sma200,
        rsi14: indicators.rsi14,
        atr14: indicators.atr14
      },
      fundamentals: fundamentals ? {
        marketCap: fundamentals.market_cap,
        forwardPE: fundamentals.forward_pe,
        revenueGrowth: fundamentals.revenue_growth,
        beta: fundamentals.beta
      } : undefined
    });
  }
  
  const portfolioData: PortfolioData = {
    totalValue,
    positions: positionDataList,
    regime: {
      description: 'Current market conditions' // Could be enhanced
    }
  };
  
  const inputJson = JSON.stringify(portfolioData, null, 2);
  
  // Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.openai.model,
      messages: [
        {
          role: 'system',
          content: portfolioWeeklyReviewPrompt
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
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }
  
  const result = await response.json();
  const outputMd = result.choices?.[0]?.message?.content || '';
  
  if (!outputMd) {
    throw new Error('Empty response from OpenAI API');
  }
  
  // Store in database
  addReview({
    created_at: new Date().toISOString(),
    scope: 'portfolio',
    symbol: undefined,
    input_json: inputJson,
    output_md: outputMd
  });
  
  return outputMd;
}

/**
 * Analyze uploaded file content using AI
 */
export async function analyzeFileContent(
  fileContent: string,
  fileName: string,
  fileType: string,
  symbol?: string
): Promise<string> {
  const settings = getSettings();
  
  if (!settings.openai.enabled) {
    throw new Error('OpenAI integration is disabled in settings');
  }
  
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Set VITE_OPENAI_API_KEY in your environment.');
  }

  const systemPrompt = `You are a financial analyst AI assistant specialized in analyzing stock-related documents and materials.
Your task is to:
1. Analyze the provided content thoroughly
2. Extract key insights, metrics, and data points relevant to investment decisions
3. Identify sentiment (bullish, bearish, or neutral)
4. Highlight risks and opportunities
5. Provide actionable conclusions

Be concise but comprehensive. Structure your response with clear sections.`;

  const userPrompt = `Please analyze this ${fileType} file "${fileName}"${symbol ? ` related to ${symbol}` : ''}:

${fileContent}

Provide a detailed analysis including:
- Key findings and insights
- Investment sentiment (bullish/bearish/neutral)
- Important metrics or data points
- Risks identified
- Opportunities identified
- Your conclusion and recommendation`;

  // Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.openai.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }
  
  const result = await response.json();
  const outputMd = result.choices?.[0]?.message?.content || '';
  
  if (!outputMd) {
    throw new Error('Empty response from OpenAI API');
  }

  // Store in database
  const inputJson = JSON.stringify({
    fileName,
    fileType,
    symbol,
    contentLength: fileContent.length,
    timestamp: new Date().toISOString()
  }, null, 2);

  addReview({
    created_at: new Date().toISOString(),
    scope: 'file_analysis',
    symbol: symbol,
    input_json: inputJson,
    output_md: outputMd
  });
  
  return outputMd;
}
