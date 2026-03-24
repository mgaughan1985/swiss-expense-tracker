// components/BeaconFileLogo.tsx
// BeaconFile lighthouse icon — embedded SVG, no external asset required.
// variant="dark"  → slate background (#1E293B), off-white tower  — default
// variant="light" → off-white background (#FEF9EE), slate tower
import Svg, { Rect, Polygon, Line } from 'react-native-svg';

interface Props {
  size?: number;
  variant?: 'dark' | 'light';
}

export function BeaconFileLogo({ size = 40, variant = 'dark' }: Props) {
  const isDark = variant === 'dark';
  const bg        = isDark ? '#1E293B' : '#FEF9EE';
  const tower     = isDark ? '#FEF9EE' : '#1E293B';
  const base      = isDark ? '#FEF9EE' : '#1E293B';
  const roof      = isDark ? '#2D4A6B' : '#1E293B';
  const lantern   = '#F59E0B';
  const window_   = '#FBBF24';

  // Scale the 500×500 viewBox to the requested size
  return (
    <Svg width={size} height={size} viewBox="0 0 500 500">
      {/* Background */}
      <Rect width="500" height="500" rx="80" fill={bg} />
      {/* Base platform */}
      <Rect x="148" y="368" width="204" height="28" rx="6" fill={base} />
      {/* Tower body */}
      <Polygon points="183,238 317,238 304,368 196,368" fill={tower} />
      {/* Lantern room */}
      <Rect x="168" y="208" width="164" height="34" rx="6" fill={lantern} />
      {/* Roof */}
      <Polygon points="250,140 158,212 342,212" fill={roof} />
      {/* Window */}
      <Rect x="213" y="270" width="74" height="52" rx="8" fill={window_} />
      {/* Light rays */}
      <Line x1="250" y1="162" x2="98"  y2="82"  stroke="#F59E0B" strokeWidth="9" strokeLinecap="round" opacity="0.95" />
      <Line x1="250" y1="162" x2="76"  y2="148" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" opacity="0.65" />
      <Line x1="250" y1="162" x2="88"  y2="210" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" opacity="0.4"  />
    </Svg>
  );
}
