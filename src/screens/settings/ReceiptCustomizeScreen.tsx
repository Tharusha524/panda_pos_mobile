import React, { useCallback, useRef, useState } from 'react';
import { Image, Pressable, Switch, StyleSheet } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { useFocusEffect } from '@react-navigation/native';
import { Box, HStack, Text, VStack } from '@gluestack-ui/themed';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppHeader } from '@/components/common/AppHeader';
import { SmoothScrollView } from '@/components/common/SmoothScrollView';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AuthInput } from '@/components/inputs/AuthInput';
import { useErrorDialog } from '@/context/ErrorDialogContext';
import { usePosSettings } from '@/context/PosSettingsContext';
import { bluetoothPrintService } from '@/services/bluetooth/bluetoothPrintService';
import { receiptLogoStorage } from '@/services/storage/receiptLogoStorage';
import { receiptPrintStorage } from '@/services/storage/receiptPrintStorage';
import { receiptTitleImageStorage } from '@/services/storage/receiptTitleImageStorage';
import { captureFromViewShotRef } from '@/utils/receiptImageShare';
import { RECEIPT_SOFTWARE_PROVIDER, RECEIPT_SOFTWARE_WEBSITE } from '@/constants/receiptBranding';
import { pickReceiptLogoFromGallery } from '@/utils/pickReceiptLogo';
import { resolveReceiptLogo } from '@/utils/receiptLogoResolver';
import {
  DEFAULT_RECEIPT_PRINT_CUSTOMIZATION,
  type ReceiptPaperWidth,
  type ReceiptPrintCustomization,
  type ReceiptTextWeight,
  type ReceiptTitleFont,
} from '@/types/receiptPrint';
import { mergeReceiptPrintSettings } from '@/utils/receiptPrintCustomization';
import { createReceiptLayout, previewLine } from '@/utils/receiptEscPosLayout';
import { SaleReceiptView } from '@/components/sales/SaleReceiptView';
import type { SaleReceiptPayload } from '@/types/sales';
import { colors } from '@/theme';

// Sample data for the live "print as image" preview below — same numbers as the
// text-mode "Paper preview" mockup above, so the two sections stay consistent.
const IMAGE_PREVIEW_RECEIPT: SaleReceiptPayload = {
  sale: {
    sales_id: 'SAL-0001',
    sale_date: new Date().toISOString().slice(0, 10),
    location: 'Main Location',
    payment_method: 'Cash',
    sub_total: 100,
    discount: 0,
    net_amount: 100,
    amount_received: 100,
    lines: [
      {
        item_number: '1',
        description: 'Sample item',
        qty: 1,
        unit_price: 100,
        line_total: 100,
        uom: 'pcs',
      },
    ],
  },
  header: {},
};

const ChipRow: React.FC<{
  label: string;
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}> = ({ label, options, value, onChange }) => (
  <VStack mb="$4">
    <Text fontSize="$xs" fontWeight="$semibold" color="$textLight400" mb="$2">
      {label}
    </Text>
    <HStack gap="$2" flexWrap="wrap">
      {options.map(opt => (
        <Pressable
          key={opt.id}
          onPress={() => onChange(opt.id)}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: value === opt.id ? colors.primary : colors.border,
            backgroundColor: value === opt.id ? colors.primarySoft : colors.white,
          }}>
          <Text
            fontSize="$sm"
            fontWeight="$semibold"
            color={value === opt.id ? colors.primary : colors.textSecondary}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </HStack>
  </VStack>
);

const ToggleRow: React.FC<{
  label: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, subtitle, value, onChange }) => (
  <HStack
    alignItems="center"
    justifyContent="space-between"
    py="$3"
    borderBottomWidth={1}
    borderBottomColor={colors.borderLight}>
    <VStack flex={1} pr="$3">
      <Text fontSize="$sm" fontWeight="$semibold" color="$textLight0">
        {label}
      </Text>
      {subtitle ? (
        <Text fontSize="$xs" color="$textLight400" mt="$0.5">
          {subtitle}
        </Text>
      ) : null}
    </VStack>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.border, true: colors.primaryMuted }}
      thumbColor={value ? colors.primary : colors.white}
    />
  </HStack>
);

const SizeStepper: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, onChange }) => (
  <VStack mb="$4">
    <Text fontSize="$xs" fontWeight="$semibold" color="$textLight400" mb="$2">
      {label} ({value}px)
    </Text>
    <HStack alignItems="center" gap="$3">
      <Pressable
        onPress={() => onChange(Math.max(min, value - step))}
        style={styles.stepperBtn}>
        <Text fontSize="$lg" fontWeight="$bold" color={colors.primary}>
          −
        </Text>
      </Pressable>
      <Text fontSize="$sm" fontWeight="$semibold" color="$textLight0">
        {value}px
      </Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + step))}
        style={styles.stepperBtn}>
        <Text fontSize="$lg" fontWeight="$bold" color={colors.primary}>
          +
        </Text>
      </Pressable>
    </HStack>
  </VStack>
);

const WEIGHT_OPTIONS = [
  { id: 'regular', label: 'Regular' },
  { id: 'medium', label: 'Medium' },
  { id: 'bold', label: 'Bold' },
];

const TITLE_SIZE_MIN = 14;
const TITLE_SIZE_MAX = 48;
const TITLE_SIZE_STEP = 2;

export const ReceiptCustomizeScreen: React.FC = () => {
  const { settings } = usePosSettings();
  const { showError } = useErrorDialog();
  const [form, setForm] = useState<ReceiptPrintCustomization>(
    DEFAULT_RECEIPT_PRINT_CUSTOMIZATION,
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreviewUri, setLogoPreviewUri] = useState<string | null>(null);
  const titleShotRef = useRef<ViewShotRef>(null);

  const load = useCallback(async () => {
    const saved = await receiptPrintStorage.get();
    setForm(mergeReceiptPrintSettings(settings, saved));
    const logo = await resolveReceiptLogo(null, settings);
    setLogoPreviewUri(logo?.displayUri ?? null);
  }, [settings]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const patch = (partial: Partial<ReceiptPrintCustomization>) => {
    setForm(prev => ({ ...prev, ...partial }));
  };

  const companyName =
    settings?.printHeader?.company_name ?? settings?.company?.name ?? 'Your Store';
  const serverLogoUrl =
    settings?.printHeader?.logo_url ?? settings?.company?.logo_url ?? null;
  const layout = createReceiptLayout(form);
  const previewTitle = previewLine(layout, companyName, form.headerAlign);
  const previewFooter = previewLine(layout, form.footerMessage, form.headerAlign);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (form.titleFont === 'custom') {
        // Snapshot the live-sized preview below and cache it — this image is what
        // actually prints in place of the plain-text title (see bluetoothPrintService).
        const uri = await captureFromViewShotRef(titleShotRef);
        await receiptTitleImageStorage.saveFromUri(uri);
      } else {
        // Not in custom mode — clear any previously cached image so it can't be
        // used stale if custom mode is picked again later without resaving.
        await receiptTitleImageStorage.clear();
      }
      await receiptPrintStorage.save(form);
      showError({
        title: 'Saved',
        message: 'Receipt print layout saved on this device.',
        variant: 'info',
        confirmLabel: 'OK',
      });
    } catch (e) {
      showError({
        title: 'Save failed',
        message: e instanceof Error ? e.message : 'Could not save',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    await receiptPrintStorage.reset();
    await receiptTitleImageStorage.clear();
    await load();
  };

  const handleUploadLogo = async () => {
    setUploadingLogo(true);
    try {
      const uri = await pickReceiptLogoFromGallery();
      if (!uri) {
        return;
      }
      await receiptLogoStorage.saveFromUri(uri);
      await load();
      showError({
        title: 'Logo saved',
        message: 'Receipt logo stored on this device. It will print on receipts.',
        variant: 'info',
        confirmLabel: 'OK',
      });
    } catch (e) {
      showError({
        title: 'Upload failed',
        message: e instanceof Error ? e.message : 'Could not save logo',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    await receiptLogoStorage.clear();
    await load();
    showError({
      title: 'Logo removed',
      message: serverLogoUrl
        ? 'Using server company logo again if available.'
        : 'No logo will show until you upload one.',
      variant: 'info',
      confirmLabel: 'OK',
    });
  };

  const handleTestPrint = async () => {
    if (!(await bluetoothPrintService.isConfigured())) {
      showError({
        title: 'Printer not set up',
        message: 'Configure your printer first under Receipt printer.',
        variant: 'warning',
      });
      return;
    }
    setTesting(true);
    try {
      await receiptPrintStorage.save(form);
      await bluetoothPrintService.printTestReceipt('short', {
        storeName: companyName,
        settings,
      });
    } catch (e) {
      showError({
        title: 'Test print failed',
        message: e instanceof Error ? e.message : 'Print failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader title="Receipt layout" subtitle="Bluetooth print customization" showBack />
      <SmoothScrollView contentPaddingBottom={40}>
        <VStack px="$5" py="$4" space="md">
          <Box
            bg="$white"
            borderRadius="$2xl"
            borderWidth={1}
            borderColor="$borderLight300"
            p="$4">
            <Text fontSize="$sm" fontWeight="$bold" color="$textLight0" mb="$3">
              Paper preview
            </Text>
            <Box bg="#fff" borderWidth={1} borderColor={colors.border} borderRadius="$lg" p="$4">
              {form.showLogo && logoPreviewUri ? (
                <Image
                  source={{ uri: logoPreviewUri }}
                  style={styles.previewLogo}
                  resizeMode="contain"
                />
              ) : form.showLogo ? (
                <Text style={styles.previewMono} textAlign="center">
                  [Logo]
                </Text>
              ) : null}
              <Text style={styles.previewMono}>{previewTitle}</Text>
              <Text style={styles.previewMono}>----------------</Text>
              <Text style={styles.previewMono}>2026-08-06      10:34 AM</Text>
              <Text style={styles.previewMono}>Cashier          Admin</Text>
              <Text style={styles.previewMono}>Sales receipt #  SAL-0001</Text>
              <Text style={styles.previewMono}>----------------</Text>
              <Text style={styles.previewMono}>Item Name  Qty Price Amt</Text>
              <Text style={styles.previewMono}>----------------</Text>
              <Text style={styles.previewMono}>Sample item  1  100.00 100.00</Text>
              <Text style={styles.previewMono}>----------------</Text>
              <Text style={styles.previewMono}>Subtotal         100.00</Text>
              <Text style={styles.previewMono}>----------------</Text>
              <Text style={styles.previewMono}>Total            100.00</Text>
              <Text style={styles.previewMono}>================</Text>
              <Text style={styles.previewMono}>Paid By Cash</Text>
              <Text style={styles.previewMono}>Received         100.00</Text>
              <Text style={styles.previewMono}>Balance            0.00</Text>
              <Text style={styles.previewMono}>No of Item(s) 1</Text>
              <Text style={styles.previewMono}>----------------</Text>
              <Text style={styles.previewMono}>{previewFooter}</Text>
              <Text style={styles.previewMono}>----------------</Text>
              <Text style={styles.previewMono}>{RECEIPT_SOFTWARE_PROVIDER}</Text>
              <Text style={styles.previewMono}>{RECEIPT_SOFTWARE_WEBSITE}</Text>
            </Box>
            <Text fontSize="$xs" color="$textLight400" mt="$2">
              Printed output uses ESC/POS center/bold tags — fixes left-aligned headers on thermal
              paper.
            </Text>
          </Box>

          <Box
            bg="$white"
            borderRadius="$2xl"
            borderWidth={1}
            borderColor="$borderLight300"
            p="$4">
            <Text fontSize="$sm" fontWeight="$bold" color="$textLight0" mb="$3">
              Receipt logo (this device)
            </Text>
            {logoPreviewUri ? (
              <Image
                source={{ uri: logoPreviewUri }}
                style={styles.uploadPreview}
                resizeMode="contain"
              />
            ) : (
              <Text fontSize="$xs" color="$textLight400" mb="$3">
                No logo on this phone. Upload one for printed receipts, or use the server company
                logo if configured.
              </Text>
            )}
            <VStack space="sm" mb="$2">
              <PrimaryButton
                label={uploadingLogo ? 'Saving…' : 'Upload logo from gallery'}
                variant="outline"
                onPress={handleUploadLogo}
                loading={uploadingLogo}
              />
              {logoPreviewUri ? (
                <PrimaryButton
                  label="Remove uploaded logo"
                  variant="outline"
                  onPress={handleRemoveLogo}
                  disabled={uploadingLogo}
                />
              ) : null}
            </VStack>
            {serverLogoUrl && !logoPreviewUri ? (
              <Text fontSize="$xs" color="$textLight400">
                Server logo available as fallback when you enable Company logo below.
              </Text>
            ) : null}
          </Box>

          <Box
            bg="$white"
            borderRadius="$2xl"
            borderWidth={1}
            borderColor="$borderLight300"
            p="$4">
            <ChipRow
              label="Paper width"
              value={form.paperWidth}
              onChange={id => patch({ paperWidth: id as ReceiptPaperWidth })}
              options={[
                { id: '58mm', label: '58mm (32 chars)' },
                { id: '80mm', label: '80mm (48 chars)' },
              ]}
            />
            <ChipRow
              label="Store name font"
              value={form.titleFont}
              onChange={id => patch({ titleFont: id as ReceiptTitleFont })}
              options={[
                { id: 'normal', label: 'Normal' },
                { id: 'large', label: 'Large' },
                { id: 'bold', label: 'Bold' },
                { id: 'custom', label: 'Custom size' },
              ]}
            />
            {form.titleFont === 'custom' ? (
              <VStack mb="$4">
                <Text fontSize="$xs" fontWeight="$semibold" color="$textLight400" mb="$2">
                  Custom size ({form.titleFontSizePx}px)
                </Text>
                <HStack alignItems="center" gap="$3" mb="$3">
                  <Pressable
                    onPress={() =>
                      patch({
                        titleFontSizePx: Math.max(
                          TITLE_SIZE_MIN,
                          form.titleFontSizePx - TITLE_SIZE_STEP,
                        ),
                      })
                    }
                    style={styles.stepperBtn}>
                    <Text fontSize="$lg" fontWeight="$bold" color={colors.primary}>
                      −
                    </Text>
                  </Pressable>
                  <Text fontSize="$sm" fontWeight="$semibold" color="$textLight0">
                    {form.titleFontSizePx}px
                  </Text>
                  <Pressable
                    onPress={() =>
                      patch({
                        titleFontSizePx: Math.min(
                          TITLE_SIZE_MAX,
                          form.titleFontSizePx + TITLE_SIZE_STEP,
                        ),
                      })
                    }
                    style={styles.stepperBtn}>
                    <Text fontSize="$lg" fontWeight="$bold" color={colors.primary}>
                      +
                    </Text>
                  </Pressable>
                </HStack>
                {/* Live preview — also the exact image captured and printed on Save
                    (see handleSave / receiptTitleImageStorage). */}
                <ViewShot
                  ref={titleShotRef}
                  options={{ format: 'png', quality: 1, result: 'tmpfile' }}
                  style={styles.titlePreviewBox}>
                  <Text
                    style={{
                      fontSize: form.titleFontSizePx,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      color: colors.text,
                    }}>
                    {companyName}
                  </Text>
                </ViewShot>
              </VStack>
            ) : null}
            <AuthInput
              label="Footer message"
              value={form.footerMessage}
              onChangeText={text => patch({ footerMessage: text })}
              placeholder="Thank you for your business!"
            />
          </Box>

          <Box
            bg="$white"
            borderRadius="$2xl"
            borderWidth={1}
            borderColor="$borderLight300"
            p="$4">
            <Text fontSize="$sm" fontWeight="$bold" color="$textLight0" mb="$1">
              Receipt appearance (image print)
            </Text>
            <Text fontSize="$xs" color="$textLight400" mb="$3">
              Only affects "Print receipt as image" below — updates live as you adjust.
            </Text>
            <Box
              bg="#fff"
              borderWidth={1}
              borderColor={colors.border}
              borderRadius="$lg"
              mb="$4"
              overflow="hidden">
              <SaleReceiptView
                receipt={IMAGE_PREVIEW_RECEIPT}
                settings={settings}
                customizationOverride={form}
              />
            </Box>

            <SizeStepper
              label="Logo width"
              value={form.receiptLogoWidthPx}
              min={60}
              max={220}
              step={10}
              onChange={v => patch({ receiptLogoWidthPx: v })}
            />

            <SizeStepper
              label="Company name size"
              value={form.receiptCompanyNameSizePx}
              min={12}
              max={36}
              step={1}
              onChange={v => patch({ receiptCompanyNameSizePx: v })}
            />
            <ChipRow
              label="Company name weight"
              value={form.receiptCompanyNameWeight}
              onChange={id => patch({ receiptCompanyNameWeight: id as ReceiptTextWeight })}
              options={WEIGHT_OPTIONS}
            />

            <SizeStepper
              label="Company details size"
              value={form.receiptCompanyDetailsSizePx}
              min={8}
              max={24}
              step={1}
              onChange={v => patch({ receiptCompanyDetailsSizePx: v })}
            />
            <ChipRow
              label="Company details weight"
              value={form.receiptCompanyDetailsWeight}
              onChange={id => patch({ receiptCompanyDetailsWeight: id as ReceiptTextWeight })}
              options={WEIGHT_OPTIONS}
            />

            <SizeStepper
              label="Body text size"
              value={form.receiptBodyTextSizePx}
              min={8}
              max={20}
              step={1}
              onChange={v => patch({ receiptBodyTextSizePx: v })}
            />
            <ChipRow
              label="Body text weight"
              value={form.receiptBodyTextWeight}
              onChange={id => patch({ receiptBodyTextWeight: id as ReceiptTextWeight })}
              options={WEIGHT_OPTIONS}
            />

            <SizeStepper
              label="Divider line thickness"
              value={form.receiptDividerThicknessPx}
              min={1}
              max={6}
              step={1}
              onChange={v => patch({ receiptDividerThicknessPx: v })}
            />
          </Box>

          <Box
            bg="$white"
            borderRadius="$2xl"
            borderWidth={1}
            borderColor="$borderLight300"
            px="$4"
            pb="$2">
            <Text fontSize="$sm" fontWeight="$bold" color="$textLight0" py="$3">
              Show on printed receipt
            </Text>
            <ToggleRow
              label="Company logo"
              subtitle={
                logoPreviewUri
                  ? 'Uses logo uploaded on this device'
                  : serverLogoUrl
                    ? 'Uses server company logo (needs internet to print)'
                    : 'Upload a logo above or set logo on server'
              }
              value={form.showLogo}
              onChange={v => patch({ showLogo: v })}
            />
            <ToggleRow
              label="Phone number"
              value={form.showPhone}
              onChange={v => patch({ showPhone: v })}
            />
            <ToggleRow
              label="Email"
              value={form.showEmail}
              onChange={v => patch({ showEmail: v })}
            />
            <ToggleRow
              label="Tax ID"
              value={form.showTaxId}
              onChange={v => patch({ showTaxId: v })}
            />
            <ToggleRow
              label="Registration number"
              value={form.showRegistration}
              onChange={v => patch({ showRegistration: v })}
            />
          </Box>

          <Box
            bg="$white"
            borderRadius="$2xl"
            borderWidth={1}
            borderColor="$borderLight300"
            px="$4"
            pb="$2">
            <ToggleRow
              label="Print receipt as image"
              subtitle="Prints an exact copy of the on-screen receipt, instead of building it from text. Slower to print."
              value={form.printAsImage}
              onChange={v => patch({ printAsImage: v })}
            />
          </Box>

          <PrimaryButton label="Save layout" onPress={handleSave} loading={saving} />
          {bluetoothPrintService.isSupported() ? (
            <PrimaryButton
              label={testing ? 'Printing…' : 'Test print with this layout'}
              variant="outline"
              onPress={handleTestPrint}
              loading={testing}
              disabled={saving}
            />
          ) : null}
          <PrimaryButton label="Reset to defaults" variant="outline" onPress={handleReset} />
        </VStack>
      </SmoothScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  previewLogo: {
    width: 100,
    height: 40,
    alignSelf: 'center',
    marginBottom: 6,
  },
  uploadPreview: {
    width: '100%',
    height: 72,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: colors.backgroundAlt,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titlePreviewBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
  },
  previewMono: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 16,
  },
});
