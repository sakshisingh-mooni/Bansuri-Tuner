import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SaCalibration } from '../theory/calibration';
import { colors } from '../theme/tokens';
import { CalibrationScreen } from '../screens/CalibrationScreen';
import { TunerScreen } from '../screens/TunerScreen';
import { HistoryScreen } from '../screens/HistoryScreen';

export type RootStackParamList = {
  Calibration: undefined;
  Tuner: { calibration: SaCalibration };
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.ink,
    card: colors.ink,
    text: colors.ivory,
    border: colors.hairline,
    primary: colors.bamboo,
  },
};

export function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.ink },
          headerTintColor: colors.ivory,
          headerTitleStyle: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 20 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.ink },
        }}
      >
        <Stack.Screen name="Calibration" component={CalibrationScreen} options={{ title: 'Set your Sa' }} />
        <Stack.Screen name="Tuner" component={TunerScreen} options={{ title: 'Practice' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'Sessions' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
