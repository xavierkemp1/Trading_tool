/**
 * Simple test harness for split detection
 * Run this file with: ts-node src/lib/__test_split_detection.ts
 * Or import and call testSplitDetection() from console
 */

import { detectStockSplit, type CorporateActionDetection } from './corporateActions';
import type { Price } from './db';

/**
 * Test 2:1 split detection
 */
export function testSplitDetection(): void {
  console.log('Testing stock split detection...\n');
  
  // Test case 1: 2:1 split scenario
  // Price drops from ~$100 to ~$50 overnight
  const test2to1Split: Price[] = [
    // Recent prices (sorted DESC by date)
    { symbol: 'TEST', date: '2024-01-10', open: 51, high: 52, low: 50, close: 51.5, volume: 5000000 },
    { symbol: 'TEST', date: '2024-01-09', open: 50, high: 51, low: 49.5, close: 50.2, volume: 4800000 },
    { symbol: 'TEST', date: '2024-01-08', open: 49.5, high: 50.5, low: 49, close: 50, volume: 6000000 }, // Split day - high volume, price ~50
    { symbol: 'TEST', date: '2024-01-07', open: 99.5, high: 101, low: 99, close: 100, volume: 2000000 }, // Pre-split
    { symbol: 'TEST', date: '2024-01-06', open: 98, high: 100, low: 98, close: 99, volume: 1900000 },
    { symbol: 'TEST', date: '2024-01-05', open: 97, high: 99, low: 97, close: 98.5, volume: 2100000 },
    { symbol: 'TEST', date: '2024-01-04', open: 96, high: 98, low: 96, close: 97, volume: 1800000 },
    { symbol: 'TEST', date: '2024-01-03', open: 95, high: 97, low: 95, close: 96.5, volume: 2000000 },
    { symbol: 'TEST', date: '2024-01-02', open: 94, high: 96, low: 94, close: 95, volume: 1850000 },
    { symbol: 'TEST', date: '2024-01-01', open: 93, high: 95, low: 93, close: 94.5, volume: 1950000 },
  ];
  
  const result1 = detectStockSplit(test2to1Split);
  console.log('Test 1 - 2:1 Split Detection:');
  console.log('Expected: detected=true, type=split, ratio=2:1, date=2024-01-08');
  console.log('Result:', result1);
  console.log('✓ PASS:', result1.detected && result1.type === 'split' && result1.ratio === '2:1' ? 'YES' : 'NO');
  console.log();
  
  // Test case 2: Normal price movement (no split)
  const testNormalMovement: Price[] = [
    { symbol: 'TEST', date: '2024-01-10', open: 101, high: 102, low: 100, close: 101.5, volume: 2000000 },
    { symbol: 'TEST', date: '2024-01-09', open: 100, high: 101, low: 99.5, close: 100.2, volume: 1900000 },
    { symbol: 'TEST', date: '2024-01-08', open: 99.5, high: 100.5, low: 99, close: 100, volume: 2100000 },
    { symbol: 'TEST', date: '2024-01-07', open: 99, high: 100, low: 98.5, close: 99.5, volume: 1850000 },
    { symbol: 'TEST', date: '2024-01-06', open: 98, high: 99.5, low: 98, close: 99, volume: 2000000 },
    { symbol: 'TEST', date: '2024-01-05', open: 97, high: 99, low: 97, close: 98.5, volume: 1950000 },
    { symbol: 'TEST', date: '2024-01-04', open: 96, high: 98, low: 96, close: 97, volume: 1800000 },
    { symbol: 'TEST', date: '2024-01-03', open: 95, high: 97, low: 95, close: 96.5, volume: 2050000 },
    { symbol: 'TEST', date: '2024-01-02', open: 94, high: 96, low: 94, close: 95, volume: 1900000 },
    { symbol: 'TEST', date: '2024-01-01', open: 93, high: 95, low: 93, close: 94.5, volume: 1950000 },
  ];
  
  const result2 = detectStockSplit(testNormalMovement);
  console.log('Test 2 - Normal Movement (No Split):');
  console.log('Expected: detected=false');
  console.log('Result:', result2);
  console.log('✓ PASS:', !result2.detected ? 'YES' : 'NO');
  console.log();
  
  // Test case 3: 3:1 split scenario
  const test3to1Split: Price[] = [
    { symbol: 'TEST', date: '2024-01-10', open: 34, high: 35, low: 33, close: 34.5, volume: 5000000 },
    { symbol: 'TEST', date: '2024-01-09', open: 33.5, high: 34.5, low: 33, close: 34, volume: 4800000 },
    { symbol: 'TEST', date: '2024-01-08', open: 33, high: 34, low: 32.5, close: 33.3, volume: 7000000 }, // Split day - high volume, price ~33% of previous
    { symbol: 'TEST', date: '2024-01-07', open: 99, high: 101, low: 98, close: 100, volume: 2000000 }, // Pre-split
    { symbol: 'TEST', date: '2024-01-06', open: 98, high: 100, low: 97, close: 99, volume: 1900000 },
    { symbol: 'TEST', date: '2024-01-05', open: 97, high: 99, low: 96, close: 98, volume: 2100000 },
    { symbol: 'TEST', date: '2024-01-04', open: 96, high: 98, low: 95, close: 97, volume: 1850000 },
    { symbol: 'TEST', date: '2024-01-03', open: 95, high: 97, low: 94, close: 96, volume: 2000000 },
    { symbol: 'TEST', date: '2024-01-02', open: 94, high: 96, low: 93, close: 95, volume: 1950000 },
    { symbol: 'TEST', date: '2024-01-01', open: 93, high: 95, low: 92, close: 94, volume: 1900000 },
  ];
  
  const result3 = detectStockSplit(test3to1Split);
  console.log('Test 3 - 3:1 Split Detection:');
  console.log('Expected: detected=true, type=split, ratio=3:1, date=2024-01-08');
  console.log('Result:', result3);
  console.log('✓ PASS:', result3.detected && result3.type === 'split' && result3.ratio === '3:1' ? 'YES' : 'NO');
  console.log();
  
  console.log('=== Split Detection Tests Complete ===');
}
