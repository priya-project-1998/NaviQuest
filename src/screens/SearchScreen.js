import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Feather";

const SearchScreen = () => {
  const [selectedResult, setSelectedResult] = useState(null);
  const [searchText, setSearchText] = useState("");

  // Dummy Completed Event Results
  const resultsData = [
    { id: 1, name: "City Car Race - July 2025" },
    { id: 2, name: "Mountain Bike Challenge - June 2025" },
    { id: 3, name: "Walking Marathon - May 2025" },
    { id: 4, name: "Speed Rally - April 2025" },
    { id: 5, name: "City Cycling - March 2025" },
    { id: 6, name: "Offroad Car Rally - Feb 2025" },
  ];

  // Filtered list based on search
  const filteredData = resultsData.filter((item) =>
    item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={{ flex: 1 }}>
      <View style={styles.container}>
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search events..."
            placeholderTextColor="#aaa"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Icon name="x-circle" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {!selectedResult && (
          <ScrollView contentContainerStyle={styles.listContainer}>
            {filteredData.map((result) => (
              <TouchableOpacity
                key={result.id}
                style={styles.listItem}
                onPress={() => setSelectedResult(result)}
              >
                <Text style={styles.listText}>{result.name}</Text>
                <Text style={styles.subText}>Tap to view details</Text>
              </TouchableOpacity>
            ))}
            {filteredData.length === 0 && (
              <Text style={{ color: "#ccc", textAlign: "center", marginTop: 20 }}>
                No events found.
              </Text>
            )}
          </ScrollView>
        )}

        {selectedResult && (
          <ScrollView contentContainerStyle={styles.detailsContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedResult(null)}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.heading}>{selectedResult.name}</Text>
            <Text style={styles.subText}>Details about {selectedResult.name} will go here...</Text>
          </ScrollView>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchInput: { flex: 1, color: "#fff", paddingVertical: 8 },
  listContainer: { paddingBottom: 20 },
  listItem: {
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  listText: { fontSize: 16, fontWeight: "bold", color: "#fff" },
  subText: { color: "#ccc", fontSize: 14 },
  detailsContainer: { padding: 10 },
  backButton: { marginBottom: 10 },
  backText: { color: "#ff7e5f", fontWeight: "bold" },
  heading: { fontSize: 20, fontWeight: "bold", color: "#fff", marginBottom: 10 },
});

export default SearchScreen;
