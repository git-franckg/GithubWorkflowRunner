import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const RESULTS_DIR = '/app/results';
const WRITE_INTERVAL_MS = 10 * 1000; // 10 secondes

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
  
  let counter = 0;
  
  setInterval(async () => {
    counter++;
    
    const result = {
      id: counter,
      timestamp: new Date().toISOString(),
      value: Math.random() * 1000,
      message: `Result #${counter}`
    };
    
    await writeResult(result);
  }, WRITE_INTERVAL_MS);
}

main();