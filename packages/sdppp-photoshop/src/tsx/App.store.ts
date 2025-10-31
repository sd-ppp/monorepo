import { create } from 'zustand'
import { Providers } from '../providers'
import { createJSONStorage, persist } from 'zustand/middleware'
import { sdpppSDK } from '@sdppp/common'
import { loadRemoteConfig } from '@sdppp/vite-remote-config-loader'

export const MainStore = create<{
    provider: (keyof typeof Providers) | ''
    previewImageList: {
        url: string,
        resource?: string,
        thumbnail?: string,
        source: string,
        docId?: number,
        boundary?: any,
        width?: number,
        height?: number,
        downloading?: boolean,
    }[]
    showingPreview: boolean
    previewError: string
    downloadAndAppendImage: (image: { url: string, source: string, docId?: number, boundary?: any }) => Promise<void>
    deletePreviewImages: (keys: string[]) => Promise<void>
    setShowingPreview: (showing: boolean) => void
}>()(persist((set) => ({
    provider: '',
    previewImageList: [
    ],
    downloadAndAppendImage: async ({ url, source, docId, boundary }: { url: string, source: string, docId?: number, boundary?: any }) => {
        // Insert a placeholder item to reflect downloading state
        set({
            previewImageList: [
                ...MainStore.getState().previewImageList,
                {
                    url,
                    source,
                    resource: undefined,
                    thumbnail: undefined,
                    docId,
                    boundary,
                    downloading: true,
                }
            ]
        })

        const res = await sdpppSDK.plugins.photoshop.downloadImage({ url })
        if ((res as any)?.error) {
            // On error, remove the placeholder and record the error
            const currentList = MainStore.getState().previewImageList
            const idx = currentList.findIndex(item => item.url === url && item.source === source && item.downloading)
            const nextList = idx >= 0 ? currentList.filter((_, i) => i !== idx) : currentList
            set({
                previewError: (res as any).error,
                previewImageList: nextList,
            })
            return
        }

        // On success, update the placeholder to the final data
        const currentList = MainStore.getState().previewImageList
        const idx = currentList.findIndex(item => item.url === url && item.source === source && item.downloading)

        const resource = (res as any).resource as string | undefined
        let thumbnail = (res as any).thumbnail as (string | undefined)

        if (resource && !thumbnail) {
            try {
                const getThumbnailAction = (sdpppSDK.plugins.photoshop as any)?.getThumbnail
                if (typeof getThumbnailAction === 'function') {
                    const thumbRes = await getThumbnailAction({ resource })
                    thumbnail = thumbRes?.thumbnail ?? thumbnail
                }
            } catch (error) {
                console.warn('[MainStore] getThumbnail failed', error)
            }
        }

        if (idx >= 0) {
            const updated = {
                ...currentList[idx],
                downloading: false,
                resource: resource ?? currentList[idx].resource,
                thumbnail: thumbnail ?? currentList[idx].thumbnail,
                width: (res as any).width,
                height: (res as any).height,
            }
            const nextList = [...currentList]
            nextList[idx] = updated
            set({
                previewError: '',
                previewImageList: nextList,
            })
        } else {
            // If placeholder not found (e.g., list cleared), append final item
            set({
                previewError: '',
                previewImageList: [
                    ...currentList,
                    {
                        url,
                        source,
                        resource,
                        thumbnail,
                        docId,
                        boundary,
                        width: (res as any).width,
                        height: (res as any).height,
                        downloading: false,
                    }
                ]
            })
        }
    },
    deletePreviewImages: async (resources: string[]) => {
        const currentList = MainStore.getState().previewImageList

        const normalizedResources = resources.filter((res): res is string => typeof res === 'string' && !!res)
        const resourceSet = new Set(normalizedResources);

        const deleteAction = (sdpppSDK.plugins.photoshop as any)?.deleteDownloadedImage;
        if (typeof deleteAction === 'function' && resourceSet.size) {
            try {
                await deleteAction({ resources: Array.from(resourceSet) });
            } catch (error) {
                console.warn('[MainStore] deleteDownloadedImage resources failed', error);
            }
        }

        set({
            previewImageList: currentList.filter(item => {
                const key = item.resource;
                return !key || !resourceSet.has(key);
            })
        })
    },
    showingPreview: false,
    previewError: '',
    setPreviewError: (error: string) => set({ previewError: error }),
    setShowingPreview: (showing: boolean) => set({ showingPreview: showing })
}), {
    name: 'main-store',
    storage: createJSONStorage(() => ({
        getItem: async (key) => {
            const result = await sdpppSDK.plugins.photoshop.getStorage({ key });
            return result.error ? null : result.value;
        },
        setItem: async (key, value) => {
            await sdpppSDK.plugins.photoshop.setStorage({ key, value });
        },
        removeItem: async (key) => {
            await sdpppSDK.plugins.photoshop.removeStorage({ key });
        }
    })),
    partialize: (state) => ({
        provider: state.provider,
    }),
    onRehydrateStorage: () => (state) => {
        if (state?.previewImageList) {
            state.previewImageList = state.previewImageList.map((item: any) => ({
                ...item,
                thumbnail: item.thumbnail ?? undefined,
            }));
        }
    },
}))

let firstPreview = false
MainStore.subscribe((state, prevState) => {
    if (state.previewImageList.length !== prevState.previewImageList.length) {
        if (!state.previewImageList.length) {
            MainStore.setState({ showingPreview: false })
        } else {
            if (!firstPreview) {
                firstPreview = true
                MainStore.setState({ showingPreview: true })
            }
        }
    }
})

// MainStore.setState({ 
//     showingPreview: true,
//     previewImageList: [{
//         url: 'https://sdppp.zombee.tech/img/qr_manga1.jpg',
//         source: 'test',
//     }]
// })
if (process.env.NODE_ENV === 'development') {
    (globalThis as any).MainStore = MainStore
}

function updateBannerData() {
    sdpppSDK.stores.WebviewStore.setState({
        bannerData: loadRemoteConfig('banners')
    })
}

// Temporarily disabled to check if this causes re-rendering
setTimeout(updateBannerData, 3000)
setInterval(updateBannerData, 60000)
