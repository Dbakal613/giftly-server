import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jwsojwoipgsbzyyvddqf.supabase.co';
const supabaseAnonKey = 'sb_publishable_sKMnqWRjuEMyancMmKgmUA_QFmTiRwJ';

// Web uses localStorage, native uses AsyncStorage
const storage = Platform.OS === 'web'
  ? {
      getItem:    (key) => Promise.resolve(localStorage.getItem(key)),
      setItem:    (key, value) => Promise.resolve(localStorage.setItem(key, value)),
      removeItem: (key) => Promise.resolve(localStorage.removeItem(key)),
    }
  : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
