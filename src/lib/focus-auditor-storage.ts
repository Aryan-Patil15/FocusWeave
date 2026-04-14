import type { FocusActivityLogEntry, FocusAuditResult, FocusPlanBlock } from '@/types/focus-auditor';

const FOCUS_PLAN_STORAGE_KEY = 'focusWeave.focusAuditor.plan';
const FOCUS_LOGS_STORAGE_KEY = 'focusWeave.focusAuditor.logs';
const FOCUS_RESULT_STORAGE_KEY = 'focusWeave.focusAuditor.result';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) {
      return fallback;
    }
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('focusweave-focus-auditor-updated'));
  } catch (error) {
    console.error(`Error writing ${key} to localStorage:`, error);
  }
}

export function loadFocusPlanBlocks(): FocusPlanBlock[] {
  return readJson<FocusPlanBlock[]>(FOCUS_PLAN_STORAGE_KEY, []);
}

export function saveFocusPlanBlocks(blocks: FocusPlanBlock[]): void {
  writeJson(FOCUS_PLAN_STORAGE_KEY, blocks);
}

export function loadFocusActivityLogs(): FocusActivityLogEntry[] {
  return readJson<FocusActivityLogEntry[]>(FOCUS_LOGS_STORAGE_KEY, []);
}

export function saveFocusActivityLogs(entries: FocusActivityLogEntry[]): void {
  writeJson(FOCUS_LOGS_STORAGE_KEY, entries);
}

export function loadFocusAuditResult(): FocusAuditResult | null {
  return readJson<FocusAuditResult | null>(FOCUS_RESULT_STORAGE_KEY, null);
}

export function saveFocusAuditResult(result: FocusAuditResult | null): void {
  writeJson(FOCUS_RESULT_STORAGE_KEY, result);
}
