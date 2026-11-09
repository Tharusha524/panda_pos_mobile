import { useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useErrorDialog } from '@/context/ErrorDialogContext';
import {
  LOCKED_MESSAGE,
  LOCKED_TITLE,
  type MobilePermissionKey,
} from '@/constants/mobilePermissions';

export const isMobileAllowed = (
  access: Record<string, boolean> | undefined,
  key: MobilePermissionKey,
): boolean => {
  // Older server without mobile permissions → everything stays allowed.
  if (!access) {
    return true;
  }
  return access[key] === true;
};

export const useMobileAccess = () => {
  const { user } = useAuth();
  const { showError } = useErrorDialog();
  const access = user?.mobile_access;

  const can = useCallback(
    (key: MobilePermissionKey) => isMobileAllowed(access, key),
    [access],
  );

  const showLocked = useCallback(() => {
    showError({ title: LOCKED_TITLE, message: LOCKED_MESSAGE, variant: 'warning' });
  }, [showError]);

  /** Runs `action` when allowed, otherwise shows the locked message. */
  const guard = useCallback(
    <A extends unknown[]>(key: MobilePermissionKey, action: (...args: A) => void) =>
      (...args: A) => {
        if (isMobileAllowed(access, key)) {
          action(...args);
        } else {
          showLocked();
        }
      },
    [access, showLocked],
  );

  return useMemo(() => ({ can, guard, showLocked }), [can, guard, showLocked]);
};
