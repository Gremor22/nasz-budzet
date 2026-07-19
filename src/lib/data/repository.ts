import type { BudgetState, ForecastMode, Transaction } from "@/lib/data/types";
import { createDemoState } from "@/lib/data/demo-data";

/**
 * Data access layer — Stage 1 uses localStorage.
 * Later this can be swapped for a Supabase implementation without rewriting UI.
 */
export interface BudgetRepository {
  load(): BudgetState;
  save(state: BudgetState): void;
  resetDemo(): BudgetState;
}

const STORAGE_KEY = "nasz-budzet-v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export class LocalStorageBudgetRepository implements BudgetRepository {
  load(): BudgetState {
    if (!isBrowser()) {
      return createDemoState();
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const demo = createDemoState();
        this.save(demo);
        return demo;
      }
      const parsed = JSON.parse(raw) as BudgetState;
      if (parsed.version !== 1) {
        const demo = createDemoState();
        this.save(demo);
        return demo;
      }
      return parsed;
    } catch {
      const demo = createDemoState();
      this.save(demo);
      return demo;
    }
  }

  save(state: BudgetState): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  resetDemo(): BudgetState {
    const demo = createDemoState();
    this.save(demo);
    return demo;
  }
}

export const budgetRepository = new LocalStorageBudgetRepository();

export function addTransaction(
  state: BudgetState,
  input: Omit<Transaction, "id" | "createdAt" | "updatedAt">,
): BudgetState {
  const now = new Date().toISOString();
  const tx: Transaction = {
    ...input,
    id: `tx-${crypto.randomUUID()}`,
    createdAt: now,
    updatedAt: now,
  };
  const next = {
    ...state,
    transactions: [tx, ...state.transactions],
  };
  return next;
}

export function setForecastMode(
  state: BudgetState,
  mode: ForecastMode,
): BudgetState {
  return {
    ...state,
    settings: { ...state.settings, forecastMode: mode },
  };
}

export function setHorizonDays(state: BudgetState, days: number): BudgetState {
  return {
    ...state,
    settings: { ...state.settings, horizonDays: days },
  };
}

export function setSafetyBuffer(
  state: BudgetState,
  grosze: number,
): BudgetState {
  return {
    ...state,
    household: { ...state.household, safetyBufferGrosze: Math.max(0, grosze) },
  };
}
