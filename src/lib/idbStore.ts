/**
 * IndexedDB Storage Layer for SQLite Database
 * 
 * Provides low-level IndexedDB operations for storing/retrieving
 * the sql.js database as Uint8Array.
 */

const IDB_NAME = 'trading_tool';
const IDB_STORE = 'sqlite';
const IDB_VERSION = 1;
const DB_KEY = 'db';

/**
 * Opens or creates the IndexedDB database
 * Database name: 'trading_tool'
 * Object store: 'sqlite'
 * Key: 'db'
 */
export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
}

/**
 * Retrieves the stored database bytes from IndexedDB
 * Returns null if no database exists
 */
export async function getDbBytes(): Promise<Uint8Array | null> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE, 'readonly');
      const store = transaction.objectStore(IDB_STORE);
      const request = store.get(DB_KEY);

      request.onerror = () => {
        reject(new Error(`Failed to get database from IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        const result = request.result;
        if (result instanceof Uint8Array) {
          resolve(result);
        } else if (result) {
          // Handle potential ArrayBuffer or other formats
          resolve(new Uint8Array(result));
        } else {
          resolve(null);
        }
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error retrieving database bytes:', error);
    return null;
  }
}

/**
 * Stores database bytes to IndexedDB under key 'db'
 */
export async function setDbBytes(bytes: Uint8Array): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IDB_STORE, 'readwrite');
    const store = transaction.objectStore(IDB_STORE);
    const request = store.put(bytes, DB_KEY);

    request.onerror = () => {
      reject(new Error(`Failed to save database to IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };

    transaction.onerror = () => {
      reject(new Error(`Transaction failed: ${transaction.error?.message}`));
    };
  });
}

/**
 * Clears the database from IndexedDB
 */
export async function clearDbBytes(): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IDB_STORE, 'readwrite');
    const store = transaction.objectStore(IDB_STORE);
    const request = store.delete(DB_KEY);

    request.onerror = () => {
      reject(new Error(`Failed to delete database from IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };

    transaction.onerror = () => {
      reject(new Error(`Transaction failed: ${transaction.error?.message}`));
    };
  });
}
