import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

const HAPTICS_PREF_KEY = 'zh_v4_haptics_enabled';

export function getHapticsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(HAPTICS_PREF_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(HAPTICS_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}

export async function hapticLight(): Promise<void> {
  if (!getHapticsEnabled()) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
      return;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }
  } catch {
    // Ignore unsupported haptic environments
  }
}

export async function hapticMedium(): Promise<void> {
  if (!getHapticsEnabled()) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
      return;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(16);
    }
  } catch {
    // Ignore unsupported haptic environments
  }
}

export async function hapticSuccess(): Promise<void> {
  if (!getHapticsEnabled()) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Success });
      return;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([10, 30, 14]);
    }
  } catch {
    // Ignore unsupported haptic environments
  }
}

export async function capturePhotoNative(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }
  try {
    const photo = await Camera.getPhoto({
      quality: 92,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
    });
    return photo.dataUrl ?? null;
  } catch {
    return null;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function shareOrDownloadFile(
  blob: Blob,
  filename: string,
  mimeType: string,
  title: string
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob);
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });
      await Share.share({
        title,
        url: saved.uri,
        dialogTitle: title,
      });
      return;
    } catch {
      // Fallback to standard browser download
    }
  }

  // Try Web Share API with files on mobile browsers if supported and user prefers sharing
  if (
    typeof navigator !== 'undefined' &&
    'canShare' in navigator &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  ) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          files: [file],
        });
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
    }
  }

  // Standard clean download
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
