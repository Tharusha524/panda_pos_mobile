import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Lock } from 'lucide-react-native';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { ScreenTopBar } from '@/components/common/ScreenTopBar';
import { LOCKED_MESSAGE } from '@/constants/mobilePermissions';
import { useMobileAccess } from '@/hooks/useMobileAccess';
import type { MobilePermissionKey } from '@/constants/mobilePermissions';
import { colors } from '@/theme';

export const LockedScreen: React.FC = () => {
  const navigation = useNavigation();

  return (
    <ScreenContainer edges={['top']}>
      {navigation.canGoBack() ? <ScreenTopBar /> : null}
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Lock size={34} color={colors.textMuted} strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>Locked</Text>
        <Text style={styles.message}>{LOCKED_MESSAGE}</Text>
      </View>
    </ScreenContainer>
  );
};

/**
 * Wraps a stack screen so it renders the locked page instead when the user's
 * role doesn't allow it — covers every way of reaching the screen.
 */
export function withMobileAccess<P extends object, Params = undefined>(
  Screen: React.ComponentType<P>,
  required: (params: Params | undefined) => MobilePermissionKey | null,
): React.FC<P> {
  const Guarded: React.FC<P> = props => {
    const route = useRoute();
    const { can } = useMobileAccess();
    const key = required(route.params as Params | undefined);
    if (key && !can(key)) {
      return <LockedScreen />;
    }
    return <Screen {...props} />;
  };
  Guarded.displayName = `withMobileAccess(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return Guarded;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  message: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
