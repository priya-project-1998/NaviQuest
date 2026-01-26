import React, { useEffect, useRef } from 'react';
import { StatusBar, useColorScheme, Linking } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/redux/store';
import AppNavigator from './src/navigation/AppNavigator';
import { handleIncomingDeepLink, getPendingEventId, clearPendingEventId } from './src/utils/deepLinkUtils';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    // ✅ TEMPORARY WORKAROUND: Auto-open pending event when app initializes (after install)
    const checkPendingEvent = async () => {
      try {
        const pendingEventId = await getPendingEventId();
        if (pendingEventId && navigationRef.current) {
          console.log(`✅ Found pending event ID: ${pendingEventId}, attempting to open...`);
          
          // Try to open the event using deep link
          const deepLink = `vcmapp://event/${pendingEventId}`;
          const canOpen = await Linking.canOpenURL(deepLink);
          
          if (canOpen) {
            console.log(`✅ Can open deep link, opening event ${pendingEventId}`);
            await Linking.openURL(deepLink);
            await clearPendingEventId();
          } else {
            console.log(`ℹ️ Cannot open deep link (might happen on first launch), clearing pending event`);
            // Don't navigate here - let normal deep link handling take over
            await clearPendingEventId();
          }
        }
      } catch (error) {
        console.error('❌ Error checking pending event:', error);
      }
    };

    // Check for pending event after a small delay to allow navigation to initialize
    const timer = setTimeout(() => {
      checkPendingEvent();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Handle deep link when app is opened
    const handleURL = ({ url }: { url: string }) => {
      if (url) {
        console.log('🔗 Deep link detected:', url);
        handleIncomingDeepLink(url, navigationRef.current);
      }
    };

    // Subscribe to deep link events
    const subscription = Linking.addEventListener('url', handleURL);

    // Check for initial URL (cold start - when app is launched from deep link)
    Linking.getInitialURL().then((url: string | null) => {
      if (url) {
        console.log('🔗 Initial deep link (cold start):', url);
        // Add a small delay to ensure navigation is ready
        setTimeout(() => {
          handleIncomingDeepLink(url, navigationRef.current);
        }, 500);
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <AppNavigator ref={navigationRef} />
      </Provider>
    </SafeAreaProvider>
  );
}

export default App;
