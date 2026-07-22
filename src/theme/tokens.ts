/**
 * Design language: grounded in the instrument itself rather than a
 * generic app palette. A bansuri is bamboo with aged brass/thread
 * binding; Hindustani practice happens in dim, focused rooms (riyaz).
 * The dark, warm-brown base reads like that room; the gold reads like
 * the bamboo under lamp light; the muted green is oxidized brass
 * patina, not a generic "success" green; the copper is a warm
 * deviation warning, not an alarm red — instruments patinate, they
 * don't "error."
 */

export const colors = {
  ink: '#1B1512', // base background — dim practice-room warmth, not flat black
  surface: '#241C16', // raised panels/cards
  surfaceRaised: '#2E241C', // hover/active panel state
  bamboo: '#C9A15A', // primary accent — brass/bamboo gold
  bambooMuted: '#8F7748',
  patina: '#6E9B7C', // "in tune" — oxidized brass green, not stock green
  copper: '#BD5B37', // "off pitch" warm warning — not alarm red
  ivory: '#EDE3D3', // primary text
  tan: '#9C8D78', // secondary/muted text
  hairline: '#3A2F26',
} as const;

export const typography = {
  display: 'InstrumentSerif_400Regular',
  body: 'Karla_400Regular',
  bodyMedium: 'Karla_500Medium',
  bodyBold: 'Karla_700Bold',
  data: 'SpaceMono_400Regular',
  dataBold: 'SpaceMono_700Bold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;
