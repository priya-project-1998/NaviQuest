import React, { useState, useCallback, useEffect, useRef } from "react";
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
  SafeAreaView,
  PixelRatio,
  Platform,
  Modal,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
} from "react-native";

// ✅ iOS-only: ID for the "Done" toolbar attached to phone-pad keyboard (no Return key by default)
const PHONE_INPUT_ACCESSORY_ID = 'crewMemberPhonePadDone';
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
const scale = width / 375;
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

// Custom Dropdown Component for iOS compatibility
const CustomDropdown = ({ 
  selectedValue, 
  onValueChange, 
  items, 
  placeholder, 
  enabled = true,
  loading = false 
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  
  const selectedItem = items.find(item => item.value === selectedValue);
  const displayText = selectedItem ? selectedItem.label : placeholder;

  const handleSelect = (value) => {
    onValueChange(value);
    setModalVisible(false);
  };

  if (loading) {
    return (
      <View style={styles.dropdownButton}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.dropdownLoadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity 
        style={[styles.dropdownButton, !enabled && styles.dropdownButtonDisabled]}
        onPress={() => enabled && setModalVisible(true)}
        activeOpacity={enabled ? 0.7 : 1}
      >
        <Text style={[
          styles.dropdownButtonText, 
          !selectedItem && styles.dropdownPlaceholder,
          !enabled && styles.dropdownButtonTextDisabled
        ]}>
          {displayText}
        </Text>
        <Text style={[styles.dropdownArrow, !enabled && styles.dropdownArrowDisabled]}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{placeholder}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={true}>
              {items.map((item, index) => (
                <TouchableOpacity
                  key={item.value || index}
                  style={[
                    styles.modalItem,
                    selectedValue === item.value && styles.modalItemSelected
                  ]}
                  onPress={() => handleSelect(item.value)}
                >
                  <Text style={[
                    styles.modalItemText,
                    selectedValue === item.value && styles.modalItemTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {selectedValue === item.value && (
                    <Text style={styles.modalItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

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
  // ✅ iOS phone-pad has no Return/Next key — keep refs to each member's Email input so the
  // toolbar "Next" button can jump there from the mobile field.
  const emailInputRefs = useRef({});
  const focusedMemberIndexRef = useRef(0);

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
    <KeyboardAvoidingView
      style={styles.joinFormContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
    <ScrollView
      style={styles.joinFormContainer}
      contentContainerStyle={styles.joinFormScrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
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
            <CustomDropdown
              selectedValue={selectedCategory?.id || ''}
              onValueChange={handleCategoryChange}
              items={categories.map(cat => ({
                label: cat.category_name || cat.name,
                value: cat.id
              }))}
              placeholder="Select a category"
              loading={dataLoading}
              enabled={!dataLoading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Class</Text>
            <CustomDropdown
              selectedValue={selectedClass?.id || ''}
              onValueChange={handleClassChange}
              items={classes.map(cls => ({
                label: cls.class_name || cls.name,
                value: cls.id
              }))}
              placeholder={selectedCategory ? "Select a class" : "Select category first"}
              loading={classesLoading}
              enabled={selectedCategory !== null && !classesLoading}
            />
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
                    // ✅ iOS: phone-pad keyboard has no Return/Next key — attach a toolbar with
                    // "Next" (jumps to this member's Email) and "Done" (dismiss)
                    inputAccessoryViewID={Platform.OS === 'ios' ? PHONE_INPUT_ACCESSORY_ID : undefined}
                    onFocus={() => { focusedMemberIndexRef.current = index; }}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    ref={(ref) => { emailInputRefs.current[index] = ref; }}
                    style={styles.input}
                    value={member.email}
                    onChangeText={(text) => updateCrewMember(index, 'email', text)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    placeholder="Enter email address"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    onSubmitEditing={() => Keyboard.dismiss()}
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
          />
          <View style={styles.submitButtonContent}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.submitButtonText}>Submitting...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Submit Registration</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

    </ScrollView>
      {/* ✅ iOS-only: phone-pad has no Next/Return key. Toolbar gives "Next" (focus this
          member's Email field) and "Done" (dismiss keyboard). */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={PHONE_INPUT_ACCESSORY_ID}>
          <View style={styles.keyboardAccessoryBar}>
            <TouchableOpacity
              onPress={() => {
                const idx = focusedMemberIndexRef.current;
                const emailRef = emailInputRefs.current[idx];
                if (emailRef && typeof emailRef.focus === 'function') {
                  emailRef.focus();
                } else {
                  Keyboard.dismiss();
                }
              }}
              style={styles.keyboardAccessoryDoneBtn}
            >
              <Text style={styles.keyboardAccessoryDoneText}>Next →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Keyboard.dismiss()}
              style={styles.keyboardAccessoryDoneBtn}
            >
              <Text style={styles.keyboardAccessoryDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </KeyboardAvoidingView>
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
    <SafeAreaView style={styles.safeArea}>
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
                  />
                  <View style={styles.myEventsButtonTextContainer}>
                    <Text style={styles.myEventsButtonText}>📋 My Events</Text>
                  </View>
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
                colors={viewTab === "upcoming" ? ['#feb47b', '#ff7e5f'] : ['#203a43', '#2c5364']}
                style={styles.tabGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
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
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, viewTab === "completed" && styles.activeTab]}
              onPress={() => setViewTab("completed")}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={viewTab === "completed" ? ['#feb47b', '#ff7e5f'] : ['#203a43', '#2c5364']}
                style={styles.tabGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ✅ iOS phone-pad Done toolbar
  keyboardAccessoryBar: {
    backgroundColor: '#1c2b36',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  keyboardAccessoryDoneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#36D1DC',
    marginLeft: 8,
  },
  keyboardAccessoryDoneText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#0f2027',
  },
  gradient: { 
    flex: 1,
    backgroundColor: '#0f2027',
  },
  container: { 
    flex: 1,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  
  // Header Styles
  headerSection: {
    paddingHorizontal: normalize(20),
    paddingTop: Platform.OS === 'ios' ? normalize(10) : normalize(15),
    paddingBottom: normalize(10),
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(8),
  },
  titleAccent: {
    backgroundColor: '#feb47b',
    width: 4,
    height: normalize(24),
    marginRight: normalize(12),
    borderRadius: 2,
    ...crossPlatformShadow(2, '#feb47b'),
  },
  headerTitle: {
    fontSize: normalize(26),
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
    color: '#fff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 4,
    flex: 1,
  },
  headerSubtitle: {
    fontSize: normalize(15),
    color: 'rgba(255, 255, 255, 0.85)',
    marginLeft: normalize(16),
    fontWeight: '600',
    marginBottom: normalize(10),
    letterSpacing: 0.2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    marginLeft: normalize(16),
  },
  myEventsButton: {
    alignSelf: 'flex-start',
    borderRadius: normalize(10),
    marginTop: normalize(8),
    ...crossPlatformShadow(4, '#4CAF50'),
    position: 'relative',
  },
  myEventsButtonGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: normalize(10),
  },
  myEventsButtonTextContainer: {
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(14),
  },
  myEventsButtonText: {
    color: '#fff',
    fontSize: normalize(13),
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
  },

  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(10),
    gap: normalize(8),
  },
  tab: {
    flex: 1,
    borderRadius: normalize(12),
    ...crossPlatformShadow(2),
    position: 'relative',
    minHeight: normalize(56),
  },
  tabGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: normalize(12),
  },
  tabContent: {
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(8),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: normalize(56),
  },
  activeTab: {
    ...crossPlatformShadow(4, '#feb47b'),
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    fontSize: normalize(11),
    textAlign: 'center',
    marginBottom: normalize(4),
  },
  activeTabText: {
    color: '#fff',
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: normalize(10),
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(3),
    minWidth: normalize(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  countText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: normalize(10),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
  },
  activeCountText: {
    color: '#fff',
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
  },

  // Event Card Styles
  eventsContainer: {
    paddingHorizontal: normalize(20),
    paddingBottom: normalize(30),
    paddingTop: normalize(10),
  },
  eventCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: normalize(16),
    marginBottom: normalize(16),
    overflow: 'hidden',
    ...crossPlatformShadow(6),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  eventImageContainer: {
    height: normalize(140),
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
    top: normalize(10),
    right: normalize(10),
    paddingVertical: normalize(4),
    paddingHorizontal: normalize(8),
    borderRadius: normalize(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 3,
  },
  statusText: {
    color: '#fff',
    fontSize: normalize(10),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },
  eventCardContent: {
    padding: normalize(16),
  },
  eventTitle: {
    fontSize: normalize(16),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#fff',
    marginBottom: normalize(12),
    letterSpacing: 0.3,
    lineHeight: normalize(22),
  },
  eventDetailsContainer: {
    marginBottom: normalize(16),
    gap: normalize(8),
  },
  eventDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(8),
  },
  detailIcon: {
    fontSize: normalize(12),
    width: normalize(18),
  },
  detailText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: normalize(12),
    fontWeight: '500',
    flex: 1,
  },
  eventActionsContainer: {
    flexDirection: 'row',
    gap: normalize(8),
  },
  eventActionButton: {
    flex: 1,
    height: normalize(44),
    borderRadius: normalize(12),
    overflow: 'hidden',
    ...crossPlatformShadow(3),
  },
  eventActionGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventActionText: {
    color: '#fff',
    fontSize: normalize(14),
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // Error and Empty States
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.12)',
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(16),
    marginHorizontal: normalize(20),
    marginBottom: normalize(15),
    borderRadius: normalize(12),
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
    ...crossPlatformShadow(2, '#f44336'),
  },
  errorIcon: {
    fontSize: normalize(16),
    marginRight: normalize(10),
  },
  errorText: {
    color: '#ffcdd2',
    fontSize: normalize(13),
    fontWeight: '600',
    flex: 1,
    lineHeight: normalize(18),
    letterSpacing: 0.1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: normalize(40),
    paddingHorizontal: normalize(20),
    marginTop: normalize(10),
  },
  emptyIcon: {
    fontSize: normalize(48),
    marginBottom: normalize(16),
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: normalize(18),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    color: '#fff',
    marginBottom: normalize(8),
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  emptySubtitle: {
    fontSize: normalize(14),
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: normalize(20),
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
    fontSize: normalize(18),
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
    marginTop: normalize(16),
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
    margin: normalize(20),
    borderRadius: normalize(12),
    overflow: 'hidden',
    alignSelf: 'flex-start',
    ...crossPlatformShadow(3, '#feb47b'),
    minHeight: Platform.OS === 'ios' ? normalize(44) : normalize(40),
  },
  backButtonGradient: {
    paddingVertical: Platform.OS === 'ios' ? normalize(14) : normalize(12),
    paddingHorizontal: normalize(20),
    borderWidth: 1,
    borderColor: 'rgba(254, 180, 123, 0.3)',
    borderRadius: normalize(12),
    minHeight: Platform.OS === 'ios' ? normalize(44) : normalize(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: '#feb47b',
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    fontSize: normalize(15),
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  detailImageContainer: {
    height: normalize(200),
    marginHorizontal: normalize(20),
    marginBottom: normalize(20),
    borderRadius: normalize(16),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...crossPlatformShadow(6),
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
    padding: normalize(16),
  },
  detailStatusBadge: {
    position: 'absolute',
    top: normalize(12),
    right: normalize(12),
  },
  detailsContent: {
    paddingHorizontal: normalize(20),
    paddingBottom: normalize(30),
  },
  detailTitle: {
    fontSize: normalize(24),
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
    color: '#fff',
    marginBottom: normalize(20),
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 4,
    letterSpacing: 0.4,
    lineHeight: normalize(30),
  },
  detailJoinButton: {
    marginBottom: normalize(24),
    borderRadius: normalize(16),
    overflow: 'hidden',
    minHeight: Platform.OS === 'ios' ? normalize(54) : normalize(50),
  },
  detailJoinButtonGradient: {
    paddingVertical: Platform.OS === 'ios' ? normalize(18) : normalize(16),
    paddingHorizontal: normalize(24),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Platform.OS === 'ios' ? normalize(54) : normalize(50),
  },
  detailJoinButtonText: {
    color: '#fff',
    fontSize: normalize(17),
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  detailSection: {
    gap: normalize(12),
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: normalize(14),
    borderRadius: normalize(14),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...crossPlatformShadow(2),
  },
  detailIconContainer: {
    backgroundColor: 'rgba(254, 180, 123, 0.2)',
    width: normalize(36),
    height: normalize(36),
    borderRadius: normalize(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: normalize(14),
    borderWidth: 1,
    borderColor: 'rgba(254, 180, 123, 0.3)',
    ...crossPlatformShadow(2, '#feb47b'),
  },
  detailItemIcon: {
    fontSize: normalize(16),
  },
  detailItemContent: {
    flex: 1,
  },
  detailItemLabel: {
    fontSize: normalize(12),
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginBottom: normalize(4),
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  detailItemValue: {
    fontSize: normalize(14),
    color: '#fff',
    fontWeight: '600',
    lineHeight: normalize(20),
    letterSpacing: 0.2,
  },

  // Join Event Form Styles
  joinFormContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 32, 39, 0.95)',
  },
  joinFormContent: {
    padding: normalize(16),
    paddingBottom: Platform.OS === 'ios' ? normalize(40) : normalize(30),
  },
  // ✅ Extra bottom space so the last field (Email) can scroll above the keyboard
  joinFormScrollContent: {
    paddingBottom: Platform.OS === 'ios' ? normalize(120) : normalize(80),
  },
  joinFormHeader: {
    alignItems: 'center',
    marginBottom: normalize(20),
    paddingTop: normalize(16),
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: normalize(40),
    height: normalize(40),
    borderRadius: normalize(20),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: normalize(18),
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    textAlign: 'center',
    lineHeight: normalize(20),
  },
  joinFormTitle: {
    fontSize: normalize(22),
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
    color: '#fff',
    marginBottom: normalize(6),
    textAlign: 'center',
  },
  joinFormSubtitle: {
    fontSize: normalize(14),
    color: '#feb47b',
    fontWeight: '600',
    textAlign: 'center',
  },
  eventInfoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: normalize(14),
    padding: normalize(12),
    marginBottom: normalize(20),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  eventInfoImage: {
    width: normalize(70),
    height: normalize(70),
    borderRadius: normalize(10),
    marginRight: normalize(12),
  },
  eventInfoContent: {
    flex: 1,
    justifyContent: 'center',
  },
  eventInfoTitle: {
    fontSize: normalize(14),
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
    color: '#fff',
    marginBottom: normalize(6),
  },
  eventInfoDetail: {
    fontSize: normalize(12),
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginBottom: normalize(3),
  },
  formSection: {
    marginBottom: normalize(16),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(10),
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(8),
  },
  sectionTitle: {
    fontSize: normalize(15),
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
    color: '#fff',
  },
  memberCount: {
    fontSize: normalize(12),
    fontWeight: '600',
    color: '#feb47b',
    backgroundColor: 'rgba(254, 180, 123, 0.15)',
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(4),
    borderRadius: normalize(12),
    borderWidth: 1,
    borderColor: 'rgba(254, 180, 123, 0.3)',
    overflow: 'hidden',
  },
  addButton: {
    backgroundColor: 'rgba(254, 180, 123, 0.15)',
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(16),
    borderRadius: normalize(20),
    borderWidth: 1,
    borderColor: 'rgba(254, 180, 123, 0.4)',
    minHeight: normalize(38),
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#feb47b',
    fontSize: normalize(13),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: normalize(16),
  },
  inputLabel: {
    fontSize: normalize(14),
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    marginBottom: normalize(8),
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: normalize(12),
    paddingVertical: normalize(14),
    paddingHorizontal: normalize(16),
    fontSize: normalize(15),
    color: '#fff',
    fontWeight: '500',
    minHeight: normalize(50),
  },
  crewMemberCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: normalize(14),
    padding: normalize(12),
    marginBottom: normalize(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  crewMemberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(12),
  },
  crewMemberTitle: {
    fontSize: normalize(14),
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
    color: '#feb47b',
  },
  removeButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    width: normalize(28),
    height: normalize(28),
    borderRadius: normalize(14),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  removeButtonText: {
    color: '#f44336',
    fontSize: normalize(14),
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    textAlign: 'center',
    lineHeight: normalize(16),
  },
  emptyMembersContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: normalize(16),
    padding: normalize(24),
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderStyle: 'dashed',
  },
  emptyMembersText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: normalize(15),
    fontWeight: '600',
    marginBottom: normalize(8),
    textAlign: 'center',
  },
  emptyMembersSubtext: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: normalize(13),
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: normalize(20),
  },
  submitButton: {
    marginTop: normalize(16),
    marginHorizontal: normalize(12),
    borderRadius: normalize(12),
    overflow: 'hidden',
    ...crossPlatformShadow(4),
    minHeight: normalize(52),
    position: 'relative',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: normalize(12),
  },
  submitButtonContent: {
    paddingVertical: normalize(16),
    paddingHorizontal: normalize(20),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: normalize(52),
  },
  submitButtonText: {
    color: '#fff',
    fontSize: normalize(16),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: normalize(12),
    overflow: 'hidden',
    minHeight: Platform.OS === 'ios' ? normalize(150) : normalize(50),
    justifyContent: 'center',
  },
  picker: {
    color: '#fff',
    backgroundColor: 'transparent',
    height: Platform.OS === 'ios' ? normalize(150) : normalize(50),
    width: '100%',
  },
  pickerItem: {
    color: '#fff',
    fontSize: normalize(15),
    fontWeight: '500',
    height: Platform.OS === 'ios' ? normalize(150) : normalize(50),
  },
  readOnlyContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: normalize(10),
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(14),
    minHeight: normalize(44),
    justifyContent: 'center',
  },
  readOnlyText: {
    color: '#fff',
    fontSize: normalize(14),
    fontWeight: '600',
    marginBottom: normalize(2),
  },
  readOnlyLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: normalize(11),
    fontWeight: '500',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(10),
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: normalize(13),
    fontWeight: '600',
    marginLeft: normalize(6),
  },
  
  // Custom Dropdown Styles
  dropdownButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: normalize(12),
    paddingVertical: normalize(14),
    paddingHorizontal: normalize(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: normalize(50),
  },
  dropdownButtonDisabled: {
    opacity: 0.5,
  },
  dropdownButtonText: {
    color: '#fff',
    fontSize: normalize(15),
    fontWeight: '500',
    flex: 1,
  },
  dropdownButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  dropdownPlaceholder: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  dropdownArrow: {
    color: '#fff',
    fontSize: normalize(10),
    marginLeft: normalize(10),
  },
  dropdownArrowDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  dropdownLoadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: normalize(13),
    fontWeight: '500',
    marginLeft: normalize(10),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: normalize(20),
  },
  modalContent: {
    backgroundColor: '#1a3a45',
    borderRadius: normalize(16),
    width: '100%',
    maxHeight: height * 0.6,
    ...crossPlatformShadow(10),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: normalize(16),
    paddingHorizontal: normalize(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: normalize(17),
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
  },
  modalCloseText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: normalize(18),
    fontWeight: '600',
    padding: normalize(5),
  },
  modalScrollView: {
    maxHeight: height * 0.5,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: normalize(16),
    paddingHorizontal: normalize(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalItemSelected: {
    backgroundColor: 'rgba(254, 180, 123, 0.15)',
  },
  modalItemText: {
    color: '#fff',
    fontSize: normalize(15),
    fontWeight: '500',
    flex: 1,
  },
  modalItemTextSelected: {
    color: '#feb47b',
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
  },
  modalItemCheck: {
    color: '#feb47b',
    fontSize: normalize(16),
    fontWeight: 'bold',
    marginLeft: normalize(10),
  },
});

export default OrganiserScreen;
