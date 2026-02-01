import { sdpppSDK } from '@sdppp/common';
import { createJSONStorage } from 'zustand/middleware';

export const sdpppPersistStorage = createJSONStorage(() => ({
  getItem: async (key) => {
    const result = await sdpppSDK.plugins.photoshop.getStorage({ key });
    return result.error ? null : result.value;
  },
  setItem: async (key, value) => {
    await sdpppSDK.plugins.photoshop.setStorage({ key, value });
  },
  removeItem: async (key) => {
    await sdpppSDK.plugins.photoshop.removeStorage({ key });
  },
}));
