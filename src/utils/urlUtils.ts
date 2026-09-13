/**
 * Utility functions for safe filename normalization and sanitization.
 */

export function sanitizeFileName(name: string): string {
  return name.replace(/[\/\\:*?"<>|]/g, '').trim().substring(0, 80);
}