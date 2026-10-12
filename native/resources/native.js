import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-app');
  // Preserve the web app's one-shot location flow, backed by Core Location.
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition(success, failure, options = {}) {
        Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: options.timeout || 10000,
          maximumAge: options.maximumAge || 300000
        }).then(success).catch(error => {
          if (failure) failure({ code: 1, message: error.message || 'Location unavailable' });
        });
      }
    }
  });
}
