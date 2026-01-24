import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
const menuItems = [
  { icon: 'account', label: 'Profile', screen: 'Profile' },
  { icon: 'magnify', label: 'Search', screen: 'Search' },
  { icon: 'trophy-outline', label: 'Results', screen: 'Results' },
  { icon: 'account-star-outline', label: 'Event', screen: 'Event' },
  { icon: 'map', label: 'Map', screen: 'Map' },
  { icon: 'translate', label: 'Language', screen: 'Language' },
  { icon: 'message-outline', label: 'Feedback', screen: 'Feedback' },
  { icon: 'account-multiple-plus-outline', label: 'Invite Friends', screen: 'Invite User' },
  { icon: 'star-outline', label: 'Rate us', screen: 'Rate Us' },
  { icon: 'shield-outline', label: 'Privacy Policy', screen: 'Privacy Policy' },
  { icon: 'map-marker-radius-outline', label: 'Location Permission Policy', screen: 'Location Permission Policy' },
  { icon: 'power', label: 'Logout', screen: 'Logout' },
];

export default function CustomDrawerContent({ navigation }: any) {
  const user = useSelector((state: RootState) => state.user);

  return (
    <DrawerContentScrollView>
      <View style={styles.header}>
        <Icon name="account-circle" size={48} color="#888" />
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <ScrollView>
        {menuItems.map(item => (
          <TouchableOpacity
            key={item.label}
            style={styles.menuItem}
            onPress={() => {
              navigation.navigate(item.screen);
            }}
          >
            <Icon name={item.icon} size={20} color="#6a1b9a" style={styles.icon} />
            <Text style={styles.menuText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.version}>v6.6</Text>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  name: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  email: { fontSize: 14, color: '#666' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  icon: { marginRight: 12 },
  menuText: { fontSize: 15 },
  version: { textAlign: 'center', paddingVertical: 10, color: '#aaa' },
});