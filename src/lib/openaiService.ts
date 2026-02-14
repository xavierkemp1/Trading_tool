import { getPositionBySymbol, getAllPositions, getPricesForSymbol, getFundamentals, addReview } from './db';
import { calculateIndicators } from './dataService';
import { positionReviewPrompt, portfolioWeeklyReviewPrompt } from './aiPrompts';
import { getSettings } from './settingsService';

/**
 * Get the proxy URL from environment or default
 */
function getProxyUrl(): string {
  return import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
}

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
  
  // Call proxy server instead of OpenAI directly
  const proxyUrl = getProxyUrl();
  const response = await fetch(`${proxyUrl}/api/ai/position-review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      positionData,
      systemPrompt: positionReviewPrompt,
      model: settings.openai.model
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    
    throw new Error(
      `Proxy server error: ${error.error || response.statusText}. ` +
      `Make sure the proxy server is running on ${proxyUrl}. ` +
      `Run 'npm run server' in a separate terminal.`
    );
  }
  
  const result = await response.json();
  const outputMd = result.result || '';
  
  if (!outputMd) {
    throw new Error('Empty response from AI service');
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
  
  // Call proxy server instead of OpenAI directly
  const proxyUrl = getProxyUrl();
  const response = await fetch(`${proxyUrl}/api/ai/portfolio-review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      portfolioData,
      systemPrompt: portfolioWeeklyReviewPrompt,
      model: settings.openai.model
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    
    throw new Error(
      `Proxy server error: ${error.error || response.statusText}. ` +
      `Make sure the proxy server is running on ${proxyUrl}. ` +
      `Run 'npm run server' in a separate terminal.`
    );
  }
  
  const result = await response.json();
  const outputMd = result.result || '';
  
  if (!outputMd) {
    throw new Error('Empty response from AI service');
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

  // Call proxy server instead of OpenAI directly
  const proxyUrl = getProxyUrl();
  const response = await fetch(`${proxyUrl}/api/ai/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemPrompt,
      userPrompt,
      model: settings.openai.model,
      maxTokens: 2000
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    
    // Provide helpful error message if server is not running
    if (response.status === 404 || !response.ok) {
      throw new Error(
        `Proxy server error: ${error.error || response.statusText}. ` +
        `Make sure the proxy server is running on ${proxyUrl}. ` +
        `Run 'npm run server' in a separate terminal.`
      );
    }
    
    throw new Error(`AI Analysis error: ${error.error || response.statusText}`);
  }
  
  const result = await response.json();
  const outputMd = result.result || '';
  
  if (!outputMd) {
    throw new Error('Empty response from AI service');
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
    symbol,
    input_json: inputJson,
    output_md: outputMd
  });
  
  return outputMd;
}

/**
 * Analyze Reddit post content using AI
 */
export async function analyzeRedditPost(
  postTitle: string,
  postContent: string,
  postAuthor: string,
  postSubreddit: string
): Promise<string> {
  const settings = getSettings();
  
  if (!settings.openai.enabled) {
    throw new Error('OpenAI integration is disabled in settings');
  }

  const systemPrompt = `You are a financial analyst AI assistant specialized in analyzing Reddit stock discussion posts and due diligence (DD) reports.
Your task is to:
1. Critically analyze the investment thesis presented
2. Evaluate the quality of research and arguments
3. Identify potential biases or gaps in analysis
4. Extract key data points and claims
5. Assess the overall credibility and strength of the argument
6. Highlight both bullish and bearish perspectives

Be objective and critical. Point out both strengths and weaknesses in the analysis.`;

  const userPrompt = `Please analyze this Reddit post from ${postSubreddit} by ${postAuthor}:

Title: ${postTitle}

Content:
${postContent}

Provide a comprehensive analysis including:
- Summary of the main investment thesis
- Quality assessment of the research/analysis
- Key claims and supporting evidence
- Potential biases or red flags
- Missing information or gaps in analysis
- Counter-arguments or risks not mentioned
- Overall credibility score (1-10)
- Your conclusion: Is this analysis worth considering?`;

  // Call proxy server instead of OpenAI directly
  const proxyUrl = getProxyUrl();
  const response = await fetch(`${proxyUrl}/api/ai/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemPrompt,
      userPrompt,
      model: settings.openai.model,
      maxTokens: 2500
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    
    // Provide helpful error message if server is not running
    if (response.status === 404 || !response.ok) {
      throw new Error(
        `Proxy server error: ${error.error || response.statusText}. ` +
        `Make sure the proxy server is running on ${proxyUrl}. ` +
        `Run 'npm run server' in a separate terminal.`
      );
    }
    
    throw new Error(`AI Analysis error: ${error.error || response.statusText}`);
  }
  
  const result = await response.json();
  const outputMd = result.result || '';
  
  if (!outputMd) {
    throw new Error('Empty response from AI service');
  }

  // Store in database
  const inputJson = JSON.stringify({
    postTitle,
    postAuthor,
    postSubreddit,
    contentLength: postContent.length,
    timestamp: new Date().toISOString()
  }, null, 2);

  addReview({
    created_at: new Date().toISOString(),
    scope: 'reddit_analysis',
    symbol: undefined,
    input_json: inputJson,
    output_md: outputMd
  });
  
  return outputMd;
}

/**
 * Generic OpenAI analysis function
 */
export async function analyzeWithOpenAI(prompt: string): Promise<string> {
  const settings = getSettings();
  
  if (!settings.openai.enabled) {
    throw new Error('OpenAI integration is disabled in settings');
  }
  
  // Call proxy server instead of OpenAI directly
  const proxyUrl = getProxyUrl();
  const response = await fetch(`${proxyUrl}/api/ai/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userPrompt: prompt,
      model: settings.openai.model,
      maxTokens: 2000
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    
    // Provide helpful error message if server is not running
    if (response.status === 404 || !response.ok) {
      throw new Error(
        `Proxy server error: ${error.error || response.statusText}. ` +
        `Make sure the proxy server is running on ${proxyUrl}. ` +
        `Run 'npm run server' in a separate terminal.`
      );
    }
    
    throw new Error(`AI Analysis error: ${error.error || response.statusText}`);
  }
  
  const result = await response.json();
  const outputMd = result.result || '';
  
  if (!outputMd) {
    throw new Error('Empty response from AI service');
  }
  
  return outputMd;
}
