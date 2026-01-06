import React from "react";
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from "react-native";
import colors from '../constants/colors';

export default function EventDetailsView({ event, onBack }) {
  if (!event) return null;
  console.log('Event Details:', event);

  // Support both EventModel properties and raw event objects
  const eventName = event.name || event.event_name || 'Untitled Event';
  const eventVenue = event.venue || event.event_venue || 'N/A';
  const eventDesc = event.desc || event.event_desc || 'No description available';
  const eventStartDate = event.startDate || event.event_start_date || 'N/A';
  const eventEndDate = event.endDate || event.event_end_date || 'N/A';
  const eventOrganisedBy = event.organisedBy || event.event_organised_by || 'N/A';
  
  // Handle image from multiple sources
  let eventImage = null;
  if (event.pic) {
    eventImage = event.pic;
  } else if (event.headerImg) {
    eventImage = event.headerImg;
  } else if (event.event_pic) {
    eventImage = event.event_pic;
  } else if (event.image && typeof event.image === 'object' && event.image.uri) {
    // Handle {uri: '...'} format from MyEventsScreen
    eventImage = event.image.uri;
  } else if (event.image && typeof event.image === 'string') {
    eventImage = event.image;
  }
  
  // If eventImage doesn't start with http, prepend base URL
  if (eventImage && !eventImage.startsWith('http://') && !eventImage.startsWith('https://')) {
    eventImage = `https://rajasthanmotorsports.com/${eventImage}`;
  }

  return (
    <View style={[styles.bgSoft, { backgroundColor: colors.background }]}> 
      <ScrollView style={styles.detailsScrollView} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.detailsContainer}>
          {onBack && (
            <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.accent }]} onPress={onBack} activeOpacity={0.8}>
              <Text style={[styles.backText, { color: colors.card }]}>← Back to Events</Text>
            </TouchableOpacity>
          )}
          <View style={[styles.detailImageContainer, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Image 
              source={eventImage ? { uri: eventImage } : { uri: 'https://via.placeholder.com/400x200/333333/ffffff?text=Event+Image' }} 
              style={styles.detailImage} 
              resizeMode="cover" 
            />
          </View>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.detailTitle, { color: colors.accent }]}>{eventName}</Text>
            <View style={styles.detailSection}>
              <View style={[styles.detailItem, { backgroundColor: colors.background, borderColor: colors.border }]}> 
                <View style={[styles.detailIconContainer, { backgroundColor: colors.accent, borderColor: colors.border }]}><Text style={styles.detailItemIcon}>📍</Text></View>
                <View style={styles.detailItemContent}><Text style={[styles.detailItemLabel, { color: colors.light }]} >Venue</Text><Text style={[styles.detailItemValue, { color: colors.text }]}>{eventVenue}</Text></View>
              </View>
              <View style={[styles.detailItem, { backgroundColor: colors.background, borderColor: colors.border }]}> 
                <View style={[styles.detailIconContainer, { backgroundColor: colors.accent, borderColor: colors.border }]}><Text style={styles.detailItemIcon}>📝</Text></View>
                <View style={styles.detailItemContent}><Text style={[styles.detailItemLabel, { color: colors.light }]} >Description</Text><Text style={[styles.detailItemValue, { color: colors.text }]}>{eventDesc}</Text></View>
              </View>
              <View style={[styles.detailItem, { backgroundColor: colors.background, borderColor: colors.border }]}> 
                <View style={[styles.detailIconContainer, { backgroundColor: colors.accent, borderColor: colors.border }]}><Text style={styles.detailItemIcon}>📅</Text></View>
                <View style={styles.detailItemContent}><Text style={[styles.detailItemLabel, { color: colors.light }]} >Start Date</Text><Text style={[styles.detailItemValue, { color: colors.text }]}>{eventStartDate}</Text></View>
              </View>
              <View style={[styles.detailItem, { backgroundColor: colors.background, borderColor: colors.border }]}> 
                <View style={[styles.detailIconContainer, { backgroundColor: colors.accent, borderColor: colors.border }]}><Text style={styles.detailItemIcon}>🏁</Text></View>
                <View style={styles.detailItemContent}><Text style={[styles.detailItemLabel, { color: colors.light }]} >End Date</Text><Text style={[styles.detailItemValue, { color: colors.text }]}>{eventEndDate}</Text></View>
              </View>
              <View style={[styles.detailItem, { backgroundColor: colors.background, borderColor: colors.border }]}> 
                <View style={[styles.detailIconContainer, { backgroundColor: colors.accent, borderColor: colors.border }]}><Text style={styles.detailItemIcon}>👤</Text></View>
                <View style={styles.detailItemContent}><Text style={[styles.detailItemLabel, { color: colors.light }]} >Organised By</Text><Text style={[styles.detailItemValue, { color: colors.text }]}>{eventOrganisedBy}</Text></View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bgSoft: { flex: 1 },
  detailsScrollView: { flex: 1 },
  detailsContainer: { flex: 1 },
  backButton: { margin: 20, borderRadius: 12, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  backText: { fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  detailImageContainer: { height: 200, marginHorizontal: 20, marginBottom: 20, borderRadius: 16, overflow: 'hidden', borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  detailImage: { width: '100%', height: '100%' },
  card: { borderRadius: 20, padding: 20, marginHorizontal: 16, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.10, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 8, borderWidth: 1 },
  detailTitle: { fontSize: 24, fontWeight: '800', marginBottom: 20, letterSpacing: 0.4, lineHeight: 28 },
  detailSection: { gap: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  detailIconContainer: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1 },
  detailItemIcon: { fontSize: 16 },
  detailItemContent: { flex: 1 },
  detailItemLabel: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 4, letterSpacing: 0.2, textTransform: 'uppercase' },
  detailItemValue: { fontSize: 14, color: '#333', fontWeight: '600', lineHeight: 18, letterSpacing: 0.2 },
});
