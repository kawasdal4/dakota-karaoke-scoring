import { JudgeRole } from '@/types';
import { setStoredJudge } from './storage';
import { loginWithSheets, changePinInSheets } from './google-sheets';

const SESSION_KEY = 'dakota_auth_session';

export interface AuthSession {
  username: JudgeRole;
  role: string;
  loggedIn: boolean;
}

/**
 * Generates SHA-256 hash using Web Crypto API.
 * PIN is never stored or sent in plaintext.
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`dakota_salt_${pin}`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies if the entered PIN matches the hash stored in the central Google Spreadsheet.
 */
export async function verifyPin(
  role: JudgeRole,
  pin: string
): Promise<{ success: boolean; message?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, message: 'Browser API tidak tersedia' };
  }

  if (!/^\d{4,6}$/.test(pin)) {
    return { success: false, message: 'PIN harus 4 sampai 6 angka.' };
  }

  const pinHash = await hashPin(pin);
  const res = await loginWithSheets(role, pinHash);

  if (res.status === 'success' && res.authenticated) {
    setAuthSession(role, res.user?.role || role.toLowerCase());
    return { success: true };
  }

  return {
    success: false,
    message: res.message || 'PIN salah. Silakan coba lagi.',
  };
}

/**
 * Changes a user's PIN centrally in Google Spreadsheet after validating old PIN & new PIN inputs.
 */
export async function changePin(
  role: JudgeRole,
  oldPin: string,
  newPin: string,
  confirmNewPin: string
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Browser API tidak tersedia' };
  }

  // Validate new PIN format (4 to 6 digits)
  if (!/^\d{4,6}$/.test(oldPin)) {
    return { success: false, error: 'PIN lama harus 4 sampai 6 angka.' };
  }

  if (!/^\d{4,6}$/.test(newPin)) {
    return { success: false, error: 'PIN baru harus 4 sampai 6 angka.' };
  }

  // Validate new PIN != old PIN
  if (oldPin === newPin) {
    return { success: false, error: 'PIN baru tidak boleh sama dengan PIN lama.' };
  }

  // Validate confirmation match
  if (newPin !== confirmNewPin) {
    return { success: false, error: 'Konfirmasi PIN baru tidak sama.' };
  }

  const oldPinHash = await hashPin(oldPin);
  const newPinHash = await hashPin(newPin);

  const res = await changePinInSheets(role, oldPinHash, newPinHash);

  if (res.status === 'success') {
    return { success: true };
  }

  return {
    success: false,
    error: res.message || 'Gagal mengubah PIN. Silakan coba lagi.',
  };
}

/**
 * Gets currently authenticated role from active session.
 */
export function getAuthSession(): JudgeRole | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (parsed && parsed.loggedIn && ['Kenji', 'Ukey', 'Revan', 'Admin'].includes(parsed.username)) {
      return parsed.username;
    }
  } catch {
    // If stored as raw string for backward compatibility
    if (['Kenji', 'Ukey', 'Revan', 'Admin'].includes(raw)) {
      return raw as JudgeRole;
    }
  }

  return null;
}

/**
 * Sets auth session and updates active judge in storage.
 */
export function setAuthSession(role: JudgeRole, roleCategory = 'user'): void {
  if (typeof window === 'undefined') return;
  const session: AuthSession = {
    username: role,
    role: roleCategory,
    loggedIn: true,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  setStoredJudge(role);
}

/**
 * Clears current session (Logout).
 */
export function logoutSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}
