import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getSettings } from './src/storage';
import HomeScreen from './src/screens/HomeScreen';
import JobsScreen from './src/screens/JobsScreen';
import AddJobScreen from './src/screens/AddJobScreen';
import JobDetailScreen from './src/screens/JobDetailScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import RouteMapScreen from './src/screens/RouteMapScreen';
import MapScreen from './src/screens/MapScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TutorialScreen from './src/screens/TutorialScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';

const Tab = createBottomTabNavigator();
const JobsStack = createNativeStackNavigator();
const ScheduleStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

const NAV_HEADER = {
  headerStyle: { backgroundColor: '#1A3057' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' as const },
};

function JobsNavigator() {
  return (
    <JobsStack.Navigator screenOptions={NAV_HEADER}>
      <JobsStack.Screen name="JobsList" component={JobsScreen} options={{ title: 'Mina Jobb' }} />
      <JobsStack.Screen name="AddJob" component={AddJobScreen}
        options={({ route }: any) => ({ title: route.params?.editClient ? 'Redigera jobb' : 'Nytt Jobb' })} />
      <JobsStack.Screen name="JobDetail" component={JobDetailScreen}
        options={({ route }: any) => ({ title: route.params?.client?.name ?? 'Jobbdetaljer' })} />
    </JobsStack.Navigator>
  );
}

function ScheduleNavigator() {
  return (
    <ScheduleStack.Navigator screenOptions={NAV_HEADER}>
      <ScheduleStack.Screen name="ScheduleMain" component={ScheduleScreen} options={{ title: 'Schema' }} />
      <ScheduleStack.Screen name="RouteMap" component={RouteMapScreen}
        options={({ route }: any) => ({ title: route.params?.dateLabel ?? 'Dagsrutt' })} />
      <ScheduleStack.Screen name="JobDetail" component={JobDetailScreen}
        options={({ route }: any) => ({ title: route.params?.client?.name ?? 'Jobbdetaljer' })} />
      <ScheduleStack.Screen name="AddJob" component={AddJobScreen}
        options={({ route }: any) => ({ title: route.params?.editClient ? 'Redigera jobb' : 'Nytt Jobb' })} />
    </ScheduleStack.Navigator>
  );
}

function SettingsNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={NAV_HEADER}>
      <SettingsStack.Screen name="SettingsMain" component={SettingsScreen} options={{ title: 'Inställningar' }} />
      <SettingsStack.Screen name="Tutorial" component={TutorialScreen} options={{ title: 'Tutorial' }} />
    </SettingsStack.Navigator>
  );
}

function MainApp() {
  return (
    <Tab.Navigator screenOptions={{
      tabBarActiveTintColor: '#D4822A',
      tabBarInactiveTintColor: '#9CA3AF',
      tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E5E7EB', paddingTop: 6, paddingBottom: 10, height: 82 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{
        headerShown: false,
        tabBarLabel: 'Hem',
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text>,
      }} />
      <Tab.Screen name="JobsTab" component={JobsNavigator} options={{
        headerShown: false,
        tabBarLabel: 'Jobb',
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>🔨</Text>,
      }} />
      <Tab.Screen name="ScheduleTab" component={ScheduleNavigator} options={{
        headerShown: false,
        tabBarLabel: 'Schema',
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>📅</Text>,
      }} />
      <Tab.Screen name="MapTab" component={MapScreen} options={{
        headerShown: false,
        tabBarLabel: 'Karta',
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>📍</Text>,
      }} />
      <Tab.Screen name="SettingsTab" component={SettingsNavigator} options={{
        headerShown: false,
        tabBarLabel: 'Inställn.',
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>⚙️</Text>,
      }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    getSettings().then(s => {
      setOnboardingDone(s.onboardingDone);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: '#1A3057', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🔨</Text>
            <ActivityIndicator color="#D4822A" size="large" />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (!onboardingDone) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <OnboardingScreen onDone={() => setOnboardingDone(true)} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <MainApp />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
