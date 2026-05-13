import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DietaryTag = 'vegetarian' | 'vegan' | 'gluten_free' | 'no_pork' | 'dairy_free';

interface UserState {
  dietaryProfile: DietaryTag[];
  setDietaryProfile: (tags: DietaryTag[]) => void;
  toggleDietaryTag: (tag: DietaryTag) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      dietaryProfile: [],

      setDietaryProfile: (tags) => set({ dietaryProfile: tags }),

      toggleDietaryTag: (tag) => {
        const current = get().dietaryProfile;
        const next = current.includes(tag)
          ? current.filter((t) => t !== tag)
          : [...current, tag];
        set({ dietaryProfile: next });
      },
    }),
    {
      name: 'plateoffs-user',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
