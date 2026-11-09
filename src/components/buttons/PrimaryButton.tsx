import React from 'react';
import { StyleSheet } from 'react-native';
import { Pressable, Text, ActivityIndicator, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { colors, shadows, typography } from '@/theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'outlineLight' | 'ghost' | 'light';
  /** Smaller button for dialogs/modals (no bottom margin). */
  compact?: boolean;
  /** Greyed with a lock icon — still pressable so the caller can show the locked message. */
  locked?: boolean;
}

const LabelText: React.FC<{ label: string; style: object; locked: boolean; color: string }> = ({
  label,
  style,
  locked,
  color,
}) =>
  locked ? (
    <View style={styles.lockedRow}>
      <Lock size={15} color={color} strokeWidth={2.6} />
      <Text style={style}>{label}</Text>
    </View>
  ) : (
    <Text style={style}>{label}</Text>
  );

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  compact = false,
  locked = false,
}) => {
  const isDisabled = disabled || loading;

  if (variant === 'outline') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={[
          styles.base,
          compact && styles.compact,
          styles.outline,
          isDisabled && styles.disabled,
          locked && styles.locked,
        ]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <LabelText label={label} style={styles.outlineText} locked={locked} color={colors.primary} />
        )}
      </Pressable>
    );
  }

  if (variant === 'outlineLight') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={[
          styles.base,
          compact && styles.compact,
          styles.outlineLight,
          isDisabled && styles.disabled,
          locked && styles.locked,
        ]}>
        {loading ? (
          <ActivityIndicator color={colors.textOnDark} />
        ) : (
          <LabelText label={label} style={styles.outlineLightText} locked={locked} color={colors.textOnDark} />
        )}
      </Pressable>
    );
  }

  if (variant === 'ghost') {
    return (
      <Pressable onPress={onPress} disabled={isDisabled} style={[styles.ghost, locked && styles.locked]}>
        <LabelText label={label} style={styles.ghostText} locked={locked} color={colors.textMuted} />
      </Pressable>
    );
  }

  if (variant === 'light') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={[styles.base, compact && styles.compact, styles.light, shadows.md, isDisabled && styles.disabled, locked && styles.locked]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <LabelText label={label} style={styles.lightText} locked={locked} color={colors.primary} />
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        compact && styles.compact,
        styles.primary,
        shadows.md,
        isDisabled && styles.disabled,
          locked && styles.locked,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.textOnPrimary} />
      ) : (
        <LabelText label={label} style={styles.primaryText} locked={locked} color={colors.textOnPrimary} />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    width: '100%',
    marginBottom: 12,
    borderRadius: 999,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    height: 46,
    marginBottom: 0,
    borderRadius: 10,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  outline: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  outlineText: {
    ...typography.button,
    color: colors.primary,
  },
  outlineLight: {
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: 'transparent',
  },
  outlineLightText: {
    ...typography.button,
    color: colors.textOnDark,
  },
  light: {
    backgroundColor: colors.white,
  },
  lightText: {
    ...typography.button,
    color: colors.primary,
  },
  ghost: {
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 4,
  },
  ghostText: {
    fontFamily: typography.bodyMedium.fontFamily,
    fontWeight: typography.bodyMedium.fontWeight,
    fontSize: 15,
    color: colors.textMuted,
  },
  disabled: {
    opacity: 0.55,
    backgroundColor: colors.textMuted,
  },
  locked: {
    opacity: 0.45,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
