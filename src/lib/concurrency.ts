export interface PoolTask<T> {
  id: string;
  execute: () => Promise<T>;
}

export interface PoolProgress {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
}

export type ProgressCallback = (progress: PoolProgress & { 
  lastCompleted?: string;
  lastError?: { id: string; error: string };
}) => void;

/**
 * Runs tasks with concurrency limit
 */
export async function runWithConcurrency<T>(
  tasks: PoolTask<T>[],
  concurrency: number = 4,
  onProgress?: ProgressCallback
): Promise<{ results: T[]; errors: Array<{ id: string; error: any }> }> {
  const results: T[] = [];
  const errors: Array<{ id: string; error: any }> = [];
  
  let queued = [...tasks];
  let running = 0;
  let completed = 0;
  let failed = 0;
  
  const reportProgress = (lastCompleted?: string, lastError?: { id: string; error: string }) => {
    if (onProgress) {
      onProgress({
        total: tasks.length,
        queued: queued.length,
        running,
        completed,
        failed,
        lastCompleted,
        lastError
      });
    }
  };
  
  // Initial progress report
  reportProgress();
  
  return new Promise((resolve) => {
    const processNext = () => {
      // If no more queued tasks and no running tasks, we're done
      if (queued.length === 0 && running === 0) {
        resolve({ results, errors });
        return;
      }
      
      // Start new tasks up to concurrency limit
      while (running < concurrency && queued.length > 0) {
        const task = queued.shift()!;
        running++;
        
        reportProgress();
        
        // Execute task
        task.execute()
          .then((result) => {
            results.push(result);
            completed++;
            running--;
            reportProgress(task.id);
            processNext();
          })
          .catch((error) => {
            errors.push({ id: task.id, error });
            failed++;
            running--;
            reportProgress(undefined, { id: task.id, error: error instanceof Error ? error.message : String(error) });
            processNext();
          });
      }
    };
    
    // Start processing
    processNext();
  });
}
