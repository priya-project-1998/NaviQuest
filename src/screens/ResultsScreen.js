import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import EventService from "../services/apiService/event_service";
import ResultService from "../services/apiService/result_service";

const { width } = Dimensions.get("window");

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
            <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.headerGradient}>
              <Text style={styles.headerTitle}>🏆 Race Results</Text>
              <Text style={styles.headerSubtitle}>Your completed events ({myEvents.length})</Text>
              <TouchableOpacity style={styles.refreshButton} onPress={fetchMyEvents}>
                <Text style={styles.refreshIcon}>↻</Text>
              </TouchableOpacity>
            </LinearGradient>
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
                  >
                    <View style={styles.eventIconContainer}>
                      <Text style={styles.eventIcon}>{idx === 0 ? '🏁' : idx === 1 ? '🚵‍♂️' : idx === 2 ? '🚶‍♂️' : idx === 3 ? '🏎️' : '🚴‍♂️'}</Text>
                    </View>
                    <View style={styles.eventTextContainer}>
                      <Text style={styles.eventTitle}>{event.event_name}</Text>
                      <Text style={styles.eventSubtitle}>
                        {loadingEventId === event.event_id ? "Loading..." : `📊 Event ID: ${event.event_id} • Tap to view results`}
                      </Text>
                    </View>
                    <View style={styles.eventArrowContainer}>
                      {loadingEventId === event.event_id ? (
                        <ActivityIndicator size="small" color="#f7f7fa" />
                      ) : (
                        <Text style={styles.eventArrow}>→</Text>
                      )}
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
                      <LinearGradient colors={["rgba(235, 250, 255, 0.95)", "rgba(220, 245, 245, 0.95)"]} style={styles.earnedSummaryGradient}>
                        <Text style={styles.earnedSummaryTitle}>✅ Completed Checkpoints Details</Text>
                        <Text style={styles.earnedSummaryText}>
                          You completed {selectedResult.performance.checkpoints} out of {selectedResult.performance.totalCheckpoints} checkpoints
                        </Text>
                        <View style={styles.earnedPointsContainer}>
                          {(selectedResult.checkpoints || [])
                            .filter(cp => cp.status === "completed")
                            .map((cp, idx) => (
                              <View key={`earned-${selectedResult.eventId}-${cp.sr}-${idx}`} style={styles.earnedPointItem}>
                                <Text style={styles.earnedPointName}>{cp.name}</Text>
                                <Text style={styles.earnedPointTime}>{cp.time}</Text>
                                <Text style={styles.earnedPointValue}>+{cp.points} pts</Text>
                              </View>
                            ))
                          }
                        </View>
                        <Text style={styles.totalEarnedPoints}>
                          Total Points Earned: {selectedResult.performance.totalPoints} pts
                        </Text>
                      </LinearGradient>
                    </View>
                  )}

                  {/* Missed Checkpoints Details */}
                  {selectedResult.performance.missedCheckpoints > 0 && (
                    <View style={styles.missedSummaryCard}>
                      <LinearGradient colors={["rgba(255, 235, 235, 0.95)", "rgba(255, 220, 220, 0.95)"]} style={styles.missedSummaryGradient}>
                        <Text style={styles.missedSummaryTitle}>❌ Missed Checkpoints Details</Text>
                        <Text style={styles.missedSummaryText}>
                          You missed {selectedResult.performance.missedCheckpoints} out of {selectedResult.performance.totalCheckpoints} checkpoints
                        </Text>
                        <View style={styles.missedPointsContainer}>
                          {(selectedResult.checkpoints || [])
                            .filter(cp => cp.status === "missed")
                            .map((cp, idx) => (
                              <View key={`missed-${selectedResult.eventId}-${cp.sr}-${idx}`} style={styles.missedPointItem}>
                                <Text style={styles.missedPointName}>{cp.name}</Text>
                                <Text style={styles.missedPointValue}>-{cp.potentialPoints} pts</Text>
                              </View>
                            ))
                          }
                        </View>
                        <Text style={styles.totalMissedPoints}>
                          Total Points Lost: {(selectedResult.checkpoints || [])
                            .filter(cp => cp.status === "missed")
                            .reduce((sum, cp) => sum + cp.potentialPoints, 0)} pts
                        </Text>
                      </LinearGradient>
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
    fontSize: 16,
    marginTop: 10,
    fontWeight: '600',
  },
  container: { 
    flex: 1, 
    paddingTop: 40,
  },
  containerFullScreen: {
    paddingTop: 0,
  },
  glassCard: {
    width: width * 0.92,
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 20,
    marginTop: 18,
    marginBottom: 10,
    alignSelf: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerContainer: {
    marginBottom: 20,
    marginHorizontal: 20,
  },
  headerGradient: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#667eea',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 15,
    elevation: 10,
    position: 'relative',
  },
  refreshButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: 20,
    color: '#f7f7fa',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f7f7fa',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(247,247,250,0.8)',
  },
  listContainer: { 
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f7f7fa',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: 'rgba(247,247,250,0.7)',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  refreshButtonLarge: {
    backgroundColor: '#667eea',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#667eea',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
  },
  refreshButtonText: {
    color: '#f7f7fa',
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventCard: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 15,
    elevation: 8,
  },
  eventCardGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  eventIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  eventIcon: {
    fontSize: 24,
  },
  eventTextContainer: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f7f7fa',
    marginBottom: 4,
  },
  eventSubtitle: {
    fontSize: 14,
    color: 'rgba(247,247,250,0.8)',
  },
  eventArrowContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventArrow: {
    fontSize: 18,
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
    paddingHorizontal: 20,
    paddingTop: 35,
    paddingBottom: 6,
    backgroundColor: '#334155',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#667eea',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  backButtonTop: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#667eea',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 5,
  },
  backIconTop: {
    fontSize: 14,
    color: '#f7f7fa',
    fontWeight: 'bold',
  },
  headerTitleDetail: {
    flex: 1,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f7f7fa',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 30,
  },
  detailsContainer: { 
    padding: 12,
  },
  detailCard: {
    backgroundColor: '#2c5364',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#43cea2',
    shadowColor: '#43cea2',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 10,
    marginHorizontal: 4,
  },
  detailHeader: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#43cea2',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
    textAlign: 'center',
    marginBottom: 12,
  },
  eventIdText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: '600',
    backgroundColor: 'rgba(102,126,234,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'center',
  },
  timelineSection: {
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  enhancedTimelineSection: {
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 20,
    margin: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 16,
    textAlign: 'center',
  },
  timelineContainer: {
    paddingLeft: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineLeft: {
    width: 30,
    alignItems: 'center',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: '#f1f5f9',
    shadowColor: '#667eea',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
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
    height: 50,
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
    marginLeft: 16,
    marginBottom: 12,
  },
  checkpointCard: {
    backgroundColor: 'rgba(102,126,234,0.15)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.3)',
    shadowColor: '#667eea',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 4,
  },
  enhancedCheckpointCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 8,
  },
  checkpointName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 4,
  },
  enhancedCheckpointName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f7f7fa',
    marginBottom: 8,
  },
  checkpointDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  checkpointTime: {
    fontSize: 14,
    color: '#4a5568',
  },
  enhancedCheckpointTime: {
    fontSize: 15,
    color: '#e0e0e0',
    fontWeight: '600',
  },
  checkpointPoints: {
    fontSize: 14,
    color: '#e0e0e0',
    fontWeight: 'bold',
  },
  enhancedCheckpointPoints: {
    fontSize: 15,
    color: '#e0e0e0',
    fontWeight: 'bold',
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
    padding: 20,
    paddingTop: 0,
  },
  enhancedPerformanceSection: {
    padding: 20,
    paddingTop: 10,
    backgroundColor: '#2c5364',
    borderRadius: 20,
    margin: 12,
    shadowColor: '#43cea2',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(102,126,234,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.3)',
    shadowColor: '#667eea',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  statGradient: {
    padding: 20,
    alignItems: 'center',
    minHeight: 90,
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 6,
    textAlign: 'center',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f1f5f9',
    textAlign: 'center',
  },
  fullScreenDetailsWrapper: {
    flex: 1,
    paddingTop: 44,
  },
  professionalTopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  elegantBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  elegantBackIcon: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  professionalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  navSpacer: {
    width: 56,
  },
  scrollViewStyle: {
    flex: 1,
  },
  elegantDetailsContainer: { 
    padding: 20,
  },
  premiumDetailCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 20,
    elevation: 10,
  },
  eventHeroSection: {
    padding: 32,
    alignItems: 'center',
    position: 'relative',
  },
  heroContent: {
    alignItems: 'center',
  },
  heroIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 26,
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  premiumTimelineSection: {
    padding: 24,
  },
  premiumPerformanceSection: {
    padding: 24,
    paddingTop: 0,
  },
  premiumSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  premiumIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#185a9d',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#43cea2',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  premiumSectionIcon: {
    fontSize: 22,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  premiumSectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  elegantTimelineContainer: {
    paddingLeft: 8,
  },
  elegantTimelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  timelineIndicator: {
    width: 32,
    alignItems: 'center',
    marginRight: 16,
  },
  elegantTimelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  elegantTimelineConnector: {
    width: 2,
    height: 40,
    backgroundColor: '#e2e8f0',
    marginTop: 4,
    borderRadius: 1,
  },
  timelineContent: {
    flex: 1,
    marginBottom: 8,
  },
  premiumCheckpointCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  checkpointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  premiumCheckpointName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
    flex: 1,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  premiumCheckpointTime: {
    fontSize: 13,
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
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  premiumStatGradient: {
    padding: 20,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  premiumStatIcon: {
    fontSize: 20,
  },
  premiumStatLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 6,
    textAlign: 'center',
    fontWeight: '500',
  },
  premiumStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  missedSummaryCard: {
    width: width * 0.92,
    backgroundColor: 'rgba(15,15,20,0.95)',
    borderRadius: 24,
    padding: 20,
    marginTop: 18,
    marginBottom: 16,
    alignSelf: 'center',
    shadowColor: '#ff7675',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  missedSummaryGradient: {
    padding: 16,
  },
  missedSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 8,
    textAlign: 'center',
  },
  missedSummaryText: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  missedPointsContainer: {
    marginBottom: 12,
  },
  missedPointItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  missedPointName: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    fontWeight: '600',
  },
  missedPointValue: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: 'bold',
  },
  totalMissedPoints: {
    fontSize: 16,
    color: '#dc2626',
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  earnedSummaryCard: {
    width: width * 0.92,
    backgroundColor: 'rgba(15,15,20,0.95)',
    borderRadius: 24,
    padding: 20,
    marginTop: 18,
    marginBottom: 16,
    alignSelf: 'center',
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
  },
  earnedSummaryGradient: {
    padding: 16,
  },
  earnedSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 8,
    textAlign: 'center',
  },
  earnedSummaryText: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  earnedPointsContainer: {
    marginBottom: 12,
  },
  earnedPointItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  earnedPointName: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    fontWeight: '600',
  },
  earnedPointTime: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 8,
    fontWeight: '500',
  },
  earnedPointValue: {
    fontSize: 14,
    color: '#059669',
    fontWeight: 'bold',
  },
  totalEarnedPoints: {
    fontSize: 16,
    color: '#059669',
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.3)',
  },
  noParticipationBanner: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    borderRadius: 16,
    padding: 20,
    marginTop: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  noParticipationIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  noParticipationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 8,
    textAlign: 'center',
  },
  noParticipationText: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 16,
    padding: 20,
    marginTop: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d97706',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#f59e0b',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ResultsScreen;
