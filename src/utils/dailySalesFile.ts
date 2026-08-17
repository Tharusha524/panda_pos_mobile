import { Platform } from 'react-native';
import Share from 'react-native-share';
import RNBlobUtil from 'react-native-blob-util';
import { buildDailySalesWorkbookBase64 } from '@/utils/dailySalesExcel';
import type { SalesSummarySale } from '@/types/backendReports';

const EXCEL_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const fileNameFor = (dateYmd: string, title: string): string =>
  `${title.replace(/\s+/g, '-')}-${dateYmd}.xlsx`;

async function writeWorkbookTo(
  dirPath: string,
  sales: SalesSummarySale[],
  dateYmd: string,
  dateLabel: string,
  title: string,
): Promise<{ path: string; isEmpty: boolean }> {
  const { base64, isEmpty } = await buildDailySalesWorkbookBase64(sales, dateLabel, title);
  const path = `${dirPath}/${fileNameFor(dateYmd, title)}`;
  if (await RNBlobUtil.fs.exists(path)) {
    await RNBlobUtil.fs.unlink(path);
  }
  await RNBlobUtil.fs.writeFile(path, base64, 'base64');
  return { path, isEmpty };
}

/** Saves the day's sales pivot as a real .xlsx directly into the device's
 * Downloads folder (Android) or app documents (iOS, visible from the Files
 * app) — a genuine one-tap save, no chooser/share sheet involved. */
export async function downloadDailySalesExcel(
  sales: SalesSummarySale[],
  dateYmd: string,
  dateLabel: string,
  title: string = 'Daily Sale Report',
): Promise<string> {
  const fileName = fileNameFor(dateYmd, title);

  if (Platform.OS === 'android') {
    const { path, isEmpty } = await writeWorkbookTo(
      RNBlobUtil.fs.dirs.DownloadDir,
      sales,
      dateYmd,
      dateLabel,
      title,
    );
    // Registers the file with Android's Downloads app/notification so it
    // actually shows up there — a plain write alone leaves it invisible to
    // anything but a raw file browser.
    await RNBlobUtil.android.addCompleteDownload({
      title: fileName,
      description: `${title} for ${dateLabel}`,
      mime: EXCEL_MIME,
      path,
      showNotification: true,
    });
    return isEmpty
      ? `${fileName} saved to Downloads (no sales recorded for this period).`
      : `${fileName} saved to Downloads.`;
  }

  const { isEmpty } = await writeWorkbookTo(
    RNBlobUtil.fs.dirs.DocumentDir,
    sales,
    dateYmd,
    dateLabel,
    title,
  );
  return isEmpty
    ? `${fileName} saved (no sales recorded for this period). Find it via the Files app.`
    : `${fileName} saved. Find it via the Files app.`;
}

/** Opens the OS share sheet for the day's sales pivot .xlsx. Writes into the
 * app's cache dir first — the only local root react-native-share's bundled
 * FileProvider (share_download_paths.xml) actually recognizes on Android;
 * writing anywhere else makes it fail to resolve a shareable URI and crash
 * with a null Uri.getScheme() NPE deep inside ClipData.newUri. */
export async function shareDailySalesExcel(
  sales: SalesSummarySale[],
  dateYmd: string,
  dateLabel: string,
  title: string = 'Daily Sale Report',
): Promise<void> {
  const { path } = await writeWorkbookTo(
    RNBlobUtil.fs.dirs.CacheDir,
    sales,
    dateYmd,
    dateLabel,
    title,
  );

  await Share.open({
    url: `file://${path}`,
    type: EXCEL_MIME,
    filename: fileNameFor(dateYmd, title),
    title: 'Share Excel report',
    // Cancelling the chooser is a normal outcome, not a failure — without
    // this the promise rejects on cancel and the caller shows an error toast
    // for simply closing the sheet.
    failOnCancel: false,
    isNewTask: true,
  });
}
