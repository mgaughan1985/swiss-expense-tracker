// app/(tabs)/camera.tsx
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ArrowLeft } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import * as ImageManipulator from 'expo-image-manipulator';
import CropTool, { CropRegion } from '@/components/CropTool';

export default function CameraScreen() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);

  async function handleTakePhoto() {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in your device settings to capture receipts.'
        );
        return;
      }

      // Launch camera — no native crop UI, we handle that ourselves
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.9,
        exif: false,
      });

      if (result.canceled) return;

      const photo = result.assets[0];

      // Store the captured photo and show the crop tool
      setPendingPhoto({
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
      });

    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  }

  async function handleCrop(region: CropRegion) {
    if (!pendingPhoto) return;

    try {
      // Convert 0–1 fractions to real pixel values
      const cropParams = {
        originX: Math.round(region.x      * pendingPhoto.width),
        originY: Math.round(region.y      * pendingPhoto.height),
        width:   Math.round(region.width  * pendingPhoto.width),
        height:  Math.round(region.height * pendingPhoto.height),
      };

      // Apply crop then compress
      const processed = await ImageManipulator.manipulateAsync(
        pendingPhoto.uri,
        [
          { crop: cropParams },
          { resize: { width: 1200 } },
        ],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Clear pending photo before uploading
      setPendingPhoto(null);

      await uploadImage(processed.uri);

    } catch (error) {
      console.error('Crop error:', error);
      Alert.alert('Error', 'Failed to crop photo. Please try again.');
    }
  }

  function handleCancelCrop() {
    // Discard the captured photo and return to the camera screen
    setPendingPhoto(null);
  }

  async function uploadImage(uri: string) {
    setIsUploading(true);
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert('Authentication Error', 'Please log in to upload receipts');
        return;
      }

      // Read the file
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      // Create unique filename
      const timestamp = Date.now();
      const fileName = `receipt_${timestamp}.jpg`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Navigate to receipt form with the image path
      router.push({
        pathname: '/receipt-form',
        params: { imagePath: filePath },
      });

    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Could not upload the photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  // ── Show crop tool if a photo has been captured ──────────────────────────
  if (pendingPhoto) {
    return (
      <CropTool
        imageUri={pendingPhoto.uri}
        onCrop={handleCrop}
        onCancel={handleCancelCrop}
      />
    );
  }

  // ── Normal camera screen ─────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Capture Receipt</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Instructions */}
      <View style={styles.content}>
        <View style={styles.instructionsCard}>
          <Camera size={64} color="#F59E0B" />
          <Text style={styles.instructionsTitle}>Ready to Scan</Text>
          <Text style={styles.instructionsText}>
            Tap the button below to open your camera. After taking the photo, you'll be able to crop it to focus on the receipt.
          </Text>

          <View style={styles.tipsList}>
            <Text style={styles.tipsTitle}>Tips for best results:</Text>
            <Text style={styles.tipItem}>• Ensure good lighting</Text>
            <Text style={styles.tipItem}>• Keep receipt flat and straight</Text>
            <Text style={styles.tipItem}>• Avoid shadows and glare</Text>
            <Text style={styles.tipItem}>• Make sure all text is readable</Text>
          </View>
        </View>

        {/* Capture Button */}
        <TouchableOpacity
          style={[styles.captureButton, isUploading && styles.captureButtonDisabled]}
          onPress={handleTakePhoto}
          disabled={isUploading}>
          {isUploading ? (
            <>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.captureButtonText}>Uploading...</Text>
            </>
          ) : (
            <>
              <Camera size={24} color="#ffffff" />
              <Text style={styles.captureButtonText}>Open Camera</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  instructionsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  tipsList: {
    width: '100%',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  tipItem: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 24,
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    shadowColor: '#DC2626',
    padding: 18,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});