import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Share,
  ScrollView,
  SafeAreaView,
  PixelRatio,
  Platform,
  Alert,
  BackHandler
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import EventService from "../services/apiService/event_service";
import NotificationBell from '../components/NotificationBell';
import { generateShareMessage, storePendingEventId } from '../utils/deepLinkUtils';

const { width } = Dimensions.get("window");
const scale = width / 375;
const normalize = (size) => Math.round(PixelRatio.roundToNearestPixel(size * scale));

export default function MyEventsScreen({ navigation }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [myEvents, setMyEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('current');

  const staticEventImages = [
    'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1605987747728-53465288b135?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&q=80',
  ];

  const fetchMyEvents = useCallback(async () => {
    try {
      const response = await EventService.getMyEvents();
      let eventsData = [];

      if ((response.status === "success" || response.code === 200) && response.data) {
        if (Array.isArray(response.data)) {
          eventsData = response.data;
        } else if (response.data.events && Array.isArray(response.data.events)) {
          eventsData = response.data.events;
        } else if (response.data.myEvents && Array.isArray(response.data.myEvents)) {
          eventsData = response.data.myEvents;
        }
      }

      console.log('📦 MyEvents fetched:', eventsData.length, 'events');

      if (eventsData.length > 0) {
        const processedEvents = eventsData.map((event, index) => ({
          ...event,
          image: event.event_pic 
            ? { uri: `https://rajasthanmotorsports.com/${event.event_pic}` }
            : { uri: staticEventImages[index % staticEventImages.length] }
        }));
        setMyEvents(processedEvents);
      } else {
        setMyEvents([]);
      }
    } catch (error) {
      console.error("Error fetching my events:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMyEvents();

      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        navigation.navigate('Drawer', { screen: 'Event' });
        return true;
      });

      return () => backHandler.remove();
    }, [fetchMyEvents])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchMyEvents();
    setIsRefreshing(false);
  }, [fetchMyEvents]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const dayMonthYear = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${dayMonthYear}, ${time}`;
  };

  const getStatusColor = () => '#185a9d';

  const getStatusIcon = (status, isPastEvent) => {
    if (isPastEvent) return '🏁';
    const normalizedStatus = status ? status.toString().toLowerCase().trim() : '';
    switch (normalizedStatus) {
      case 'upcoming':
      case 'pending':
      case 'active':
        return '⏰';
      case 'completed':
      case 'finished':
      case 'done':
        return '✅';
      case 'cancelled':
      case 'canceled':
      case 'inactive':
        return '❌';
      case 'in-progress':
      case 'ongoing':
      case 'live':
        return '🔄';
      default:
        return '📅';
    }
  };

  function EventCard({ item, navigation }) {
    const eventImage = item.image || { uri: staticEventImages[0] };
    const eventName = item.event_name || 'Unknown Event';
    const eventDate = item.event_start_date || 'Date TBD';
    const eventEndDate = item.event_end_date ? formatDate(item.event_end_date) : 'End date TBD';
    const eventVenue = item.event_venue || 'Venue TBD';
    const eventStatus = item.status || 'upcoming';
    const crewMembers = (item.crew_members || []).slice(0, 4);
    const isPastEvent = item.event_end_date && new Date(item.event_end_date) < new Date();

    const onShare = async () => {
      try {
        const shareData = generateShareMessage({
          event_id: item.event_id,
          event_name: eventName,
          event_venue: eventVenue,
          event_start_date: item.event_start_date
        });

        // ✅ Store event ID for auto-open when user installs app
        await storePendingEventId(item.event_id);

        // Platform-specific share handling with HTTPS store URL
        const shareOptions = Platform.select({
          android: {
            title: shareData.title,
            message: `${shareData.message}\n${shareData.url}`
          },
          ios: {
            title: shareData.title,
            message: shareData.message,
            url: shareData.url
          }
        });

        const result = await Share.share(shareOptions);
        
        if (result.action === Share.dismissedAction) {
          console.log('Share was dismissed');
        }
      } catch (error) {
        Alert.alert('Share Error', 'Failed to share event');
      }
    };

    const handleStartEvent = () => {
      try {
        if (navigation && typeof navigation.navigate === 'function') {
          navigation.navigate('EventStartScreen', { event: item });
        } else {
          alert('Navigation error: Unable to open Event Start Screen.');
        }
      } catch (e) {
        alert('Navigation error: ' + e.message);
      }
    };

    const handleViewResult = () => {
      if (navigation && typeof navigation.navigate === 'function') {
        navigation.navigate('ResultsScreen', { event: item });
      } else {
        alert('Navigation error: Unable to open Results Screen.');
      }
    };

    const renderChip = (children, backgroundColor) => (
      <View style={[styles.chip, backgroundColor ? { backgroundColor } : null]}>{children}</View>
    );

    return (
      <View style={styles.eventCard}>
        <LinearGradient colors={["#185a9d", "#43cea2"]} style={styles.cardGradient}>
          <View style={styles.glassOverlay} />
          <View style={styles.cardHeader}>
            <View style={styles.imageWrapper}>
              <Image source={eventImage} style={styles.eventImage} resizeMode="cover" />
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(eventStatus) }]}> 
                <Text style={styles.statusText}>
                  {getStatusIcon(eventStatus, isPastEvent)} {isPastEvent ? 'Event Finished' : eventStatus}
                </Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {renderChip(<><Text style={styles.chipIcon}>📅</Text><Text style={styles.chipText}>{item.event_start_date ? formatDate(item.event_start_date) : 'Date TBD'}</Text></>, undefined)}
              {renderChip(<><Text style={styles.chipIcon}>📅</Text><Text style={styles.chipText}>{item.event_end_date ? formatDate(item.event_end_date) : 'End date TBD'}</Text></>, undefined)}
              {renderChip(<><Text style={styles.chipIcon}>📍</Text><Text style={styles.chipText}>{eventVenue}</Text></>, undefined)}
            </ScrollView>
          </View>
          <View style={styles.eventContent}>
            <Text style={styles.eventName} numberOfLines={2}>{eventName}</Text>
            <View style={styles.categoryClassContainer}>
              {item.category_name && renderChip(<Text style={styles.chipText}>Category: {item.category_name}</Text>, 'rgba(255,255,255,0.18)')}
              {item.class_name && renderChip(<Text style={styles.chipText}>Class: {item.class_name}</Text>, 'rgba(255,255,255,0.18)')}
            </View>
            <View style={styles.featureBtnRow}>
              <TouchableOpacity style={styles.featureBtn} onPress={onShare}>
                <Text style={styles.featureBtnText}>Share Event</Text>
              </TouchableOpacity>
              {isPastEvent ? (
                <TouchableOpacity style={styles.featureBtn} onPress={handleViewResult}>
                  <Text style={styles.featureBtnText}>View Result</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.featureBtn} onPress={handleStartEvent}>
                  <Text style={styles.featureBtnText}>Start Event</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.crewSection}>
              <View style={styles.crewHeader}>
                <Text style={styles.crewEmoji}>👥</Text>
                <Text style={styles.crewTitle}>Crew Members ({crewMembers.length})</Text>
              </View>
              <View style={styles.crewMembersList}>
                {crewMembers.map((crew, index) => (
                  <View key={crew.id || index} style={styles.crewMemberCard}>
                    <View style={styles.crewAvatar}>
                      <Text style={styles.crewAvatarText}>
                        {crew.crew_name ? crew.crew_name.split(' ').map(n => n[0]).join('').toUpperCase() : '??'}
                      </Text>
                    </View>
                    <View style={styles.crewInfo}>
                      <Text style={styles.crewName} numberOfLines={1}>{crew.crew_name || 'Unknown Member'}</Text>
                      <View style={styles.crewDetails}>
                        <Text style={styles.crewContact} numberOfLines={1}>Mobile: {crew.crew_mobile || 'No contact'}</Text>
                        {crew.crew_email && <Text style={styles.crewContact} numberOfLines={1}>Email: {crew.crew_email}</Text>}
                        <View style={styles.crewMetadata}>
                          {crew.created_at && (
                            <Text style={styles.crewMetaText}>
                              Joined: {new Date(crew.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Filter events based on active tab
  const currentEvents = myEvents.filter(event => {
    if (!event.event_end_date) return true;
    return new Date(event.event_end_date) >= new Date();
  });
  const pastEvents = myEvents.filter(event => {
    if (!event.event_end_date) return false;
    return new Date(event.event_end_date) < new Date();
  });
  const displayedEvents = activeTab === 'current' ? currentEvents : pastEvents;

  const renderEventCard = ({ item }) => <EventCard item={item} navigation={navigation} />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.gradient}>
        {/* ✅ Fixed Header */}
        <View style={styles.headerBar}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Drawer', { screen: 'Event' })} 
            style={styles.headerBackBtn}
          >
            <Text style={styles.headerBackIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Events</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ✅ Always visible - motivation, stats, tabs */}
        <View style={styles.motivationContainer}>
          <Text style={styles.motivationText}>
            🌟 Keep exploring new adventures with your amazing crew!
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statIconWrapper}><Text style={styles.statIcon}>📅</Text></View>
            <View style={styles.statInfo}>
              <Text style={styles.statNumber}>{myEvents.length}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <View style={styles.statIconWrapper}><Text style={styles.statIcon}>👥</Text></View>
            <View style={styles.statInfo}>
              <Text style={styles.statNumber}>
                {myEvents.reduce((total, event) => total + (event.crew_members?.length || 0), 0)}
              </Text>
              <Text style={styles.statLabel}>Crew</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <View style={styles.statIconWrapper}><Text style={styles.statIcon}>✅</Text></View>
            <View style={styles.statInfo}>
              <Text style={styles.statNumber}>{pastEvents.length}</Text>
              <Text style={styles.statLabel}>Done</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'current' && styles.tabBtnActive]}
            onPress={() => setActiveTab('current')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'current' && styles.tabBtnTextActive]}>
              Current Events ({currentEvents.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'past' && styles.tabBtnActive]}
            onPress={() => setActiveTab('past')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'past' && styles.tabBtnTextActive]}>
              Past Events ({pastEvents.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ✅ Event list with pull-to-refresh */}
        <View style={{ flex: 1 }}>
          <FlatList
            data={displayedEvents}
            keyExtractor={(item) => item.event_id?.toString() || item.id?.toString() || Math.random().toString()}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={['#43cea2']}
                tintColor={'#43cea2'}
                title="Pull to refresh..."
                titleColor={'#43cea2'}
              />
            }
            renderItem={renderEventCard}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>{activeTab === 'current' ? '📅' : '🏁'}</Text>
                <Text style={styles.emptyTitle}>
                  {activeTab === 'current' ? 'No Current Events' : 'No Past Events'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {activeTab === 'current'
                    ? 'Pull down to refresh or join exciting events to see them here!'
                    : 'You don\'t have any completed events yet.'}
                </Text>
              </View>
            }
          />
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

// Styles remain exactly same as your previous code
const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#0f2027' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 56, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(67,206,162,0.18)', shadowColor: '#000', shadowOpacity: 0.10, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 4, zIndex: 10 },
  headerBackBtn: { padding: 6, justifyContent: 'center', alignItems: 'center', height: 40, width: 40 },
  headerBackIcon: { fontSize: 22, color: '#43cea2', fontWeight: '700', textAlign: 'center' },
  headerTitle: { fontSize: 20, color: '#fff', fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  statsContainer: { flexDirection: 'row', backgroundColor: 'transparent', borderRadius: 14, padding: 12, marginHorizontal: 15, borderWidth: 1, borderColor: 'rgba(67,206,162,0.3)', minHeight: 50 },
  statCard: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  statIconWrapper: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(67,206,162,0.12)', borderWidth: 1, borderColor: 'rgba(67,206,162,0.25)', justifyContent: 'center', alignItems: 'center' },
  statIcon: { fontSize: 12 },
  statInfo: { flex: 1 },
  statNumber: { fontSize: normalize(18), fontWeight: '800', color: '#43cea2', marginBottom: 1, textShadowColor: 'rgba(67,206,162,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  statLabel: { fontSize: normalize(10), color: '#e0e0e0', fontWeight: '600', opacity: 0.8, letterSpacing: 0.2 },
  statDivider: { width: 1, backgroundColor: 'rgba(67,206,162,0.3)', marginHorizontal: 8, height: 28 },
  motivationContainer: { paddingVertical: 12, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  motivationText: { fontSize: normalize(14), color: '#4CAF50', fontWeight: '700', textAlign: 'center', letterSpacing: 0.3, lineHeight: 22 },
  tabRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14, marginBottom: 10, paddingHorizontal: 15 },
  tabBtn: { backgroundColor: 'rgba(67,206,162,0.12)', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 16, marginHorizontal: 5 },
  tabBtnActive: { backgroundColor: '#43cea2' },
  tabBtnText: { color: '#43cea2', fontWeight: '700', fontSize: 14 },
  tabBtnTextActive: { color: '#fff' },
  listContainer: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 30, flexGrow: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#e0e0e0', marginTop: 15, textAlign: 'center' },
  eventCard: { width: '100%', maxWidth: 400, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 24, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.4, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 12, borderWidth: 1, borderColor: "rgba(254, 180, 123, 0.15)", overflow: 'hidden', alignSelf: 'center' },
  cardGradient: { borderRadius: 24, overflow: 'hidden' },
  glassOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 24, zIndex: 1, pointerEvents: 'none' },
  imageWrapper: { borderRadius: 20, overflow: 'hidden', marginBottom: 8, elevation: 6, shadowColor: '#feb47b', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, position: 'relative' },
  eventImage: { width: '100%', height: 180, borderRadius: 20 },
  statusBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, zIndex: 2, shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 4 },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  eventContent: { padding: 20, backgroundColor: 'rgba(15, 15, 20, 0.95)', borderTopWidth: 1, borderColor: 'rgba(254, 180, 123, 0.2)' },
  eventName: { fontSize: normalize(20), fontWeight: "800", color: "#fff", marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', marginRight: 6, marginBottom: 6 },
  chipIcon: { fontSize: 12, marginRight: 4, color: '#fff' },
  chipText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  categoryClassContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  featureBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  featureBtn: { flex: 1, marginRight: 6, paddingVertical: 10, borderRadius: 14, backgroundColor: '#43cea2', alignItems: 'center' },
  featureBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  crewSection: { marginTop: 8 },
  crewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  crewEmoji: { fontSize: 16, marginRight: 6 },
  crewTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  crewMembersList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  crewMemberCard: { flexDirection: 'row', alignItems: 'center', width: '48%', marginBottom: 8 },
  crewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#43cea2', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  crewAvatarText: { color: '#fff', fontWeight: '700' },
  crewInfo: { flex: 1 },
  crewName: { fontSize: 12, fontWeight: '700', color: '#fff', marginBottom: 2 },
  crewDetails: { flexDirection: 'column' },
  crewContact: { fontSize: 10, color: '#e0e0e0' },
  crewMetadata: { flexDirection: 'row', marginTop: 2 },
  crewMetaText: { fontSize: 10, color: '#43cea2', fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, color: '#fff', fontWeight: '700', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#ccc', textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 }
})