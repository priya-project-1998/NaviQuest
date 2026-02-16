import React, { forwardRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Linking, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ResultsScreen from '../screens/ResultsScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import LogoutScreen from '../screens/LogoutScreen';
import SearchScreen from '../screens/SearchScreen';
import OrganiserScreen from '../screens/OrganiserScreen';
import InviteUserScreen from '../screens/InviteUserScreen';
import RateUsScreen from '../screens/RateUsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import LocationPermissionPolicyScreen from '../screens/LocationPermissionPolicyScreen';
import TermsConditionScreen from '../screens/TermsConditionScreen';
import SplashScreen from '../screens/SplashScreen';
import CustomDrawer from "../screens/CustomDrawer"; 
import SettingsScreen from '../screens/SettingsScreen';
import AboutAppScreen from '../screens/AboutAppScreen';
import ForgetPasswordScreen from '../screens/ForgetPasswordScreen';
import NotificationBell from '../components/NotificationBell';
import MyEventsScreen from '../screens/MyEventsScreen';
import NotificationsScreen from '../screens/Notifications';
import EventStartScreen from '../screens/EventStartScreen';
import EventDetailsScreen from '../screens/EventDetailsScreen';
import MapScreen from '../screens/MapScreen';
import JoinEventScreen from '../screens/JoinEventScreen';
const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const defaultScreenOptions = {
  headerBackground: () => (
    <LinearGradient
      colors={['#0f2027', '#203a43']}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
    />
  ),
  headerTintColor: '#fff',
  headerTitleStyle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  headerShadowVisible: false,
  // headerRight: () => <NotificationBell notificationCount={3} />, // Add notification bell to all screens
};

function DrawerNavigator() {
  return (
    <Drawer.Navigator 
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        ...defaultScreenOptions,
        headerStyle: {
          // Don't set fixed height on iOS - let it automatically handle safe area
          ...(Platform.OS === 'android' ? { height: 65 } : {}),
          backgroundColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerLeftContainerStyle: {
          paddingLeft: 10,
        },
        headerRightContainerStyle: {
          paddingRight: 10,
        },
        headerTitleAlign: 'center',
        drawerStyle: {
          backgroundColor: '#203a43',
          borderRightWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          width: '75%',
        },
        drawerActiveTintColor: '#ffffff',
        drawerInactiveTintColor: 'rgba(255,255,255,0.8)',
        drawerActiveBackgroundColor: 'transparent',
        drawerItemStyle: {
          borderRadius: 12,
          marginHorizontal: 12,
          marginVertical: 3,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'transparent',
        },
        drawerContentStyle: {
          backgroundColor: 'transparent',
        },
        drawerLabelStyle: ({ focused }) => ({
          fontSize: 14,
          fontWeight: focused ? '700' : '500',
          letterSpacing: 0.3,
          textShadowColor: focused ? 'rgba(0,0,0,0.3)' : 'transparent',
          textShadowOffset: { width: 1, height: 1 },
          textShadowRadius: 2,
        }),
        pressColor: 'rgba(254, 180, 123, 0.1)',
        pressOpacity: 0.8,
        drawerContentContainerStyle: {
          paddingTop: 10,
        },
        drawerItemBackground: ({ focused }) => 
          focused ? (
            <LinearGradient
              colors={['#feb47b', '#ff7e5f']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                opacity: 0.9,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5,
              }}
            />
          ) : (
            <LinearGradient
              colors={['rgba(32, 58, 67, 0.4)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
              }}
            />
          )
      }}
    >
      <Drawer.Screen 
        name="Dashboard" 
        component={HomeScreen}
        options={{
          headerTitle: "NaviQuest",
          headerTitleStyle: {
            color: '#feb47b',
            fontWeight: '700',
            fontSize: 20,
            letterSpacing: 0.8,
            textAlign: 'center',
          },
          headerTitleAlign: 'center',
        }} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
      {/* <Drawer.Screen name="Map" component={MapScreen} /> */}
      <Drawer.Screen name="Notifications" component={NotificationsScreen} options={{drawerItemStyle: { display: 'none' }}}/>
      <Drawer.Screen name="Event" component={OrganiserScreen} />
      <Drawer.Screen name="Results" component={ResultsScreen} />
      {/* <Drawer.Screen name="Search" component={SearchScreen} /> */}
      {/* <Drawer.Screen name="Feedback" component={FeedbackScreen} /> */}
      <Drawer.Screen name="Invite User" component={InviteUserScreen} />
      {/* <Drawer.Screen name="Rate Us" component={RateUsScreen} /> */}
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      <Drawer.Screen name="Location Permission Policy" component={LocationPermissionPolicyScreen} />
      <Drawer.Screen name="Privacy Policy" component={PrivacyPolicyScreen} />
      <Drawer.Screen name="Terms & Condition" component={TermsConditionScreen} />
      <Drawer.Screen name="About App" component={AboutAppScreen} />
    </Drawer.Navigator>
  );
}

const AppNavigator = forwardRef((props, ref) => {
  // Deep link configuration
  const linking = {
    prefixes: ['vcmapp://', 'https://vcmapp.com'],
    config: {
      screens: {
        JoinEventScreen: {
          path: '/event/:eventId',
          parse: {
            eventId: (eventId) => eventId,
          },
        },
        'Join Event': {
          path: '/join/:eventId',
          parse: {
            eventId: (eventId) => eventId,
          },
        },
        Drawer: {
          screens: {
            Dashboard: 'dashboard',
            Event: 'events',
            Profile: 'profile',
          },
        },
        LoginScreen: 'login',
        Signup: 'signup',
      },
    },
  };

  return (
    <NavigationContainer ref={ref} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="SplashScreen" component={SplashScreen} />
        <Stack.Screen name="LoginScreen" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Drawer" component={DrawerNavigator} />
        <Stack.Screen name="ForgetPassword" component={ForgetPasswordScreen} />
        <Stack.Screen name="My Events" component={MyEventsScreen} />
        <Stack.Screen name="EventStartScreen" component={EventStartScreen} />
        <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
        <Stack.Screen name="MapScreen" component={MapScreen} />
        <Stack.Screen name="ResultsScreen" component={ResultsScreen} />
        <Stack.Screen name="JoinEventScreen" component={JoinEventScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
});

export default AppNavigator;
