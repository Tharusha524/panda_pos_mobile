import { Platform } from 'react-native';
import Share from 'react-native-share';
import RNBlobUtil from 'react-native-blob-util';
import { buildDayEndReportWorkbookBase64, type DayEndExcelRow } from '@/utils/dayEndReportExcel';

const EXCEL_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const fileNameFor = (dateYmd: string): string => `Day-End-Report-${dateYmd}.xlsx`;

async function writeWorkbookTo(
  dirPath: string,
  rows: DayEndExcelRow[],
  dateYmd: string,
  dateLabel: string,
  totals: { start: number; sold: number; remaining: number },
): Promise<{ path: string; isEmpty: boolean }> {
  const { base64, isEmpty } = await buildDayEndReportWorkbookBase64(rows, dateLabel, totals);
  const path = `${dirPath}/${fileNameFor(dateYmd)}`;
  if (await RNBlobUtil.fs.exists(path)) {
    await RNBlobUtil.fs.unlink(path);
  }
  await RNBlobUtil.fs.writeFile(path, base64, 'base64');
  return { path, isEmpty };
}

export async function downloadDayEndReportExcel(
  rows: DayEndExcelRow[],
  dateYmd: string,
  dateLabel: string,
  totals: { start: number; sold: number; remaining: number },
): Promise<string> {
  const fileName = fileNameFor(dateYmd);

  if (Platform.OS === 'android') {
    const { path, isEmpty } = await writeWorkbookTo(
      RNBlobUtil.fs.dirs.DownloadDir,
      rows,
      dateYmd,
      dateLabel,
      totals,
    );
    await RNBlobUtil.android.addCompleteDownload({
      title: fileName,
      description: `Day End Report for ${dateLabel}`,
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
    rows,
    dateYmd,
    dateLabel,
    totals,
  );
  return isEmpty
    ? `${fileName} saved (no rows for this period). Find it via the Files app.`
    : `${fileName} saved. Find it via the Files app.`;
}

export async function shareDayEndReportExcel(
  rows: DayEndExcelRow[],
  dateYmd: string,
  dateLabel: string,
  totals: { start: number; sold: number; remaining: number },
): Promise<void> {
  const { path } = await writeWorkbookTo(
    RNBlobUtil.fs.dirs.CacheDir,
    rows,
    dateYmd,
    dateLabel,
    totals,
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
