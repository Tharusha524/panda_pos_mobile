import { Platform } from 'react-native';
import Share from 'react-native-share';
import RNBlobUtil from 'react-native-blob-util';
import { buildReportTableWorkbookBase64 } from '@/utils/reportTableExcel';
import type { BackendReportData } from '@/types/backendReports';

const EXCEL_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const fileNameFor = (dateYmd: string, title: string): string =>
  `${(title || 'Report').replace(/\s+/g, '-')}-${dateYmd}.xlsx`;

async function writeWorkbookTo(
  dirPath: string,
  report: BackendReportData,
  dateYmd: string,
  dateLabel: string,
): Promise<{ path: string; isEmpty: boolean }> {
  const { base64, isEmpty } = await buildReportTableWorkbookBase64(report, dateLabel);
  const path = `${dirPath}/${fileNameFor(dateYmd, report.title)}`;
  if (await RNBlobUtil.fs.exists(path)) {
    await RNBlobUtil.fs.unlink(path);
  }
  await RNBlobUtil.fs.writeFile(path, base64, 'base64');
  return { path, isEmpty };
}

/** Saves a flat-table report (Customer Settlement, Return report, etc.) as a
 * real .xlsx directly into the device's Downloads folder (Android) or app
 * documents (iOS) — same one-tap save as the Daily Sale Report export. */
export async function downloadReportTableExcel(
  report: BackendReportData,
  dateYmd: string,
  dateLabel: string,
): Promise<string> {
  const fileName = fileNameFor(dateYmd, report.title);

  if (Platform.OS === 'android') {
    const { path, isEmpty } = await writeWorkbookTo(
      RNBlobUtil.fs.dirs.DownloadDir,
      report,
      dateYmd,
      dateLabel,
    );
    await RNBlobUtil.android.addCompleteDownload({
      title: fileName,
      description: `${report.title} for ${dateLabel}`,
      mime: EXCEL_MIME,
      path,
      showNotification: true,
    });
    return isEmpty
      ? `${fileName} saved to Downloads (no rows for this period).`
      : `${fileName} saved to Downloads.`;
  }

  const { isEmpty } = await writeWorkbookTo(
    RNBlobUtil.fs.dirs.DocumentDir,
    report,
    dateYmd,
    dateLabel,
  );
  return isEmpty
    ? `${fileName} saved (no rows for this period). Find it via the Files app.`
    : `${fileName} saved. Find it via the Files app.`;
}

/** Opens the OS share sheet for a flat-table report .xlsx — writes into the
 * app's cache dir first, same reasoning as shareDailySalesExcel. */
export async function shareReportTableExcel(
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
    filename: fileNameFor(dateYmd, report.title),
    title: 'Share Excel report',
    failOnCancel: false,
    isNewTask: true,
  });
}
