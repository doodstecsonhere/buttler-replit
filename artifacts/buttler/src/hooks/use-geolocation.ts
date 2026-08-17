import { useState, useEffect } from 'react';

export interface Location {
  lat: number;
  lng: number;
}

export const GEOLOCATION_TIMEOUT_MS = 2500;

export function useGeolocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let settled = false;
    const settleError = (message: string) => {
      if (settled) return;
      settled = true;
      setError(message);
      setLoading(false);
    };

    if (!navigator.geolocation) {
      settleError('Geolocation is not supported by your browser.');
      return;
    }

    const handleSuccess = (pos: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      setLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      setLoading(false);
    };

    const handleError = (err: GeolocationPositionError) => {
      settleError(err.message || 'Unable to determine your location.');
    };

    // Use both the browser timeout and a local guard so the map never waits
    // longer than the strict startup budget for a location result.
    const options = {
      enableHighAccuracy: true,
      timeout: GEOLOCATION_TIMEOUT_MS,
      maximumAge: 0,
    };
    const timeoutId = window.setTimeout(() => {
      settleError('Location lookup timed out.');
    }, GEOLOCATION_TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);

    return () => {
      settled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return { location, error, loading };
}
