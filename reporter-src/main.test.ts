import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  downloadCurrentGist, 
  getNewResultFiles, 
  readFileWithStream,
  appendFileContent,
  uploadFileToGist,
  processResults 
} from './main';
import axios from 'axios';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

vi.mock('axios');
vi.mock('fs/promises');
vi.mock('fs');

describe('Reporter Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('downloadCurrentGist', () => {
    it('should download gist content and save to file', async () => {
      const mockContent = 'existing gist content';
      vi.mocked(axios.get).mockResolvedValue({
        data: {
          files: {
            'results.jsonl': { content: mockContent }
          }
        }
      });
      vi.mocked(fs.writeFile).mockResolvedValue();

      const result = await downloadCurrentGist('gist123', 'token123', '/tmp/test');

      expect(result).toBe(true);
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/gists/gist123',
        {
          headers: {
            'Authorization': 'Bearer token123',
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      expect(fs.writeFile).toHaveBeenCalledWith('/tmp/test', mockContent);
    });

    it('should return false when gist file not found', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: { files: {} }
      });

      const result = await downloadCurrentGist('gist123', 'token123', '/tmp/test');

      expect(result).toBe(false);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should return false on network error', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

      const result = await downloadCurrentGist('gist123', 'token123', '/tmp/test');

      expect(result).toBe(false);
    });
  });

  describe('getNewResultFiles', () => {
    it('should return jsonl files excluding hidden files', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'result1.jsonl',
        'result2.jsonl',
        '.hidden.jsonl',
        'other.txt',
        'data.json'
      ] as any);

      const files = await getNewResultFiles('/test/dir');

      expect(files).toEqual([
        '/test/dir/result1.jsonl',
        '/test/dir/result2.jsonl'
      ]);
    });

    it('should return empty array when directory read fails', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('Dir not found'));

      const files = await getNewResultFiles('/test/dir');

      expect(files).toEqual([]);
    });
  });

  describe('readFileWithStream', () => {
    it('should read file content using stream', async () => {
      const mockStream = new Readable();
      mockStream.push('line1\n');
      mockStream.push('line2\n');
      mockStream.push(null);

      vi.mocked(createReadStream).mockReturnValue(mockStream as any);

      const content = await readFileWithStream('/test/file.jsonl');

      expect(content).toBe('line1\nline2\n');
      expect(createReadStream).toHaveBeenCalledWith('/test/file.jsonl', {
        encoding: 'utf-8',
        highWaterMark: 16 * 1024
      });
    });

    it('should handle stream errors', async () => {
      const mockStream = new Readable();
      vi.mocked(createReadStream).mockReturnValue(mockStream as any);

      const promise = readFileWithStream('/test/file.jsonl');
      
      mockStream.emit('error', new Error('Stream error'));

      await expect(promise).rejects.toThrow('Stream error');
    });
  });

  describe('appendFileContent', () => {
    it('should append source file to target file', async () => {
      const mockStream = new Readable();
      mockStream.push('content to append');
      mockStream.push(null);

      vi.mocked(createReadStream).mockReturnValue(mockStream as any);
      vi.mocked(fs.appendFile).mockResolvedValue();

      await appendFileContent('/source.jsonl', '/target.jsonl');

      expect(fs.appendFile).toHaveBeenCalledWith('/target.jsonl', 'content to append');
    });
  });

  describe('uploadFileToGist', () => {
    it('should upload file content to gist', async () => {
      const mockStream = new Readable();
      mockStream.push('content to upload');
      mockStream.push(null);

      vi.mocked(createReadStream).mockReturnValue(mockStream as any);
      vi.mocked(axios.patch).mockResolvedValue({ data: {} });

      const result = await uploadFileToGist('gist123', 'token123', '/tmp/test');

      expect(result).toBe(true);
      expect(axios.patch).toHaveBeenCalledWith(
        'https://api.github.com/gists/gist123',
        {
          files: {
            'results.jsonl': { content: 'content to upload' }
          }
        },
        {
          headers: {
            'Authorization': 'Bearer token123',
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
    });

    it('should return false on upload error', async () => {
      const mockStream = new Readable();
      mockStream.push('content');
      mockStream.push(null);

      vi.mocked(createReadStream).mockReturnValue(mockStream as any);
      vi.mocked(axios.patch).mockRejectedValue(new Error('Upload failed'));

      const result = await uploadFileToGist('gist123', 'token123', '/tmp/test');

      expect(result).toBe(false);
    });
  });

  describe('processResults', () => {
    it('should process and upload new results', async () => {
      // Mock file system operations
      vi.mocked(fs.readdir).mockResolvedValue(['result1.jsonl', 'result2.jsonl'] as any);
      vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as any);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.appendFile).mockResolvedValue();
      vi.mocked(fs.unlink).mockResolvedValue();

      // Mock axios operations
      vi.mocked(axios.get).mockResolvedValue({
        data: {
          files: {
            'results.jsonl': { content: 'existing content' }
          }
        }
      });
      vi.mocked(axios.patch).mockResolvedValue({ data: {} });

      // Mock streams
      const mockStream1 = new Readable();
      mockStream1.push('result1 content\n');
      mockStream1.push(null);

      const mockStream2 = new Readable();
      mockStream2.push('result2 content\n');
      mockStream2.push(null);

      const mockStream3 = new Readable();
      mockStream3.push('existing content\nresult1 content\nresult2 content\n');
      mockStream3.push(null);

      vi.mocked(createReadStream)
        .mockReturnValueOnce(mockStream1 as any)
        .mockReturnValueOnce(mockStream2 as any)
        .mockReturnValueOnce(mockStream3 as any);

      await processResults('gist123', 'token123', '/results', '/tmp/backup');

      // Verify flow
      expect(fs.readdir).toHaveBeenCalledWith('/results');
      expect(axios.get).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith('/tmp/backup', 'existing content');
      expect(fs.appendFile).toHaveBeenCalledWith('/tmp/backup', '\n');
      expect(fs.appendFile).toHaveBeenCalledWith('/tmp/backup', 'result1 content\n');
      expect(fs.appendFile).toHaveBeenCalledWith('/tmp/backup', 'result2 content\n');
      expect(axios.patch).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalledWith('/results/result1.jsonl');
      expect(fs.unlink).toHaveBeenCalledWith('/results/result2.jsonl');
      expect(fs.unlink).toHaveBeenCalledWith('/tmp/backup');
    });

    it('should handle no new results', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['.hidden.jsonl', 'other.txt'] as any);

      await processResults('gist123', 'token123', '/results', '/tmp/backup');

      expect(axios.get).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should start fresh when no existing gist content', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['result1.jsonl'] as any);
      vi.mocked(axios.get).mockResolvedValue({ data: { files: {} } });
      vi.mocked(axios.patch).mockResolvedValue({ data: {} });
      vi.mocked(fs.unlink).mockResolvedValue();

      const mockStream1 = new Readable();
      mockStream1.push('result1 content');
      mockStream1.push(null);

      const mockStream2 = new Readable();
      mockStream2.push('result1 content');
      mockStream2.push(null);

      vi.mocked(createReadStream)
        .mockReturnValueOnce(mockStream1 as any)
        .mockReturnValueOnce(mockStream2 as any);

      await processResults('gist123', 'token123', '/results', '/tmp/backup');

      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(fs.stat).not.toHaveBeenCalled();
      expect(fs.appendFile).toHaveBeenCalledTimes(1);
      expect(fs.appendFile).toHaveBeenCalledWith('/tmp/backup', 'result1 content');
    });

    it('should not delete files if upload fails', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['result1.jsonl'] as any);
      vi.mocked(axios.get).mockResolvedValue({ data: { files: {} } });
      vi.mocked(axios.patch).mockRejectedValue(new Error('Upload failed'));
      vi.mocked(fs.appendFile).mockResolvedValue();
      vi.mocked(fs.unlink).mockResolvedValue();

      const mockStream1 = new Readable();
      mockStream1.push('content');
      mockStream1.push(null);

      const mockStream2 = new Readable();
      mockStream2.push('content');
      mockStream2.push(null);

      vi.mocked(createReadStream)
        .mockReturnValueOnce(mockStream1 as any)
        .mockReturnValueOnce(mockStream2 as any);

      await processResults('gist123', 'token123', '/results', '/tmp/backup');

      expect(fs.unlink).toHaveBeenCalledTimes(1); // Only temp file
      expect(fs.unlink).toHaveBeenCalledWith('/tmp/backup');
      expect(fs.unlink).not.toHaveBeenCalledWith('/results/result1.jsonl');
    });
  });
});