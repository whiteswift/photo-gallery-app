import { useState, useEffect } from "react";
import { useCamera } from '@ionic/react-hooks/camera';
import { useFilesystem, base64FromPath } from '@ionic/react-hooks/filesystem';
import { useStorage } from '@ionic/react-hooks/storage';
import { isPlatform } from '@ionic/react';
import { CameraResultType, CameraSource, CameraPhoto, Capacitor, FilesystemDirectory } from "@capacitor/core";
import { stringify } from "querystring";

const PHOTO_STORAGE = "photos";

export interface Photo {
  filepath: string;
  webviewPath?: string;
  base64?: string;
}

export function usePhotoGallery() {
  const { getPhoto } = useCamera();
  const { get, set } = useStorage();
  const { deleteFile, getUri, readFile, writeFile } = useFilesystem();
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    const loadSaved = async () => {
      const photosString = await get(PHOTO_STORAGE);
      const photosInStorage = (photosString ? JSON.parse(photosString) : []) as Photo[];

      // If running on web
      if (!isPlatform('hybrid')) {
        for (let photo of photosInStorage) {
          const file = await readFile({
            path: photo.filepath,
            directory: FilesystemDirectory.Data
          });

          // Web platform only: Save the photo into the base64 field
          photo.base64 = `data:image/jpeg;base64,${file.data}`;
        }
      }
      setPhotos(photosInStorage);
    };
    loadSaved();
  }, [get, readFile]);

  const takePhoto = async () => {
    const cameraPhoto = await getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100
    });

    const fileName = new Date().getTime() + '.jpeg';
    const savedFileImage = await savePicture(cameraPhoto, fileName);
    const newPhotos = [savedFileImage, ...photos];

    set(PHOTO_STORAGE,
      isPlatform('hybrid')
        ? JSON.stringify(newPhotos)
        : JSON.stringify(newPhotos.map(p => {
          const photoCopy = { ...p };
          delete photoCopy.webviewPath;

          return photoCopy;
        })));

    setPhotos(newPhotos)
  };

  const savePicture = async (photo: CameraPhoto, fileName: string): Promise<Photo> => {
    const base64Data: string = await readPictureToBase64(photo);

    const savedFile = await writeFile({
      path: fileName,
      data: base64Data,
      directory: FilesystemDirectory.Data
    });

    console.log('DO i need savedFile?', savedFile);

    return isPlatform('hybrid')
      ? { // Display the new image by rewriting the 'file://' path to HTTP. Details: https://ionicframework.com/docs/building/webview#file-protocol
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri),
      }
      : { // Use webPath to display the new image instead of base64 since it's already loaded into memory
        filepath: fileName,
        webviewPath: photo.webPath
      }
  }

  const readPictureToBase64 = async (photo: CameraPhoto): Promise<string> => {
    if (isPlatform('hybrid')) {
      const file = await readFile({ path: photo.path! });
      return file.data;
    } else {
      return await base64FromPath(photo.webPath!);
    }
  }

  return {
    photos,
    takePhoto
  };
}