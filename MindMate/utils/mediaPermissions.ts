// utils/mediaPermissions.ts
import * as MediaLibrary from 'expo-media-library';

export const mediaPermissions = {
  /**
   * Requests media library permissions when needed
   * Call this function right before you need to access the media library
   */
  async requestMediaLibraryPermission(): Promise<boolean> {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting media library permission:', error);
      return false;
    }
  },

  /**
   * Checks if media library permissions are already granted
   * without triggering a permission request
   */
  async checkMediaLibraryPermission(): Promise<boolean> {
    try {
      const { status } = await MediaLibrary.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking media library permission:', error);
      return false;
    }
  },

  /**
   * Saves an image to the media library
   * Automatically requests permission if needed
   */
  async saveImageToLibrary(uri: string): Promise<boolean> {
    try {
      // First check if we have permission
      let permissionStatus = await this.checkMediaLibraryPermission();
      
      // If not, request it
      if (!permissionStatus) {
        permissionStatus = await this.requestMediaLibraryPermission();
        if (!permissionStatus) {
          // Permission denied
          return false;
        }
      }
      
      // Now save the image
      await MediaLibrary.saveToLibraryAsync(uri);
      return true;
    } catch (error) {
      console.error('Error saving image to library:', error);
      return false;
    }
  }
};


//How to use mediaPermissions.ts
//When you need to access the media library in your app (like saving photos), use the helper:

//------------------------------------------------------------------------------------------------
// import { mediaPermissions } from '@/utils/mediaPermissions';

// // In your component where you need media access:
// const savePhoto = async () => {
//   // This will request permission only when needed
//   const hasPermission = await mediaPermissions.requestMediaLibraryPermission();
  
//   if (hasPermission) {
//     // Do media library operations here
//   } else {
//     // Handle permission denied
//     Alert.alert("Permission required", 
//       "Media library access is needed for this feature.");
//   }
// };

// // Or use the built-in save function:
// const savePhotoSimpler = async (uri) => {
//   const success = await mediaPermissions.saveImageToLibrary(uri);
//   if (success) {
//     Alert.alert("Success", "Photo saved to your gallery!");
//   } else {
//     Alert.alert("Error", "Could not save the photo. Please check permissions.");
//   }
// };
//------------------------------------------------------------------------------------------------