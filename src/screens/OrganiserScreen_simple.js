import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Image,
  Dimensions,
  RefreshControl,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";

import EventService from "../services/apiService/event_service";
import EventModel from "../model/EventModel";

const { width, height } = Dimensions.get("window");
const isSmallDevice = width < 375;
const cardWidth = width * 0.9;

// Default event images for fallback
const getEventImage = (index) => {
  const images = [
    { uri: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80' },
    { uri: 'https://images.unsplash.com/photo-1536244636800-a3f74db0f3cf?auto=format&fit=crop&q=80' },
    { uri: 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?auto=format&fit=crop&q=80' },
    { uri: 'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?auto=format&fit=crop&q=80' },
    { uri: 'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?auto=format&fit=crop&q=80' },
  ];
  return images[index % images.length];
};

const OrganiserScreen = () => {
  const [viewTab, setViewTab] = useState("upcoming");
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [completedEvents, setCompletedEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  // API call
  const fetchEvents = useCallback(async () => {
    setApiError("");
    setLoading(true);
    try {
      const res = await EventService.getEvents(); // should return {status, events: []}
      if (res.status === true) {
        const allEvents = res.data.events.map((e) => new EventModel(e));
        setUpcomingEvents(allEvents.filter((ev) => !ev.isCompleted));
        setCompletedEvents(allEvents.filter((ev) => ev.isCompleted));
      } else {
        setUpcomingEvents([]);
        setCompletedEvents([]);
        setApiError("Failed to load events");
      }
    } catch (err) {
      setUpcomingEvents([]);
      setCompletedEvents([]);
      setApiError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents])
  );

  const renderEventCard = (event, index) => (
    <TouchableOpacity
      key={event.id}
      style={styles.eventCard}
      onPress={() => setSelectedEvent(event)}
      activeOpacity={0.9}
    >
      <Image 
        source={getEventImage(index)} 
        style={styles.eventImage} 
        resizeMode="cover" 
      />
      
      {/* Status Badge */}
      <View style={[styles.statusBadge, { 
        backgroundColor: event.isCompleted ? 'rgba(76, 175, 80, 0.9)' : 'rgba(255, 152, 0, 0.9)' 
      }]}>
        <Text style={styles.statusText}>
          {event.isCompleted ? '✓ Completed' : '🔥 Upcoming'}
        </Text>
      </View>

      {/* Event Content */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
        style={styles.eventOverlay}
      >
        <View style={styles.eventContent}>
          <Text style={styles.eventTitle} numberOfLines={2}>{event.name}</Text>
          
          <View style={styles.eventDetailRow}>
            <View style={styles.detailChip}>
              <Text style={styles.detailIcon}>📍</Text>
              <Text style={styles.detailText} numberOfLines={1}>{event.venue}</Text>
            </View>
          </View>

          <View style={styles.eventDetailRow}>
            <View style={styles.detailChip}>
              <Text style={styles.detailIcon}>📅</Text>
              <Text style={styles.detailText}>{event.startDate}</Text>
            </View>
          </View>

          <View style={styles.eventDetailRow}>
            <View style={styles.detailChip}>
              <Text style={styles.detailIcon}>👤</Text>
              <Text style={styles.detailText} numberOfLines={1}>{event.organisedBy}</Text>
            </View>
          </View>

          {/* Simple View Button */}
          <TouchableOpacity 
            style={styles.viewButton} 
            onPress={() => setSelectedEvent(event)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#feb47b', '#ff7e5f']}
              style={styles.viewButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.viewButtonText}>👁️ View Details</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.gradient}>
      {/* Loader overlay */}
      {loading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#feb47b" />
          <Text style={styles.loadingText}>Loading Events...</Text>
        </View>
      )}

      {/* Main Content */}
      {!selectedEvent ? (
        <ScrollView 
          style={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchEvents}
              colors={['#feb47b']}
              tintColor="#feb47b"
            />
          }
        >
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.titleAccent} />
              <Text style={styles.headerTitle}>Event Management</Text>
            </View>
            <Text style={styles.headerSubtitle}>Manage and track your events</Text>
          </View>

          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <LinearGradient
                colors={['rgba(255, 152, 0, 0.2)', 'rgba(255, 152, 0, 0.1)']}
                style={styles.statGradient}
              >
                <Text style={styles.statNumber}>{upcomingEvents.length}</Text>
                <Text style={styles.statLabel}>Upcoming</Text>
              </LinearGradient>
            </View>
            <View style={styles.statCard}>
              <LinearGradient
                colors={['rgba(76, 175, 80, 0.2)', 'rgba(76, 175, 80, 0.1)']}
                style={styles.statGradient}
              >
                <Text style={styles.statNumber}>{completedEvents.length}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </LinearGradient>
            </View>
          </View>

          {/* Tab Section */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, viewTab === "upcoming" && styles.activeTab]}
              onPress={() => setViewTab("upcoming")}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={viewTab === "upcoming" ? ['#feb47b', '#ff7e5f'] : ['transparent', 'transparent']}
                style={styles.tabGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={[styles.tabText, viewTab === "upcoming" && styles.activeTabText]}>
                  🔥 Upcoming Events
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, viewTab === "completed" && styles.activeTab]}
              onPress={() => setViewTab("completed")}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={viewTab === "completed" ? ['#feb47b', '#ff7e5f'] : ['transparent', 'transparent']}
                style={styles.tabGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={[styles.tabText, viewTab === "completed" && styles.activeTabText]}>
                  ✓ Completed Events
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {!!apiError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{apiError}</Text>
            </View>
          )}

          {/* Event List */}
          <View style={styles.eventsContainer}>
            {viewTab === "upcoming" && (
              <>
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map((event, index) => renderEventCard(event, index))
                ) : (
                  !loading && (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyIcon}>📅</Text>
                      <Text style={styles.emptyTitle}>No Upcoming Events</Text>
                      <Text style={styles.emptySubtitle}>Check back later for new events</Text>
                    </View>
                  )
                )}
              </>
            )}

            {viewTab === "completed" && (
              <>
                {completedEvents.length > 0 ? (
                  completedEvents.map((event, index) => renderEventCard(event, index))
                ) : (
                  !loading && (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyIcon}>✅</Text>
                      <Text style={styles.emptyTitle}>No Completed Events</Text>
                      <Text style={styles.emptySubtitle}>Completed events will appear here</Text>
                    </View>
                  )
                )}
              </>
            )}
          </View>
        </ScrollView>
      ) : (
        // Event Details View
        <ScrollView style={styles.detailsScrollView}>
          <View style={styles.detailsContainer}>
            {/* Back Button */}
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => setSelectedEvent(null)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['rgba(254, 180, 123, 0.2)', 'rgba(255, 126, 95, 0.2)']}
                style={styles.backButtonGradient}
              >
                <Text style={styles.backText}>← Back to Events</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Event Image */}
            <View style={styles.detailImageContainer}>
              <Image 
                source={getEventImage(0)} 
                style={styles.detailImage} 
                resizeMode="cover" 
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.detailImageOverlay}
              >
                <View style={[styles.statusBadge, styles.detailStatusBadge, { 
                  backgroundColor: selectedEvent.isCompleted ? 'rgba(76, 175, 80, 0.9)' : 'rgba(255, 152, 0, 0.9)' 
                }]}>
                  <Text style={styles.statusText}>
                    {selectedEvent.isCompleted ? '✓ Completed' : '🔥 Live Event'}
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {/* Event Details */}
            <View style={styles.detailsContent}>
              <Text style={styles.detailTitle}>{selectedEvent.name}</Text>
              
              <View style={styles.detailSection}>
                <View style={styles.detailItem}>
                  <View style={styles.detailIconContainer}>
                    <Text style={styles.detailItemIcon}>🆔</Text>
                  </View>
                  <View style={styles.detailItemContent}>
                    <Text style={styles.detailItemLabel}>Event ID</Text>
                    <Text style={styles.detailItemValue}>{selectedEvent.id}</Text>
                  </View>
                </View>

                <View style={styles.detailItem}>
                  <View style={styles.detailIconContainer}>
                    <Text style={styles.detailItemIcon}>📍</Text>
                  </View>
                  <View style={styles.detailItemContent}>
                    <Text style={styles.detailItemLabel}>Venue</Text>
                    <Text style={styles.detailItemValue}>{selectedEvent.venue}</Text>
                  </View>
                </View>

                <View style={styles.detailItem}>
                  <View style={styles.detailIconContainer}>
                    <Text style={styles.detailItemIcon}>📝</Text>
                  </View>
                  <View style={styles.detailItemContent}>
                    <Text style={styles.detailItemLabel}>Description</Text>
                    <Text style={styles.detailItemValue}>{selectedEvent.desc || 'No description available'}</Text>
                  </View>
                </View>

                <View style={styles.detailItem}>
                  <View style={styles.detailIconContainer}>
                    <Text style={styles.detailItemIcon}>📅</Text>
                  </View>
                  <View style={styles.detailItemContent}>
                    <Text style={styles.detailItemLabel}>Start Date</Text>
                    <Text style={styles.detailItemValue}>{selectedEvent.startDate}</Text>
                  </View>
                </View>

                <View style={styles.detailItem}>
                  <View style={styles.detailIconContainer}>
                    <Text style={styles.detailItemIcon}>🏁</Text>
                  </View>
                  <View style={styles.detailItemContent}>
                    <Text style={styles.detailItemLabel}>End Date</Text>
                    <Text style={styles.detailItemValue}>{selectedEvent.endDate}</Text>
                  </View>
                </View>

                <View style={styles.detailItem}>
                  <View style={styles.detailIconContainer}>
                    <Text style={styles.detailItemIcon}>👤</Text>
                  </View>
                  <View style={styles.detailItemContent}>
                    <Text style={styles.detailItemLabel}>Organised By</Text>
                    <Text style={styles.detailItemValue}>{selectedEvent.organisedBy}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { 
    flex: 1 
  },
  container: { 
    flex: 1,
  },
  
  // Header Styles
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleAccent: {
    backgroundColor: '#feb47b',
    width: 4,
    height: 28,
    marginRight: 12,
    borderRadius: 2,
  },
  headerTitle: {
    fontSize: isSmallDevice ? 24 : 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 16,
    fontWeight: '700',
  },

  // Stats Cards
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 15,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statGradient: {
    padding: 20,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '800',
  },

  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 10,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderColor: '#feb47b',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '800',
  },

  // Event Card Styles
  eventsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  eventCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  eventImage: {
    width: '100%',
    height: 200,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 2,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  eventOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
    justifyContent: 'flex-end',
  },
  eventContent: {
    padding: 20,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
    letterSpacing: 0.3,
  },
  eventDetailRow: {
    marginBottom: 8,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  detailText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    maxWidth: width * 0.6,
  },
  
  // Simple View Button (single button)
  viewButton: {
    marginTop: 15,
    borderRadius: 12,
    overflow: 'hidden',
  },
  viewButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Error and Empty States
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  errorIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  errorText: {
    color: '#ffcdd2',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
  },

  // Loader
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 100,
  },
  loadingText: {
    color: '#feb47b',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
    letterSpacing: 0.5,
  },

  // Detail View Styles
  detailsScrollView: {
    flex: 1,
  },
  detailsContainer: {
    flex: 1,
  },
  backButton: {
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  backButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(254, 180, 123, 0.3)',
    borderRadius: 12,
  },
  backText: {
    color: '#feb47b',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  detailImageContainer: {
    height: 250,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    padding: 16,
  },
  detailStatusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  detailsContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  detailTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 5,
    letterSpacing: 0.5,
  },
  detailSection: {
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailIconContainer: {
    backgroundColor: 'rgba(254, 180, 123, 0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(254, 180, 123, 0.3)',
  },
  detailItemIcon: {
    fontSize: 18,
  },
  detailItemContent: {
    flex: 1,
  },
  detailItemLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  detailItemValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
    lineHeight: 22,
  },
});

export default OrganiserScreen;
