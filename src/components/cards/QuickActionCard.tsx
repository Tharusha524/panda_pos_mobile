import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { Lock, LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { cardStyles, colors, radius, typography } from '@/theme';

interface QuickActionCardProps {
  label: string;
  subtitle?: string;
  icon: ComponentType<LucideProps>;
  color?: string;
  onPress?: () => void;
  wide?: boolean;
  /** Greyed with a lock — still pressable so the caller can show the locked message. */
  locked?: boolean;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  label,
  subtitle,
  icon: Icon,
  color = colors.backgroundAlt,
  onPress,
  wide = false,
  locked = false,
}) => (
  <Card
    mode="outlined"
    style={[
      wide ? styles.wide : styles.narrow,
      cardStyles.surfaceFlat,
      styles.card,
      locked && styles.locked,
    ]}
    onPress={onPress}>
    <Card.Content style={styles.content}>
      <View style={[styles.iconWrap, { backgroundColor: color }]}>
        <Icon size={22} color={colors.text} strokeWidth={2.35} />
        {locked ? (
          <View style={styles.lockBadge}>
            <Lock size={10} color={colors.white} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <View style={styles.textCol}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Card.Content>
  </Card>
);

const styles = StyleSheet.create({
  card: {
    marginBottom: 0,
    borderColor: colors.border,
  },
  locked: {
    opacity: 0.5,
  },
  lockBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wide: {
    width: '48%',
  },
  narrow: {
    width: '31%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...typography.label,
    color: colors.text,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
