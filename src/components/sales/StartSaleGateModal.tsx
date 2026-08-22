import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Box, HStack, Pressable, Text, VStack } from '@gluestack-ui/themed';
import { ChevronRight, MapPin, User } from 'lucide-react-native';
import { SelectionModal, type SelectionOption } from '@/components/common/SelectionModal';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { colors } from '@/theme';
import { formatCurrency } from '@/utils/format';
import type { CustomerSummary } from '@/types/sales';

interface StartSaleGateModalProps {
  visible: boolean;
  routeOptions: string[];
  route: string | null;
  onSelectRoute: (route: string | null) => void;
  customers: CustomerSummary[];
  customer: CustomerSummary | null;
  onSelectCustomer: (customer: CustomerSummary | null) => void;
  onNewCustomer: () => void;
  onConfirm: () => void;
  currency: string;
}

/**
 * Gate shown before a brand-new sale starts — forces route + customer to be
 * picked up front. Once confirmed (onConfirm), the route is locked for the
 * rest of that sale (see usePosSale's routeLocked).
 *
 * Rendered as an in-screen overlay (not a native Modal) so it only blocks
 * this screen's own content — the bottom tab bar lives outside this screen's
 * view tree (owned by the tab navigator) and stays usable, so switching to
 * another tab is never blocked.
 */
export const StartSaleGateModal: React.FC<StartSaleGateModalProps> = ({
  visible,
  routeOptions,
  route,
  onSelectRoute,
  customers,
  customer,
  onSelectCustomer,
  onNewCustomer,
  onConfirm,
  currency,
}) => {
  const [routePickerOpen, setRoutePickerOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  const customerOptions: SelectionOption[] = useMemo(
    () => [
      { id: 'walk-in', label: 'Walk-in Customer', subtitle: 'Default' },
      ...customers
        .filter(c => !route || c.route === route)
        .map(c => {
          const balance =
            (c.net_balance ?? 0) > 0
              ? `Balance ${formatCurrency(c.net_balance, currency)}`
              : null;
          return {
            id: String(c.id),
            label: c.customer_name,
            subtitle: [c.customer_code ?? c.customer_id, c.contact_no, c.location, balance]
              .filter(Boolean)
              .join(' · '),
          };
        }),
    ],
    [customers, route, currency],
  );

  if (!visible) {
    return null;
  }

  return (
    <>
      <View style={styles.overlay}>
        <Box bg={colors.white} borderRadius={20} p="$5" mx="$4" width="100%">
          <Text size="lg" fontWeight="$bold" color={colors.text} mb="$1">
            Start new sale
          </Text>
          <Text size="sm" color={colors.textMuted} mb="$4">
            Select the route and customer for this sale.
          </Text>

          {routeOptions.length > 0 ? (
            <Pressable
              onPress={() => setRoutePickerOpen(true)}
              flexDirection="row"
              alignItems="center"
              justifyContent="space-between"
              borderWidth={1}
              borderColor={colors.primaryMuted}
              borderRadius="$xl"
              px="$3"
              py="$3"
              bg={colors.backgroundAlt}
              mb="$3">
              <HStack alignItems="center" gap="$2" flex={1}>
                <Box bg={colors.primarySoft} p="$1.5" borderRadius="$full">
                  <MapPin size={16} color={colors.primary} />
                </Box>
                <VStack>
                  <Text size="xs" color={colors.textMuted}>
                    Route
                  </Text>
                  <Text fontWeight="$semibold" color={colors.text}>
                    {route ?? 'All routes'}
                  </Text>
                </VStack>
              </HStack>
              <ChevronRight size={16} color={colors.primaryLight} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setCustomerPickerOpen(true)}
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            borderWidth={1}
            borderColor={colors.primaryMuted}
            borderRadius="$xl"
            px="$3"
            py="$3"
            bg={colors.backgroundAlt}
            mb="$5">
            <HStack alignItems="center" gap="$2" flex={1}>
              <Box bg={colors.primarySoft} p="$1.5" borderRadius="$full">
                <User size={16} color={colors.primary} />
              </Box>
              <VStack>
                <Text size="xs" color={colors.textMuted}>
                  Customer
                </Text>
                <Text fontWeight="$semibold" color={colors.text}>
                  {customer?.customer_name ?? 'Walk-in Customer'}
                </Text>
              </VStack>
            </HStack>
            <ChevronRight size={16} color={colors.primaryLight} />
          </Pressable>

          <PrimaryButton label="Start Sale" onPress={onConfirm} />
        </Box>
      </View>

      <SelectionModal
        visible={routePickerOpen}
        title="Select route"
        options={[
          { id: '__all__', label: 'All routes' },
          ...routeOptions.map(r => ({ id: r, label: r })),
        ]}
        onSelect={opt => onSelectRoute(opt.id === '__all__' ? null : opt.id)}
        onClose={() => setRoutePickerOpen(false)}
        emptyMessage="No routes"
      />

      <SelectionModal
        visible={customerPickerOpen}
        title="Select customer"
        options={customerOptions}
        onSelect={opt => {
          if (opt.id === 'walk-in') {
            onSelectCustomer({ id: 0, customer_name: 'Walk-in Customer' });
          } else {
            const found = customers.find(c => String(c.id) === opt.id);
            onSelectCustomer(found ?? null);
          }
        }}
        onClose={() => setCustomerPickerOpen(false)}
        emptyMessage="No customers"
        footerActionLabel="+ New customer"
        onFooterAction={() => {
          setCustomerPickerOpen(false);
          onNewCustomer();
        }}
        searchable
        searchPlaceholder="Search customer…"
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    elevation: 8,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});
