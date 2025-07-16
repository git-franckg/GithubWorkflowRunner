import { readdir, unlink, writeFile, appendFile, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import axios from 'axios';

const RESULTS_DIR = './results';
const TEMP_FILE = './results/.gist_backup';
const SCAN_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const STREAM_BUFFER_SIZE = 16 * 1024; // 16KB

export async function downloadCurrentGist(
  gistId: string, 
  token: string,
  tempFile: string = TEMP_FILE
): Promise<boolean> {
  try {
    const response = await axios.get(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    const content = response.data.files?.['results.jsonl']?.content;
    if (!content) return false;
    
    await writeFile(tempFile, content);
    return true;
  } catch {
    return false;
  }
}

export async function getNewResultFiles(resultsDir: string = RESULTS_DIR): Promise<string[]> {
  const allFiles = await readdir(resultsDir).catch(() => []);
  return allFiles
    .filter(filename => filename.endsWith('.jsonl'))
    .filter(filename => !filename.startsWith('.'))
    .map(filename => join(resultsDir, filename));
}

export async function readFileWithStream(filepath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    const stream = createReadStream(filepath, { 
      encoding: 'utf-8',
      highWaterMark: STREAM_BUFFER_SIZE 
    });
    
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(chunks.join('')));
    stream.on('error', reject);
  });
}

export async function appendFileContent(sourceFile: string, targetFile: string): Promise<void> {
  const content = await readFileWithStream(sourceFile);
  await appendFile(targetFile, content);
}

export async function uploadFileToGist(
  gistId: string, 
  token: string,
  tempFile: string = TEMP_FILE
): Promise<boolean> {
  try {
    const content = await readFileWithStream(tempFile);
    
    await axios.patch(
      `https://api.github.com/gists/${gistId}`,
      {
        files: {
          'results.jsonl': { content }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    return true;
  } catch (error) {
    console.error('Upload failed:', error);
    return false;
  }
}

export async function processResults(
  gistId: string, 
  token: string,
  resultsDir: string = RESULTS_DIR,
  tempFile: string = TEMP_FILE
): Promise<void> {
  console.log('Checking for new results...');
  
  const resultFiles = await getNewResultFiles(resultsDir);
  if (resultFiles.length === 0) {
    console.log('No new results found');
    return;
  }
  
  console.log(`Found ${resultFiles.length} result files`);
  
  const hasExistingContent = await downloadCurrentGist(gistId, token, tempFile);
  console.log(hasExistingContent ? 'Downloaded existing gist' : 'Starting fresh');
  
  if (hasExistingContent) {
    const fileInfo = await stat(tempFile);
    if (fileInfo.size > 0) {
      await appendFile(tempFile, '\n');
    }
  }
  
  for (const file of resultFiles) {
    await appendFileContent(file, tempFile);
  }
  
  const uploadSuccess = await uploadFileToGist(gistId, token, tempFile);
  
  if (uploadSuccess) {
    await Promise.all(resultFiles.map(file => unlink(file)));
    console.log(`Uploaded and deleted ${resultFiles.length} files`);
  }
  
  await unlink(tempFile).catch(() => {});
}

// Point d'entrée
async function main(): Promise<void> {
  const gistId = process.env.GIST_ID;
  const token = process.env.GITHUB_TOKEN;
  
  if (!gistId || !token) {
    console.error('Missing GIST_ID or GITHUB_TOKEN');
    process.exit(1);
  }
  
  console.log('Reporter started');
  
  await processResults(gistId, token);
  
  const scanInterval = setInterval(async () => {
    await processResults(gistId, token);
  }, SCAN_INTERVAL_MS);
  
  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    clearInterval(scanInterval);
    await processResults(gistId, token);
    process.exit(0);
  });
}

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}