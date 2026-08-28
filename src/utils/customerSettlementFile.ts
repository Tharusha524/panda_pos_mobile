import { Platform } from 'react-native';
import Share from 'react-native-share';
import RNBlobUtil from 'react-native-blob-util';
import { buildCustomerSettlementWorkbookBase64 } from '@/utils/customerSettlementExcel';
import type { BackendReportData } from '@/types/backendReports';

const EXCEL_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const fileNameFor = (dateYmd: string): string => `Customer-Settlement-${dateYmd}.xlsx`;

async function writeWorkbookTo(
  dirPath: string,
  report: BackendReportData,
  dateYmd: string,
  dateLabel: string,
): Promise<{ path: string; isEmpty: boolean }> {
  const { base64, isEmpty } = await buildCustomerSettlementWorkbookBase64(report, dateLabel);
  const path = `${dirPath}/${fileNameFor(dateYmd)}`;
  if (await RNBlobUtil.fs.exists(path)) {
    await RNBlobUtil.fs.unlink(path);
  }
  await RNBlobUtil.fs.writeFile(path, base64, 'base64');
  return { path, isEmpty };
}

export async function downloadCustomerSettlementExcel(
  report: BackendReportData,
  dateYmd: string,
  dateLabel: string,
): Promise<string> {
  const fileName = fileNameFor(dateYmd);

  if (Platform.OS === 'android') {
    const { path, isEmpty } = await writeWorkbookTo(
      RNBlobUtil.fs.dirs.DownloadDir,
      report,
      dateYmd,
      dateLabel,
    );
    await RNBlobUtil.android.addCompleteDownload({
      title: fileName,
      description: `Customer Settlement for ${dateLabel}`,
      mime: EXCEL_MIME,
      path,
      showNotification: true,
    });
    return isEmpty
      ? `${fileName} saved to Downloads (no settlements for this period).`
      : `${fileName} saved to Downloads.`;
  }

  const { isEmpty } = await writeWorkbookTo(
    RNBlobUtil.fs.dirs.DocumentDir,
    report,
    dateYmd,
    dateLabel,
  );
  return isEmpty
    ? `${fileName} saved (no settlements for this period). Find it via the Files app.`
    : `${fileName} saved. Find it via the Files app.`;
}

export async function shareCustomerSettlementExcel(
  report: BackendReportData,
  dateYmd: string,
  dateLabel: string,
): Promise<void> {
  const { path } = await writeWorkbookTo(
    RNBlobUtil.fs.dirs.CacheDir,
    report,
    dateYmd,
    dateLabel,
  );

  await Share.open({
    url: `file://${path}`,
    type: EXCEL_MIME,
    filename: fileNameFor(dateYmd),
    title: 'Share Excel report',
    failOnCancel: false,
    isNewTask: true,
  });
}
