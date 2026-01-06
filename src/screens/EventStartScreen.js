import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Share, Alert, Modal } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationBell from '../components/NotificationBell';
import EventService from "../services/apiService/event_service";
import { generateShareMessage } from '../utils/deepLinkUtils';

const { width } = Dimensions.get("window");

export default function EventStartScreen({ navigation, route }) {
  const event = route?.params?.event || {
    name: "Mahindra Adventure Trail Hunt : Comp# 030",
    date: "Jul, 20, 2025",
    flagOff: "11:15hrs",
    speedLimit: "60 kmph",
    duration: "3h 0mins",
    gpsAccuracy: "8 Meters",
    status: {
      approved: true,
      location: true,
      time: true,
      message: "All Good To Start."
    }
  };
  if (event.eventId) delete event.eventId;
  if (event.categoryId) delete event.categoryId;
  if (event.participantId) delete event.participantId;

  const status = event?.status || { approved: false, location: false, time: false, message: "Status Unknown" };
  const flagOff = event?.flagOff ?? "";

  // Extract fields from event object
  const eventName = event.event_name || event.name || 'Event Name N/A';
  const eventStartDate = event.event_start_date || event.date || 'Start Date N/A';
  const eventEndDate = event.event_end_date || 'End Date N/A';
  const eventVenue = event.event_venue || event.venue || 'Venue N/A';
  const eventId = event.event_id || 'Event ID N/A';
  const eventCategoryId = event.category_id || 'Category ID N/A';
  const eventDateCombined = `${eventStartDate} - ${eventEndDate}`;

  // Timer logic
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(true);
  const [startPressed, setStartPressed] = useState(false);
  const [startMessage, setStartMessage] = useState("");
  const [showStartModal, setShowStartModal] = useState(false);
  const [canStartEvent, setCanStartEvent] = useState(false);
  const [isEventCompleted, setIsEventCompleted] = useState(false); // Track if event is completed
  const [isEventAborted, setIsEventAborted] = useState(false); // Track if event was aborted

  // Config state
  const [eventConfig, setEventConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState(null);

  // ✅ Check if event is already completed or aborted on mount
  useEffect(() => {
    async function checkEventStatus() {
      try {
        const status = await AsyncStorage.getItem(`event_${eventId}_status`);
        const abortFlag = await AsyncStorage.getItem(`event_${eventId}_aborted`);
        
        if (status === 'completed') {
          setIsEventCompleted(true);
          console.log(`✅ Event ${eventId} is already completed - hiding START button`);
        } else {
          setIsEventCompleted(false);
          console.log(`📍 Event ${eventId} status: ${status || 'not found'} - showing START button`);
        }
        
        if (abortFlag === 'true') {
          setIsEventAborted(true);
          console.log(`⚠️ Event ${eventId} was aborted - disabling START button`);
        } else {
          setIsEventAborted(false);
        }
      } catch (error) {
        console.error('❌ Error checking event status:', error);
        setIsEventCompleted(false); // Show START button on error
        setIsEventAborted(false);
      }
    }
    
    if (eventId && eventId !== 'Event ID N/A') {
      checkEventStatus();
    }
  }, [eventId]);

  useEffect(() => {
    // Fetch event config on mount
    async function fetchConfig() {
      setConfigLoading(true);
      setConfigError(null);
      if (!event.event_id || event.event_id === 'Event ID N/A') {
        setConfigLoading(false);
        return;
      }
      const res = await EventService.getConfigPerEvent(event.event_id);
      if (res.status === 'success' && res.data) {
        setEventConfig(res.data);
      } else {
        setConfigError('Failed to fetch event config');
      }
      setConfigLoading(false);
    }
    fetchConfig();
  }, [eventId]);

  // Use config values if available, else fallback to event
  const flagOffDisplay = eventConfig?.flag_off_time || event.flagOff || event.flag_off_time || 'N/A';
  const durationDisplay = eventConfig?.duration || event.duration || 'N/A';
  const speedLimitDisplay = eventConfig?.speed_limit ? `${eventConfig.speed_limit} kmph` : (event.speedLimit || 'N/A');
  const gpsAccuracyDisplay = eventConfig?.gps_accuracy ? `${eventConfig.gps_accuracy} Meters` : (event.gpsAccuracy || 'N/A');

  useEffect(() => {
    const eventDateTime = eventStartDate !== 'Start Date N/A' ? new Date(eventStartDate) : new Date();
    const updateTimer = () => {
      const now = new Date();
      const diff = eventDateTime - now;
      setTimeLeft(diff > 0 ? diff : 0);
      setTimerActive(diff > 0);
      
      // Check if current date matches event start date and time >= flag off time
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentDay = now.getDate();
      
      const eventYear = eventDateTime.getFullYear();
      const eventMonth = eventDateTime.getMonth();
      const eventDay = eventDateTime.getDate();
      
      const isSameDate = (currentYear === eventYear && currentMonth === eventMonth && currentDay === eventDay);
      
      let canStart = false;
     
      if (isSameDate && flagOffDisplay && flagOffDisplay !== 'N/A' && flagOffDisplay.trim() !== '') {
        const flagOffMatch = flagOffDisplay.match(/(\d{1,2}):(\d{2})/);
        if (flagOffMatch) {
          const flagOffHours = parseInt(flagOffMatch[1], 10);
          const flagOffMinutes = parseInt(flagOffMatch[2], 10);
          const currentHours = now.getHours();
          const currentMinutes = now.getMinutes();
                
          if (currentHours > flagOffHours || (currentHours === flagOffHours && currentMinutes >= flagOffMinutes)) {
            canStart = true;
          }
        }
      }
      
      setCanStartEvent(canStart);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [eventStartDate, flagOffDisplay, configLoading]);

  const formatTime = (ms) => {
    if (ms <= 0) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const handleStartEvent = async () => {
    setStartPressed(true);
    setStartMessage(`Event will be start in ${formatTime(timeLeft)}`);
    // ✅ Reset abort flag when starting event normally
    await AsyncStorage.removeItem(`event_${eventId}_aborted`);
    console.log(`✅ Abort flag reset for event ${eventId}`);
    // Fetch checkpoints and kml_path for this event
    const res = await EventService.getCheckpointsPerEvent(eventId);
    if (res.status === 'success' && res.data) {
      // Get speed limit from config or fallback to event data
      const speedLimit = eventConfig?.speed_limit || event.speedLimit || 60; // Default 60 kmph
      // Get duration from config or fallback to event data
      const duration = eventConfig?.duration || event.duration || 'N/A';
      navigation.navigate('MapScreen', {
        event_id: eventId,
        category_id: eventCategoryId,
        checkpoints: res.data.checkpoints,
        kml_path: res.data.kml_path,
        color: res.data.color || '#0000FF',
        event_organizer_no: res.data.event_organizer_no || 'N/A',
        speed_limit: speedLimit, // Pass speed limit to MapScreen
        event_start_date: eventStartDate, // Pass start date
        event_end_date: eventEndDate, // Pass end date
        event_name: eventName, // Pass event name for reference
        duration: duration // Pass duration from config to MapScreen

      });
    } else {
      Alert.alert('Error', 'Failed to fetch checkpoints. Please try again.');
    }
  };

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.gradientBg}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Decorative Circles */}
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />

        {/* Gradient Top Bar */}
        <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.gradientBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />

        {/* Header */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
            <Text style={styles.headerBackIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Event Start</Text>
          {/* <NotificationBell style={{ marginLeft: 'auto' }} /> */}
        </View>

        {/* Banner/Icon */}
        <View style={styles.bannerContainer}>
          <LinearGradient colors={["#43cea2", "#185a9d"]} style={styles.bannerGradient}>
            <Text style={styles.bannerIcon}>🏁</Text>
          </LinearGradient>
          <View style={styles.bannerGlow} />
        </View>

        {/* Greeting */}
        <Text style={styles.greetingText}>Welcome, Explorer! Ready for your next adventure?</Text>

        {/* Chips */}
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={true} style={{ marginVertical: 4, maxWidth: '100%' }} contentContainerStyle={styles.chipRow}>
          <View style={styles.chip}><Text style={styles.chipIcon}>📅</Text><Text style={styles.chipText}>{eventDateCombined}</Text></View>
          <View style={styles.chip}><Text style={styles.chipIcon}>📍</Text><Text style={styles.chipText}>{eventVenue}</Text></View>
        </ScrollView>

        {/* Event Info Card */}
        <View style={styles.glassCard}>
          <Text style={styles.eventTitle}>{eventName}</Text>
          <View style={styles.divider} />
          <View style={styles.infoRow}><Text style={styles.detailIcon}>⏰</Text><Text style={styles.label}>Flag Off</Text><Text style={styles.value}>{flagOffDisplay}</Text></View>
          <View style={styles.infoRow}><Text style={styles.detailIcon}>⏳</Text><Text style={styles.label}>Duration</Text><Text style={[styles.value, styles.success]}>{durationDisplay}</Text></View>
          <View style={styles.infoRow}><Text style={styles.detailIcon}>🚗</Text><Text style={styles.label}>Speed Limit</Text><Text style={[styles.value, styles.danger]}>{speedLimitDisplay}</Text></View>
          <View style={styles.infoRow}><Text style={styles.detailIcon}>📍</Text><Text style={styles.label}>GPS Accuracy</Text><Text style={[styles.value, styles.success]}>{gpsAccuracyDisplay}</Text></View>
          {/* Buttons */}
          <View style={styles.featureBtnRow}>
            <TouchableOpacity style={styles.featureBtn} onPress={async () => {
              try {
                // Generate share message using deep link utility
                const shareData = generateShareMessage({
                  event_id: eventId,
                  event_name: eventName,
                  event_venue: eventVenue,
                  event_start_date: eventStartDate
                });
                
                await Share.share({
                  message: shareData.message,
                  url: shareData.url, // For iOS
                  title: shareData.title,
                });
              } catch (error) {
                Alert.alert('Error', 'Failed to share event');
              }
            }}>
              <LinearGradient colors={["#43cea2", "#185a9d"]} style={styles.featureBtnGradient}>
                <Text style={styles.featureBtnText}>Share Event</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.featureBtn} onPress={() => navigation.navigate("EventDetails", { event })}>
              <LinearGradient colors={["#43cea2", "#185a9d"]} style={styles.featureBtnGradient}>
                <Text style={styles.featureBtnText}>View Details</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.sectionDivider} />

        {/* Status */}
        <View style={styles.glassStatusCard}>
          <Text style={styles.statusTitle}>Event Status</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusBox, status.approved && styles.statusBoxActive]}>
              <Text style={styles.statusIcon}>✔️</Text>
              <Text style={styles.statusText}>Approved</Text>
              {!(status.approved) && (
                <Text style={styles.statusPending}>{(!timerActive) ? 'Done' : 'Pending'}</Text>
              )}
            </View>
            <View style={[styles.statusBox, status.location && styles.statusBoxActive]}>
              <Text style={styles.statusIcon}>📍</Text>
              <Text style={styles.statusText}>Location</Text>
              {!(status.location) && (
                <Text style={styles.statusPending}>{(!timerActive) ? 'Done' : 'Pending'}</Text>
              )}
            </View>
            <View style={[styles.statusBox, status.time && styles.statusBoxActive]}>
              <Text style={styles.statusIcon}>⏰</Text>
              <Text style={styles.statusText}>Time</Text>
              {!(status.time) && (
                <Text style={styles.statusPending}>{(!timerActive) ? 'Done' : 'Pending'}</Text>
              )}
            </View>
          </View>

          {/* Timer */}
          {timerActive ? (
            <Text style={styles.timerText}>Event starts in: {formatTime(timeLeft)}</Text>
          ) : (
            <Text style={styles.statusMessageWhite}>
              {status.message === "Status Unknown" ? `Event starts in: ${formatTime(timeLeft)}` : status.message}
            </Text>
          )}

          {/* Start Button - Only show if event is not completed */}
          {!isEventCompleted && (
            <TouchableOpacity
              style={[styles.startBtnIntegrated, (!canStartEvent || isEventAborted) && styles.startBtnDisabled]}
              disabled={!canStartEvent || isEventAborted}
              onPress={() => {
                if (canStartEvent && !isEventAborted) {
                  handleStartEvent();
                }
              }}
            >
              <LinearGradient colors={(!canStartEvent || isEventAborted) ? ["#666", "#888"] : ["#43cea2", "#185a9d"]} style={styles.startBtnGradientIntegrated}>
                <Text style={styles.startBtnTextIntegrated}>START</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          {/* Event Completed Message */}
          {isEventCompleted && (
            <View style={styles.completedContainer}>
              <Text style={styles.completedText}>✅ Event Completed</Text>
              <Text style={styles.completedSubText}>This event has been successfully completed</Text>
            </View>
          )}
          <Modal
            visible={showStartModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowStartModal(false)}
          >
            <View style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'rgba(0,0,0,0.4)'}}>
              <View style={{backgroundColor:'#fff',borderRadius:22,padding:0,alignItems:'center',width:'80%',borderWidth:2,borderColor:'#43cea2',overflow:'hidden',shadowColor:'#185a9d',shadowOpacity:0.18,shadowOffset:{width:0,height:6},shadowRadius:12,elevation:8}}>
                <LinearGradient colors={["#e0f7fa", "#fff"]} style={{width:'100%',padding:28,borderRadius:22,alignItems:'center'}}>
                  <Text style={{fontSize:22,fontWeight:'800',color:'#43cea2',marginBottom:10,letterSpacing:0.5}}>Event Info</Text>
                  <View style={{width:'100%',borderBottomWidth:1,borderColor:'#e0e0e0',paddingBottom:10,marginBottom:10,flexDirection:'row',alignItems:'center',justifyContent:'center'}}>
                    <Text style={{fontSize:20,color:'#185a9d',fontWeight:'bold',marginRight:6}}>⏰</Text>
                    <Text style={{fontSize:17,color:'#203a43',fontWeight:'700'}}>{`Event Will be Start In `}</Text>
                    <Text style={{fontSize:17,color:'#43cea2',fontWeight:'800'}}>{formatTime(timeLeft)}</Text>
                  </View>
                  <View style={{width:'100%',borderBottomWidth:1,borderColor:'#e0e0e0',paddingBottom:10,marginBottom:10,flexDirection:'row',alignItems:'center',justifyContent:'center'}}>
                    <Text style={{fontSize:18,color:'#185a9d',marginRight:6}}>📢</Text>
                    <Text style={{fontSize:15,color:'#185a9d',textAlign:'center',fontWeight:'600'}}>
                      Get ready! Be at the starting point and prepared. Good luck!
                    </Text>
                  </View>
                  <TouchableOpacity onPress={()=>setShowStartModal(false)} style={{backgroundColor:'#43cea2',borderRadius:12,paddingVertical:10,paddingHorizontal:32,marginTop:8,shadowColor:'#185a9d',shadowOpacity:0.12,shadowOffset:{width:0,height:2},shadowRadius:6,elevation:4}}>
                    <Text style={{color:'#fff',fontWeight:'800',fontSize:17,letterSpacing:0.5}}>OK</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          </Modal>
          {!canStartEvent && !isEventCompleted && !isEventAborted && (
            <Text style={styles.startHint}>
              Start will be enabled when event date and flag off time are reached
            </Text>
          )}
          {isEventAborted && !isEventCompleted && (
            <Text style={styles.abortHint}>
              ⚠️ Event was aborted. Please contact the organizer to restart.
            </Text>
          )}
         
        </View>

        {/* Testing Button - For Development Only */}
        {/* <TouchableOpacity
          style={styles.testingBtn}
          onPress={() => {
            handleStartEvent();
          }}
        >
          <LinearGradient colors={["#FF6B6B", "#EE5A6F"]} style={styles.testingBtnGradient}>
            <Text style={styles.testingBtnText}>🧪 TEST START (Dev Only)</Text>
          </LinearGradient>
        </TouchableOpacity>   */}

        {/* Location Info */}
        <View style={styles.locationInfoRow}>
          <Text style={styles.locationInfoText}>
            By pressing Start, you are allowing us to track your <Text style={{ fontWeight: "bold", color: "#43cea2" }}>Location Information</Text> in background during race.
          </Text>
        </View>

        {/* Motivation */}
        <Text style={styles.startInfo}>Click Only When Asked To Take Start</Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBg: {
    flex: 1,
    minHeight: '100%',
  },
  container: {
    flex: 1,
    paddingTop: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: "100%",
    // backgroundColor: "#0f2027", // removed, now using gradientBg
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: 56,
    width: '100%',
    paddingHorizontal: 12,
    backgroundColor: '#203a43',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(67,206,162,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  headerBackBtn: {
    padding: 12,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(67,206,162,0.12)',
  },
  headerBackIcon: {
    fontSize: 22,
    color: '#43cea2',
    fontWeight: '700',
    textAlign: 'center',
  },
  headerTitle: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
    marginLeft: -40,
  },
  gradientBar: {
    height: 5,
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 20,
  },
  bannerContainer: {
    marginTop: 18,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  greetingText: {
    fontSize: 16,
    color: '#43cea2',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  glassCard: {
    width: width * 0.92,
    backgroundColor: 'rgba(15,15,20,0.95)',
    borderRadius: 24,
    padding: 20,
    marginTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(67,206,162,0.18)',
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#43cea2",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 7,
  },
  label: {
    fontSize: 15,
    color: "#e0e0e0",
    fontWeight: "500",
    minWidth: 80,
    flexShrink: 0,
  },
  value: {
    fontSize: 15,
    color: "#fff",
    fontWeight: "400",
    flex: 1,
    flexWrap: 'wrap',
    textAlign: 'right',
    marginLeft: 8,
    minWidth: 60,
    maxWidth: width * 0.45,
  },
  danger: {
    color: '#185a9d',
    fontWeight: 'bold',
  },
  success: {
    color: '#43cea2',
    fontWeight: 'bold',
  },
  divider: {
    height: 2,
    backgroundColor: '#43cea2',
    borderRadius: 2,
    marginVertical: 8,
    width: '100%',
    opacity: 0.7,
  },
  detailIcon: {
    fontSize: 18,
    marginRight: 6,
    color: '#43cea2',
  },
  sectionDivider: {
    height: 2,
    backgroundColor: '#185a9d',
    borderRadius: 2,
    marginVertical: 18,
    width: width * 0.7,
    alignSelf: 'center',
    opacity: 0.7,
  },
  glassStatusCard: {
    width: width * 0.92,
    backgroundColor: 'rgba(15,15,20,0.95)',
    borderRadius: 24,
    padding: 20,
    marginTop: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(67,206,162,0.18)',
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#43cea2",
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  statusBox: {
    width: 70,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: 'rgba(67,206,162,0.18)',
  },
  statusBoxActive: {
    backgroundColor: "#43cea2",
  },
  statusIcon: {
    fontSize: 18,
    marginBottom: 2,
    color: '#43cea2',
    textAlign: 'center',
  },
  statusText: {
    color: "#203a43",
    fontWeight: "700",
    fontSize: 13,
  },
  statusMessage: {
    backgroundColor: "#185a9d",
    color: "#fff",
    fontWeight: "500",
    fontSize: 14,
    borderRadius: 6,
    padding: 7,
    textAlign: "center",
    marginTop: 4,
    letterSpacing: 0.3,
  },
  statusMessageWhite: {
    backgroundColor: "transparent",
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    borderRadius: 6,
    padding: 7,
    textAlign: "center",
    marginTop: 4,
    letterSpacing: 0.3,
  },
  startBtnDisabled: {
    opacity: 0.5,
  },
  statusPending: {
    color: '#185a9d',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8, // increased from 2 to 8 for more spacing below
    textAlign: 'center',
  },
  locationInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    width: width * 0.92,
  },
  locationInfoText: {
    fontSize: 14,
    color: "#e0e0e0",
    marginLeft: 0,
    flex: 1,
    letterSpacing: 0.2,
  },
  startInfo: {
    fontSize: 15,
    color: "#43cea2",
    fontWeight: "500",
    marginTop: 18,
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  timerText: {
    color: '#43cea2',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  startBtnIntegrated: {
    marginTop: 14,
    width: '80%',
    borderRadius: 14,
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  startBtnGradientIntegrated: {
    borderRadius: 14,
    width: '100%',
    paddingVertical: 13,
    alignItems: 'center',
  },
  startBtnTextIntegrated: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 1,
  },
  startHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#185a9d',
    textAlign: 'center',
    fontWeight: '500',
  },
  abortHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#FF6B6B',
    textAlign: 'center',
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(67,206,162,0.13)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginHorizontal: 2,
    shadowColor: '#43cea2',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  chipIcon: {
    fontSize: 16,
    marginRight: 6,
    color: '#43cea2',
    fontWeight: 'bold',
  },
  chipText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  motivationQuote: {
    fontSize: 20,
    color: '#43cea2',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 16,
    letterSpacing: 1,
    backgroundColor: 'rgba(67,206,162,0.10)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    textShadowColor: 'rgba(67,206,162,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  featureBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    marginBottom: 4,
  },
  featureBtn: {
    flex: 1,
    marginHorizontal: 6,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 2,
  },
  featureBtnGradient: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    width: '100%',
  },
  featureBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  testingBtn: {
    marginTop: 18,
    width: width * 0.92,
    borderRadius: 14,
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  testingBtnGradient: {
    borderRadius: 14,
    width: '100%',
    paddingVertical: 13,
    alignItems: 'center',
  },
  testingBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  completedContainer: {
    marginTop: 14,
    width: '80%',
    borderRadius: 14,
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(67,206,162,0.15)',
    padding: 16,
    borderWidth: 2,
    borderColor: '#43cea2',
  },
  completedText: {
    color: '#43cea2',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  completedSubText: {
    color: '#e0e0e0',
    fontWeight: '500',
    fontSize: 13,
    textAlign: 'center',
  },
});

