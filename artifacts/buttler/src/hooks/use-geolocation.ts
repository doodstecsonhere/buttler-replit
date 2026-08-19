import { useState, useEffect } from 'react';

export interface Location {
  lat: number;
  lng: number;
}

export function useGeolocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    const handleSuccess = (pos: GeolocationPosition) => {
      setLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      setLoading(false);
    };

    const handleError = (err: GeolocationPositionError) => {
      setError(err.message);
      setLoading(false);
    };

    // Fast timeout for better UX, falling back gracefully
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);
    
    // Also watch for updates
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options);

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return { location, error, loading };
}
