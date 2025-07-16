import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const RESULTS_DIR = '/app/results';
const WRITE_INTERVAL_MS = 10 * 1000; // 10 secondes
const MAX_RUNTIME_MS = 60 * 60 * 1000; // 1 heure

async function writeResult(data: any): Promise<void> {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const filename = `result_${timestamp}_${randomId}.jsonl`;
  const filepath = join(RESULTS_DIR, filename);
  
  const jsonLine = JSON.stringify(data) + '\n';
  await writeFile(filepath, jsonLine);
  
  console.log(`Wrote: ${filename}`);
}

async function main(): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });
  
  console.log('Demo script started');
  console.log(`Will run for maximum ${MAX_RUNTIME_MS / 1000 / 60} minutes`);
  
  const startTime = Date.now();
  let counter = 0;
  
  const interval = setInterval(async () => {
    counter++;
    
    const result = {
      id: counter,
      timestamp: new Date().toISOString(),
      value: Math.random() * 1000,
      message: `Result #${counter}`
    };
    
    await writeResult(result);
    
    // Vérifier si le temps maximum est écoulé
    if (Date.now() - startTime >= MAX_RUNTIME_MS) {
      console.log(`Maximum runtime of 1 hour reached. Stopping...`);
      clearInterval(interval);
      process.exit(0);
    }
  }, WRITE_INTERVAL_MS);
}

main();