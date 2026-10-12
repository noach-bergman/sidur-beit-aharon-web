import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { installFixedHome } from './fixed-home.js';
import { installNativeReader } from './native-reader.js';

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-app');
  document.addEventListener('DOMContentLoaded', installFixedHome);
  document.addEventListener('DOMContentLoaded', installNativeReader);
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
