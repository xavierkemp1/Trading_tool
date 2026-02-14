/**
 * Storage Health Utility
 * 
 * Provides metrics and debugging information about database storage
 */

import { getDbBytes } from './idbStore';

export interface StorageHealth {
  dbSizeBytes: number;
  dbSizeMB: number;
  lastSavedAt: Date | null;
  storageType: 'IndexedDB';
}

/**
 * Gets current database storage health metrics
 * Logs size and timestamp for debugging
 */
export async function getStorageHealth(): Promise<StorageHealth> {
  const bytes = await getDbBytes();
  
  const dbSizeBytes = bytes ? bytes.length : 0;
  const dbSizeMB = dbSizeBytes / (1024 * 1024);
  
  const health: StorageHealth = {
    dbSizeBytes,
    dbSizeMB,
    lastSavedAt: null, // IndexedDB doesn't provide modification time easily
    storageType: 'IndexedDB'
  };
  
  // Log for debugging
  console.log('Storage Health:', {
    size: `${dbSizeMB.toFixed(2)} MB (${dbSizeBytes} bytes)`,
    storageType: health.storageType
  });
  
  return health;
}
