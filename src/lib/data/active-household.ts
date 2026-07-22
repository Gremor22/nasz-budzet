const ACTIVE_HOUSEHOLD_KEY = "nasz-budzet-active-household";

export function readActiveHouseholdId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_HOUSEHOLD_KEY);
  } catch {
    return null;
  }
}

export function writeActiveHouseholdId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_HOUSEHOLD_KEY, id);
    else window.localStorage.removeItem(ACTIVE_HOUSEHOLD_KEY);
  } catch {
    /* private mode */
  }
}
