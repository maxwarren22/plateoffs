import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const ROTATION_MESSAGES = [
  {
    title: 'NEW ARENA UNLOCKED 🔥',
    body: 'Fresh competitors have entered the bracket. Step up and judge.',
  },
  {
    title: 'THE ROTATION HAS SPOKEN',
    body: 'New divisions are live. Time to settle some serious scores.',
  },
  {
    title: 'FRESH BRACKETS INCOMING',
    body: 'A new food fight is ready. Who reigns supreme tonight?',
  },
  {
    title: 'YOUR TABLE IS READY',
    body: 'New contenders have arrived in the arena. Judge them harshly.',
  },
  {
    title: 'LINEUP CHANGE ⚡',
    body: 'New dishes have entered the tournament. Pick your champion.',
  },
  {
    title: 'PLATES UP 🍽️',
    body: 'The kitchen has rotated. New arenas await your verdict.',
  },
  {
    title: 'NEW CHALLENGERS APPROACH',
    body: "Fresh divisions just dropped in Plateoffs. The bracket won't judge itself.",
  },
  {
    title: 'THE BELL HAS RUNG 🥊',
    body: "New food brawls are live. Don't sleep on these contenders.",
  },
  {
    title: 'ROTATION COMPLETE',
    body: 'A new division is live. Enter the arena and crown a champion.',
  },
  {
    title: 'IT JUST ROTATED 👀',
    body: 'New food fighters have entered the ring. Your vote matters.',
  },
];

function pickMessage(seed: number) {
  return ROTATION_MESSAGES[seed % ROTATION_MESSAGES.length];
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleRotationNotifications(
  rotationTimes: { slot: string; name: string; rotatesAt: number }[]
): Promise<void> {
  // Cancel previously scheduled rotation notifications before rescheduling
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const rotationIds = scheduled
    .filter((n) => n.identifier.startsWith('rotation-'))
    .map((n) => n.identifier);
  await Promise.all(rotationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

  const now = Date.now();

  await Promise.all(
    rotationTimes
      .filter(({ rotatesAt }) => rotatesAt > now + 60_000)
      .map(async ({ slot, name, rotatesAt }, i) => {
        const msg = pickMessage(i + Math.floor(now / 86_400_000));
        await Notifications.scheduleNotificationAsync({
          identifier: `rotation-${slot.toLowerCase()}`,
          content: {
            title: msg.title,
            body: `${name} just rotated. ${msg.body}`,
            data: { slot },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(rotatesAt),
          },
        });
      })
  );
}
