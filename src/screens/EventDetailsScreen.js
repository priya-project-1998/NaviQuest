import React from "react";
import EventDetailsView from "../components/EventDetailsView";
import { View } from "react-native";

export default function EventDetailsScreen({ route, navigation }) {
  const { event } = route.params || {};
  return (
    <View style={{ flex: 1, backgroundColor: '#203a43' }}>
      <EventDetailsView event={event} onBack={() => navigation.goBack()} />
    </View>
  );
}
