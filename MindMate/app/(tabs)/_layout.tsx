// app/(tabs)/_layout.tsx - With improved touch area alignment
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';

// Define the props interface for our HeaderIconButton
interface HeaderIconButtonProps {
  iconName: React.ComponentProps<typeof FontAwesome>['name'];
  onPress: () => void;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Custom header button component that ensures the entire area is touchable
function HeaderIconButton({ 
  iconName, 
  onPress, 
  color = '#666', 
  size = 22,
  style
}: HeaderIconButtonProps) {
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.iconButton,
        { opacity: pressed ? 0.7 : 1 },
        style
      ]}
      onPress={onPress}
      hitSlop={{ top: 15, right: 15, bottom: 15, left: 15 }}
    >
      <FontAwesome 
        name={iconName} 
        size={size} 
        color={color} 
        style={styles.buttonIcon}
      />
    </Pressable>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const textColor = Colors[colorScheme ?? 'light'].text;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          tabBarShowLabel: true,
          headerShown: true,
          tabBarStyle: {
            height: 60,
          },
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: 'normal',
            marginTop: 2,
          },
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: 'bold',
            color: textColor,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerTitle: 'MindMate',
            headerRight: () => (
              <HeaderIconButton 
                iconName="bell"
                color={textColor}
                onPress={() => router.push('/notifications')}
                style={styles.headerRightButton}
              />
            ),
            tabBarIcon: ({ color }) => <FontAwesome size={40} name="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: 'Community',
            tabBarIcon: ({ color }) => <FontAwesome size={30} name="users" color={color} />,
            headerRight: () => (
              <HeaderIconButton 
                iconName="plus"
                color="#fff"
                style={[styles.headerRightButton, styles.createButtonContainer]}
                onPress={() => router.push('/community/create_community')}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color }) => <FontAwesome size={32} name="envelope" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            headerRight: () => (
              <HeaderIconButton 
                iconName="cog"
                color={textColor}
                style={styles.headerRightButton}
                onPress={() => router.push('/profile/settings')}
              />
            ),
            tabBarIcon: ({ color }) => <FontAwesome size={32} name="user" color={color} />,
          }}
        />
      </Tabs>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
  },
  buttonIcon: {
    textAlign: 'center',
  },
  headerRightButton: {
    marginRight: 16,
  },
  createButtonContainer: {
    backgroundColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  }
});