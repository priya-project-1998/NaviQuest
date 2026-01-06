// SplashScreen.js
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import AuthService from '../services/apiService/auth_service';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    const checkAuthenticationStatus = async () => {
      try {
        // Use the proper session validation from AuthService
        const isSessionValid = await AuthService.isSessionValid();
        
        // Show splash for minimum time to display branding, then navigate
        setTimeout(() => {
          if (isSessionValid) {
            // User has valid session, go directly to home
            navigation.replace("Drawer");
          } else {
            // No valid session, go to login
            navigation.replace("LoginScreen");
          }
        }, 1500); // Reduced splash delay to 1.5 seconds for better UX
      } catch (err) {
        navigation.replace("LoginScreen");
      }
    };

    checkAuthenticationStatus();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Image 
        source={require('../assets/images/splash.png')} 
        style={styles.splashImage}
        resizeMode="contain"
      />
      <ActivityIndicator size="large" color="#fff" style={styles.loader} />
      <Text style={styles.text}> </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#203a43' 
  },
  splashImage: {
    width: 200,
    height: 200,
    marginBottom: 30,
  },
  loader: {
    marginBottom: 10,
  },
  text: { 
    fontSize: 18, 
    marginTop: 10, 
    color: '#fff' 
  },
});
