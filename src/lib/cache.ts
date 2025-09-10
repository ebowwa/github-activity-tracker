import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class Cache {
  private cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  private getCacheKey(key: string): string {
    return crypto.createHash('md5').update(key).digest('hex');
  }

  private getCachePath(key: string): string {
    return path.join(this.cacheDir, `${this.getCacheKey(key)}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cachePath = this.getCachePath(key);
      const data = await fs.readFile(cachePath, 'utf-8');
      const cached = JSON.parse(data);
      
      if (cached.expiry && Date.now() > cached.expiry) {
        await this.delete(key);
        return null;
      }
      
      return cached.value as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const cachePath = this.getCachePath(key);
      const data = {
        value,
        created: Date.now(),
        expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
      };
      
      await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to write cache:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(key);
      await fs.unlink(cachePath);
    } catch {
      // Ignore errors if file doesn't exist
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
}