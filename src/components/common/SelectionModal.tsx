import React, { useEffect, useState } from 'react';
import { Modal, TextInput, TouchableOpacity, StyleSheet, View } from 'react-native';
import { SmoothFlatList } from '@/components/common/SmoothFlatList';
import { Box, Text } from '@gluestack-ui/themed';
import { Search, X } from 'lucide-react-native';
import { colors, appInputPlaceholderColor } from '@/theme';

export interface SelectionOption {
  id: string;
  label: string;
  subtitle?: string;
}

interface SelectionModalProps {
  visible: boolean;
  title: string;
  options: SelectionOption[];
  onSelect: (option: SelectionOption) => void;
  onClose: () => void;
  emptyMessage?: string;
  footerActionLabel?: string;
  onFooterAction?: () => void;
  /** Optional content rendered between the title bar and the list — e.g. a filter row. */
  headerExtra?: React.ReactNode;
  /** Shows a search box above the list that filters options by label/subtitle as
   * the user types — useful once the option list grows large (e.g. customers). */
  searchable?: boolean;
  searchPlaceholder?: string;
}

export const SelectionModal: React.FC<SelectionModalProps> = ({
  visible,
  title,
  options,
  onSelect,
  onClose,
  emptyMessage = 'No options found',
  footerActionLabel,
  onFooterAction,
  headerExtra,
  searchable = false,
  searchPlaceholder = 'Search…',
}) => {
  const [query, setQuery] = useState('');

  // Start fresh each time the modal opens instead of carrying over a leftover
  // search from the last time it was used.
  useEffect(() => {
    if (visible) {
      setQuery('');
    }
  }, [visible]);

  const trimmedQuery = query.trim().toLowerCase();
  const filteredOptions =
    searchable && trimmedQuery
      ? options.filter(
          option =>
            option.label.toLowerCase().includes(trimmedQuery) ||
            (option.subtitle?.toLowerCase().includes(trimmedQuery) ?? false),
        )
      : options;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Box bg={colors.white} borderTopLeftRadius={20} borderTopRightRadius={20} flex={1} mt="30%">
          <Box
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            px="$4"
            py="$3"
            borderBottomWidth={1}
            borderColor={colors.border}>
            <Text size="lg" fontWeight="$bold" color={colors.text}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </Box>
          {searchable ? (
            <Box
              flexDirection="row"
              alignItems="center"
              gap="$2"
              mx="$4"
              mt="$3"
              mb="$1"
              px="$3"
              borderWidth={1}
              borderColor={colors.border}
              borderRadius="$lg"
              bg={colors.backgroundAlt}>
              <Search size={16} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={appInputPlaceholderColor}
                style={styles.searchInput}
              />
            </Box>
          ) : null}
          {headerExtra}
          {footerActionLabel && onFooterAction ? (
            <TouchableOpacity style={styles.footerAction} onPress={onFooterAction}>
              <Text fontWeight="$bold" color={colors.primary}>
                {footerActionLabel}
              </Text>
            </TouchableOpacity>
          ) : null}
          <SmoothFlatList
            data={filteredOptions}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text textAlign="center" color={colors.textMuted} py="$8">
                {searchable && trimmedQuery ? 'No matches found' : emptyMessage}
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}>
                <Text fontWeight="$semibold" color={colors.text}>
                  {item.label}
                </Text>
                {item.subtitle ? (
                  <Text size="sm" color={colors.textMuted} mt="$0.5">
                    {item.subtitle}
                  </Text>
                ) : null}
              </TouchableOpacity>
            )}
          />
        </Box>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  list: {
    paddingBottom: 32,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  footerAction: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.primarySoft,
  },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
