import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { SmoothScrollView } from '@/components/common/SmoothScrollView';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { Box } from '@gluestack-ui/themed';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppHeader } from '@/components/common/AppHeader';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { ChequeReturnReceiptView } from '@/components/customers/ChequeReturnReceiptView';
import { useErrorDialog } from '@/context/ErrorDialogContext';
import { usePosSettings } from '@/context/PosSettingsContext';
import {
  downloadReceiptAsImage,
  shareReceiptImageFile,
} from '@/utils/receiptImageShare';
import { buildPrintHeaderFromSettings } from '@/utils/receiptPrintCustomization';
import { TAB_BAR_SCROLL_PADDING } from '@/theme';
import type { HomeStackParamList } from '@/navigation/types';

type Route = RouteProp<HomeStackParamList, 'ChequeReturnReceipt'>;

/** Image-only receipt for a cheque return (bounced cheque) — download/share,
 * no Bluetooth thermal print support for this one. */
export const ChequeReturnReceiptScreen: React.FC = () => {
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const { settings } = usePosSettings();
  const { showError } = useErrorDialog();
  const [savingImage, setSavingImage] = useState(false);
  const receiptShotRef = useRef<ViewShotRef>(null);

  const header = buildPrintHeaderFromSettings(settings);
  const { result } = params.receipt;

  const handleDownloadImage = async () => {
    setSavingImage(true);
    try {
      const message = await downloadReceiptAsImage(receiptShotRef, params.receipt);
      showError({ title: 'Image saved', message, variant: 'info', confirmLabel: 'OK' });
    } catch (e) {
      showError({
        title: 'Download failed',
        message: e instanceof Error ? e.message : 'Could not save receipt image',
        variant: 'warning',
      });
    } finally {
      setSavingImage(false);
    }
  };

  const handleShareImage = async () => {
    setSavingImage(true);
    try {
      await shareReceiptImageFile(receiptShotRef, params.receipt);
    } catch (e) {
      showError({
        title: 'Share failed',
        message: e instanceof Error ? e.message : 'Could not share receipt image',
        variant: 'warning',
      });
    } finally {
      setSavingImage(false);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader
        title="Cheque return receipt"
        subtitle={result.customer.customer_name}
        showBack
      />

      <SmoothScrollView
        contentContainerStyle={{ padding: 16, alignItems: 'center' }}
        contentPaddingBottom={TAB_BAR_SCROLL_PADDING}>
        <View style={{ width: '100%', maxWidth: 400 }} collapsable={false}>
          <ViewShot
            ref={receiptShotRef}
            options={{ format: 'png', quality: 1, result: 'tmpfile' }}
            style={{ backgroundColor: '#fff' }}>
            <ChequeReturnReceiptView result={result} header={header} settings={settings} />
          </ViewShot>
        </View>

        <Box w="100%" maxWidth={400} gap="$2" mt="$3">
          <PrimaryButton
            label={savingImage ? 'Saving…' : 'Download receipt image'}
            variant="outline"
            onPress={handleDownloadImage}
            loading={savingImage}
          />
          <PrimaryButton
            label="Share receipt image"
            variant="outline"
            onPress={handleShareImage}
            disabled={savingImage}
          />
          <PrimaryButton label="Done" onPress={() => navigation.goBack()} />
        </Box>
      </SmoothScrollView>
    </ScreenContainer>
  );
};
