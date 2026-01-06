import React from "react";
import { View, Text, StyleSheet, Button, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LogoutScreen({ navigation }) {
  const handleLogout = () => {
    Alert.alert("Confirm Logout", "Do you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        onPress: async () => {
          await AsyncStorage.setItem("rememberMe", "false");
        await AsyncStorage.removeItem("sessionExpiry");
          navigation.replace("LoginScreen");  
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Logout</Text>
      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 18, marginBottom: 10 },
});
