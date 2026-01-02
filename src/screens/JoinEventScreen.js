import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function JoinEventScreen({ navigation, route }) {
  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState(null);
  const [joining, setJoining] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Extract event ID from deep link params
  const eventId = route?.params?.eventId || route?.params?.event_id;
  const eventName = route?.params?.eventName || route?.params?.name;
  const eventVenue = route?.params?.venue || route?.params?.event_venue;
  const eventDate = route?.params?.date || route?.params?.event_start_date;

  useEffect(() => {
    checkLoginStatus();
    if (eventId) {
      fetchEventDetails();
    } else {
      setLoading(false);
    }
  }, [eventId]);

  const checkLoginStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      setIsLoggedIn(!!token);
    } catch (error) {
      console.log('Error checking login status:', error);
      setIsLoggedIn(false);
    }
  };

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      // Mock event data - replace with actual API call
      const mockEventData = {
        event_id: eventId,
        event_name: eventName || 'Trail Hunt Event',
        event_venue: eventVenue || 'Event Venue',
        event_start_date: eventDate || new Date().toISOString(),
        description: 'Join this exciting trail hunt event and test your navigation skills!',
        participants_count: 25,
        max_participants: 50,
        entry_fee: 'Free',
        duration: '3 hours',
        difficulty: 'Medium'
      };
      
      setEventData(mockEventData);
    } catch (error) {
      console.log('Error fetching event details:', error);
      Alert.alert('Error', 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinEvent = async () => {
    if (!isLoggedIn) {
      Alert.alert(
        'Login Required',
        'You need to login to join this event',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Login', 
            onPress: () => navigation.navigate('LoginScreen', { 
              returnTo: 'JoinEventScreen', 
              eventId 
            }) 
          }
        ]
      );
      return;
    }

    try {
      setJoining(true);
      
      // Mock API call to join event
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        'Success!', 
        'You have successfully joined the event!',
        [
          { 
            text: 'OK', 
            onPress: () => navigation.navigate('Drawer', { screen: 'Dashboard' })
          }
        ]
      );
    } catch (error) {
      console.log('Error joining event:', error);
      Alert.alert('Error', 'Failed to join event. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const openPlayStore = () => {
    const playStoreUrl = Platform.OS === 'android' 
      ? 'https://play.google.com/store/apps/details?id=com.vcmapp' 
      : 'https://apps.apple.com/app/vcmapp/id123456789';
    
    Linking.openURL(playStoreUrl).catch(err => {
      console.log('Error opening app store:', err);
      Alert.alert('Error', 'Could not open app store');
    });
  };

  if (loading) {
    return (
      <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#43cea2" />
          <Text style={styles.loadingText}>Loading event details...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!eventData) {
    return (
      <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Event Not Found</Text>
          <Text style={styles.errorText}>
            The event you're looking for could not be found.
          </Text>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Drawer', { screen: 'Dashboard' })}
          >
            <LinearGradient colors={["#43cea2", "#185a9d"]} style={styles.buttonGradient}>
              <Text style={styles.buttonText}>Go to Dashboard</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join Event</Text>
        </View>

        {/* Event Banner */}
        <View style={styles.bannerContainer}>
          <LinearGradient colors={["#43cea2", "#185a9d"]} style={styles.bannerGradient}>
            <Text style={styles.bannerIcon}>🏁</Text>
          </LinearGradient>
        </View>

        {/* Event Info Card */}
        <View style={styles.eventCard}>
          <Text style={styles.eventTitle}>{eventData.event_name}</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📅</Text>
            <Text style={styles.infoLabel}>Date:</Text>
            <Text style={styles.infoValue}>
              {new Date(eventData.event_start_date).toLocaleDateString()}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoLabel}>Venue:</Text>
            <Text style={styles.infoValue}>{eventData.event_venue}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>⏱️</Text>
            <Text style={styles.infoLabel}>Duration:</Text>
            <Text style={styles.infoValue}>{eventData.duration}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>👥</Text>
            <Text style={styles.infoLabel}>Participants:</Text>
            <Text style={styles.infoValue}>
              {eventData.participants_count}/{eventData.max_participants}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>💰</Text>
            <Text style={styles.infoLabel}>Entry Fee:</Text>
            <Text style={styles.infoValue}>{eventData.entry_fee}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📊</Text>
            <Text style={styles.infoLabel}>Difficulty:</Text>
            <Text style={styles.infoValue}>{eventData.difficulty}</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionTitle}>About This Event</Text>
          <Text style={styles.descriptionText}>{eventData.description}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleJoinEvent}
            disabled={joining}
          >
            <LinearGradient colors={["#43cea2", "#185a9d"]} style={styles.buttonGradient}>
              {joining ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Join Event</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={openPlayStore}
          >
            <LinearGradient colors={["#185a9d", "#43cea2"]} style={styles.buttonGradient}>
              <Text style={styles.buttonText}>Get Full App</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Login Status */}
        {!isLoggedIn && (
          <View style={styles.loginPrompt}>
            <Text style={styles.loginPromptText}>
              💡 You need to login to participate in events
            </Text>
          </View>
        )}

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#43cea2',
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 24,
    color: '#FF6B6B',
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    padding: 12,
    backgroundColor: 'rgba(67,206,162,0.12)',
    borderRadius: 22,
    marginRight: 15,
  },
  backIcon: {
    fontSize: 20,
    color: '#43cea2',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
    marginRight: 50, // Compensate for back button
  },
  bannerContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  bannerGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#43cea2',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  bannerIcon: {
    fontSize: 40,
    color: '#203a43',
    fontWeight: 'bold',
  },
  eventCard: {
    width: width * 0.9,
    backgroundColor: 'rgba(15,15,20,0.95)',
    borderRadius: 20,
    padding: 25,
    marginVertical: 15,
    borderWidth: 1,
    borderColor: 'rgba(67,206,162,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#43cea2',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 25,
  },
  infoLabel: {
    fontSize: 16,
    color: '#e0e0e0',
    fontWeight: '500',
    width: 90,
  },
  infoValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    flex: 1,
  },
  descriptionCard: {
    width: width * 0.9,
    backgroundColor: 'rgba(15,15,20,0.95)',
    borderRadius: 20,
    padding: 25,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(67,206,162,0.18)',
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#43cea2',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 15,
    color: '#e0e0e0',
    lineHeight: 22,
  },
  actionContainer: {
    width: width * 0.9,
    marginVertical: 20,
  },
  actionButton: {
    borderRadius: 15,
    marginVertical: 8,
    shadowColor: '#43cea2',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 5,
  },
  secondaryButton: {
    marginTop: 15,
  },
  buttonGradient: {
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loginPrompt: {
    width: width * 0.9,
    backgroundColor: 'rgba(255,193,7,0.15)',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,193,7,0.3)',
  },
  loginPromptText: {
    fontSize: 14,
    color: '#FFC107',
    textAlign: 'center',
    fontWeight: '600',
  },
});
