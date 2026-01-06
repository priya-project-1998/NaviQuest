import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BannerService from "../services/apiService/banner_service";
import EventService from "../services/apiService/event_service";
import { formatEventStartEndDateTime } from "../utils/helpers";
import { isEventActive } from "../utils/eventFilter";

const { width, height } = Dimensions.get("window");
const isSmallDevice = width < 375; // For iPhone SE and similar small devices
const responsiveWidth = width * 0.9; // 90% of screen width
const bannerHeight = height * 0.28; // Approximately 28% of screen height
const cardWidth = (width * 0.44); // Slightly less than 50% to account for margins

export default function Dashboard({ navigation }) {
  const [autoPlayTimer, setAutoPlayTimer] = useState(null);
  const [activeBanner, setActiveBanner] = useState(0);
  const [banners, setBanners] = useState([]);
  const [events, setEvents] = useState([]);
  const [isLoadingBanners, setIsLoadingBanners] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const bannerRef = useRef(null);

  // Check authentication status
  const checkAuthentication = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      setIsAuthenticated(!!token);
      return !!token;
    } catch (error) {
      setIsAuthenticated(false);
      return false;
    }
  };

  // Refresh function for pull-to-refresh
  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchBanners(),
        fetchEvents()
      ]);
    } catch (error) {
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch banners from API
  const fetchBanners = async () => {
    try {
      setIsLoadingBanners(true);
      const hasAuth = await checkAuthentication();
      if (!hasAuth) {
        setShowAuthPrompt(true);
        setBanners([]); // No fallback banners
        return;
      }
      const response = await BannerService.getBanners();
      if (response.status && response.data) {
        const bannersWithImages = response.data.map((banner) => ({
          ...banner,
          image: banner.image_url 
            ? { uri: `https://rajasthanmotorsports.com/${banner.image_url}` }
            : null,
          subtitle: `Event ID: ${banner.event_id || 'N/A'}`,
          date: banner.created_date
            ? new Date(banner.created_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : '',
        })).filter(b => b.image); // Only banners with images
        setBanners(bannersWithImages);
      } else {
        setBanners([]); // No fallback
      }
    } catch (error) {
      setBanners([]); // No fallback
    } finally {
      setIsLoadingBanners(false);
    }
  };

  // Fetch events from API
  const fetchEvents = async () => {
    try {
      setIsLoadingEvents(true);
      const hasAuth = await checkAuthentication();
      if (!hasAuth) {
        setShowAuthPrompt(true);
        setEvents([]); // No fallback events
        return;
      }
      const response = await EventService.getEvents();
      let eventsArray = [];
      if (response.status === "success" && response.data && Array.isArray(response.data)) {
        eventsArray = response.data;
      } else if (response.status === "success" && response.data && response.data.events && Array.isArray(response.data.events)) {
        eventsArray = response.data.events;
      } else if (response.code === 200 && response.data) {
        if (Array.isArray(response.data)) {
          eventsArray = response.data;
        } else if (response.data.events && Array.isArray(response.data.events)) {
          eventsArray = response.data.events;
        }
      }
      if (eventsArray.length > 0) {
        const eventsWithImages = eventsArray
          .map((event) => ({
            ...event,
            image: event.event_pic 
              ? { uri: `https://rajasthanmotorsports.com/${event.event_pic}` }
              : null,
          }))
          .filter(e => e.image && isEventActive(e.event_end_date)); // Only events with images and not ended
        setEvents(eventsWithImages);
      } else {
        setEvents([]); // No fallback
      }
    } catch (error) {
      setEvents([]); // No fallback
    } finally {
      setIsLoadingEvents(false);
    }
  };

  React.useEffect(() => {
    fetchBanners();
    fetchEvents();
    return () => {
      if (autoPlayTimer) clearInterval(autoPlayTimer);
    };
  }, []);

  // Update global loading state when individual loading states change
  React.useEffect(() => {
    setIsLoading(isLoadingBanners || isLoadingEvents);
  }, [isLoadingBanners, isLoadingEvents]);

  // Start autoplay when banners are loaded
  React.useEffect(() => {
    if (banners.length > 0) {
      startAutoPlay();
    }
    return () => {
      if (autoPlayTimer) clearInterval(autoPlayTimer);
    };
  }, [banners]);

  const startAutoPlay = () => {
    const timer = setInterval(() => {
      if (bannerRef.current && banners.length > 0) {
        const nextIndex = (activeBanner + 1) % banners.length;
        bannerRef.current.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        setActiveBanner(nextIndex);
      }
    }, 3000); // Change banner every 3 seconds
    setAutoPlayTimer(timer);
  };

  // 🔹 On scroll event to set active dot
  const onViewRef = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0 && banners.length > 0) {
      setActiveBanner(viewableItems[0].index);
    }
  });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.gradient}>
      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#feb47b" />
            <Text style={styles.loadingText}>Please wait...</Text>
            <Text style={styles.loadingSubText}>Please wait while we fetch the latest content</Text>
          </View>
        </View>
      )}

      {/* Authentication Prompt */}
      {showAuthPrompt && !isLoading && (
        <View style={styles.authPromptOverlay}>
          <View style={styles.authPromptContainer}>
            <Text style={styles.authPromptTitle}>🔐 Login Required</Text>
            <Text style={styles.authPromptText}>
              To access the latest events and banners, please log in to your account.
            </Text>
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => {
                if (navigation) {
                  navigation.navigate('LoginScreen');
                } else {
                  Alert.alert("Login Required", "Please navigate to login screen to access full content.");
                }
              }}
            >
              <Text style={styles.loginButtonText}>Go to Login</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.continueButton}
              onPress={() => setShowAuthPrompt(false)}
            >
              <Text style={styles.continueButtonText}>Continue with limited content</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      <FlatList
        ListHeaderComponent={
          <>
            {/* 🔹 Banner Carousel */}
            <FlatList
              ref={bannerRef}
              data={banners}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={{ width, height: bannerHeight }}>
                  <View style={[styles.bannerContainer, { height: bannerHeight - 30 }]}>
                    <Image source={item.image} style={styles.bannerImage} resizeMode="cover" />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.9)"]}
                      style={styles.bannerOverlay}
                    >
                      <Text style={styles.bannerTitle}>{item.title}</Text>
                      <Text style={styles.bannerDate}>🗓 {item.date}</Text>
                    </LinearGradient>
                  </View>
                </View>
              )}
              onViewableItemsChanged={onViewRef.current}
              viewabilityConfig={viewConfigRef.current}
            />

            {/* 🔹 Banner Dots */}
            <View style={styles.dotsContainer}>
              {banners.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    if (bannerRef.current && banners.length > 0) {
                      bannerRef.current.scrollToIndex({
                        index: index,
                        animated: true
                      });
                      setActiveBanner(index);
                    }
                  }}
                >
                  <View
                    style={[styles.dot, activeBanner === index && styles.activeDot]}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 10,
              marginBottom: 15,
            }}>
              <View style={{
                backgroundColor: '#feb47b',
                width: 3,
                height: 24,
                marginRight: 12,
                marginLeft: width * 0.04,
                borderRadius: 2,
              }} />
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              <View style={{
                position: 'absolute',
                right: width * 0.04,
                backgroundColor: 'rgba(254, 180, 123, 0.15)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(254, 180, 123, 0.3)',
              }}>
                <Text style={{
                  color: '#feb47b',
                  fontSize: isSmallDevice ? 11 : 12,
                  fontWeight: '600',
                }}>
                  {events.length} Events
                </Text>
              </View>
            </View>
          </>
        }
        data={events}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between", paddingHorizontal: width * 0.02 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#feb47b']} // Android
            tintColor={'#feb47b'} // iOS
            title="Pull to refresh..." // iOS
            titleColor={'#feb47b'} // iOS
          />
        }
        renderItem={({ item }) => {
          const { startDate, endDate } = formatEventStartEndDateTime(
            item.event_start_date, 
            item.event_end_date
          );
          
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                // Map event data to OrganiserScreen expected format
                const eventObj = {
                  id: item.id,
                  event_name: item.event_name,
                  event_venue: item.event_venue,
                  event_start_date: item.event_start_date,
                  event_end_date: item.event_end_date,
                  event_organised_by: item.event_organised_by,
                  pic: item.image.uri,
                  //event_pic: item.image.uri,
                  headerImg: item.image?.uri,
                  event_desc: item.event_desc || '',
                  isCompleted: item.isCompleted || false,
                  // Add other fields as needed
                };
                navigation.navigate('Event', { event: eventObj });
              }}
            >
              <View style={styles.eventCard}>
                <Image source={item.image} style={styles.eventImage} resizeMode="cover" />
                <View style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: 'rgba(0, 0, 0, 0.75)',
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#feb47b',
                }}>
                  <Text style={[styles.eventOrg, { 
                    fontSize: 11,
                    color: '#feb47b',
                    textShadowColor: 'rgba(0, 0, 0, 0.75)',
                    textShadowOffset: {width: 0, height: 1},
                    textShadowRadius: 3,
                  }]} numberOfLines={1}>{item.event_organised_by}</Text>
                </View>
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.9)']}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    height: 130,
                    opacity: 0.95,
                  }}
                />
                <View style={styles.eventContent}>
                  <Text style={styles.eventName}>{item.event_name}</Text>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      marginBottom: 6,
                    }}>
                      <Text style={[styles.eventVenue, { marginBottom: 0 }]}>
                        <Text style={{ fontSize: 14, opacity: 0.9 }}>📍</Text> {item.event_venue}
                      </Text>
                    </View>
                  </View>
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}>
                    {/* Start Date */}
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      paddingVertical: 3,
                      paddingHorizontal: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.15)',
                    }}>
                      <Text style={[styles.eventDate, { fontSize: 11, marginBottom: 0 }]}>
                        <Text style={{ fontSize: 11, opacity: 0.9 }}>📅</Text> {startDate}
                      </Text>
                    </View>
                    
                    {/* End Date - Show when endDate exists */}
                    {endDate && (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        paddingVertical: 3,
                        paddingHorizontal: 6,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.15)',
                      }}>
                        <Text style={[styles.eventDate, { 
                          fontSize: 11, 
                          marginBottom: 0
                        }]}>
                          <Text style={{ fontSize: 11, opacity: 0.9 }}>
                            {startDate === endDate ? '🕐' : '🏁'}
                          </Text> {endDate}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },

  // Loading overlay styles
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(254, 180, 123, 0.3)',
  },
  loadingText: {
    color: '#feb47b',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
    textAlign: 'center',
  },
  loadingSubText: {
    color: '#e0e0e0',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.8,
  },

  // Authentication prompt styles
  authPromptOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  authPromptContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    margin: 20,
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(254, 180, 123, 0.3)',
  },
  authPromptTitle: {
    color: '#feb47b',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 15,
    textAlign: 'center',
  },
  authPromptText: {
    color: '#e0e0e0',
    fontSize: 16,
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 22,
  },
  loginButton: {
    backgroundColor: '#feb47b',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 15,
    width: '80%',
  },
  loginButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    width: '80%',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },

  bannerContainer: {
    margin: 15,
    height: 190,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  bannerImage: { 
    width: "100%", 
    height: "100%",
    borderRadius: 20,
  },
  bannerOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    height: "100%",
    justifyContent: "flex-end",
    borderRadius: 20,
  },
  bannerTitle: { 
    fontSize: isSmallDevice ? 24 : 28, 
    color: "#fff", 
    fontWeight: "bold",
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: -1, height: 1},
    textShadowRadius: 10,
    marginBottom: 8,
  },
  bannerSubtitle: {
    fontSize: 16,
    color: "#e0e0e0",
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: -1, height: 1},
    textShadowRadius: 10,
  },
  bannerDate: {
    fontSize: 14,
    color: "#feb47b",
    fontWeight: "600",
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: -1, height: 1},
    textShadowRadius: 10,
  },

  dotsContainer: { 
    flexDirection: "row", 
    justifyContent: "center", 
    marginTop: -25,
    marginBottom: 15,
    zIndex: 1,
  },
  dot: { 
    height: 6, 
    width: 6, 
    backgroundColor: "rgba(255,255,255,0.4)", 
    marginHorizontal: 3, 
    borderRadius: 3,
  },
  activeDot: { 
    backgroundColor: "#feb47b", 
    width: 18,
  },

  sectionTitle: { 
    fontSize: isSmallDevice ? 22 : 24, 
    fontWeight: "800", 
    color: "#fff", 
    marginVertical: 20,
    marginLeft: width * 0.04,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 5,
    letterSpacing: 0.5,
    position: 'relative',
  },

  eventCard: {
    width: cardWidth,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: isSmallDevice ? 16 : 20,
    marginBottom: 16,
    marginHorizontal: width * 0.02,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: 'hidden',
    position: 'relative',
  },
  eventImage: {
    width: '100%',
    height: width * 0.32,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  eventContent: {
    padding: 12,
    paddingTop: 10,
    backgroundColor: 'rgba(15, 15, 20, 0.85)',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backdropFilter: 'blur(12px)',
  },
  eventName: { 
    fontSize: isSmallDevice ? 14 : 16, 
    fontWeight: "700", 
    color: "#feb47b",
    marginBottom: 8,
    textShadowColor: 'rgba(254, 180, 123, 0.4)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
    letterSpacing: 0.3,
    lineHeight: 20,
  },
  eventVenue: { 
    fontSize: isSmallDevice ? 11 : 13, 
    color: "#ffffff", 
    marginBottom: 6,
    fontWeight: "600",
    opacity: 0.95,
    letterSpacing: 0.2,
  },
  eventDate: { 
    fontSize: 12, 
    color: "#f0f0f0",
    letterSpacing: 0.2,
    opacity: 0.9,
    fontWeight: "500",
  },
  eventTime: { 
    fontSize: 12, 
    color: "#feb47b",
    letterSpacing: 0.2,
    opacity: 1,
    fontWeight: "600",
  },
  eventOrg: { 
    fontSize: 12, 
    color: "#feb47b",
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
