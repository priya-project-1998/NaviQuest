import React, { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { handleIncomingDeepLink } from './src/utils/deepLinkUtils';

export default function App() {
  const navigationRef = useRef();

  useEffect(() => {
    // Handle deep link when app is opened from a link
    const handleDeepLink = (url) => {
      console.log('Deep link received:', url);
      if (navigationRef.current) {
        handleIncomingDeepLink(url, navigationRef);
      }
    };

    // Handle initial URL if app was opened from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for incoming deep links while app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  return <AppNavigator ref={navigationRef} />;
}
