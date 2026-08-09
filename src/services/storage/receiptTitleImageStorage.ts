import AsyncStorage from '@react-native-async-storage/async-storage';
import RNBlobUtil from 'react-native-blob-util';

/** Cached image of the company name, rendered at a custom pixel size (see
 * ReceiptCustomizeScreen). Mirrors receiptLogoStorage's pattern exactly. Printed
 * in place of the plain-text title line only when present — if missing/cleared,
 * printing falls back to the normal text-tag title untouched. */

const TITLE_IMAGE_META_KEY = '@pos/receipt_title_image_meta';
const TITLE_IMAGE_FILE_NAME = 'receipt_title.png';

export type StoredReceiptTitleImage = {
  filePath: string;
  updatedAt: string;
};

const titleImageFilePath = (): string =>
  `${RNBlobUtil.fs.dirs.DocumentDir}/${TITLE_IMAGE_FILE_NAME}`;

export const receiptTitleImageStorage = {
  async get(): Promise<StoredReceiptTitleImage | null> {
    try {
      const raw = await AsyncStorage.getItem(TITLE_IMAGE_META_KEY);
      if (!raw) {
        return null;
      }
      const meta = JSON.parse(raw) as StoredReceiptTitleImage;
      const exists = await RNBlobUtil.fs.exists(meta.filePath);
      if (!exists) {
        await AsyncStorage.removeItem(TITLE_IMAGE_META_KEY);
        return null;
      }
      return meta;
    } catch {
      return null;
    }
  },

  async saveFromUri(sourceUri: string): Promise<StoredReceiptTitleImage> {
    const dest = titleImageFilePath();
    const normalizedSource = sourceUri.startsWith('file://')
      ? sourceUri
      : sourceUri.startsWith('content://') || sourceUri.startsWith('ph://')
        ? sourceUri
        : `file://${sourceUri}`;

    if (await RNBlobUtil.fs.exists(dest)) {
      await RNBlobUtil.fs.unlink(dest);
    }

    await RNBlobUtil.fs.cp(normalizedSource, dest);

    const meta: StoredReceiptTitleImage = {
      filePath: dest,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(TITLE_IMAGE_META_KEY, JSON.stringify(meta));
    return meta;
  },

  async clear(): Promise<void> {
    const existing = await this.get();
    if (existing) {
      try {
        await RNBlobUtil.fs.unlink(existing.filePath);
      } catch {
        /* ignore */
      }
    }
    await AsyncStorage.removeItem(TITLE_IMAGE_META_KEY);
  },
};
