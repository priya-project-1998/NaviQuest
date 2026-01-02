import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

export default function CustomButton({ title, onPress }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
