import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';

export default function TabLayout() {
  const colorScheme = useColorScheme();

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
            color: Colors[colorScheme ?? 'light'].text,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerTitle: 'MindMate',
            headerRight: () => (
              <Link href="../notifications" asChild>
                <Pressable style={{ marginRight: 20 }}>
                  <FontAwesome
                    name="bell"
                    size={22}
                    color={Colors[colorScheme ?? 'light'].text}
                  />
                </Pressable>
              </Link>
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
              <Link href="../community/create_community" asChild>
                <Pressable style={styles.createButton}>
                  <FontAwesome name="plus" size={20} color="#fff" />
                </Pressable>
              </Link>
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
              <Link href="/profile/settings" asChild>
                <Pressable style={{ marginRight: 20 }}>
                  <FontAwesome
                    name="cog"
                    size={22}
                    color={Colors[colorScheme ?? 'light'].text}
                  />
                </Pressable>
              </Link>
            ),
            tabBarIcon: ({ color }) => <FontAwesome size={32} name="user" color={color} />,
          }}
        />
      </Tabs>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  //Community Page - Create Community Button
  createButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});