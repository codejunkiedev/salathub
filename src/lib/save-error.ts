import { toast } from 'sonner';
import { isPlanLimitError } from '@/lib/supabase';
import { AppRoutes } from '@/constants';

/**
 * Toasts a failed save. A plan limit shows its own message with a way to the
 * Billing page; anything else shows the fallback.
 */
export function showSaveError(error: unknown, fallback: string): void {
  if (isPlanLimitError(error)) {
    toast.error((error as Error).message, {
      action: {
        label: 'View plan',
        onClick: () => window.location.assign(AppRoutes.SettingsBilling),
      },
    });
    return;
  }
  toast.error(fallback);
}
