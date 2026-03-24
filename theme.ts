// theme.ts — BeaconFile brand design tokens
// Single source of truth for all colors and typography.
// Do not hardcode brand colours inline in individual screens.

export const colors = {
  // ── Brand palette ───────────────────────────────────────────────────────────
  primary:      '#F59E0B',   // Amber — buttons, highlights, active states
  primaryDark:  '#D97706',   // Amber dark — pressed/hover states
  primaryLight: '#FBBF24',   // Amber light — secondary highlights, icon window
  slate:        '#1E293B',   // Slate dark — backgrounds, headers, nav bar
  offWhite:     '#FEF9EE',   // Off-white — light mode base, light backgrounds
  bodyText:     '#334155',   // Body text — all body copy
  danger:       '#DC2626',   // Red — destructive actions only (reject, delete)

  // ── Utility ─────────────────────────────────────────────────────────────────
  white:   '#FFFFFF',
  black:   '#000000',

  // ── Gray scale ──────────────────────────────────────────────────────────────
  gray50:  '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // ── Status ──────────────────────────────────────────────────────────────────
  success:     '#16A34A',
  successBg:   '#f0fdf4',
  successText: '#166534',
  warningBg:   '#FFFBEB',
  warningText: '#78350F',
  errorBg:     '#fef2f2',
  errorText:   '#991b1b',
};

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  xxxl: 40,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
};

// DM Sans font families — available after useFonts() loads in _layout.tsx.
// Fall back to system font if not yet loaded.
export const fonts = {
  regular:  'DMSans_400Regular',
  medium:   'DMSans_500Medium',
  bold:     'DMSans_700Bold',
};

export const typography = {
  title: {
    fontSize: 28,
    fontWeight: '500' as const,
    color: colors.slate,
    fontFamily: fonts.medium,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: colors.bodyText,
    fontFamily: fonts.regular,
  },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.slate,
    fontFamily: fonts.medium,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: colors.bodyText,
    fontFamily: fonts.regular,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: colors.gray500,
    fontFamily: fonts.regular,
  },
  // kept for backward compat
  small: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: colors.gray500,
  },
};

// Secondary colour — kept for backward compat, was gray-blue
export const secondary = '#F0F4F8';
