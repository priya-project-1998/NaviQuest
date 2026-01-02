import { Linking, Platform } from 'react-native';

/**
 * Deep Link Utility for VCM App
 * Handles generating and parsing deep links for event sharing
 */

const APP_SCHEME = 'vcmapp://';
const WEB_BASE_URL = 'https://rajasthanmotorsports.com';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.vcmapp';
const APP_STORE_URL = 'https://apps.apple.com/app/vcmapp/id123456789';

/**
 * Generate a shareable link for an event
 * @param {Object} eventData - Event data object
 * @returns {Object} - Contains both deep link and web link
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

  const deepLink = `${APP_SCHEME}event/${eventId}?${params.toString()}`;
  const webLink = `${WEB_BASE_URL}/event/${eventId}?${params.toString()}`;

  return {
    deepLink,
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
 * @returns {Object} - Share message and URL
 */
export const generateShareMessage = (eventData) => {
  const linkData = generateEventShareLink(eventData);
  
  const message = `Check out this event:\n${linkData.eventName}\nVenue: ${linkData.eventVenue}\nDate: ${new Date(linkData.eventDate).toLocaleDateString()}\n\nJoin here: ${linkData.webLink}`;

  return {
    message,
    url: linkData.webLink,
    title: `Join ${linkData.eventName}`,
    ...linkData
  };
};

/**
 * Parse deep link URL and extract event parameters
 * @param {string} url - Deep link URL
 * @returns {Object} - Parsed event data
 */
export const parseEventDeepLink = (url) => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Extract event ID from path (/event/123)
    const eventId = pathParts[pathParts.length - 1];
    
    // Extract parameters from query string
    const params = new URLSearchParams(urlObj.search);
    
    return {
      eventId,
      eventName: params.get('name') || 'Event',
      venue: params.get('venue') || 'Venue',
      date: params.get('date') || new Date().toISOString(),
      success: true
    };
  } catch (error) {
    console.log('Error parsing deep link:', error);
    return {
      success: false,
      error: 'Invalid deep link format'
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
 * Handle incoming deep link when app is opened
 * @param {Function} navigationRef - Navigation reference
 */
export const handleIncomingDeepLink = (url, navigationRef) => {
  const parsedData = parseEventDeepLink(url);
  
  if (parsedData.success && navigationRef?.current) {
    // Navigate to JoinEventScreen with parsed data
    navigationRef.current.navigate('JoinEventScreen', {
      eventId: parsedData.eventId,
      eventName: parsedData.eventName,
      venue: parsedData.venue,
      date: parsedData.date,
      fromDeepLink: true
    });
    
    return true;
  }
  
  return false;
};

/**
 * Share event using native share functionality
 * @param {Object} eventData - Event data object
 */
export const shareEvent = async (eventData) => {
  try {
    const shareData = generateShareMessage(eventData);
    
    const result = await Share.share({
      message: shareData.message,
      url: shareData.url, // For iOS
      title: shareData.title,
    });

    return { success: true, result };
  } catch (error) {
    console.log('Error sharing event:', error);
    return { success: false, error: error.message };
  }
};

export default {
  generateEventShareLink,
  generateShareMessage,
  parseEventDeepLink,
  handleDeepLink,
  openAppStore,
  handleIncomingDeepLink,
  shareEvent,
  APP_SCHEME,
  WEB_BASE_URL,
  PLAY_STORE_URL,
  APP_STORE_URL
};
