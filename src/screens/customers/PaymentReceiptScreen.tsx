import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { SmoothScrollView } from '@/components/common/SmoothScrollView';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { Box, Text } from '@gluestack-ui/themed';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppHeader } from '@/components/common/AppHeader';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { PaymentReceiptView } from '@/components/customers/PaymentReceiptView';
import { ReceiptActions } from '@/components/sales/ReceiptBottomBar';
import { useErrorDialog } from '@/context/ErrorDialogContext';
import { usePosSettings } from '@/context/PosSettingsContext';
import { bluetoothPrintService } from '@/services/bluetooth/bluetoothPrintService';
import { navigateToPrinterSetup } from '@/navigation/navigationRef';
import {
  captureReceiptBase64,
  downloadReceiptAsImage,
  shareReceiptImageFile,
} from '@/utils/receiptImageShare';
import { getReceiptPrintCustomization, buildPrintHeaderFromSettings } from '@/utils/receiptPrintCustomization';
import { colors, TAB_BAR_SCROLL_PADDING } from '@/theme';
import type { HomeStackParamList } from '@/navigation/types';

type Route = RouteProp<HomeStackParamList, 'PaymentReceipt'>;

const isPrinterSetupError = (msg: string): boolean =>
  /no printer|not configured|settings/i.test(msg);

/** Review + print screen for a "receive payment" receipt — same content the old
 * text-only receipt printed, now routed through the image-receipt preview/print
 * flow shared with sale receipts. */
export const PaymentReceiptScreen: React.FC = () => {
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const { settings } = usePosSettings();
  const { showError, showConfirm } = useErrorDialog();
  const [printing, setPrinting] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const receiptShotRef = useRef<ViewShotRef>(null);

  const canPrint = bluetoothPrintService.isSupported();
  const header = buildPrintHeaderFromSettings(settings);
  const { result, notes } = params.receipt;
  const { pendingConfirm } = params;

  const handleConfirmPending = async () => {
    if (!pendingConfirm) {
      return;
    }
    setConfirming(true);
    try {
      await pendingConfirm.onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const promptPrinterSetup = (message: string) => {
    showConfirm({
      title: 'Printer not set up',
      message,
      confirmLabel: 'Open printer setup',
      cancelLabel: 'Cancel',
      onConfirm: () => navigateToPrinterSetup(),
    });
  };

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

  const handlePrint = async () => {
    setPrinting(true);
    try {
      let capturedImageBase64: string | undefined;
      try {
        const customization = await getReceiptPrintCustomization(settings);
        if (customization.printAsImage) {
          capturedImageBase64 = await captureReceiptBase64(receiptShotRef);
        }
      } catch {
        // Couldn't read the setting or capture the preview — fall back to the
        // normal text receipt below instead of blocking the print entirely.
      }
      await bluetoothPrintService.printPaymentReceipt(
        result,
        header,
        notes,
        settings,
        capturedImageBase64,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Print failed';
      if (isPrinterSetupError(msg)) {
        promptPrinterSetup(
          `${msg}\n\nConfigure your portable printer once in Settings → Receipt printer.`,
        );
      } else {
        showError({ title: 'Print', message: msg, variant: 'warning' });
      }
    } finally {
      setPrinting(false);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader
        title={pendingConfirm ? pendingConfirm.title : 'Payment receipt'}
        subtitle={result.customer.customer_name}
        showBack
      />

      {pendingConfirm ? (
        <Box px="$4" pt="$2">
          <Text size="xs" color={colors.textMuted}>
            Please check every detail below — this cannot be edited after it&apos;s
            confirmed.
          </Text>
        </Box>
      ) : null}

      <SmoothScrollView
        contentContainerStyle={{ padding: 16, alignItems: 'center' }}
        contentPaddingBottom={TAB_BAR_SCROLL_PADDING}>
        <View style={{ width: '100%', maxWidth: 400 }} collapsable={false}>
          <ViewShot
            ref={receiptShotRef}
            options={{ format: 'png', quality: 1, result: 'tmpfile' }}
            style={{ backgroundColor: '#fff' }}>
            <PaymentReceiptView result={result} notes={notes} header={header} settings={settings} />
          </ViewShot>
        </View>

        <Box w="100%" maxWidth={400} gap="$2" mt="$3">
          {pendingConfirm ? (
            <>
              <PrimaryButton
                label={pendingConfirm.confirmLabel}
                onPress={handleConfirmPending}
                loading={confirming}
              />
              <PrimaryButton
                label="Edit"
                variant="outline"
                onPress={pendingConfirm.onEdit}
                disabled={confirming}
              />
            </>
          ) : (
            <>
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

              <ReceiptActions
                showPrint={canPrint}
                onPrint={canPrint ? handlePrint : undefined}
                onNewSale={() => navigation.goBack()}
                secondaryLabel="Done"
                printLoading={printing}
              />
            </>
          )}
        </Box>
      </SmoothScrollView>
    </ScreenContainer>
  );
};
