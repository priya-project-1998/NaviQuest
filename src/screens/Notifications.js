import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions 
} from "react-native";
import LinearGradient from "react-native-linear-gradient";

const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "Event Reminder",
      message: "Your event 'City Car Race' starts tomorrow at 9:00 AM.",
      time: "2025-08-02 18:30",
      isRead: false,
      type: "reminder",
      icon: "⏰",
    },
    {
      id: 2,
      title: "Result Published",
      message: "Results for 'Mountain Bike Challenge' are now live.",
      time: "2025-08-01 14:20",
      isRead: false,
      type: "success",
      icon: "🏆",
    },
    {
      id: 3,
      title: "New Event Available",
      message: "A new event 'Walking Marathon' is now open for registration.",
      time: "2025-07-30 09:15",
      isRead: true,
      type: "info",
      icon: "🎯",
    },
    {
      id: 4,
      title: "Registration Closing Soon",
      message: "Only 2 days left to register for 'Speed Rally'.",
      time: "2025-07-28 17:00",
      isRead: true,
      type: "warning",
      icon: "⚠️",
    },
    {
      id: 5,
      title: "Event Update",
      message: "'City Cycling' start time has been changed to 8:00 AM.",
      time: "2025-07-25 11:45",
      isRead: true,
      type: "info",
      icon: "📝",
    },
    {
      id: 6,
      title: "Special Bonus",
      message: "You have earned a bonus of 50 points in 'Offroad Car Rally'.",
      time: "2025-07-20 10:05",
      isRead: true,
      type: "success",
      icon: "🎉",
    },
  ]);

  const markAsRead = (id) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, isRead: true }))
    );
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'info': return '#2196F3';
      case 'warning': return '#FF9800';
      case 'reminder': return '#9C27B0';
      default: return '#feb47b';
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <TouchableOpacity 
              style={styles.markAllButton}
              onPress={markAllAsRead}
            >
              <Text style={styles.markAllText}>Mark All Read</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notifications Count */}
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up! 🎉'}
          </Text>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {notifications.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.notificationCard,
                !item.isRead && styles.unreadCard
              ]}
              onPress={() => markAsRead(item.id)}
              activeOpacity={0.8}
            >
              <View style={styles.notificationContent}>
                <View style={[styles.iconContainer, { backgroundColor: getTypeColor(item.type) }]}>
                  <Text style={styles.iconText}>{item.icon}</Text>
                </View>
                
                <View style={styles.textContainer}>
                  <Text style={[styles.title, !item.isRead && styles.unreadTitle]}>
                    {item.title}
                  </Text>
                  <Text style={styles.message} numberOfLines={2}>
                    {item.message}
                  </Text>
                  <Text style={styles.time}>{item.time}</Text>
                </View>
                
                {!item.isRead && <View style={styles.unreadDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: isSmallDevice ? 24 : 28,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
    letterSpacing: 0.5,
  },
  markAllButton: {
    backgroundColor: 'rgba(254, 180, 123, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#feb47b',
  },
  markAllText: {
    color: '#feb47b',
    fontSize: 12,
    fontWeight: '600',
  },
  countContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  countText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  notificationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },
  unreadCard: {
    backgroundColor: 'rgba(254, 180, 123, 0.1)',
    borderColor: 'rgba(254, 180, 123, 0.3)',
  },
  notificationContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  unreadTitle: {
    color: '#feb47b',
  },
  message: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
    marginBottom: 8,
  },
  time: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#feb47b',
    marginLeft: 8,
    marginTop: 8,
  },
});

export default NotificationsScreen;
