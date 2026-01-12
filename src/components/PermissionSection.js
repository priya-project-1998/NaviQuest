// src/components/PermissionSection.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PermissionSection = ({ title, description, children }) => (
  <View style={styles.sectionContainer}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.sectionDesc}>{description}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  sectionContainer: {
    marginBottom: 24,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#feb47b',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: '#fff',
    marginBottom: 10,
    opacity: 0.8,
  },
});

export default PermissionSection;
