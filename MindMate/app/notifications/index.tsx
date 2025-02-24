import { StyleSheet, ScrollView, Pressable } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function NotificationsScreen() {
  const notifications = [
    {
      id: 1,
      type: 'support',
      title: 'Support Request',
      message: 'Sarah wants to check in with you',
      time: '5 min ago',
      read: false,
    },
    {
      id: 2,
      type: 'wellness',
      title: 'Daily Check-in',
      message: 'Time for your daily wellness check',
      time: '1 hour ago',
      read: true,
    },
    {
      id: 3,
      type: 'community',
      title: 'New Community Post',
      message: 'New activity in Mindful Mornings group',
      time: '2 hours ago',
      read: false,
    },
    {
      id: 4,
      type: 'alert',
      title: 'Wellness Alert',
      message: 'Your activity patterns have changed',
      time: '3 hours ago',
      read: true,
    }
  ];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {notifications.map((notification) => (
          <Pressable 
            key={notification.id}
            style={styles.notificationItem}
          >
            <View style={[
              styles.iconContainer,
              { backgroundColor: 
                notification.type === 'support' ? '#FFE4E4' :
                notification.type === 'wellness' ? '#E3F2FD' :
                notification.type === 'community' ? '#E8F5E9' :
                '#FFF3E0'
              }
            ]}>
              <FontAwesome 
                name={
                  notification.type === 'support' ? 'heart' :
                  notification.type === 'wellness' ? 'check-circle' :
                  notification.type === 'community' ? 'users' :
                  'exclamation-circle'
                }
                size={20}
                color={
                  notification.type === 'support' ? '#FF4444' :
                  notification.type === 'wellness' ? '#2196F3' :
                  notification.type === 'community' ? '#4CAF50' :
                  '#FF9800'
                }
              />
            </View>

            <View style={styles.textContainer}>
              <Text style={styles.title}>{notification.title}</Text>
              <Text style={styles.message}>{notification.message}</Text>
            </View>

            <View style={styles.rightContainer}>
              <Text style={styles.time}>{notification.time}</Text>
              {!notification.read && (
                <View style={styles.unreadDot} />
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  content: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#666',
  },
  rightContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  time: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
  },
});