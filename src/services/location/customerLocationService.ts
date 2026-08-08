import { Linking, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

async function ensureLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const already = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  if (already) {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export const customerLocationService = {
  /** Captures the device's current GPS position, requesting permission if needed. */
  async getCurrentPosition(): Promise<Coordinates> {
    const allowed = await ensureLocationPermission();
    if (!allowed) {
      throw new Error(
        'Location permission was not granted. Enable location access for this app in phone settings.',
      );
    }

    return new Promise<Coordinates>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        error => {
          reject(new Error(error.message || 'Could not get the current location'));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    });
  },

  /** Opens the device's maps app with directions to the given coordinates. */
  async openDirections(latitude: number, longitude: number, label?: string): Promise<void> {
    const query = label
      ? `${latitude},${longitude}(${encodeURIComponent(label)})`
      : `${latitude},${longitude}`;
    const nativeUrl = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: '',
    });
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    try {
      if (nativeUrl && (await Linking.canOpenURL(nativeUrl))) {
        await Linking.openURL(nativeUrl);
        return;
      }
    } catch {
      /* fall through to web url */
    }

    await Linking.openURL(webUrl);
  },
};
