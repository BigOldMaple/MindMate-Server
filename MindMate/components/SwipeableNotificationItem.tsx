// components/SwipeableNotificationItem.tsx
import React, { useRef } from 'react';
import { StyleSheet, Animated, View, Text, TouchableOpacity, Alert } from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

// Define the props for our swipeable notification item
interface SwipeableNotificationItemProps {
  item: any; // Replace with your Notification type
  onPress: (item: any) => void;
  onDelete: (id: string) => void;
}

const SwipeableNotificationItem: React.FC<SwipeableNotificationItemProps> = ({ 
  item, 
  onPress,
  onDelete
}) => {
  const colorScheme = useColorScheme();
  const swipeableRef = useRef<Swipeable>(null);

  // Function to handle item press
  const handlePress = () => {
    onPress(item);
  };

  // Function to handle delete confirmation
  const confirmDelete = () => {
    Alert.alert(
      "Delete Notification",
      "Are you sure you want to delete this notification?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            // Close the swipeable
            swipeableRef.current?.close();
          }
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // Call the delete function
            onDelete(item.id || item._id);
            // Close the swipeable
            swipeableRef.current?.close();
          }
        }
      ]
    );
  };

  // Render the right actions (swipe from left to right)
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    });

    return (
      <RectButton style={styles.deleteAction} onPress={confirmDelete}>
        <Animated.View
          style={[
            styles.actionContent,
            {
              transform: [{ translateX: trans }],
            },
          ]}
        >
          <FontAwesome name="trash" size={22} color="#fff" />
          <Text style={styles.actionText}>Delete</Text>
        </Animated.View>
      </RectButton>
    );
  };

  // Render the left actions (swipe from right to left)
  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [-80, 0],
    });

    return (
      <RectButton style={styles.deleteActionLeft} onPress={confirmDelete}>
        <Animated.View
          style={[
            styles.actionContent,
            {
              transform: [{ translateX: trans }],
            },
          ]}
        >
          <FontAwesome name="trash" size={22} color="#fff" />
          <Text style={styles.actionText}>Delete</Text>
        </Animated.View>
      </RectButton>
    );
  };

  // Get appropriate colors from the theme
  const backgroundColor = Colors[colorScheme ?? 'light'].background;
  const textColor = Colors[colorScheme ?? 'light'].text;
  const unreadBackgroundColor = colorScheme === 'dark' ? '#1A2235' : '#F8FAFD';

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={80}
      rightThreshold={80}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      onSwipeableOpen={(direction) => {
        if (direction === 'right' || direction === 'left') {
          // We can either automatically trigger delete or show confirmation
          // For safety, we're using explicit confirmation via button press
        }
      }}
    >
      <TouchableOpacity
        style={[
          styles.notificationItem,
          { backgroundColor },
          !item.read && { backgroundColor: unreadBackgroundColor }
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={[
          styles.iconContainer,
          {
            backgroundColor:
              item.type === 'support' ? '#FFE4E4' :
                item.type === 'wellness' ? '#E3F2FD' :
                  item.type === 'community' ? '#E8F5E9' :
                    item.type === 'buddy' ? '#E1F5FE' :
                      '#FFF3E0'
          }
        ]}>
          <FontAwesome
            name={
              item.type === 'support' ? 'heart' :
                item.type === 'wellness' ? 'check-circle' :
                  item.type === 'community' ? 'users' :
                    item.type === 'buddy' ? 'user-plus' :
                      'exclamation-circle'
            }
            size={20}
            color={
              item.type === 'support' ? '#FF4444' :
                item.type === 'wellness' ? '#2196F3' :
                  item.type === 'community' ? '#4CAF50' :
                    item.type === 'buddy' ? '#03A9F4' :
                      '#FF9800'
            }
          />
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: textColor }]}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
        </View>

        <View style={styles.rightContainer}>
          <Text style={styles.time}>{typeof item.time === 'string' ? item.time : new Date(item.time).toLocaleDateString()}</Text>
          {!item.read && (
            <View style={[styles.unreadDot, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]} />
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  unreadNotification: {
    backgroundColor: '#F8FAFD',
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
  },
  deleteAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: 80,
    height: '100%',
  },
  deleteActionLeft: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: 80,
    height: '100%',
  },
  actionContent: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
});

export default SwipeableNotificationItem;