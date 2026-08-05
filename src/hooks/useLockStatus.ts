'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getLockStatusFromSheets } from '@/lib/google-sheets';

/**
 * Lock sync status badge states:
 * - 'checking'  -> first poll in progress
 * - 'open'      -> locked === false
 * - 'locked'    -> locked === true
 * - 'error'     -> polling failed (retain last known state)
 */
export type LockSyncStatus = 'checking' | 'open' | 'locked' | 'error';

interface UseLockStatusOptions {
  round: string;
  participantName: string;
  judge: string;
  onLocked?: () => void;
  onUnlocked?: () => void;
  pollIntervalMs?: number;
  enabled?: boolean;
}

interface UseLockStatusResult {
  locked: boolean;
  syncStatus: LockSyncStatus;
  isInitializing: boolean;
  refetch: () => Promise<void>;
}

export function useLockStatus({
  round,
  participantName,
  judge,
  onLocked,
  onUnlocked,
  pollIntervalMs = 2000,
  enabled = true,
}: UseLockStatusOptions): UseLockStatusResult {
  const [locked, setLocked] = useState(false);
  const [syncStatus, setSyncStatus] = useState<LockSyncStatus>('checking');
  const [isInitializing, setIsInitializing] = useState(true);

  const prevLockedRef = useRef<boolean | null>(null);
  const isFetchingRef = useRef(false);

  const fetchLockStatus = useCallback(async () => {
    if (!enabled || !round || !participantName || !judge) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const result = await getLockStatusFromSheets(round, participantName, judge);

      if (result.status === 'error') {
        setSyncStatus('error');
        return;
      }

      const newLocked = result.locked === true;
      setLocked(newLocked);
      setSyncStatus(newLocked ? 'locked' : 'open');

      if (prevLockedRef.current !== null && prevLockedRef.current !== newLocked) {
        if (newLocked) {
          onLocked?.();
        } else {
          onUnlocked?.();
        }
      }
      prevLockedRef.current = newLocked;
    } catch {
      setSyncStatus('error');
    } finally {
      isFetchingRef.current = false;
      setIsInitializing(false);
    }
  }, [round, participantName, judge, enabled, onLocked, onUnlocked]);

  useEffect(() => {
    if (!enabled || !round || !participantName || !judge) return;

    setSyncStatus('checking');
    setIsInitializing(true);
    prevLockedRef.current = null;

    fetchLockStatus();

    const intervalId = setInterval(fetchLockStatus, pollIntervalMs);

    return () => {
      clearInterval(intervalId);
      isFetchingRef.current = false;
    };
  }, [round, participantName, judge, enabled, pollIntervalMs]);

  return {
    locked,
    syncStatus,
    isInitializing,
    refetch: fetchLockStatus,
  };
}
