// utils/assetLoader.ts
import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { Image } from 'react-native';

export class AssetLoader {
  private static instance: AssetLoader;
  private loadedAssets: Set<string> = new Set();
  private loadedFonts: Set<string> = new Set();

  private constructor() {}

  static getInstance(): AssetLoader {
    if (!AssetLoader.instance) {
      AssetLoader.instance = new AssetLoader();
    }
    return AssetLoader.instance;
  }

  async loadInitialAssets() {
    try {
      const imageAssets = [
        require('@assets/images/icon.png'),
        require('@assets/images/splash-icon.png'),
        require('@assets/images/adaptive-icon.png'),
      ];

      const fontAssets = {
        'SpaceMono': require('@assets/fonts/SpaceMono-Regular.ttf'),
        // Add other fonts here
      };

      await Promise.all([
        this.cacheImages(imageAssets),
        this.cacheFonts(fontAssets),
      ]);
    } catch (error) {
      console.error('Error loading initial assets:', error);
    }
  }

  async cacheImages(images: any[]) {
    try {
      const downloads = images.map((image) => {
        if (typeof image === 'string') {
          return Image.prefetch(image);
        } else {
          return Asset.fromModule(image).downloadAsync();
        }
      });

      await Promise.all(downloads);
    } catch (error) {
      console.error('Error caching images:', error);
    }
  }

  async cacheFonts(fonts: { [key: string]: any }) {
    try {
      await Font.loadAsync(fonts);
      Object.keys(fonts).forEach(fontName => {
        this.loadedFonts.add(fontName);
      });
    } catch (error) {
      console.error('Error caching fonts:', error);
    }
  }

  async preloadAsset(asset: any, type: 'image' | 'font' = 'image') {
    const assetKey = typeof asset === 'string' ? asset : asset.toString();
    
    if (this.loadedAssets.has(assetKey)) {
      return;
    }

    try {
      if (type === 'image') {
        await this.cacheImages([asset]);
      } else {
        await this.cacheFonts({ [assetKey]: asset });
      }
      
      this.loadedAssets.add(assetKey);
    } catch (error) {
      console.error(`Error preloading asset ${assetKey}:`, error);
    }
  }

  async preloadAssetsForScreen(assets: { images?: any[], fonts?: { [key: string]: any } }) {
    try {
      const tasks = [];

      if (assets.images) {
        tasks.push(this.cacheImages(assets.images));
      }

      if (assets.fonts) {
        tasks.push(this.cacheFonts(assets.fonts));
      }

      await Promise.all(tasks);
    } catch (error) {
      console.error('Error preloading screen assets:', error);
    }
  }

  isFontLoaded(fontName: string): boolean {
    return this.loadedFonts.has(fontName);
  }

  isAssetLoaded(asset: any): boolean {
    const assetKey = typeof asset === 'string' ? asset : asset.toString();
    return this.loadedAssets.has(assetKey);
  }
}

export const assetLoader = AssetLoader.getInstance();