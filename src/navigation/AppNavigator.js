import { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';

import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import ProductScreen from '../screens/ProductScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FriendsScreen from '../screens/FriendsScreen';
import FriendProfileScreen from '../screens/FriendProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PriceAlertsScreen from '../screens/PriceAlertsScreen';
import GroupGiftScreen from '../screens/GroupGiftScreen';
import PublicGiftScreen from '../screens/PublicGiftScreen';

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: [],
  config: {
    screens: {
      PublicGift: 'gift/:giftId',
    },
  },
};

export default function AppNavigator() {
  const [session, setSession]               = useState(null);
  const [loading, setLoading]               = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session) checkOnboarding(session.user.id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await checkOnboarding(session.user.id);
      } else {
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkOnboarding(userId) {
    try {
      // Check localStorage first (fast, works on web)
      try {
        if (localStorage.getItem(`onboarding_done_${userId}`)) {
          setNeedsOnboarding(false);
          return;
        }
      } catch {}
      // Fallback: check DB
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_done')
        .eq('id', userId)
        .maybeSingle();
      setNeedsOnboarding(!data?.onboarding_done);
    } catch {
      setNeedsOnboarding(false);
    } finally {
      setLoading(false);
    }
  }

  function handleOnboardingDone() {
    setNeedsOnboarding(false);
  }

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAF7' }}>
      <ActivityIndicator size="large" color="#D94F3D" />
    </View>
  );

  // Not logged in — include PublicGift so share links work without auth
  if (!session) {
    return (
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="PublicGift" component={PublicGiftScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Logged in but hasn't done onboarding
  if (needsOnboarding) {
    return <OnboardingScreen onDone={handleOnboardingDone} />;
  }

  // Logged in + onboarding done
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Product" component={ProductScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Friends" component={FriendsScreen} />
        <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="PriceAlerts" component={PriceAlertsScreen} />
        <Stack.Screen name="GroupGift" component={GroupGiftScreen} />
        <Stack.Screen name="PublicGift" component={PublicGiftScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
