// Enterprise Anti-Tamper & Security Protection Module

// Map to track API request rate limiting per endpoint
const requestTimestampTracker = new Map<string, number>();

export function initSecurityProtections(): void {
  // Only activate strict protections in browser environment
  if (typeof window === 'undefined') return;

  // 1. Disable Context Menu (Right Click Inspect Element)
  document.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    return false;
  });

  // 2. Disable Common Inspect & View-Source Key Combinations
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    const key = e.key.toUpperCase();
    const ctrlOrCmd = e.ctrlKey || e.metaKey;

    // F12 key
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
    if (ctrlOrCmd && e.shiftKey && (key === 'I' || key === 'J' || key === 'C')) {
      e.preventDefault();
      return false;
    }

    // Ctrl+U (View Source), Ctrl+S (Save Page)
    if (ctrlOrCmd && (key === 'U' || key === 'S')) {
      e.preventDefault();
      return false;
    }
  });

  // 3. DevTools Open Detection Trap
  setInterval(() => {
    const widthThreshold = window.outerWidth - window.innerWidth > 160;
    const heightThreshold = window.outerHeight - window.innerHeight > 160;
    
    if (widthThreshold || heightThreshold) {
      console.clear();
    }
  }, 1000);
}

/**
 * Anti-Spam Request Rate Limiter
 * Ensures an action cannot be fired repeatedly within threshold milliseconds.
 */
export function isRequestRateLimited(actionKey: string, minIntervalMs: number = 600): boolean {
  const now = Date.now();
  const lastTime = requestTimestampTracker.get(actionKey) || 0;
  if (now - lastTime < minIntervalMs) {
    return true; // Throttled
  }
  requestTimestampTracker.set(actionKey, now);
  return false;
}
