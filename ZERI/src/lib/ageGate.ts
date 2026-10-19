/** Storage key for the 16+ check. Only the fact that it was passed is stored, never the age. */
export const AGE_VERIFICATION_KEY = 'zeri_age_verified_v1';
/** Fired when the visitor passes the age check, so later prompts can appear in order. */
export const AGE_PASSED_EVENT = 'zeri:age-passed';

export function isAgeVerified(): boolean {
  try {
    return window.localStorage.getItem(AGE_VERIFICATION_KEY) === 'passed';
  } catch {
    return false;
  }
}
