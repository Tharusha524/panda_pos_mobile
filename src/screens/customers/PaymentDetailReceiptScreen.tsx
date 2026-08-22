import React from 'react';
import { View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { SmoothScrollView } from '@/components/common/SmoothScrollView';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppHeader } from '@/components/common/AppHeader';
import { PaymentDetailReceiptView } from '@/components/customers/PaymentDetailReceiptView';
import { usePosSettings } from '@/context/PosSettingsContext';
import { TAB_BAR_SCROLL_PADDING } from '@/theme';
import type { HomeStackParamList } from '@/navigation/types';

type Route = RouteProp<HomeStackParamList, 'PaymentDetailReceipt'>;

export const PaymentDetailReceiptScreen: React.FC = () => {
  const { params } = useRoute<Route>();
  const { settings } = usePosSettings();

  return (
    <ScreenContainer>
      <AppHeader
        title="Payment receipt"
        subtitle={params.payment.sales_no ?? `#${params.payment.id}`}
        showBack
      />

      <SmoothScrollView
        contentContainerStyle={{ padding: 16, alignItems: 'center' }}
        contentPaddingBottom={TAB_BAR_SCROLL_PADDING}>
        <View style={{ width: '100%', maxWidth: 400 }}>
          <PaymentDetailReceiptView payment={params.payment} settings={settings} />
        </View>
      </SmoothScrollView>
    </ScreenContainer>
  );
};
