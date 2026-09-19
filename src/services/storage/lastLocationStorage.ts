import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@pos/last_location';

export const lastLocationStorage = {
  async get(): Promise<string | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw?.trim() || null;
    } catch {
      return null;
    }
  },

  async save(location: string | null): Promise<void> {
    try {
      if (!location?.trim()) {
        await AsyncStorage.removeItem(STORAGE_KEY);
        return;
      }
      await AsyncStorage.setItem(STORAGE_KEY, location.trim());
    } catch {
      /* non-fatal — just won't pre-fill next time */
    }
  },
};
