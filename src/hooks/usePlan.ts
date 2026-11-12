import { useEffect, useState } from 'react';
import { getPlanRules } from '@/lib/supabase';
import { useAuthStore } from '@/store';
import type { BillingPlan, PlanRules } from '@/types';
import { useMasjidBilling } from './useMasjidBilling';

let rulesRequest: Promise<PlanRules[]> | null = null;
const loadRules = () => {
  rulesRequest ??= getPlanRules().catch(error => {
    rulesRequest = null;
    throw error;
  });
  return rulesRequest;
};

type ReturnType = {
  isLoading: boolean;
  plan: BillingPlan;
  rules: PlanRules | null;
  hasFeature: (feature: string) => boolean;
  /** Screens the masjid may have: included plus any paid extras. */
  screenLimit: number | null;
};

/**
 * What the current masjid's plan allows, for locking features in the console.
 * Moderators can only sign in on a plan that has them, so they're treated as Pro.
 * The database enforces every limit; this only keeps the console honest.
 */
export function usePlan(): ReturnType {
  const role = useAuthStore(s => s.role);
  const { billing, isLoading: isBillingLoading } = useMasjidBilling();
  const [rules, setRules] = useState<PlanRules[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRules()
      .then(loaded => {
        if (!cancelled) setRules(loaded);
      })
      .catch(error => console.error('Error loading plan rules:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const plan: BillingPlan = role === 'admin' ? (billing?.plan ?? 'free') : 'pro';
  const current = rules?.find(r => r.plan === plan) ?? null;
  const isLoading = !rules || (role === 'admin' && (isBillingLoading || !billing));

  return {
    isLoading,
    plan,
    rules: current,
    // Unlocked while loading, so nothing flashes locked on a Pro masjid.
    hasFeature: feature => isLoading || !current || current.features.includes(feature),
    screenLimit: current
      ? current.included_screens +
        (current.extra_screens_allowed && billing ? billing.extra_screens : 0)
      : null,
  };
}
