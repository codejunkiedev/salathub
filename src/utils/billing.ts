const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left in a trial, counting a part day as one; 0 once it has ended. */
export const trialDaysLeft = (trialEndsAt: string | null): number =>
  trialEndsAt ? Math.max(Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / DAY_MS), 0) : 0;
