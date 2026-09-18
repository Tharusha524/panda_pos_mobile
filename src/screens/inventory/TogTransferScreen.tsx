import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, HStack, Text, VStack } from '@gluestack-ui/themed';
import { ArrowLeftRight, Minus, Plus, Search, Trash2 } from 'lucide-react-native';
import { SmoothScrollView } from '@/components/common/SmoothScrollView';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppHeader } from '@/components/common/AppHeader';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SelectionModal, type SelectionOption } from '@/components/common/SelectionModal';
import { useErrorDialog } from '@/context/ErrorDialogContext';
import { useToast } from '@/context/ToastContext';
import { stockTransferService } from '@/services/api/stockTransferService';
import type { StockTransferItemOption } from '@/types/stockTransfer';
import {
  colors,
  shadows,
  typography,
  appInputStyle,
  appInputPlaceholderColor,
  TAB_BAR_BOTTOM_MARGIN,
} from '@/theme';

interface DraftLine {
  item: StockTransferItemOption;
  qty: string;
}

export const TogTransferScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { showErrorFromUnknown } = useErrorDialog();
  const { showSuccess } = useToast();

  const [loadingContext, setLoadingContext] = useState(true);
  const [locations, setLocations] = useState<string[]>([]);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [pickerFor, setPickerFor] = useState<'from' | 'to' | null>(null);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StockTransferItemOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ctx = await stockTransferService.context();
        setLocations(ctx.locations ?? []);
        if (ctx.locations?.length) {
          setFromLocation(ctx.locations[0]);
          setToLocation(ctx.locations[1] ?? ctx.locations[0]);
        }
      } catch (e) {
        showErrorFromUnknown(e, 'Load stock transfer');
      } finally {
        setLoadingContext(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!fromLocation) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const items = await stockTransferService.search(search, fromLocation, toLocation);
        if (!cancelled) setResults(items);
      } catch (e) {
        if (!cancelled) showErrorFromUnknown(e, 'Search items');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, fromLocation, toLocation]);

  const locationOptions: SelectionOption[] = useMemo(
    () => locations.map(loc => ({ id: loc, label: loc })),
    [locations],
  );

  const addLine = (item: StockTransferItemOption) => {
    setLines(prev => {
      if (prev.some(l => l.item.id === item.id)) return prev;
      return [...prev, { item, qty: '1' }];
    });
  };

  const removeLine = (id: number) => {
    setLines(prev => prev.filter(l => l.item.id !== id));
  };

  const updateQty = (id: number, qty: string) => {
    setLines(prev => prev.map(l => (l.item.id === id ? { ...l, qty } : l)));
  };

  const bumpQty = (id: number, delta: number) => {
    setLines(prev =>
      prev.map(l => {
        if (l.item.id !== id) return l;
        const current = parseInt(l.qty, 10) || 0;
        const next = Math.max(1, Math.min(l.item.qty, current + delta));
        return { ...l, qty: String(next) };
      }),
    );
  };

  const canSubmit =
    !!fromLocation &&
    !!toLocation &&
    fromLocation !== toLocation &&
    lines.length > 0 &&
    lines.every(l => {
      const qty = parseInt(l.qty, 10);
      return qty > 0 && qty <= l.item.qty;
    });

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      await stockTransferService.transfer({
        from_location: fromLocation,
        to_location: toLocation,
        notes: notes.trim() || undefined,
        lines: lines.map(l => ({ item_id: l.item.id, qty: parseInt(l.qty, 10) })),
      });
      showSuccess('Stock transferred successfully');
      setLines([]);
      setNotes('');
      setSearch('');
    } catch (e) {
      showErrorFromUnknown(e, 'Transfer stock');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingContext) {
    return (
      <ScreenContainer>
        <AppHeader title="TOG transfer" subtitle="Transfer of goods" showBack />
        <Box flex={1} alignItems="center" justifyContent="center">
          <ActivityIndicator color={colors.primary} />
        </Box>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AppHeader title="TOG transfer" subtitle="Move stock between branches" showBack />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}>
        <SmoothScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: TAB_BAR_BOTTOM_MARGIN + 32 },
          ]}
          keyboardShouldPersistTaps="handled">
          <HStack space="sm" alignItems="center" mb="$3">
            <TouchableOpacity
              style={styles.locationBox}
              onPress={() => setPickerFor('from')}>
              <Text style={styles.locationLabel}>From</Text>
              <Text style={styles.locationValue} numberOfLines={1}>
                {fromLocation || 'Select'}
              </Text>
            </TouchableOpacity>
            <Box>
              <ArrowLeftRight size={20} color={colors.textMuted} />
            </Box>
            <TouchableOpacity style={styles.locationBox} onPress={() => setPickerFor('to')}>
              <Text style={styles.locationLabel}>To</Text>
              <Text style={styles.locationValue} numberOfLines={1}>
                {toLocation || 'Select'}
              </Text>
            </TouchableOpacity>
          </HStack>
          {fromLocation && toLocation && fromLocation === toLocation ? (
            <Text style={styles.warningText}>From and To locations must be different.</Text>
          ) : null}

          <View style={styles.searchWrap}>
            <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search items to transfer"
              placeholderTextColor={appInputPlaceholderColor}
              style={[appInputStyle, styles.searchInput]}
            />
          </View>

          {searching ? (
            <ActivityIndicator style={{ marginVertical: 8 }} color={colors.primary} />
          ) : (
            results
              .filter(item => !lines.some(l => l.item.id === item.id))
              .map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.resultRow}
                  onPress={() => addLine(item)}>
                  <VStack flex={1}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {item.description}
                    </Text>
                    <Text style={styles.resultMeta}>
                      {item.item_number} • {item.qty} {item.uom} available
                    </Text>
                  </VStack>
                  <Plus size={18} color={colors.primary} />
                </TouchableOpacity>
              ))
          )}

          {lines.length > 0 ? (
            <VStack space="sm" mt="$4">
              <Text style={styles.sectionTitle}>Items to transfer</Text>
              {lines.map(line => (
                <View key={line.item.id} style={styles.lineCard}>
                  <HStack alignItems="center" justifyContent="space-between">
                    <VStack flex={1} pr="$2">
                      <Text style={styles.resultName} numberOfLines={1}>
                        {line.item.description}
                      </Text>
                      <Text style={styles.resultMeta}>
                        {line.item.item_number} • max {line.item.qty} {line.item.uom}
                      </Text>
                    </VStack>
                    <TouchableOpacity onPress={() => removeLine(line.item.id)}>
                      <Trash2 size={18} color={colors.error} />
                    </TouchableOpacity>
                  </HStack>
                  <HStack alignItems="center" space="sm" mt="$2">
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => bumpQty(line.item.id, -1)}>
                      <Minus size={16} color={colors.text} />
                    </TouchableOpacity>
                    <TextInput
                      value={line.qty}
                      onChangeText={t => updateQty(line.item.id, t.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      style={styles.qtyInput}
                    />
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => bumpQty(line.item.id, 1)}>
                      <Plus size={16} color={colors.text} />
                    </TouchableOpacity>
                  </HStack>
                  {(() => {
                    const qty = parseInt(line.qty, 10);
                    if (!qty || qty <= 0) {
                      return <Text style={styles.lineWarning}>Enter a quantity.</Text>;
                    }
                    if (qty > line.item.qty) {
                      return (
                        <Text style={styles.lineWarning}>
                          Only {line.item.qty} {line.item.uom} available.
                        </Text>
                      );
                    }
                    return null;
                  })()}
                </View>
              ))}
            </VStack>
          ) : null}

          <Text style={styles.sectionTitle}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Lorry loading for delivery run"
            placeholderTextColor={appInputPlaceholderColor}
            style={[appInputStyle, styles.notesInput]}
            multiline
          />

          <View style={styles.submitWrap}>
            <PrimaryButton
              label="Transfer stock"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
            />
          </View>
        </SmoothScrollView>
      </KeyboardAvoidingView>

      <SelectionModal
        visible={pickerFor != null}
        title={pickerFor === 'from' ? 'From location' : 'To location'}
        options={locationOptions}
        onSelect={opt => {
          if (pickerFor === 'from') setFromLocation(opt.id);
          else if (pickerFor === 'to') setToLocation(opt.id);
          setPickerFor(null);
        }}
        onClose={() => setPickerFor(null)}
      />

      {submitting ? <LoadingOverlay /> : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16 },
  locationBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
  },
  locationLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontSize: 10,
  },
  locationValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginTop: 2,
  },
  warningText: {
    ...typography.caption,
    color: colors.error,
    marginBottom: 8,
  },
  searchWrap: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 8,
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 38,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 6,
    ...shadows.sm,
  },
  resultName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  resultMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  lineCard: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 16,
    padding: 12,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    ...appInputStyle,
    width: 72,
    textAlign: 'center',
    paddingVertical: 8,
  },
  lineWarning: {
    ...typography.caption,
    color: colors.error,
    marginTop: 6,
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  submitWrap: {
    marginTop: 20,
  },
});
