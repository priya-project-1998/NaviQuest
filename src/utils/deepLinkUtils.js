import { Linking, Platform } from 'react-native';

/**
 * Deep Link Configuration
 * Android: vcmapp://event/38?name=Trail+Hunt&venue=Indore&date=2026-01-14
 * iOS: naviquest://event/38?name=Trail+Hunt&venue=Indore&date=2026-01-14
 * Web Fallback: https://rajasthanmotorsports.com/event/38?name=Trail+Hunt&venue=Indore&date=2026-01-14
 * 
 * IMPORTANT: Update these with your actual app details:
 * - Android Package Name: Check AndroidManifest.xml <manifest package="...">
 * - iOS Bundle ID: Check Info.plist <key>CFBundleIdentifier</key>
 * - iOS App Store ID: Get from https://apps.apple.com/app/yourapp/id123456789
 */

const ANDROID_APP_SCHEME = 'vcmapp://';
const IOS_APP_SCHEME = 'naviquest://';
const WEB_BASE_URL = 'https://rajasthanmotorsports.com';

// ⚠️ UPDATE THESE WITH YOUR LIVE APP DETAILS
// Android Package Name (from AndroidManifest.xml)
const ANDROID_PACKAGE_NAME = 'com.vcmapp';

// iOS Bundle ID (from Info.plist - CFBundleIdentifier)
const IOS_BUNDLE_ID = 'com.rajasthanmotorssports.naviquest.app'; // Your actual bundle ID

// iOS App Store ID (get from App Store URL)
const IOS_APP_STORE_ID = '6757330871'; // NaviQuest App Store ID

/**
 * Generate store URLs dynamically based on live app details
 */
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;
const APP_STORE_URL = `https://apps.apple.com/app/naviquest/id${IOS_APP_STORE_ID}`;

// Alternative iOS URL formats (if needed)
const IOS_ITUNES_URL = `itms-apps://apps.apple.com/app/naviquest/id${IOS_APP_STORE_ID}`;
const IOS_UNIVERSAL_LINK = `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`;

console.log('📱 App Store URLs:');
console.log('Play Store:', PLAY_STORE_URL);
console.log('App Store:', APP_STORE_URL);
console.log('iTunes Direct:', IOS_ITUNES_URL);

/**
 * Generate a shareable link for an event
 * @param {Object} eventData - Event data object
 * @returns {Object} - Contains deep links for both platforms and web link
 */
export const generateEventShareLink = (eventData) => {
  const {
    event_id,
    event_name,
    event_venue,
    event_start_date,
    name,
    venue,
    date
  } = eventData;

  // Use fallback values for compatibility
  const eventId = event_id || 'unknown';
  const eventName = event_name || name || 'Event';
  const eventVenue = event_venue || venue || 'Venue';
  const eventDate = event_start_date || date || new Date().toISOString();

  // Create URL parameters
  const params = new URLSearchParams({
    name: eventName,
    venue: eventVenue,
    date: eventDate
  });

  // Platform-specific deep links
  const androidDeepLink = `${ANDROID_APP_SCHEME}event/${eventId}?${params.toString()}`;
  const iosDeepLink = `${IOS_APP_SCHEME}event/${eventId}?${params.toString()}`;
  
  // Fallback web link
  const webLink = `${WEB_BASE_URL}/event/${eventId}?${params.toString()}`;
  
  // Smart deep link - uses platform-specific scheme
  const platformDeepLink = Platform.OS === 'ios' ? iosDeepLink : androidDeepLink;

  return {
    androidDeepLink,
    iosDeepLink,
    platformDeepLink, // Use this for current platform
    webLink,
    eventId,
    eventName,
    eventVenue,
    eventDate
  };
};

/**
 * Generate share message with deep link
 * @param {Object} eventData - Event data object
 * @returns {Object} - Share data with message, url, title
 */
/**
 * ✅ TEMPORARY WORKAROUND: Share HTTPS store links instead of vcmapp://
 * Rationale:
 * - vcmapp:// cannot redirect to store if app not installed
 * - App will handle deep-link auto-open on initialization
 * - This guarantees store opens for new users, event opens for installed users
 */
export const generateShareMessage = (eventData) => {
  const {
    event_id,
    event_name,
    event_venue,
    event_start_date,
    name,
    venue,
    date
  } = eventData;

  // Use fallback values for compatibility
  const eventId = event_id || 'unknown';
  const eventName = event_name || name || 'Event';
  const eventVenue = event_venue || venue || 'Venue';
  const eventDate = event_start_date || date || new Date().toISOString();

  // 🔥 TEMPORARY: Share ONLY HTTPS store URL (NO vcmapp:// or naviquest://)
  // Store will be aware of event context via app-side deep link handling
  const storeUrl = Platform.OS === 'ios'
    ? APP_STORE_URL
    : PLAY_STORE_URL;

  // Simple message without deep link
  const message = `🏁 ${eventName}\n📍 ${eventVenue}\n📅 ${new Date(eventDate).toLocaleDateString()}\n\n⬇️ Tap the link below to join`;

  return {
    title: `Join ${eventName}`,
    message,
    url: storeUrl, // Store URL instead of deep link
    eventId, // Store eventId for app-side deep link handling
  };
};

/**
 * Parse deep link URL and extract event parameters
 * Handles both Android (vcmapp://) and iOS (naviquest://) schemes
 * @param {string} url - Deep link URL
 * @returns {Object} - Parsed event data
 */
export const parseEventDeepLink = (url) => {
  try {
    let eventId, eventName, venue, eventDate;
    let source = 'unknown';
    
    if (!url) {
      throw new Error('URL is empty');
    }

    // Check for Android deep link (vcmapp://)
    if (url.includes('vcmapp://')) {
      source = 'android-deeplink';
      const eventMatch = url.match(/vcmapp:\/\/event\/(\d+)/);
      eventId = eventMatch ? eventMatch[1] : null;
      
      const queryStart = url.indexOf('?');
      const queryString = queryStart !== -1 ? url.substring(queryStart + 1) : '';
      const params = new URLSearchParams(queryString);
      
      eventName = params.get('name') || 'Event';
      venue = params.get('venue') || 'Venue';
      eventDate = params.get('date') || new Date().toISOString();
    }
    // Check for iOS deep link (naviquest://)
    else if (url.includes('naviquest://')) {
      source = 'ios-deeplink';
      const eventMatch = url.match(/naviquest:\/\/event\/(\d+)/);
      eventId = eventMatch ? eventMatch[1] : null;
      
      const queryStart = url.indexOf('?');
      const queryString = queryStart !== -1 ? url.substring(queryStart + 1) : '';
      const params = new URLSearchParams(queryString);
      
      eventName = params.get('name') || 'Event';
      venue = params.get('venue') || 'Venue';
      eventDate = params.get('date') || new Date().toISOString();
    }
    // Check for web link (https://)
    else if (url.includes('http')) {
      source = 'weblink';
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      eventId = pathParts[pathParts.length - 1];
      
      const params = new URLSearchParams(urlObj.search);
      eventName = params.get('name') || 'Event';
      venue = params.get('venue') || 'Venue';
      eventDate = params.get('date') || new Date().toISOString();
    }
    else {
      throw new Error('Unknown URL format');
    }

    if (!eventId) {
      throw new Error('Event ID not found in URL');
    }

    return {
      eventId,
      eventName,
      venue,
      date: eventDate,
      success: true,
      source
    };
  } catch (error) {
    console.log('❌ Error parsing deep link:', error, 'URL:', url);
    return {
      success: false,
      error: error.message || 'Invalid deep link format'
    };
  }
};

/**
 * Check if the app is installed and handle deep linking
 * @param {string} deepLink - Deep link URL
 * @param {string} fallbackUrl - Fallback web URL or app store URL
 */
export const handleDeepLink = async (deepLink, fallbackUrl = null) => {
  try {
    const supported = await Linking.canOpenURL(deepLink);
    
    if (supported) {
      await Linking.openURL(deepLink);
      return { success: true, method: 'deeplink' };
    } else {
      // App not installed, redirect to app store or web
      const storeUrl = fallbackUrl || (Platform.OS === 'android' ? PLAY_STORE_URL : APP_STORE_URL);
      await Linking.openURL(storeUrl);
      return { success: true, method: 'fallback' };
    }
  } catch (error) {
    console.log('Error handling deep link:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Open app store for app installation
 */
export const openAppStore = () => {
  const storeUrl = Platform.OS === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
  return Linking.openURL(storeUrl);
};

/**
 * Handle redirect from web link - checks if app is installed
 * This should be called when user clicks the shared link from web
 * @param {Object} eventData - Event data object
 * @returns {Promise<Object>} - Result with redirect info
 */
export const handleLinkRedirect = async (eventData) => {
  try {
    const linkData = generateEventShareLink(eventData);
    const isIOS = Platform.OS === 'ios';
    
    // Use platform-specific deep link
    const deepLinkToTry = linkData.platformDeepLink;
    
    // Check if app is installed by testing the deep link
    const canOpenDeepLink = await Linking.canOpenURL(deepLinkToTry);
    
    if (canOpenDeepLink) {
      // App installed - open with deep link
      console.log(`✅ App installed (${Platform.OS}), opening event with deep link`);
      await Linking.openURL(deepLinkToTry);
      return { 
        success: true, 
        action: 'open_app',
        message: `Opening event in app (${Platform.OS})`,
        deepLink: deepLinkToTry
      };
    } else {
      // App not installed - redirect to store
      const storeUrl = isIOS ? APP_STORE_URL : PLAY_STORE_URL;
      console.log(`❌ App not installed (${Platform.OS}), redirecting to ${isIOS ? 'App Store' : 'Play Store'}`);
      console.log('Store URL:', storeUrl);
      
      await Linking.openURL(storeUrl);
      return { 
        success: true, 
        action: 'redirect_store',
        message: `Redirecting to ${isIOS ? 'App Store' : 'Play Store'}`,
        storeUrl: storeUrl
      };
    }
  } catch (error) {
    console.error('❌ Error handling redirect:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

/**
 * Smart event link handler - Opens event directly if app is installed, otherwise redirects to app store
 * @param {Object} eventData - Event data object
 * @returns {Promise<Object>} - Result of the operation
 */
export const handleSmartEventLink = async (eventData) => {
  try {
    const linkData = generateEventShareLink(eventData);
    const isIOS = Platform.OS === 'ios';
    const storeUrl = isIOS ? APP_STORE_URL : PLAY_STORE_URL;
    
    // Try platform-specific deep link first
    const deepLinkToTry = linkData.platformDeepLink;
    const canOpenDeepLink = await Linking.canOpenURL(deepLinkToTry);
    
    console.log(`🔍 Checking if app can open: ${deepLinkToTry}`, canOpenDeepLink);
    
    if (canOpenDeepLink) {
      // App is installed, open event directly via deep link
      console.log(`✅ App installed, opening event via ${Platform.OS} deep link`);
      await Linking.openURL(deepLinkToTry);
      return { 
        success: true, 
        method: 'deeplink',
        message: `App opened with event details (${Platform.OS})`,
        platform: Platform.OS
      };
    } else {
      // App not installed, redirect to app store
      console.log(`❌ App not installed, redirecting to ${Platform.OS === 'ios' ? 'App Store' : 'Play Store'}`);
      await Linking.openURL(storeUrl);
      return { 
        success: true, 
        method: 'store',
        message: `Redirected to ${Platform.OS === 'ios' ? 'App Store' : 'Play Store'}`,
        platform: Platform.OS
      };
    }
  } catch (error) {
    console.log('❌ Error handling smart event link:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

/**
 * Handle incoming deep link when app is opened
 * Navigates to the specific event page
 * @param {string} url - Deep link URL
 * @param {Function} navigationRef - Navigation reference
 * @returns {boolean} - Success flag
 */
export const handleIncomingDeepLink = (url, navigationRef) => {
  try {
    const parsedData = parseEventDeepLink(url);
    
    if (parsedData.success && navigationRef?.current) {
      console.log('✅ Deep link parsed successfully:', parsedData);
      
      // Navigate to EventStartScreen with parsed event data
      navigationRef.current.navigate('EventStartScreen', {
        event: {
          event_id: parsedData.eventId,
          event_name: parsedData.eventName,
          event_venue: parsedData.venue,
          event_start_date: parsedData.date,
          fromDeepLink: true
        }
      });
      
      return true;
    }
    
    console.log('❌ Failed to parse deep link');
    return false;
  } catch (error) {
    console.error('❌ Error in handleIncomingDeepLink:', error);
    return false;
  }
};



/**
 * ✅ TEMPORARY WORKAROUND: Store pending event ID for auto-open on app initialization
 * When user shares store link → user installs app → app tries to open event automatically
 * 
 * Usage:
 * 1. Before share: storePendingEventId(eventId)
 * 2. On app init: checkAndOpenPendingEvent()
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const storePendingEventId = async (eventId) => {
  try {
    await AsyncStorage.setItem('pendingEventId', String(eventId));
    console.log(`✅ Stored pending event ID: ${eventId}`);
    return true;
  } catch (error) {
    console.error('❌ Error storing pending event ID:', error);
    return false;
  }
};

export const getPendingEventId = async () => {
  try {
    const eventId = await AsyncStorage.getItem('pendingEventId');
    return eventId;
  } catch (error) {
    console.error('❌ Error retrieving pending event ID:', error);
    return null;
  }
};

export const clearPendingEventId = async () => {
  try {
    await AsyncStorage.removeItem('pendingEventId');
    console.log('✅ Cleared pending event ID');
    return true;
  } catch (error) {
    console.error('❌ Error clearing pending event ID:', error);
    return false;
  }
};

export default {
  generateEventShareLink,
  generateShareMessage,
  parseEventDeepLink,
  handleDeepLink,
  handleSmartEventLink,
  handleLinkRedirect,
  openAppStore,
  handleIncomingDeepLink,
  storePendingEventId,
  getPendingEventId,
  clearPendingEventId,
  // Constants
  ANDROID_APP_SCHEME,
  IOS_APP_SCHEME,
  ANDROID_PACKAGE_NAME,
  IOS_BUNDLE_ID,
  IOS_APP_STORE_ID,
  WEB_BASE_URL,
  PLAY_STORE_URL,
  APP_STORE_URL,
  IOS_ITUNES_URL,
  IOS_UNIVERSAL_LINK
};
