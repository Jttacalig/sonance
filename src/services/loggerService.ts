import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'AUDIO' | 'DOWNLOAD' | 'SEARCH';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  tag: string;
  message: string;
  data?: any;
}

const STORAGE_HOST_KEY = '@sonance_console_host';
const MAX_LOGS = 300;

class LoggerService {
  private logs: LogEntry[] = [];
  private hostUrl: string | null = null;
  private listeners: Set<(entry: LogEntry) => void> = new Set();
  private batchQueue: LogEntry[] = [];
  private flushTimer: any = null;
  private isInitialized = false;
  private idCounter = 1;

  async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      const savedHost = await AsyncStorage.getItem(STORAGE_HOST_KEY);
      if (savedHost) {
        this.hostUrl = this.normalizeHost(savedHost);
      }
    } catch (e) {}

    // Hook global error handler if available
    if (typeof (globalThis as any).ErrorUtils !== 'undefined') {
      const originalHandler = (globalThis as any).ErrorUtils.getGlobalHandler();
      (globalThis as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
        this.error('GLOBAL_CRASH', error?.message || 'Uncaught Global Error', {
          stack: error?.stack,
          isFatal,
        });
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }

    this.info('APP_INIT', 'Sonance iOS Logger initialized', {
      platform: Platform.OS,
      version: Platform.Version,
      connectedHost: this.hostUrl || 'Not configured',
    });
  }

  normalizeHost(raw: string): string {
    let clean = raw.trim();
    if (!clean) return '';
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'http://' + clean;
    }
    // If no port specified, default to 8088
    try {
      const url = new URL(clean);
      if (!url.port) {
        clean = clean.replace(url.hostname, url.hostname + ':8088');
      }
    } catch {
      if (!clean.includes(':', 7)) {
        clean = clean + ':8088';
      }
    }
    return clean;
  }

  async setHost(host: string): Promise<void> {
    if (!host.trim()) {
      this.hostUrl = null;
      await AsyncStorage.removeItem(STORAGE_HOST_KEY);
      this.info('LOGGER', 'Windows Console host disconnected');
      return;
    }

    const normalized = this.normalizeHost(host);
    this.hostUrl = normalized;
    await AsyncStorage.setItem(STORAGE_HOST_KEY, normalized);
    this.info('LOGGER', 'Windows Console host set to ' + normalized);
  }

  getHost(): string | null {
    return this.hostUrl;
  }

  async testConnection(host: string): Promise<{ success: boolean; message: string }> {
    const target = this.normalizeHost(host);
    if (!target) {
      return { success: false, message: 'Invalid or empty IP address' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const res = await fetch(target + '/ping', {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        return { success: true, message: 'Connected to ' + (data.server || 'Windows Console') };
      }
      return { success: false, message: 'Server returned HTTP ' + res.status };
    } catch (err: any) {
      clearTimeout(timeout);
      return {
        success: false,
        message: err.name === 'AbortError' ? 'Connection timed out (verify IP & Wi-Fi)' : (err.message || 'Cannot reach server'),
      };
    }
  }

  log(level: LogLevel, tag: string, message: string, data?: any): void {
    const entry: LogEntry = {
      id: String(Date.now()) + '-' + String(this.idCounter++),
      timestamp: Date.now(),
      level,
      tag: tag.toUpperCase(),
      message,
      data,
    };

    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS) {
      this.logs.shift();
    }

    // Notify in-app UI listeners
    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch {}
    });

    // Queue for remote Windows console delivery
    if (this.hostUrl) {
      this.batchQueue.push(entry);
      this.scheduleFlush(level === 'ERROR');
    }
  }

  info(tag: string, message: string, data?: any): void {
    this.log('INFO', tag, message, data);
  }

  warn(tag: string, message: string, data?: any): void {
    this.log('WARN', tag, message, data);
  }

  error(tag: string, message: string, data?: any): void {
    this.log('ERROR', tag, message, data);
  }

  audio(message: string, data?: any): void {
    this.log('AUDIO', 'AUDIO', message, data);
  }

  download(message: string, data?: any): void {
    this.log('DOWNLOAD', 'DOWNLOAD', message, data);
  }

  search(message: string, data?: any): void {
    this.log('SEARCH', 'SEARCH', message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private scheduleFlush(immediate: boolean = false): void {
    if (immediate) {
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushQueue();
      return;
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flushQueue();
      }, 350);
    }
  }

  private async flushQueue(): Promise<void> {
    if (!this.hostUrl || this.batchQueue.length === 0) return;

    const payload = [...this.batchQueue];
    this.batchQueue = [];

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      await fetch(this.hostUrl + '/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (e) {
      // Re-queue up to 50 logs if send fails
      if (this.batchQueue.length < 50) {
        this.batchQueue.unshift(...payload.slice(-20));
      }
    }
  }
}

export const logger = new LoggerService();
