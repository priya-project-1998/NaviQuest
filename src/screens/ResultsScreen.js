import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Alert, PixelRatio, Platform } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import EventService from "../services/apiService/event_service";
import ResultService from "../services/apiService/result_service";

const { width, height } = Dimensions.get("window");
const scale = width / 375;

// Responsive size helper
const normalize = (size) => {
  const newSize = size * scale;
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
};

// Cross-platform shadow helper
const crossPlatformShadow = (elevation = 3, shadowColor = '#000') => ({
  ...Platform.select({
    ios: {
      shadowColor: shadowColor,
      shadowOffset: { width: 0, height: elevation / 2 },
      shadowOpacity: 0.15 + (elevation * 0.02),
      shadowRadius: elevation,
    },
    android: {
      elevation: elevation,
    },
  }),
});

const ResultsScreen = () => {
  const [selectedResult, setSelectedResult] = useState(null);
  const [myEvents, setMyEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEventId, setLoadingEventId] = useState(null);
  const [performanceMatrix, setPerformanceMatrix] = useState({});

  // Fetch my events on component mount
  useEffect(() => {
    fetchMyEvents();
  }, []);

  const fetchMyEvents = async () => {
    try {
      setLoading(true);
      const response = await EventService.getMyEvents();
      
      if (response.status === "success") {
        setMyEvents(response.data);
        // Don't process results here - only when user clicks on an event
      } else {
        Alert.alert("Error", response.message || "Failed to fetch events");
        setMyEvents([]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load events");
      setMyEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // New function to handle event click and fetch results
  const handleEventClick = async (event) => {
    try {
      setLoadingEventId(event.event_id);
      
      // Fetch checkpoints for this event
      const checkpointsResponse = await EventService.getCheckpointsPerEvent(event.event_id);
      
      // Fetch result for this event using dynamic event_id
      const resultResponse = await ResultService.getUserResultPerEvent(event.event_id);
      
      if (checkpointsResponse.status === "success") {
        const checkpoints = checkpointsResponse.data?.checkpoints || [];
        
        if (resultResponse.status === "success") {
          // User has participated and has results
          const userResult = resultResponse.data?.data || resultResponse.data || {};
          const userCheckpoints = userResult.checkpoints || [];
          const performanceMatrixData = userResult.final_result || {};
          
          // Store performanceMatrix in state
          setPerformanceMatrix(performanceMatrixData);

          
          // Process checkpoints to match the required format
          const processedCheckpoints = processCheckpoints(checkpoints, userCheckpoints);
          
          // Calculate performance metrics
          const performance = calculatePerformance(checkpoints, userResult);
          
          const eventResult = {
            id: parseInt(event.participant_id) || Math.random(),
            name: `${event.user_name || 'User'} - ${event.event_name}`,
            eventId: event.event_id,
            participantId: event.participant_id,
            eventName: event.event_name,
            userName: event.user_name,
            checkpoints: processedCheckpoints,
            performance: performance,
            hasResults: true
          };
          
          setSelectedResult(eventResult);
          
        } else if (resultResponse.status === "no_results") {
          // User hasn't participated in this event yet
          
          // Show all checkpoints as missed since user didn't participate
          const processedCheckpoints = checkpoints.map((checkpoint, index) => ({
            sr: parseInt(checkpoint.sequence_number) || (index + 1),
            name: checkpoint.checkpoint_name || `Checkpoint ${index + 1}`,
            time: "Not Participated",
            points: 0,
            status: "not_participated",
            potentialPoints: parseInt(checkpoint.description) || parseInt(checkpoint.points) || 0
          }));
          
          const eventResult = {
            id: parseInt(event.participant_id) || Math.random(),
            name: `${event.user_name || 'User'} - ${event.event_name}`,
            eventId: event.event_id,
            participantId: event.participant_id,
            eventName: event.event_name,
            userName: event.user_name,
            checkpoints: processedCheckpoints,
            performance: {
              startTime: "N/A",
              endTime: "N/A",
              checkpoints: 0,
              totalCheckpoints: checkpoints.length,
              bonus: 0,
              speedPenalty: 0,
              timeTaken: "N/A",
              totalPoints: 0,
              checkpointPoints: 0,
              missedCheckpoints: 0,
              completionRate: "0%",
              totalPossiblePoints: checkpoints.reduce((sum, cp) => sum + (parseInt(cp.description) || parseInt(cp.points) || 0), 0)
            },
            hasResults: false,
            noParticipation: true
          };
          
          setSelectedResult(eventResult);
          
        } else {
          // Error fetching results - but don't show alert for every failed event
          
          // Show event with no results instead of blocking user
          const processedCheckpoints = checkpoints.map((checkpoint, index) => ({
            sr: parseInt(checkpoint.sequence_number) || (index + 1),
            name: checkpoint.checkpoint_name || `Checkpoint ${index + 1}`,
            time: "Unable to load",
            points: 0,
            status: "error",
            potentialPoints: parseInt(checkpoint.description) || parseInt(checkpoint.points) || 0
          }));
          
          const eventResult = {
            id: parseInt(event.participant_id) || Math.random(),
            name: `${event.user_name || 'User'} - ${event.event_name}`,
            eventId: event.event_id,
            participantId: event.participant_id,
            eventName: event.event_name,
            userName: event.user_name,
            checkpoints: processedCheckpoints,
            performance: {
              startTime: "N/A",
              endTime: "N/A",
              checkpoints: 0,
              totalCheckpoints: checkpoints.length,
              bonus: 0,
              speedPenalty: 0,
              timeTaken: "N/A",
              totalPoints: 0,
              checkpointPoints: 0,
              missedCheckpoints: 0,
              completionRate: "0%",
              totalPossiblePoints: checkpoints.reduce((sum, cp) => sum + (parseInt(cp.description) || parseInt(cp.points) || 0), 0)
            },
            hasResults: false,
            hasError: true
          };
          
          setSelectedResult(eventResult);
        }
      } else {
        // Error fetching checkpoints - show a more user-friendly message
        Alert.alert("Unable to Load Event", `Sorry, we couldn't load the details for "${event.event_name}". Please try again later.`);
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong while loading event details.");
    } finally {
      setLoadingEventId(null);
    }
  };

  const processCheckpoints = (allCheckpoints, userCheckpoints) => {
    const processedCheckpoints = [];
    
    // Handle case when userCheckpoints is undefined or null
    const safeUserCheckpoints = userCheckpoints || [];
    
    allCheckpoints.forEach((checkpoint, index) => {
      // Try to find matching user checkpoint by checkpoint_id
      const userCheckpoint = safeUserCheckpoints.find(uc => 
        uc.checkpoint_id === checkpoint.checkpoint_id || 
        uc.checkpoint_id === checkpoint.id
      );
      
      const processedCheckpoint = {
        sr: parseInt(checkpoint.sequence_number) || (index + 1),
        name: checkpoint.checkpoint_name || `Checkpoint ${index + 1}`,
        time: userCheckpoint ? formatTime(userCheckpoint.reached_at) : "Missed",
        points: parseInt(checkpoint.description) || parseInt(checkpoint.points) || 0,
        status: userCheckpoint ? "completed" : "missed",
        potentialPoints: parseInt(checkpoint.description) || parseInt(checkpoint.points) || 0
      };
      
      processedCheckpoints.push(processedCheckpoint);
    });
    
    return processedCheckpoints;
  };

  const calculatePerformance = (allCheckpoints, userResult) => {
    const totalCheckpoints = allCheckpoints.length;
    const safeUserCheckpoints = userResult?.checkpoints || [];
    const completedCheckpoints = safeUserCheckpoints.length;
    const missedCheckpoints = totalCheckpoints - completedCheckpoints;
    const totalPossiblePoints = allCheckpoints.reduce((sum, cp) => sum + (parseInt(cp.description) || 0), 0);
    const completionRate = totalCheckpoints > 0 ? Math.round((completedCheckpoints / totalCheckpoints) * 100) : 0;
    
    // Calculate start and end times
    let startTime = "N/A";
    let endTime = "N/A";
    
    if (safeUserCheckpoints.length > 0) {
      const checkpointTimes = safeUserCheckpoints.map(cp => new Date(cp.reached_at));
      startTime = formatTime(Math.min(...checkpointTimes));
      endTime = formatTime(Math.max(...checkpointTimes));
    }
    
    // Calculate total earned points from completed checkpoints
    const totalEarnedPoints = safeUserCheckpoints.reduce((sum, userCP) => {
      const checkpoint = allCheckpoints.find(cp => cp.checkpoint_id === userCP.checkpoint_id);
      const points = parseInt(checkpoint?.description) || parseInt(checkpoint?.points) || 0;
      return sum + points;
    }, 0);
    
    return {
      startTime: startTime,
      endTime: endTime,
      checkpoints: completedCheckpoints, // Count of completed checkpoints
      totalCheckpoints: totalCheckpoints,
      bonus: 0,
      speedPenalty: 0,
      timeTaken: userResult?.final_result?.formatted_time || "N/A",
      totalPoints: totalEarnedPoints, // Sum of all earned points
      checkpointPoints: completedCheckpoints, // Count of completed checkpoints (same as checkpoints)
      missedCheckpoints: missedCheckpoints,
      completionRate: `${completionRate}%`,
      totalPossiblePoints: totalPossiblePoints
    };
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-GB', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) {
    return (
      <LinearGradient colors={["#1a1a2e", "#16213e", "#0f3460"]} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading Results...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#1a1a2e", "#16213e", "#0f3460"]} style={{ flex: 1 }}>
      <View style={[styles.container, selectedResult && styles.containerFullScreen]}>
        {/* Header - Only show when not viewing details */}
        {!selectedResult && (
          <View style={styles.headerContainer}>
            <View style={styles.headerWrapper}>
              <LinearGradient 
                colors={["#667eea", "#764ba2"]} 
                style={styles.headerGradientBg}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
              />
              <View style={styles.headerContentRow}>
                <View style={styles.headerTextSection}>
                  <Text style={styles.headerTitle}>🏆 Race Results</Text>
                  <Text style={styles.headerSubtitle}>Your completed events ({myEvents.length})</Text>
                </View>
                <TouchableOpacity style={styles.refreshButton} onPress={fetchMyEvents}>
                  <Text style={styles.refreshIcon}>↻</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {!selectedResult && (
          <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
            {myEvents.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateIcon}>📊</Text>
                <Text style={styles.emptyStateTitle}>No Events Found</Text>
                <Text style={styles.emptyStateText}>You haven't joined any events yet.</Text>
                <TouchableOpacity style={styles.refreshButtonLarge} onPress={fetchMyEvents}>
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : (
              myEvents.map((event, idx) => (
                <TouchableOpacity
                  key={`event-${event.event_id}-${idx}`}
                  style={styles.eventCard}
                  onPress={() => handleEventClick(event)}
                  disabled={loadingEventId === event.event_id}
                >
                  <LinearGradient 
                    colors={idx % 4 === 0 ? ["#667eea", "#764ba2"] : 
                           idx % 4 === 1 ? ["#f093fb", "#f5576c"] : 
                           idx % 4 === 2 ? ["#4facfe", "#00f2fe"] : 
                           ["#43e97b", "#38f9d7"]} 
                    style={styles.eventCardGradient}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 0}}
                  >
                    <View style={styles.eventCardContent}>
                      <View style={styles.eventIconContainer}>
                        <Text style={styles.eventIcon}>{idx === 0 ? '🏁' : idx === 1 ? '🚵‍♂️' : idx === 2 ? '🚶‍♂️' : idx === 3 ? '🏎️' : '🚴‍♂️'}</Text>
                      </View>
                      <View style={styles.eventTextContainer}>
                        <Text style={styles.eventTitle} numberOfLines={1}>{event.event_name}</Text>
                        <Text style={styles.eventSubtitle} numberOfLines={1}>
                          {loadingEventId === event.event_id ? "Loading..." : "📊 Tap to view results"}
                        </Text>
                      </View>
                      <View style={styles.eventArrowContainer}>
                        {loadingEventId === event.event_id ? (
                          <ActivityIndicator size="small" color="#f7f7fa" />
                        ) : (
                          <Text style={styles.eventArrow}>→</Text>
                        )}
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}

        {selectedResult && (
          <View style={styles.detailsWrapper}>
            {/* Top Header with Back Button */}
            <View style={styles.topHeader}>
              <TouchableOpacity style={styles.backButtonTop} onPress={() => setSelectedResult(null)}>
                <Text style={styles.backIconTop}>←</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitleDetail}>Event Details</Text>
              <View style={styles.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.detailsContainer} showsVerticalScrollIndicator={false}>
              <View>
                <View style={styles.glassCard}>
                  <Text style={styles.detailTitle}>🏆 {selectedResult.name}</Text>
                  {selectedResult.noParticipation && (
                    <View style={styles.noParticipationBanner}>
                      <Text style={styles.noParticipationIcon}>📭</Text>
                      <Text style={styles.noParticipationTitle}>No Participation Found</Text>
                      <Text style={styles.noParticipationText}>
                        You haven't participated in this event yet or results are not available.
                      </Text>
                    </View>
                  )}
                  {selectedResult.hasError && (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorIcon}>🔍</Text>
                      <Text style={styles.errorTitle}>No results found for this event</Text>
                      <Text style={styles.errorText}>
                        Looks like you haven't participated in this race yet, or the results are still being processed. Check back later!
                      </Text>
                    </View>
                  )}
                </View>

                {/* Timeline Section - Only show if there are checkpoints and no errors */}
                {!selectedResult.noParticipation && !selectedResult.hasError && (selectedResult.checkpoints || []).length > 0 && (
                  <View style={styles.glassCard}>
                    <Text style={styles.sectionTitle}>📍 Race Timeline</Text>
                    <View style={styles.timelineContainer}>
                    {(selectedResult.checkpoints || []).map((cp, idx) => (
                      <View key={`checkpoint-${selectedResult.eventId}-${cp.sr}-${idx}`} style={styles.timelineItem}>
                        <View style={styles.timelineLeft}>
                          <View style={[
                            styles.timelineDot, 
                            idx === 0 ? styles.startDot : 
                            idx === (selectedResult.checkpoints || []).length-1 ? styles.finishDot :
                            cp.status === "missed" ? styles.missedDot : 
                            cp.status === "not_participated" ? styles.notParticipatedDot : 
                            cp.status === "error" ? styles.errorDot : styles.checkpointDot
                          ]} />
                          {idx < (selectedResult.checkpoints || []).length-1 && 
                            <View style={[
                              styles.timelineConnector,
                              cp.status === "missed" || cp.status === "not_participated" || cp.status === "error" ? styles.missedConnector : styles.normalConnector
                            ]} />
                          }
                        </View>
                        <View style={styles.timelineRight}>
                          <View style={styles.checkpointCard}>
                            <Text style={[
                              styles.enhancedCheckpointName, 
                              (cp.status === "missed" || cp.status === "not_participated" || cp.status === "error") && styles.missedCheckpointName
                            ]}>
                              {cp.name}
                            </Text>
                            <View style={styles.checkpointDetails}>
                              <Text style={[
                                styles.enhancedCheckpointTime, 
                                (cp.status === "missed" || cp.status === "not_participated" || cp.status === "error") && styles.missedTime
                              ]}>
                                🕐 {cp.time}
                              </Text>
                              <Text style={[
                                styles.enhancedCheckpointPoints, 
                                (cp.status === "missed" || cp.status === "not_participated" || cp.status === "error") && styles.missedPoints
                              ]}>
                                🏅 {cp.points} pts
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
                )}

                {/* Performance Section - Only show if there are performance stats and no errors */}
                {!selectedResult.noParticipation && !selectedResult.hasError && selectedResult.performance && (
                <View style={styles.glassCard}>
                  <Text style={styles.sectionTitle}>📊 Performance Summary</Text>
                  
                  {/* Earned Checkpoints Details */}
                  {selectedResult.performance.checkpoints > 0 && (
                    <View style={styles.earnedSummaryCard}>
                      <LinearGradient 
                        colors={["rgba(235, 250, 255, 0.95)", "rgba(220, 245, 245, 0.95)"]} 
                        style={styles.summaryGradientBg}
                      />
                      <View style={styles.summaryContent}>
                        <Text style={styles.earnedSummaryTitle}>✅ Completed Checkpoints Details</Text>
                        <Text style={styles.earnedSummaryText}>
                          You completed {selectedResult.performance.checkpoints} out of {selectedResult.performance.totalCheckpoints} checkpoints
                        </Text>
                        <View style={styles.earnedPointsContainer}>
                          {(selectedResult.checkpoints || [])
                            .filter(cp => cp.status === "completed")
                            .map((cp, idx) => (
                              <View key={`earned-${selectedResult.eventId}-${cp.sr}-${idx}`} style={styles.earnedPointItem}>
                                <Text style={styles.earnedPointName} numberOfLines={1}>{cp.name}</Text>
                                <Text style={styles.earnedPointTime} numberOfLines={1}>{cp.time}</Text>
                                <Text style={styles.earnedPointValue}>+{cp.points}</Text>
                              </View>
                            ))
                          }
                        </View>
                        <Text style={styles.totalEarnedPoints}>
                          Total Earned: {selectedResult.performance.totalPoints} pts
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Missed Checkpoints Details */}
                  {selectedResult.performance.missedCheckpoints > 0 && (
                    <View style={styles.missedSummaryCard}>
                      <LinearGradient 
                        colors={["rgba(255, 235, 235, 0.95)", "rgba(255, 220, 220, 0.95)"]} 
                        style={styles.summaryGradientBg}
                      />
                      <View style={styles.summaryContent}>
                        <Text style={styles.missedSummaryTitle}>❌ Missed Checkpoints Details</Text>
                        <Text style={styles.missedSummaryText}>
                          You missed {selectedResult.performance.missedCheckpoints} out of {selectedResult.performance.totalCheckpoints} checkpoints
                        </Text>
                        <View style={styles.missedPointsContainer}>
                          {(selectedResult.checkpoints || [])
                            .filter(cp => cp.status === "missed")
                            .map((cp, idx) => (
                              <View key={`missed-${selectedResult.eventId}-${cp.sr}-${idx}`} style={styles.missedPointItem}>
                                <Text style={styles.missedPointName} numberOfLines={1}>{cp.name}</Text>
                                <Text style={styles.missedPointValue}>-{cp.potentialPoints}</Text>
                              </View>
                            ))
                          }
                        </View>
                        <Text style={styles.totalMissedPoints}>
                          Total Lost: {(selectedResult.checkpoints || [])
                            .filter(cp => cp.status === "missed")
                            .reduce((sum, cp) => sum + cp.potentialPoints, 0)} pts
                        </Text>
                      </View>
                    </View>
                  )}
                  <View style={styles.statsGrid}>
                    {Object.keys(performanceMatrix).map((key, index) => {
                      // Get icon based on key name with more specific matching
                      const getIcon = (keyName) => {
                        const lowerKey = keyName.toLowerCase();
                        
                        if (lowerKey.includes('total') && lowerKey.includes('checkpoint') && lowerKey.includes('reached')) return '🎯';
                        if (lowerKey.includes('total') && lowerKey.includes('points') && lowerKey.includes('earned')) return '💰';
                        if (lowerKey.includes('event') && lowerKey.includes('time') && lowerKey.includes('deduction')) return '⏱️';
                        if (lowerKey.includes('overspeed') && lowerKey.includes('time')) return '🚗';
                        if (lowerKey.includes('overspeed') && lowerKey.includes('penalty')) return '⚡';
                        if (lowerKey.includes('mandatory') && lowerKey.includes('required')) return '📋';
                        if (lowerKey.includes('mandatory') && lowerKey.includes('missed')) return '❌';
                        if (lowerKey.includes('mandatory') && lowerKey.includes('penalty')) return '⛔';
                        if (lowerKey.includes('total') && lowerKey.includes('deductions')) return '➖';
                        if (lowerKey.includes('net') && lowerKey.includes('score')) return '🏆';
                        if (lowerKey.includes('formatted') && lowerKey.includes('time')) return '📅';
                        
                        // Fallback for general categories
                        if (lowerKey.includes('checkpoint')) return '🎯';
                        if (lowerKey.includes('points') || lowerKey.includes('score')) return '🏅';
                        if (lowerKey.includes('time')) return '⏰';
                        if (lowerKey.includes('penalty')) return '❌';
                        if (lowerKey.includes('mandatory')) return '�';
                        
                        return '📊';
                      };

                      // Format key name for display (remove parentheses and make readable)
                      const formatLabel = (keyName) => {
                        return keyName
                          .replace(/([A-Z])/g, ' $1') // Add space before capital letters
                          .replace(/^\s+/, '') // Remove leading space
                          .replace(/\(.*?\)/g, '') // Remove content in parentheses
                          .trim();
                      };

                      return (
                        <View key={`stat-${index}`} style={styles.statCard}>
                          <View style={styles.statGradient}>
                            <Text style={styles.statIcon}>{getIcon(key)}</Text>
                            <Text style={styles.statLabel}>{formatLabel(key)}</Text>
                            <Text style={styles.statValue}>{performanceMatrix[key]}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#f7f7fa',
    fontSize: normalize(16),
    marginTop: normalize(10),
    fontWeight: '600',
  },
  container: { 
    flex: 1, 
    paddingTop: Platform.OS === 'ios' ? normalize(50) : normalize(40),
  },
  containerFullScreen: {
    paddingTop: 0,
  },
  glassCard: {
    width: width * 0.92,
    backgroundColor: '#1e293b',
    borderRadius: normalize(24),
    padding: normalize(14),
    marginTop: normalize(18),
    marginBottom: normalize(10),
    alignSelf: 'center',
    ...crossPlatformShadow(8, '#667eea'),
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  headerContainer: {
    marginBottom: normalize(20),
    marginHorizontal: normalize(20),
  },
  headerWrapper: {
    borderRadius: normalize(20),
    overflow: 'hidden',
    ...crossPlatformShadow(10, '#667eea'),
  },
  headerGradientBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: normalize(20),
  },
  headerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: normalize(20),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: normalize(20),
  },
  headerTextSection: {
    flex: 1,
  },
  headerContent: {
    flex: 1,
  },
  refreshButton: {
    width: normalize(40),
    height: normalize(40),
    borderRadius: normalize(20),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: normalize(10),
  },
  refreshIcon: {
    fontSize: normalize(20),
    color: '#f7f7fa',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: normalize(24),
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
    color: '#f7f7fa',
    marginBottom: normalize(4),
  },
  headerSubtitle: {
    fontSize: normalize(16),
    color: 'rgba(247,247,250,0.8)',
    fontWeight: '500',
  },
  listContainer: { 
    paddingBottom: normalize(30),
    paddingHorizontal: normalize(20),
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(60),
  },
  emptyStateIcon: {
    fontSize: normalize(64),
    marginBottom: normalize(20),
  },
  emptyStateTitle: {
    fontSize: normalize(20),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#f7f7fa',
    marginBottom: normalize(12),
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: normalize(16),
    color: 'rgba(247,247,250,0.7)',
    textAlign: 'center',
    marginBottom: normalize(30),
    paddingHorizontal: normalize(20),
    lineHeight: normalize(24),
    fontWeight: '500',
  },
  refreshButtonLarge: {
    backgroundColor: '#667eea',
    paddingHorizontal: normalize(30),
    paddingVertical: normalize(12),
    borderRadius: normalize(25),
    ...crossPlatformShadow(5, '#667eea'),
  },
  refreshButtonText: {
    color: '#f7f7fa',
    fontSize: normalize(16),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
  },
  eventCard: {
    marginBottom: normalize(16),
    borderRadius: normalize(18),
    overflow: 'hidden',
    ...crossPlatformShadow(8, '#667eea'),
  },
  eventCardGradient: {
    borderRadius: normalize(18),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  eventCardContent: {
    padding: normalize(20),
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventIconContainer: {
    width: normalize(50),
    height: normalize(50),
    borderRadius: normalize(25),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: normalize(16),
  },
  eventIcon: {
    fontSize: normalize(24),
  },
  eventTextContainer: {
    flex: 1,
  },
  eventTitle: {
    fontSize: normalize(16),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#f7f7fa',
    marginBottom: normalize(4),
  },
  eventSubtitle: {
    fontSize: normalize(14),
    color: 'rgba(247,247,250,0.8)',
    fontWeight: '500',
  },
  eventArrowContainer: {
    width: normalize(30),
    height: normalize(30),
    borderRadius: normalize(15),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventArrow: {
    fontSize: normalize(18),
    color: '#f7f7fa',
    fontWeight: 'bold',
  },
  detailsWrapper: {
    flex: 1,
    backgroundColor: '#1e293b',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: normalize(20),
    paddingTop: Platform.OS === 'ios' ? normalize(50) : normalize(35),
    paddingBottom: normalize(10),
    backgroundColor: '#334155',
    borderBottomLeftRadius: normalize(20),
    borderBottomRightRadius: normalize(20),
    ...crossPlatformShadow(6, '#667eea'),
  },
  backButtonTop: {
    width: normalize(36),
    height: normalize(36),
    borderRadius: normalize(18),
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    ...crossPlatformShadow(5, '#667eea'),
  },
  backIconTop: {
    fontSize: normalize(16),
    color: '#f7f7fa',
    fontWeight: 'bold',
  },
  headerTitleDetail: {
    flex: 1,
    fontSize: normalize(17),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#f7f7fa',
    textAlign: 'center',
  },
  headerSpacer: {
    width: normalize(36),
  },
  detailsContainer: { 
    padding: normalize(12),
    paddingBottom: Platform.OS === 'ios' ? normalize(40) : normalize(30),
  },
  detailCard: {
    backgroundColor: '#2c5364',
    borderRadius: normalize(24),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#43cea2',
    ...crossPlatformShadow(8, '#43cea2'),
    marginBottom: normalize(10),
    marginHorizontal: normalize(4),
  },
  detailHeader: {
    padding: normalize(16),
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#43cea2',
  },
  detailTitle: {
    fontSize: normalize(18),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#667eea',
    textAlign: 'center',
    marginBottom: normalize(12),
  },
  eventIdText: {
    fontSize: normalize(14),
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: normalize(15),
    fontWeight: '600',
    backgroundColor: 'rgba(102,126,234,0.1)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(12),
    alignSelf: 'center',
    overflow: 'hidden',
  },
  timelineSection: {
    padding: normalize(20),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  enhancedTimelineSection: {
    padding: normalize(20),
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: normalize(20),
    margin: normalize(12),
    ...crossPlatformShadow(4),
  },
  sectionTitle: {
    fontSize: normalize(18),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#667eea',
    marginBottom: normalize(16),
    textAlign: 'center',
  },
  timelineContainer: {
    paddingLeft: normalize(10),
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: normalize(4),
  },
  timelineLeft: {
    width: normalize(30),
    alignItems: 'center',
  },
  timelineDot: {
    width: normalize(14),
    height: normalize(14),
    borderRadius: normalize(7),
    borderWidth: 3,
    borderColor: '#f1f5f9',
    ...crossPlatformShadow(4, '#667eea'),
  },
  startDot: {
    backgroundColor: '#43e97b',
    borderColor: '#667eea',
  },
  checkpointDot: {
    backgroundColor: '#43e97b',
    borderColor: '#667eea',
  },
  finishDot: {
    backgroundColor: '#43e97b',
    borderColor: '#667eea',
  },
  missedDot: {
    backgroundColor: '#ff6b6b',
    borderColor: '#ee5a6f',
  },
  notParticipatedDot: {
    backgroundColor: '#94a3b8',
    borderColor: '#64748b',
  },
  errorDot: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706',
  },
  timelineConnector: {
    width: 3,
    height: normalize(50),
    backgroundColor: '#667eea',
    marginTop: 2,
    borderRadius: 2,
  },
  normalConnector: {
    backgroundColor: '#667eea',
  },
  missedConnector: {
    backgroundColor: '#ff6b6b',
  },
  timelineRight: {
    flex: 1,
    marginLeft: normalize(16),
    marginBottom: normalize(12),
  },
  checkpointCard: {
    backgroundColor: 'rgba(102,126,234,0.15)',
    borderRadius: normalize(12),
    padding: normalize(12),
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.3)',
    ...crossPlatformShadow(4, '#667eea'),
  },
  enhancedCheckpointCard: {
    borderRadius: normalize(16),
    padding: normalize(16),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    ...crossPlatformShadow(6),
    marginBottom: normalize(8),
  },
  checkpointName: {
    fontSize: normalize(15),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#2d3748',
    marginBottom: normalize(4),
  },
  enhancedCheckpointName: {
    fontSize: normalize(16),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#f7f7fa',
    marginBottom: normalize(8),
  },
  checkpointDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: normalize(6),
  },
  checkpointTime: {
    fontSize: normalize(14),
    color: '#4a5568',
    fontWeight: '500',
  },
  enhancedCheckpointTime: {
    fontSize: normalize(15),
    color: '#e0e0e0',
    fontWeight: '600',
  },
  checkpointPoints: {
    fontSize: normalize(14),
    color: '#e0e0e0',
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
  },
  enhancedCheckpointPoints: {
    fontSize: normalize(15),
    color: '#e0e0e0',
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
  },
  missedCheckpointName: {
    color: '#ff6b6b',
  },
  missedTime: {
    color: '#ff6b6b',
    fontStyle: 'italic',
  },
  missedPoints: {
    color: '#ff6b6b',
  },
  performanceSection: {
    padding: normalize(20),
    paddingTop: 0,
  },
  enhancedPerformanceSection: {
    padding: normalize(20),
    paddingTop: normalize(10),
    backgroundColor: '#2c5364',
    borderRadius: normalize(20),
    margin: normalize(12),
    ...crossPlatformShadow(4, '#43cea2'),
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    marginBottom: normalize(16),
    borderRadius: normalize(16),
    overflow: 'hidden',
    backgroundColor: 'rgba(102,126,234,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.3)',
    ...crossPlatformShadow(6, '#667eea'),
  },
  statGradient: {
    padding: normalize(20),
    alignItems: 'center',
    minHeight: normalize(90),
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: normalize(24),
    marginBottom: normalize(8),
  },
  statLabel: {
    fontSize: normalize(13),
    color: '#cbd5e1',
    marginBottom: normalize(6),
    textAlign: 'center',
    fontWeight: '600',
  },
  statValue: {
    fontSize: normalize(18),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#f1f5f9',
    textAlign: 'center',
  },
  fullScreenDetailsWrapper: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? normalize(50) : normalize(44),
  },
  professionalTopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: normalize(20),
    paddingVertical: normalize(16),
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  elegantBackButton: {
    width: normalize(40),
    height: normalize(40),
    borderRadius: normalize(20),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: normalize(16),
  },
  elegantBackIcon: {
    fontSize: normalize(20),
    color: '#fff',
    fontWeight: 'bold',
  },
  professionalTitle: {
    flex: 1,
    fontSize: normalize(18),
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  navSpacer: {
    width: normalize(56),
  },
  scrollViewStyle: {
    flex: 1,
  },
  elegantDetailsContainer: { 
    padding: normalize(20),
  },
  premiumDetailCard: {
    backgroundColor: '#fff',
    borderRadius: normalize(24),
    overflow: 'hidden',
    ...crossPlatformShadow(10),
  },
  eventHeroSection: {
    padding: normalize(32),
    alignItems: 'center',
    position: 'relative',
  },
  heroContent: {
    alignItems: 'center',
  },
  heroIcon: {
    fontSize: normalize(48),
    marginBottom: normalize(12),
  },
  heroTitle: {
    fontSize: normalize(20),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: normalize(16),
    lineHeight: normalize(26),
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(8),
    borderRadius: normalize(20),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  statusText: {
    color: '#fff',
    fontSize: normalize(14),
    fontWeight: '600',
  },
  premiumTimelineSection: {
    padding: normalize(24),
  },
  premiumPerformanceSection: {
    padding: normalize(24),
    paddingTop: 0,
  },
  premiumSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(24),
    paddingBottom: normalize(16),
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  premiumIconBadge: {
    width: normalize(48),
    height: normalize(48),
    borderRadius: normalize(24),
    backgroundColor: '#185a9d',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: normalize(16),
    ...crossPlatformShadow(6, '#43cea2'),
  },
  premiumSectionIcon: {
    fontSize: normalize(22),
  },
  sectionTitleContainer: {
    flex: 1,
  },
  premiumSectionTitle: {
    fontSize: normalize(22),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#1a202c',
    marginBottom: normalize(4),
  },
  sectionSubtitle: {
    fontSize: normalize(14),
    color: '#64748b',
    fontWeight: '500',
  },
  elegantTimelineContainer: {
    paddingLeft: normalize(8),
  },
  elegantTimelineItem: {
    flexDirection: 'row',
    marginBottom: normalize(16),
    alignItems: 'flex-start',
  },
  timelineIndicator: {
    width: normalize(32),
    alignItems: 'center',
    marginRight: normalize(16),
  },
  elegantTimelineDot: {
    width: normalize(16),
    height: normalize(16),
    borderRadius: normalize(8),
    borderWidth: 3,
    borderColor: '#fff',
    ...crossPlatformShadow(4),
  },
  elegantTimelineConnector: {
    width: 2,
    height: normalize(40),
    backgroundColor: '#e2e8f0',
    marginTop: normalize(4),
    borderRadius: 1,
  },
  timelineContent: {
    flex: 1,
    marginBottom: normalize(8),
  },
  premiumCheckpointCard: {
    borderRadius: normalize(16),
    padding: normalize(16),
    ...crossPlatformShadow(3),
  },
  checkpointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  premiumCheckpointName: {
    fontSize: normalize(16),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#2d3748',
    flex: 1,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    borderRadius: normalize(12),
  },
  chipIcon: {
    fontSize: normalize(12),
    marginRight: normalize(4),
  },
  premiumCheckpointTime: {
    fontSize: normalize(13),
    color: '#4a5568',
    fontWeight: '600',
  },
  premiumStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  premiumStatCard: {
    width: '48%',
    marginBottom: normalize(16),
    borderRadius: normalize(18),
    overflow: 'hidden',
    ...crossPlatformShadow(6),
  },
  premiumStatGradient: {
    padding: normalize(20),
    alignItems: 'center',
    minHeight: normalize(100),
    justifyContent: 'center',
  },
  statIconContainer: {
    width: normalize(40),
    height: normalize(40),
    borderRadius: normalize(20),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: normalize(12),
  },
  premiumStatIcon: {
    fontSize: normalize(20),
  },
  premiumStatLabel: {
    fontSize: normalize(13),
    color: 'rgba(255,255,255,0.9)',
    marginBottom: normalize(6),
    textAlign: 'center',
    fontWeight: '500',
  },
  premiumStatValue: {
    fontSize: normalize(18),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  missedSummaryCard: {
    width: '100%',
    borderRadius: normalize(16),
    marginTop: normalize(14),
    marginBottom: normalize(14),
    alignSelf: 'center',
    ...crossPlatformShadow(8, '#ff7675'),
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    overflow: 'hidden',
  },
  missedSummaryGradient: {
    padding: normalize(14),
    paddingHorizontal: normalize(16),
    borderRadius: normalize(14),
  },
  missedSummaryTitle: {
    fontSize: normalize(15),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#dc2626',
    marginBottom: normalize(6),
    textAlign: 'center',
  },
  missedSummaryText: {
    fontSize: normalize(13),
    color: '#374151',
    textAlign: 'center',
    marginBottom: normalize(10),
    fontWeight: '600',
  },
  missedPointsContainer: {
    marginBottom: normalize(10),
  },
  missedPointItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: normalize(6),
    paddingHorizontal: normalize(8),
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginBottom: normalize(3),
    borderRadius: normalize(6),
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  missedPointName: {
    fontSize: normalize(12),
    color: '#374151',
    flex: 1,
    fontWeight: '600',
    marginRight: normalize(4),
  },
  missedPointValue: {
    fontSize: normalize(11),
    color: '#dc2626',
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    flexShrink: 0,
    paddingRight: normalize(2),
  },
  totalMissedPoints: {
    fontSize: normalize(13),
    color: '#dc2626',
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: normalize(8),
    borderRadius: normalize(8),
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    overflow: 'hidden',
  },
  earnedSummaryCard: {
    width: '100%',
    borderRadius: normalize(16),
    marginTop: normalize(14),
    marginBottom: normalize(14),
    alignSelf: 'center',
    ...crossPlatformShadow(8, '#43cea2'),
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
    overflow: 'hidden',
  },
  summaryGradientBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: normalize(16),
  },
  summaryContent: {
    padding: normalize(14),
  },
  earnedSummaryGradient: {
    padding: normalize(14),
    paddingHorizontal: normalize(16),
    borderRadius: normalize(14),
  },
  earnedSummaryTitle: {
    fontSize: normalize(15),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#059669',
    marginBottom: normalize(6),
    textAlign: 'center',
  },
  earnedSummaryText: {
    fontSize: normalize(13),
    color: '#374151',
    textAlign: 'center',
    marginBottom: normalize(10),
    fontWeight: '600',
  },
  earnedPointsContainer: {
    marginBottom: normalize(10),
  },
  earnedPointItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: normalize(6),
    paddingHorizontal: normalize(8),
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginBottom: normalize(3),
    borderRadius: normalize(6),
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  earnedPointName: {
    fontSize: normalize(12),
    color: '#374151',
    flex: 1,
    fontWeight: '600',
    marginRight: normalize(4),
  },
  earnedPointTime: {
    fontSize: normalize(10),
    color: '#6B7280',
    marginRight: normalize(4),
    fontWeight: '500',
    flexShrink: 1,
  },
  earnedPointValue: {
    fontSize: normalize(11),
    color: '#059669',
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    flexShrink: 0,
    paddingRight: normalize(2),
  },
  totalEarnedPoints: {
    fontSize: normalize(13),
    color: '#059669',
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: normalize(8),
    borderRadius: normalize(8),
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.3)',
    overflow: 'hidden',
  },
  noParticipationBanner: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    borderRadius: normalize(16),
    padding: normalize(20),
    marginTop: normalize(15),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  noParticipationIcon: {
    fontSize: normalize(48),
    marginBottom: normalize(12),
  },
  noParticipationTitle: {
    fontSize: normalize(18),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#64748b',
    marginBottom: normalize(8),
    textAlign: 'center',
  },
  noParticipationText: {
    fontSize: normalize(15),
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: normalize(22),
    fontWeight: '500',
  },
  errorBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: normalize(16),
    padding: normalize(20),
    marginTop: normalize(15),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  errorIcon: {
    fontSize: normalize(48),
    marginBottom: normalize(12),
  },
  errorTitle: {
    fontSize: normalize(18),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#d97706',
    marginBottom: normalize(8),
    textAlign: 'center',
  },
  errorText: {
    fontSize: normalize(15),
    color: '#f59e0b',
    textAlign: 'center',
    lineHeight: normalize(22),
    fontWeight: '500',
  },
});

export default ResultsScreen;
