// utils/ImagePicker.js
import {launchImageLibrary} from "react-native-image-picker";

export const pickImage = async () => {
  return new Promise((resolve, reject) => {
    launchImageLibrary(
      {
        mediaType: "photo",
        quality: 1,
      },
      (response) => {
        if (response.didCancel) {
          resolve(null);
        } else if (response.errorCode) {
          reject(response.errorMessage);
        } else {
          const asset = response.assets[0];
          resolve({
            uri: asset.uri,
            type: asset.type || "image/jpeg",
            name: asset.fileName || "upload.jpg",
          });
        }
      }
    );
  });
};
