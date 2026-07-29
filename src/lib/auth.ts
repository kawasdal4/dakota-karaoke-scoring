import { JudgeRole } from '@/types';
import { setStoredJudge } from './storage';

const KEYS = {
  PIN_HASHES: 'dakota_pin_hashes',
  SESSION: 'dakota_auth_session',
};

// Initial default PINs
const DEFAULT_PINS: Record<JudgeRole, string> = {
  Kenji: '1234',
  Ukey: '1234',
  Revan: '1234',
  Admin: '123456',
};

/**
 * Generates SHA-256 hash using Web Crypto API.
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`dakota_salt_${pin}`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Initializes default PIN hashes in localStorage if not already set.
 */
export async function ensurePinHashesInitialized(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  
  const existing = localStorage.getItem(KEYS.PIN_HASHES);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      // re-initialize if corrupted
    }
  }

  const hashes: Record<string, string> = {};
  for (const role of ['Kenji', 'Ukey', 'Revan', 'Admin'] as JudgeRole[]) {
    hashes[role] = await hashPin(DEFAULT_PINS[role]);
  }

  localStorage.setItem(KEYS.PIN_HASHES, JSON.stringify(hashes));
  return hashes;
}

/**
 * Verifies if the entered PIN matches the stored hash for the role.
 */
export async function verifyPin(role: JudgeRole, pin: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!/^\d{4,6}$/.test(pin)) return false;

  const hashes = await ensurePinHashesInitialized();
  const inputHash = await hashPin(pin);
  return hashes[role] === inputHash;
}

/**
 * Changes a user's PIN after validating old PIN, new PIN specs, and mismatch rules.
 */
export async function changePin(
  role: JudgeRole,
  oldPin: string,
  newPin: string,
  confirmNewPin: string
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'Browser API tidak tersedia' };

  // Validate old PIN
  const isOldValid = await verifyPin(role, oldPin);
  if (!isOldValid) {
    return { success: false, error: 'PIN lama tidak sesuai.' };
  }

  // Validate new PIN format (4 to 6 digits)
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

  // Update hash
  const hashes = await ensurePinHashesInitialized();
  hashes[role] = await hashPin(newPin);
  localStorage.setItem(KEYS.PIN_HASHES, JSON.stringify(hashes));

  return { success: true };
}

/**
 * Gets currently authenticated role from session.
 */
export function getAuthSession(): JudgeRole | null {
  if (typeof window === 'undefined') return null;
  const role = localStorage.getItem(KEYS.SESSION) as JudgeRole | null;
  if (role && ['Kenji', 'Ukey', 'Revan', 'Admin'].includes(role)) {
    return role;
  }
  return null;
}

/**
 * Sets auth session and updates active judge in storage.
 */
export function setAuthSession(role: JudgeRole): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.SESSION, role);
  setStoredJudge(role);
}

/**
 * Clears current session (Logout).
 */
export function logoutSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEYS.SESSION);
}
