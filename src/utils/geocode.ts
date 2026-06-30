import * as Location from 'expo-location';

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const results = await Location.geocodeAsync(address);
    if (results && results.length > 0) {
      return { lat: results[0].latitude, lng: results[0].longitude };
    }
    return null;
  } catch {
    return null;
  }
}
