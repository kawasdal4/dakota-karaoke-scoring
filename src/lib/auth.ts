import { JudgeRole } from '@/types';
import { setStoredJudge } from './storage';
import { loginWithSheets, changePinInSheets } from './google-sheets';

const SESSION_KEY = 'dakota_auth_session';

export interface AuthSession {
  username: JudgeRole;
  role: string;
  loggedIn: boolean;
}

function sha256PureJs(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j;
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash: number[] = [];
  let k: number[] = [];
  let primeCounter = 0;
  const isNotPrime: Record<number, boolean> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isNotPrime[candidate]) {
      for (i = 0; i < 300; i += candidate) {
        isNotPrime[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Generates SHA-256 hash using Web Crypto API with pure JS fallback.
 * PIN is never stored or sent in plaintext.
 */
export async function hashPin(pin: string): Promise<string> {
  const pinStr = String(pin).trim();
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(pinStr);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
    } catch (_) {}
  }
  return sha256PureJs(pinStr);
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

  try {
    const pinHash = await hashPin(pin);
    const res = await loginWithSheets(role, pinHash);

    console.log('[Dakota Auth Log]', {
      action: 'login',
      username: role,
      hashLength: pinHash.length,
      response: res,
    });

    if (res.authenticated === true || res.status === 'success') {
      setAuthSession(role, res.user?.role || (role === 'Admin' ? 'admin' : role.toLowerCase()));
      return { success: true };
    }

    return {
      success: false,
      message: res.message || 'PIN salah. Silakan coba lagi.',
    };
  } catch (err: any) {
    console.error('[Dakota Login Error]', err);
    return {
      success: false,
      message: `[Dakota Login Error]: ${err.message || String(err)}`,
    };
  }
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
