import React, { useState, useCallback, useEffect } from "react";
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
  TextInput,
  Alert,
} from "react-native";
import { Picker } from '@react-native-picker/picker';
import LinearGradient from "react-native-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StackActions } from '@react-navigation/native';

import EventService from "../services/apiService/event_service";
import EventModel from "../model/EventModel";
import EventDetailsView from '../components/EventDetailsView';
import NotificationBell from '../components/NotificationBell';

const { width, height } = Dimensions.get("window");
const isSmallDevice = width < 375;
const cardWidth = width * 0.9;

// Join Event Form Component
const JoinEventForm = ({ event, onClose }) => {
  const [formData, setFormData] = useState({
    event_id: event?.id || '',
    category_id: '',
    class_id: '',
    vehicle_model: '',
    vehicle_rc_no: '',
    crew_members: [] // Start with empty array - no default members
  });
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [categories, setCategories] = useState([]);
  const [classes, setClasses] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [classesLoading, setClassesLoading] = useState(false);

  // Load categories when component mounts
  useEffect(() => {
    loadEventCategories();
    // Ensure event_id is set in form data
    if (event?.id && !formData.event_id) {
      setFormData(prev => ({ ...prev, event_id: event.id }));
    }
  }, [event?.id]);

  const loadEventCategories = async () => {
    try {
      setDataLoading(true);
      
      // Load categories
      const categoriesResponse = await EventService.getEventCategories(event?.id);
      
      if (categoriesResponse.status === "success" && categoriesResponse.data) {
        // Categories are directly in the data array
        const categoriesArray = Array.isArray(categoriesResponse.data) ? categoriesResponse.data : [];
        
        setCategories(categoriesArray);
        
        if (categoriesArray.length === 0) {
          Alert.alert('Warning', 'No categories available for this event');
        }
      } else {
        Alert.alert('Error', 'Failed to load event categories');
        setCategories([]);
      }
    } catch (error) {
      console.error("Load Categories Error:", error);
      Alert.alert('Error', 'Failed to load categories: ' + error.message);
      setCategories([]);
    } finally {
      setDataLoading(false);
    }
  };

  // Function to load classes when a category is selected
  const loadClassesForCategory = async (categoryId) => {
    try {
      setClassesLoading(true);
      
      const classesResponse = await EventService.getCategoryClasses(event?.id, categoryId);
      
      if (classesResponse.status === "success" && classesResponse.data) {
        const classesArray = Array.isArray(classesResponse.data) ? classesResponse.data : [];
        
        setClasses(classesArray);
        // Reset selected class when category changes
        setSelectedClass(null);
        setFormData(prev => ({ ...prev, class_id: null }));
        
        if (classesArray.length === 0) {
          Alert.alert('Warning', 'No classes available for this category');
        }
      } else {
        Alert.alert('Error', 'Failed to load classes for this category');
        setClasses([]);
      }
    } catch (error) {
      console.error("Load Classes Error:", error);
      Alert.alert('Error', 'Failed to load classes: ' + error.message);
      setClasses([]);
    } finally {
      setClassesLoading(false);
    }
  };

  // Handle category selection
  const handleCategoryChange = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    setSelectedCategory(category);
    setFormData(prev => ({ ...prev, category_id: categoryId }));
    
    if (categoryId) {
      loadClassesForCategory(categoryId);
    } else {
      setClasses([]);
      setSelectedClass(null);
      setFormData(prev => ({ ...prev, class_id: null }));
    }
  };

  // Handle class selection
  const handleClassChange = (classId) => {
    const classObj = classes.find(cls => cls.id === classId);
    setSelectedClass(classObj);
    setFormData(prev => ({ ...prev, class_id: classId }));
  };

  const updateCrewMember = (index, field, value) => {
    const updatedMembers = [...formData.crew_members];
    updatedMembers[index][field] = value;
    setFormData({ ...formData, crew_members: updatedMembers });
  };

  const addCrewMember = () => {
    if (formData.crew_members.length < 4) {
      setFormData({
        ...formData,
        crew_members: [...formData.crew_members, { name: '', mobile: '', email: '' }]
      });
    } else {
      Alert.alert('Limit Reached', 'You can add maximum 4 crew members only');
    }
  };

  const removeCrewMember = (index) => {
    const updatedMembers = formData.crew_members.filter((_, i) => i !== index);
    setFormData({ ...formData, crew_members: updatedMembers });
  };

  const validateAndFormatData = () => {
    // Ensure all required fields are present and properly formatted
    const eventId = parseInt(formData.event_id) || parseInt(event?.id);
    const categoryId = parseInt(formData.category_id);
    const classId = parseInt(formData.class_id);

    // Validate required IDs
    if (!eventId || isNaN(eventId)) {
      throw new Error('Invalid event ID');
    }
    if (!categoryId || isNaN(categoryId)) {
      throw new Error('Invalid category ID');
    }
    if (!classId || isNaN(classId)) {
      throw new Error('Invalid class ID');
    }

    // Format crew members exactly as API expects
    const cleanData = {
      event_id: eventId,
      category_id: categoryId,
      class_id: classId,
      vehicle_model: formData.vehicle_model.trim(),
      vehicle_rc_no: formData.vehicle_rc_no.trim(),
      crew_members: formData.crew_members.map((member) => ({
        name: member.name.trim(),
        mobile: member.mobile.trim(),
        email: member.email.trim().toLowerCase()
      }))
    };

    return cleanData;
  };

  const checkAuthToken = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      return !!token;
    } catch (error) {
      console.error("Error checking auth token:", error);
      return false;
    }
  };

  const handleSubmit = async () => {
    // Validate form
    if (!formData.category_id) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    
    if (!formData.class_id) {
      Alert.alert('Error', 'Please select a class');
      return;
    }

    if (!formData.vehicle_model.trim()) {
      Alert.alert('Error', 'Please enter vehicle model');
      return;
    }

    if (!formData.vehicle_rc_no.trim()) {
      Alert.alert('Error', 'Please enter vehicle RC number');
      return;
    }

    if (formData.crew_members.length === 0) {
      Alert.alert('Error', 'Please add at least one crew member');
      return;
    }

    const hasEmptyFields = formData.crew_members.some(
      member => !member.name.trim() || !member.mobile.trim() || !member.email.trim()
    );

    if (hasEmptyFields) {
      Alert.alert('Error', 'Please fill in all crew member details');
      return;
    }

    try {
      setLoading(true);
      
      // Check auth token first
      const hasToken = await checkAuthToken();
      if (!hasToken) {
        Alert.alert('Authentication Error', 'Please log in again to submit registration');
        return;
      }
      
      // Validate and format data
      let cleanedData;
      try {
        cleanedData = validateAndFormatData();
      } catch (validationError) {
        Alert.alert('Validation Error', validationError.message);
        return;
      }
      
      const response = await EventService.joinEvent(cleanedData);
      
      // Debug: Log the response
      console.log("=== JOIN EVENT RESPONSE ===");
      console.log("Status:", response.status);
      console.log("Code:", response.code);
      console.log("Message:", response.message);
      console.log("Data:", response.data);
      console.log("Full Response:", response);
      
      if (response.status === "success") {
        Alert.alert('Success', response.message || 'Event registration submitted successfully!', [
          { text: 'OK', onPress: onClose }
        ]);
      } else {
        // Show specific error message from API
        const errorMessage = response.message || 'Failed to submit registration';
        const errorCode = response.code ? `\n\nError Code: ${response.code}` : '';
        Alert.alert('Registration Failed', `${errorMessage}${errorCode}`);
      }
    } catch (error) {
      console.error("Join Event Error:", error);
      Alert.alert('Network Error', `Failed to submit registration: ${error.message || 'Network connection error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.joinFormContainer}>
      <View style={styles.joinFormContent}>
        {/* Header */}
        <View style={styles.joinFormHeader}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.joinFormTitle}>Join Event</Text>
          <Text style={styles.joinFormSubtitle}>{event?.name}</Text>
        </View>

        {/* Event Info Card */}
        <View style={styles.eventInfoCard}>
          <Image source={(event?.pic || event?.headerImg) ? { uri: event.pic || event.headerImg } : { uri: 'https://via.placeholder.com/80x80/333333/ffffff?text=Event' }} style={styles.eventInfoImage} resizeMode="cover" />
          <View style={styles.eventInfoContent}>
            <Text style={styles.eventInfoTitle}>{event?.name}</Text>
            <Text style={styles.eventInfoDetail}>📍 {event?.venue}</Text>
            <Text style={styles.eventInfoDetail}>📅 {event?.startDate}</Text>
          </View>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Event Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Category</Text>
            {dataLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loadingText}>Loading categories...</Text>
              </View>
            ) : (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedCategory?.id || ''}
                  onValueChange={handleCategoryChange}
                  style={styles.picker}
                  dropdownIconColor="#fff"
                >
                  <Picker.Item label="Select a category" value="" />
                  {categories.map((category) => (
                    <Picker.Item 
                      key={category.id} 
                      label={category.category_name || category.name} 
                      value={category.id} 
                    />
                  ))}
                </Picker>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Class</Text>
            {classesLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loadingText}>Loading classes...</Text>
              </View>
            ) : (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedClass?.id || ''}
                  onValueChange={handleClassChange}
                  style={styles.picker}
                  dropdownIconColor="#fff"
                  enabled={selectedCategory !== null && !classesLoading} // Only enable when category is selected and not loading
                >
                  <Picker.Item 
                    label={selectedCategory ? "Select a class" : "Select category first"} 
                    value="" 
                  />
                  {classes.map((classItem) => (
                    <Picker.Item 
                      key={classItem.id} 
                      label={classItem.class_name || classItem.name} 
                      value={classItem.id} 
                    />
                  ))}
                </Picker>
              </View>
            )}
          </View>
        </View>

        {/* Vehicle Details */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Vehicle Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Vehicle Model *</Text>
            <TextInput
              style={styles.input}
              value={formData.vehicle_model}
              onChangeText={(text) => setFormData(prev => ({ ...prev, vehicle_model: text }))}
              placeholder="Enter vehicle model (e.g., Honda City, Maruti Swift)"
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Vehicle RC Number *</Text>
            <TextInput
              style={styles.input}
              value={formData.vehicle_rc_no}
              onChangeText={(text) => setFormData(prev => ({ ...prev, vehicle_rc_no: text }))}
              placeholder="Enter vehicle RC number"
              placeholderTextColor="rgba(255,255,255,0.5)"
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* Crew Members */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>Crew Members</Text>
              <Text style={styles.memberCount}>({formData.crew_members.length}/4)</Text>
            </View>
            {formData.crew_members.length < 4 && (
              <TouchableOpacity style={styles.addButton} onPress={addCrewMember}>
                <Text style={styles.addButtonText}>+ Add Member</Text>
              </TouchableOpacity>
            )}
          </View>

          {formData.crew_members.length === 0 ? (
            <View style={styles.emptyMembersContainer}>
              <Text style={styles.emptyMembersText}>No crew members added yet</Text>
              <Text style={styles.emptyMembersSubtext}>Click "Add Member" to add your first crew member</Text>
            </View>
          ) : (
            formData.crew_members.map((member, index) => (
              <View key={index} style={styles.crewMemberCard}>
                <View style={styles.crewMemberHeader}>
                  <Text style={styles.crewMemberTitle}>Member {index + 1}</Text>
                  <TouchableOpacity 
                    style={styles.removeButton} 
                    onPress={() => removeCrewMember(index)}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    value={member.name}
                    onChangeText={(text) => updateCrewMember(index, 'name', text)}
                    placeholder="Enter full name"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mobile Number</Text>
                  <TextInput
                    style={styles.input}
                    value={member.mobile}
                    onChangeText={(text) => updateCrewMember(index, 'mobile', text)}
                    keyboardType="phone-pad"
                    placeholder="Enter mobile number"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    value={member.email}
                    onChangeText={(text) => updateCrewMember(index, 'email', text)}
                    keyboardType="email-address"
                    placeholder="Enter email address"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                  />
                </View>
              </View>
            ))
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
          onPress={handleSubmit}
          disabled={loading}
        >
          <LinearGradient
            colors={loading ? ['#666', '#555'] : ['#36D1DC', '#5B86E5']}
            style={styles.submitButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.submitButtonText}>Submitting...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Submit Registration</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const OrganiserScreen = ({ navigation, route }) => {
  const [viewTab, setViewTab] = useState("upcoming");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showJoinEventForm, setShowJoinEventForm] = useState(false);
  const [joiningEvent, setJoiningEvent] = useState(null);

  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [completedEvents, setCompletedEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  // Automatically open event details if event param is present
  useEffect(() => {
    if (route?.params?.event) {
      setSelectedEvent(route.params.event);
    }
  }, [route?.params?.event]);

  // API call
  const fetchEvents = useCallback(async () => {
    setApiError("");
    setLoading(true);
    try {
      const res = await EventService.getEvents();
      
      // Check multiple possible response structures
      let eventsArray = [];
      
      if (res.status === "success" && res.data) {
        if (Array.isArray(res.data)) {
          // Direct array: {status: "success", data: [...]}
          eventsArray = res.data;
        } else if (res.data.events && Array.isArray(res.data.events)) {
          // Nested events: {status: "success", data: {events: [...]}}
          eventsArray = res.data.events;
        }
      } else if (res.code === 200 && res.data) {
        if (Array.isArray(res.data)) {
          eventsArray = res.data;
        } else if (res.data.events && Array.isArray(res.data.events)) {
          eventsArray = res.data.events;
        }
      }
      if (eventsArray.length > 0) {
        const allEvents = eventsArray.map((e) => new EventModel(e));
        setUpcomingEvents(allEvents.filter((ev) => !ev.isCompleted));
        setCompletedEvents(allEvents.filter((ev) => ev.isCompleted));
      } else {
        setUpcomingEvents([]);
        setCompletedEvents([]);
        setApiError("No events found from API");
      }
    } catch (err) {
      console.error("API Call Failed:", err.message);
      setUpcomingEvents([]);
      setCompletedEvents([]);
      setApiError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents])
  );

  const handleJoinEvent = (event) => {
    setJoiningEvent(event);
    setShowJoinEventForm(true);
  };

  const renderEventCard = (event, index) => (
    <View style={styles.eventCard} key={event.id}>
      {/* Event Image with Overlay */}
      <View style={styles.eventImageContainer}>
        <Image 
          source={(event.pic || event.headerImg) ? { uri: event.pic || event.headerImg } : { uri: 'https://via.placeholder.com/400x200/333333/ffffff?text=Event+Image' }} 
          style={styles.eventImage} 
          resizeMode="cover" 
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
          style={styles.eventImageOverlay}
        />
        
        {/* Status Badge */}
        <View style={[styles.statusBadge, { 
          backgroundColor: event.isCompleted ? 'rgba(76, 175, 80, 0.9)' : 'rgba(255, 152, 0, 0.9)' 
        }]}>
          <Text style={styles.statusText}>
            {event.isCompleted ? '✓ Done' : '🔥 Live'}
          </Text>
        </View>
      </View>

      {/* Event Content */}
      <View style={styles.eventCardContent}>
        <Text style={styles.eventTitle} numberOfLines={2}>{event.name}</Text>
        
        {/* Event Details */}
        <View style={styles.eventDetailsContainer}>
          <View style={styles.eventDetailItem}>
            <Text style={styles.detailIcon}>📍</Text>
            <Text style={styles.detailText} numberOfLines={1}>{event.venue}</Text>
          </View>
          
          <View style={styles.eventDetailItem}>
            <Text style={styles.detailIcon}>📅</Text>
            <Text style={styles.detailText}>{event.startDate}</Text>
          </View>
          
          <View style={styles.eventDetailItem}>
            <Text style={styles.detailIcon}>👤</Text>
            <Text style={styles.detailText} numberOfLines={1}>{event.organisedBy}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.eventActionsContainer}>
          {!event.isCompleted && (
            <TouchableOpacity 
              style={styles.eventActionButton} 
              onPress={() => handleJoinEvent(event)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#4CAF50', '#45a049']}
                style={styles.eventActionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.eventActionText}>Join</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.eventActionButton} 
            onPress={() => setSelectedEvent(event)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#feb47b', '#ff7e5f']}
              style={styles.eventActionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.eventActionText}>View</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
      {showJoinEventForm ? (
        <JoinEventForm 
          event={joiningEvent}
          onClose={() => {
            setShowJoinEventForm(false);
            setJoiningEvent(null);
          }}
        />
      ) : !selectedEvent ? (
        <ScrollView 
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
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
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerSubtitle}>Manage and track your events</Text>
                
                {/* My Events Button */}
                <TouchableOpacity 
                  style={styles.myEventsButton} 
                  onPress={() => navigation.dispatch(StackActions.push('My Events'))}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#4CAF50', '#45a049']}
                    style={styles.myEventsButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.myEventsButtonIcon}>📋</Text>
                    <Text style={styles.myEventsButtonText}>My Events</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Tab Section with Counts */}
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
                <View style={styles.tabContent}>
                  <Text style={[styles.tabText, viewTab === "upcoming" && styles.activeTabText]}>
                    🔥 Upcoming Events
                  </Text>
                  <View style={[styles.countBadge, viewTab === "upcoming" && styles.activeCountBadge]}>
                    <Text style={[styles.countText, viewTab === "upcoming" && styles.activeCountText]}>
                      {upcomingEvents.length}
                    </Text>
                  </View>
                </View>
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
                <View style={styles.tabContent}>
                  <Text style={[styles.tabText, viewTab === "completed" && styles.activeTabText]}>
                    ✓ Past Events
                  </Text>
                  <View style={[styles.countBadge, viewTab === "completed" && styles.activeCountBadge]}>
                    <Text style={[styles.countText, viewTab === "completed" && styles.activeCountText]}>
                      {completedEvents.length}
                    </Text>
                  </View>
                </View>
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
        <EventDetailsView 
          event={selectedEvent} 
          onBack={() => setSelectedEvent(null)} 
        />
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { 
    flex: 1,
    backgroundColor: '#0f2027', // Fallback color
  },
  container: { 
    flex: 1,
    paddingBottom: 20,
  },
  
  // Header Styles
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleAccent: {
    backgroundColor: '#feb47b',
    width: 4,
    height: 24,
    marginRight: 12,
    borderRadius: 2,
    shadowColor: '#feb47b',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: isSmallDevice ? 22 : 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 4,
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    marginLeft: 16,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    marginLeft: 16,
  },
  myEventsButton: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#4CAF50',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  myEventsButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
  },
  myEventsButtonIcon: {
    fontSize: 14,
  },
  myEventsButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 12,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  tabGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activeTab: {
    borderColor: '#feb47b',
    shadowColor: '#feb47b',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  countText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '700',
  },
  activeCountText: {
    color: '#fff',
    fontWeight: '800',
  },

  // Event Card Styles
  eventsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10,
  },
  eventCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  eventImageContainer: {
    height: 140,
    position: 'relative',
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  eventImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 3,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },
  eventCardContent: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    letterSpacing: 0.3,
    lineHeight: 20,
  },
  eventDetailsContainer: {
    marginBottom: 16,
    gap: 8,
  },
  eventDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailIcon: {
    fontSize: 12,
    width: 16,
  },
  detailText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  eventActionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  eventActionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  eventActionGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Error and Empty States
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.12)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
    shadowColor: '#f44336',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  errorIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  errorText: {
    color: '#ffcdd2',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0.2,
    maxWidth: width * 0.8,
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 100,
  },
  loadingText: {
    color: '#feb47b',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
    letterSpacing: 0.8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
    shadowColor: '#feb47b',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(254, 180, 123, 0.3)',
    borderRadius: 12,
  },
  backText: {
    color: '#feb47b',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  detailImageContainer: {
    height: 200,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
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
    top: 12,
    right: 12,
  },
  detailsContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 4,
    letterSpacing: 0.4,
    lineHeight: 28,
  },
  detailJoinButton: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  detailJoinButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  detailJoinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailSection: {
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  detailIconContainer: {
    backgroundColor: 'rgba(254, 180, 123, 0.2)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(254, 180, 123, 0.3)',
    shadowColor: '#feb47b',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  detailItemIcon: {
    fontSize: 16,
  },
  detailItemContent: {
    flex: 1,
  },
  detailItemLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  detailItemValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0.2,
  },

  // Join Event Form Styles
  joinFormContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 32, 39, 0.95)',
  },
  joinFormContent: {
    padding: 20,
    paddingBottom: 40,
  },
  joinFormHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  joinFormTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  joinFormSubtitle: {
    fontSize: 16,
    color: '#feb47b',
    fontWeight: '600',
    textAlign: 'center',
  },
  eventInfoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  eventInfoImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  eventInfoContent: {
    flex: 1,
    justifyContent: 'center',
  },
  eventInfoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  eventInfoDetail: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginBottom: 4,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  memberCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#feb47b',
    backgroundColor: 'rgba(254, 180, 123, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(254, 180, 123, 0.3)',
  },
  addButton: {
    backgroundColor: 'rgba(254, 180, 123, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(254, 180, 123, 0.3)',
  },
  addButtonText: {
    color: '#feb47b',
    fontSize: 12,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  crewMemberCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  crewMemberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  crewMemberTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#feb47b',
  },
  removeButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  removeButtonText: {
    color: '#f44336',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyMembersContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
  },
  emptyMembersText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMembersSubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  submitButton: {
    marginTop: 16,
    marginHorizontal: 40,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    color: '#fff',
    backgroundColor: 'transparent',
    height: 50,
  },
  readOnlyContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 50,
    justifyContent: 'center',
  },
  readOnlyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  readOnlyLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 50,
  },
  picker: {
    color: '#fff',
    backgroundColor: 'transparent',
    height: 50,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default OrganiserScreen;
