// Android-only native sound module (SoundPool). Null on iOS, web and Expo Go, where the app falls
// back to expo-audio.
import { requireOptionalNativeModule } from 'expo';

type FlappySfxModule = {
  load(name: string, uri: string): void;
  play(name: string, volume: number): void;
};

export default requireOptionalNativeModule<FlappySfxModule>('FlappySfx');
