import { useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import { PREFERENCES_API_URL } from '@/config/api';

/**
 * Custom hook for saving user preferences to the backend.
 * 
 * Returns a memoized function that handles authentication checks and
 * preference persistence. The function will only save if the user is authenticated.
 * 
 * @returns A memoized savePreference function that accepts preference data
 * 
 * @example
 * ```tsx
 * const savePreference = useSavePreference();
 * 
 * const handleChange = (value: string) => {
 *   setValue(value);
 *   savePreference({ some_preference: value });
 * };
 * ```
 */
export function useSavePreference() {
  const auth = useAuth();
  const userId = auth.user?.profile?.sub || 'anonymous';

  const savePreference = useCallback(
    async (preferenceData: Record<string, string | null>) => {
      // Only save if user is authenticated
      if (userId === 'anonymous' || !auth.user?.id_token) {
        return;
      }

      try {
        await fetch(PREFERENCES_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.user.id_token}`,
          },
          credentials: 'include',
          body: JSON.stringify({
            user_id: userId,
            ...preferenceData,
          }),
        });
        console.info(`[useSavePreference] Preference saved:`, preferenceData, `for user ${userId}`);
      } catch (error) {
        console.error('[useSavePreference] Failed to save preference:', error);
      }
    },
    [userId, auth.user?.id_token]
  );

  return savePreference;
}
