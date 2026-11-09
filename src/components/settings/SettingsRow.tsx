import React from 'react';
import { ChevronRight, Lock, LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { HStack, Pressable, Text, VStack } from '@gluestack-ui/themed';
import { colors, radius } from '@/theme';

interface SettingsRowProps {
  icon: ComponentType<LucideProps>;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  /** Greyed with a lock — still pressable so the caller can show the locked message. */
  locked?: boolean;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon: Icon,
  iconColor = colors.text,
  iconBg = colors.backgroundAlt,
  title,
  subtitle,
  onPress,
  showChevron = true,
  destructive = false,
  locked = false,
}) => (
  <Pressable
    onPress={onPress}
    disabled={!onPress}
    opacity={locked ? 0.5 : 1}
    flexDirection="row"
    alignItems="center"
    py="$3.5"
    px="$4"
    borderBottomWidth={1}
    borderBottomColor={colors.borderLight}
    $active-bg={colors.backgroundAlt}>
    <HStack alignItems="center" gap="$3" flex={1}>
      <Pressable
        w={44}
        h={44}
        borderRadius={radius.md}
        bg={destructive ? colors.errorSoft : iconBg}
        alignItems="center"
        justifyContent="center">
        <Icon size={20} color={destructive ? colors.error : iconColor} />
      </Pressable>
      <VStack flex={1}>
        <Text
          fontSize="$md"
          fontWeight="$bold"
          color={destructive ? colors.error : colors.text}>
          {title}
        </Text>
        {subtitle ? (
          <Text fontSize="$xs" color={colors.textSecondary} mt="$0.5" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </VStack>
    </HStack>
    {locked ? (
      <Lock size={18} color={colors.textMuted} />
    ) : showChevron && onPress ? (
      <ChevronRight size={20} color={colors.textMuted} />
    ) : null}
  </Pressable>
);
