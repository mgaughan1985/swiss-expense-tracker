/**
 * CropTool.tsx
 * Drop-in receipt crop component for CH Expense Tracker
 *
 * Features:
 *  - Four independent draggable edge handles (top / bottom / left / right)
 *  - Dark overlay outside the crop region
 *  - Corner accent marks at the four intersections
 *  - Prominent bottom ribbon with Cancel and Crop actions
 *
 * Usage:
 *  <CropTool
 *    imageUri={uri}
 *    onCrop={(cropRegion) => { ... }}   // { x, y, width, height } as 0–1 fractions
 *    onCancel={() => { ... }}
 *  />
 *
 * The onCrop callback returns a normalised CropRegion (values 0–1).
 * Pass those fractions to expo-image-manipulator to do the real pixel crop:
 *
 *   import * as ImageManipulator from 'expo-image-manipulator';
 *
 *   const result = await ImageManipulator.manipulateAsync(
 *     imageUri,
 *     [{
 *       crop: {
 *         originX: region.x * imageWidth,
 *         originY: region.y * imageHeight,
 *         width:   region.width  * imageWidth,
 *         height:  region.height * imageHeight,
 *       },
 *     }],
 *     { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
 *   );
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Image,
  PanResponder,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  StatusBar,
  Platform,
  LayoutChangeEvent,
} from 'react-native';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CropRegion {
  /** Left edge offset as a fraction of image width (0–1) */
  x: number;
  /** Top edge offset as a fraction of image height (0–1) */
  y: number;
  /** Crop width as a fraction of image width (0–1) */
  width: number;
  /** Crop height as a fraction of image height (0–1) */
  height: number;
}

interface Props {
  imageUri: string;
  onCrop: (region: CropRegion) => void;
  onCancel: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HANDLE_HIT_SLOP = 20;        // px either side of the edge line that counts as a touch
const MIN_CROP_SIZE   = 60;        // minimum crop dimension in px
const HANDLE_COLOR    = '#FFFFFF';
const OVERLAY_COLOR   = 'rgba(0, 0, 0, 0.55)';
const RIBBON_HEIGHT   = 80;
const CORNER_SIZE     = 22;        // length of the L-shaped corner marks
const CORNER_THICK    = 3;         // thickness of corner marks
const EDGE_THICK      = 1.5;       // dashed border line thickness

// ─── Component ────────────────────────────────────────────────────────────────

export default function CropTool({ imageUri, onCrop, onCancel }: Props) {
  const screenWidth  = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const statusBarH   = StatusBar.currentHeight ?? (Platform.OS === 'ios' ? 44 : 0);
  const availableH   = screenHeight - statusBarH - RIBBON_HEIGHT;

  // Container size — updated once the image container lays out
  const [containerW, setContainerW] = useState(screenWidth);
  const [containerH, setContainerH] = useState(availableH);

  // Crop edges in pixels relative to the image container
  const [top,    setTop]    = useState(0);
  const [bottom, setBottom] = useState(availableH);   // bottom edge Y position
  const [left,   setLeft]   = useState(0);
  const [right,  setRight]  = useState(screenWidth);  // right edge X position

  const topRef    = useRef(top);
  const bottomRef = useRef(bottom);
  const leftRef   = useRef(left);
  const rightRef  = useRef(right);
  const cwRef     = useRef(containerW);
  const chRef     = useRef(containerH);

  const sync = (t: number, b: number, l: number, r: number) => {
    topRef.current    = t;
    bottomRef.current = b;
    leftRef.current   = l;
    rightRef.current  = r;
    setTop(t); setBottom(b); setLeft(l); setRight(r);
  };

  // ── Layout callback ────────────────────────────────────────────────────────
  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    cwRef.current = width;
    chRef.current = height;
    setContainerW(width);
    setContainerH(height);
    // Initialise crop to full image
    sync(0, height, 0, width);
  }, []);

  // ── PanResponder factory ───────────────────────────────────────────────────
  // IMPORTANT: g.dy / g.dx from PanResponder are *cumulative* from touch start,
  // not incremental per frame. We capture the edge's position at the moment the
  // finger lands (onPanResponderGrant) and always add the cumulative delta to
  // that snapshot — never to the current position. This gives smooth 1:1 tracking.
  type Edge = 'top' | 'bottom' | 'left' | 'right';

  const makePan = (edge: Edge) => {
    let startVal = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        // Snapshot the edge position the moment the finger touches
        if      (edge === 'top')    startVal = topRef.current;
        else if (edge === 'bottom') startVal = bottomRef.current;
        else if (edge === 'left')   startVal = leftRef.current;
        else                        startVal = rightRef.current;
      },
      onPanResponderMove: (_, g) => {
        const t  = topRef.current;
        const b  = bottomRef.current;
        const l  = leftRef.current;
        const r  = rightRef.current;
        const cw = cwRef.current;
        const ch = chRef.current;

        if (edge === 'top') {
          const next = Math.max(0, Math.min(b - MIN_CROP_SIZE, startVal + g.dy));
          sync(next, b, l, r);
        } else if (edge === 'bottom') {
          const next = Math.min(ch, Math.max(t + MIN_CROP_SIZE, startVal + g.dy));
          sync(t, next, l, r);
        } else if (edge === 'left') {
          const next = Math.max(0, Math.min(r - MIN_CROP_SIZE, startVal + g.dx));
          sync(t, b, next, r);
        } else {
          const next = Math.min(cw, Math.max(l + MIN_CROP_SIZE, startVal + g.dx));
          sync(t, b, l, next);
        }
      },
    });
  };

  // Memoised pan responders — one per edge
  const topPan    = useRef(makePan('top')).current;
  const bottomPan = useRef(makePan('bottom')).current;
  const leftPan   = useRef(makePan('left')).current;
  const rightPan  = useRef(makePan('right')).current;

  // ── Crop confirm ──────────────────────────────────────────────────────────
  const handleCrop = () => {
    const cw = cwRef.current;
    const ch = chRef.current;
    onCrop({
      x:      left   / cw,
      y:      top    / ch,
      width:  (right  - left) / cw,
      height: (bottom - top)  / ch,
    });
  };

  // ── Derived geometry ──────────────────────────────────────────────────────
  const cropW = right - left;
  const cropH = bottom - top;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Black spacer — gives the top edge handle room to render above the image container
         without being clipped. Height matches HANDLE_HIT_SLOP exactly. */}
      <View style={{ height: HANDLE_HIT_SLOP, backgroundColor: '#000' }} />

      {/* ── Image + crop overlay ─────────────────────────────────────── */}
      <View
        style={[styles.imageContainer, { height: availableH - HANDLE_HIT_SLOP }]}
        onLayout={onContainerLayout}
      >
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />

        {/* Dark overlays — top / bottom / left / right of crop window */}
        <View style={[styles.overlay, { top: 0,      left: 0,    width: containerW, height: top    }]} />
        <View style={[styles.overlay, { top: bottom, left: 0,    width: containerW, height: containerH - bottom }]} />
        <View style={[styles.overlay, { top: top,    left: 0,    width: left,  height: cropH }]} />
        <View style={[styles.overlay, { top: top,    left: right, width: containerW - right, height: cropH }]} />

        {/* Crop border */}
        <View
          style={[
            styles.cropBorder,
            { top, left, width: cropW, height: cropH },
          ]}
          pointerEvents="none"
        />

        {/* Corner marks */}
        <CornerMark position="top-left"     top={top}    left={left}  />
        <CornerMark position="top-right"    top={top}    left={right} />
        <CornerMark position="bottom-left"  top={bottom} left={left}  />
        <CornerMark position="bottom-right" top={bottom} left={right} />

        {/* ── Edge handles ─────────────────────────────────────────────── */}

        {/* TOP edge */}
        <View
          {...topPan.panHandlers}
          style={[styles.edgeHandle, styles.edgeH, {
            top:  top - HANDLE_HIT_SLOP,
            left: left,
            width: cropW,
            height: HANDLE_HIT_SLOP * 2,
          }]}
        >
          <View style={styles.edgeBarH} />
          <GrabPill horizontal />
        </View>

        {/* BOTTOM edge */}
        <View
          {...bottomPan.panHandlers}
          style={[styles.edgeHandle, styles.edgeH, {
            top:  bottom - HANDLE_HIT_SLOP,
            left: left,
            width: cropW,
            height: HANDLE_HIT_SLOP * 2,
          }]}
        >
          <View style={styles.edgeBarH} />
          <GrabPill horizontal />
        </View>

        {/* LEFT edge */}
        <View
          {...leftPan.panHandlers}
          style={[styles.edgeHandle, styles.edgeV, {
            top:    top,
            left:   left - HANDLE_HIT_SLOP,
            width:  HANDLE_HIT_SLOP * 2,
            height: cropH,
          }]}
        >
          <View style={styles.edgeBarV} />
          <GrabPill horizontal={false} />
        </View>

        {/* RIGHT edge */}
        <View
          {...rightPan.panHandlers}
          style={[styles.edgeHandle, styles.edgeV, {
            top:    top,
            left:   right - HANDLE_HIT_SLOP,
            width:  HANDLE_HIT_SLOP * 2,
            height: cropH,
          }]}
        >
          <View style={styles.edgeBarV} />
          <GrabPill horizontal={false} />
        </View>
      </View>

      {/* ── Action ribbon ────────────────────────────────────────────── */}
      <View style={styles.ribbon}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <View style={styles.ribbonLabel}>
          <Text style={styles.ribbonLabelText}>Drag edges to crop</Text>
        </View>

        <TouchableOpacity style={styles.cropBtn} onPress={handleCrop} activeOpacity={0.7}>
          <Text style={styles.cropText}>✓  Crop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Corner Mark ─────────────────────────────────────────────────────────────

interface CornerProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  top: number;
  left: number;
}

function CornerMark({ position, top, left }: CornerProps) {
  const isTop    = position.startsWith('top');
  const isLeft   = position.endsWith('left');

  return (
    <View
      pointerEvents="none"
      style={{
        position:  'absolute',
        top:       isTop  ? top  - CORNER_THICK : top  - CORNER_SIZE,
        left:      isLeft ? left - CORNER_THICK : left - CORNER_SIZE,
        width:     CORNER_SIZE + CORNER_THICK,
        height:    CORNER_SIZE + CORNER_THICK,
      }}
    >
      {/* Horizontal arm */}
      <View style={{
        position: 'absolute',
        top:    isTop  ? 0 : CORNER_SIZE - CORNER_THICK,
        left:   isLeft ? 0 : 0,
        width:  CORNER_SIZE + CORNER_THICK,
        height: CORNER_THICK,
        backgroundColor: HANDLE_COLOR,
      }} />
      {/* Vertical arm */}
      <View style={{
        position: 'absolute',
        top:    0,
        left:   isLeft ? 0 : CORNER_SIZE - CORNER_THICK,
        width:  CORNER_THICK,
        height: CORNER_SIZE + CORNER_THICK,
        backgroundColor: HANDLE_COLOR,
      }} />
    </View>
  );
}

// ─── Grab Pill ────────────────────────────────────────────────────────────────
// Small tactile indicator centred on the edge handle

function GrabPill({ horizontal }: { horizontal: boolean }) {
  return (
    <View style={[
      styles.grabPill,
      horizontal
        ? { width: 36, height: 4, borderRadius: 2 }
        : { width: 4,  height: 36, borderRadius: 2 },
    ]} />
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    width: '100%',
    // overflow must NOT be 'hidden' — top/bottom handles extend outside and get clipped
    backgroundColor: '#111',
  },
  overlay: {
    position: 'absolute',
    backgroundColor: OVERLAY_COLOR,
  },
  cropBorder: {
    position: 'absolute',
    borderWidth: EDGE_THICK,
    borderColor: 'rgba(255,255,255,0.7)',
    // Dashed border via borderStyle isn't reliable cross-platform
    // so we use a solid thin line here; the corner marks carry the visual weight
  },

  // Edge handle containers
  edgeHandle: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  edgeH: {
    flexDirection: 'column',
  },
  edgeV: {
    flexDirection: 'row',
  },

  // Thin visible line on each edge (sits on top of the border, centred in hit area)
  edgeBarH: {
    position: 'absolute',
    top: HANDLE_HIT_SLOP - EDGE_THICK / 2,
    left: 0,
    right: 0,
    height: EDGE_THICK,
    backgroundColor: 'transparent', // border already drawn by cropBorder
  },
  edgeBarV: {
    position: 'absolute',
    left: HANDLE_HIT_SLOP - EDGE_THICK / 2,
    top: 0,
    bottom: 0,
    width: EDGE_THICK,
    backgroundColor: 'transparent',
  },

  grabPill: {
    backgroundColor: HANDLE_COLOR,
    opacity: 0.9,
  },

  // ── Ribbon ───────────────────────────────────────────────────────────────
  ribbon: {
    height: RIBBON_HEIGHT,
    backgroundColor: '#1A1A2E',   // dark navy — matches typical Bolt dark theme
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    minWidth: 80,
    alignItems: 'center',
  },
  cancelText: {
    color: '#AAAAAA',
    fontSize: 15,
    fontWeight: '500',
  },
  ribbonLabel: {
    flex: 1,
    alignItems: 'center',
  },
  ribbonLabelText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  cropBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#4F46E5',   // indigo — swap for your brand primary
    minWidth: 90,
    alignItems: 'center',
  },
  cropText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});