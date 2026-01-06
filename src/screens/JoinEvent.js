import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Feather";
import { Picker } from "@react-native-picker/picker";

export default function JoinEventScreen() {
  const [email, setEmail] = useState("");
  const [crewMember, setCrewMember] = useState("");
  const [memberName, setMemberName] = useState("");
  const [category, setCategory] = useState("");
  const [group, setGroup] = useState("");
  const [classType, setClassType] = useState("");
  const [rcNo, setRcNo] = useState("");
  const [reference, setReference] = useState("");

  const [mainTab, setMainTab] = useState("apply"); // apply | view
  const [viewTab, setViewTab] = useState("upcoming"); // upcoming | completed
  const [appliedEvents, setAppliedEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    (async () => {
      const storedUser = await AsyncStorage.getItem("loggedInUser");
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setEmail(userData.email || "");
      }
      const storedEvents = await AsyncStorage.getItem("appliedEvents");
      if (storedEvents) {
        setAppliedEvents(JSON.parse(storedEvents));
      }
    })();
  }, []);

  const renderInput = (icon, placeholder, value, setValue, editable = true) => (
    <View style={styles.inputContainer}>
      <Icon name={icon} size={20} color="#ccc" style={styles.icon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#aaa"
        value={value}
        onChangeText={setValue}
        editable={editable}
      />
    </View>
  );

  const handleSubmit = async () => {
    if (!crewMember || !memberName || !category || !group || !classType || !rcNo) {
      Alert.alert("Error", "Please fill all required fields.");
      return;
    }

    const newEvent = {
      id: Date.now(),
      email,
      crewMember,
      memberName,
      category,
      group,
      classType,
      rcNo,
      reference,
      status: "upcoming",
    };

    const updatedEvents = [...appliedEvents, newEvent];
    setAppliedEvents(updatedEvents);
    await AsyncStorage.setItem("appliedEvents", JSON.stringify(updatedEvents));

    Alert.alert("Success", "Your request to join the event has been submitted!");

    setCrewMember("");
    setMemberName("");
    setCategory("");
    setGroup("");
    setClassType("");
    setRcNo("");
    setReference("");
    setMainTab("view");
  };

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Main Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, mainTab === "apply" && styles.activeTab]}
            onPress={() => { setMainTab("apply"); setSelectedEvent(null); }}
          >
            <Text style={styles.tabText}>Apply</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mainTab === "view" && styles.activeTab]}
            onPress={() => { setMainTab("view"); setSelectedEvent(null); }}
          >
            <Text style={styles.tabText}>View</Text>
          </TouchableOpacity>
        </View>

        {mainTab === "apply" && (
          <ScrollView contentContainerStyle={styles.formContainer}>
            <View style={styles.card}>
              <Text style={styles.title}>Apply / Join Event</Text>
              {renderInput("mail", "Email", email, setEmail, false)}

              <View style={styles.inputContainer}>
                <Icon name="users" size={20} color="#ccc" style={styles.icon} />
                <Picker
                  selectedValue={crewMember}
                  onValueChange={(value) => setCrewMember(value)}
                  style={styles.picker}
                  dropdownIconColor="#fff"
                >
                  <Picker.Item label="Select Crew Member" value="" />
                  <Picker.Item label="Crew Member 1" value="crew1" />
                  <Picker.Item label="Crew Member 2" value="crew2" />
                  <Picker.Item label="Crew Member 3" value="crew3" />
                </Picker>
              </View>

              {renderInput("user", "Member Name", memberName, setMemberName)}
              {renderInput("tag", "Category", category, setCategory)}
              {renderInput("grid", "Group", group, setGroup)}
              {renderInput("layers", "Class", classType, setClassType)}
              {renderInput("hash", "RC No", rcNo, setRcNo)}
              {renderInput("file-text", "Reference", reference, setReference)}

              <TouchableOpacity style={{ marginTop: 20 }} onPress={handleSubmit}>
                <LinearGradient colors={["#ff7e5f", "#feb47b"]} style={styles.button}>
                  <Text style={styles.buttonText}>Submit</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {mainTab === "view" && !selectedEvent && (
          <>
            {/* Sub Tabs */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, viewTab === "upcoming" && styles.activeTab]}
                onPress={() => setViewTab("upcoming")}
              >
                <Text style={styles.tabText}>Upcoming</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, viewTab === "completed" && styles.activeTab]}
                onPress={() => setViewTab("completed")}
              >
                <Text style={styles.tabText}>Completed</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 10 }}>
              {appliedEvents
                .filter(e => e.status === viewTab)
                .map(e => (
                  <TouchableOpacity
                    key={e.id}
                    style={styles.listItem}
                    onPress={() => setSelectedEvent(e)}
                  >
                    <Text style={styles.listTitle}>{e.memberName}</Text>
                    <Text style={styles.listSub}>{e.category} - {e.group}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </>
        )}

        {mainTab === "view" && selectedEvent && (
          <ScrollView contentContainerStyle={{ padding: 15 }}>
            <TouchableOpacity onPress={() => setSelectedEvent(null)}>
              <Text style={{ color: "#ff7e5f", marginBottom: 10 }}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.detailTitle}>{selectedEvent.memberName}</Text>
            <Text style={styles.detailText}>Email: {selectedEvent.email}</Text>
            <Text style={styles.detailText}>Crew Member: {selectedEvent.crewMember}</Text>
            <Text style={styles.detailText}>Category: {selectedEvent.category}</Text>
            <Text style={styles.detailText}>Group: {selectedEvent.group}</Text>
            <Text style={styles.detailText}>Class: {selectedEvent.classType}</Text>
            <Text style={styles.detailText}>RC No: {selectedEvent.rcNo}</Text>
            <Text style={styles.detailText}>Reference: {selectedEvent.reference}</Text>
          </ScrollView>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabRow: { flexDirection: "row", margin: 5 },
  tab: { flex: 1, paddingVertical: 10, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 8, alignItems: "center", marginHorizontal: 5 },
  activeTab: { backgroundColor: "#ff7e5f" },
  tabText: { color: "#fff", fontWeight: "bold" },
  formContainer: { padding: 10 },
  card: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 20 },
  inputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, marginVertical: 8, paddingHorizontal: 10 },
  icon: { marginRight: 10 },
  input: { flex: 1, color: "#fff", fontSize: 16, paddingVertical: 10 },
  picker: { flex: 1, color: "#fff" },
  button: { paddingVertical: 14, borderRadius: 10 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 18, textAlign: "center" },
  listItem: { backgroundColor: "rgba(255,255,255,0.1)", padding: 15, borderRadius: 8, marginBottom: 10 },
  listTitle: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  listSub: { color: "#ccc", fontSize: 14 },
  detailTitle: { fontSize: 20, fontWeight: "bold", color: "#fff", marginBottom: 10 },
  detailText: { color: "#ccc", marginBottom: 5 },
});
