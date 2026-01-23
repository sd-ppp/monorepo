import { create } from 'zustand'
import { Providers } from '../providers'
import { createJSONStorage, persist } from 'zustand/middleware'
import { sdpppSDK } from '@sdppp/common'
import type { ResourceHandle } from '@sdppp/resourcing/src/@sideweb/resource-handles'
import { createFileResourceFromExternal } from '@sdppp/resourcing/src/@sideweb/file-resource-actions'
import { loadRemoteConfig } from '@sdppp/vite-remote-config-loader'
import { buildBoundaryUri } from '@sdppp/resourcing/src/resource-uris'

export type SendMode = 'smartobject' | 'newdoc' | 'selection';

export const MainStore = create<{
    provider: (keyof typeof Providers) | ''
    previewImageList: {
        url: string,
        resource?: string,
        thumbnail?: string,
        source: string,
        fileName?: string,
        docId?: number,
        boundaryUri?: string | null,
        maskUri?: string | null,
        width?: number,
        height?: number,
        mimeType?: string,
        downloading?: boolean,
        handle?: ResourceHandle | null,
        maskHandle?: ResourceHandle | null,
    }[]
    showingPreview: boolean
    previewError: string
    autoSendMode: SendMode | null
    autoSendSending: boolean
    autoSendSendingAll: boolean
    downloadAndAppendImage: (image: {
        url: string,
        source: string,
        fileName?: string,
        docId?: number,
        boundaryUri?: string | null,
        maskUri?: string | null,
        maskHandle?: ResourceHandle | null
    }, options?: { replaceExisting?: boolean }) => Promise<void>
    deletePreviewImages: (keys: string[]) => Promise<void>
    setShowingPreview: (showing: boolean) => void
    setPreviewError: (error: string) => void
    setAutoSendMode: (mode: SendMode | null) => void
    toggleAutoSendMode: (mode: SendMode) => void
    setAutoSendSending: (sending: boolean) => void
    setAutoSendSendingAll: (sending: boolean) => void
}>()(persist((set) => ({
    provider: '',
    autoSendMode: null,
    autoSendSending: false,
    autoSendSendingAll: false,
    previewImageList: [
    ],
    downloadAndAppendImage: async (
        {
            url,
            source,
            fileName,
            docId,
            boundaryUri,
            maskUri,
            maskHandle
        },
        options?: { replaceExisting?: boolean }
    ) => {
        const replaceExisting = options?.replaceExisting === true;
        const disposeHandle = (handle?: ResourceHandle | null) => {
            if (handle) {
                try {
                    handle.dispose()
                } catch (error) {
                    console.warn('[MainStore] dispose handle failed', error)
                }
            }
        }

        const photoshopActions = (sdpppSDK.plugins.photoshop as any) ?? {};
        const res = await createFileResourceFromExternal({ url, fileName });
        const primary = res && Array.isArray(res.batch) && res.batch.length ? res.batch[0] ?? res : res;
        const hasError = Boolean((res as any)?.error ?? (primary as any)?.error);

        if (!res || hasError) {
            disposeHandle(maskHandle ?? null)
            set({
                previewError: (res as any)?.error ?? (primary as any)?.error ?? 'download failed',
            })
            return
        }

        const resource = (primary as any)?.resource as string | undefined
        const handle = (primary as any)?.handle as ResourceHandle | null | undefined
        let thumbnail = (primary as any)?.thumbnail as (string | undefined)

        if (resource && !thumbnail) {
            try {
                const thumbnailAction = photoshopActions['fileResource.thumbnail'];

                if (typeof thumbnailAction === 'function') {
                    const thumbRes = await thumbnailAction.call(photoshopActions, { resource, maxSize: 512 })
                    thumbnail = thumbRes?.thumbnail ?? thumbnail
                }
            } catch (error) {
                console.warn('[MainStore] getThumbnail failed', error)
            }
        }

        const normalizedHandle = resource ? (handle ?? null) : null
        if (!resource && handle) {
            disposeHandle(handle)
        }

        const previousItems = replaceExisting ? [...MainStore.getState().previewImageList] : [];

        const nextItem = {
            url,
            source,
            fileName,
            resource,
            thumbnail,
            docId,
            boundaryUri: boundaryUri ?? null,
            maskUri: maskUri ?? null,
            width: (primary as any)?.width,
            height: (primary as any)?.height,
            mimeType: (primary as any)?.mimeType ?? (primary as any)?.mime,
            downloading: false,
            handle: normalizedHandle,
            maskHandle: maskHandle ?? null,
        };

        set((state) => ({
            previewError: '',
            previewImageList: replaceExisting ? [nextItem] : [...state.previewImageList, nextItem]
        }))

        if (replaceExisting && previousItems.length) {
            for (const item of previousItems) {
                if (item?.handle) {
                    disposeHandle(item.handle)
                }
                if (item?.maskHandle) {
                    disposeHandle(item.maskHandle)
                }
            }
        }
    },
    deletePreviewImages: async (resources: string[]) => {
        const currentList = MainStore.getState().previewImageList

        const normalizedResources = resources.filter((res): res is string => typeof res === 'string' && !!res)
        const resourceSet = new Set(normalizedResources);

        const photoshopActions = (sdpppSDK.plugins.photoshop as any) ?? {};
        const deleteAction = photoshopActions['fileResource.delete'];
        if (typeof deleteAction === 'function' && resourceSet.size) {
            try {
                await deleteAction.call(photoshopActions, { resources: Array.from(resourceSet) });
            } catch (error) {
                console.warn('[MainStore] fileResource.delete resources failed', error);
            }
        }

        const retained: typeof currentList = []
        for (const item of currentList) {
            const key = item.resource;
            if (key && resourceSet.has(key)) {
                if (item.handle) {
                    try {
                        item.handle.dispose()
                    } catch (error) {
                        console.warn('[MainStore] dispose handle failed', error)
                    }
                }
                if (item.maskHandle) {
                    try {
                        item.maskHandle.dispose()
                    } catch (error) {
                        console.warn('[MainStore] dispose mask handle failed', error)
                    }
                }
                continue
            }
            retained.push(item)
        }

        set({
            previewImageList: retained,
        })
    },
    showingPreview: false,
    previewError: '',
    setPreviewError: (error: string) => set({ previewError: error }),
    setShowingPreview: (showing: boolean) => set({ showingPreview: showing }),
    setAutoSendMode: (mode: SendMode | null) => set({ autoSendMode: mode }),
    toggleAutoSendMode: (mode: SendMode) => set((state) => ({
        autoSendMode: state.autoSendMode === mode ? null : mode
    })),
    setAutoSendSending: (sending: boolean) => set({ autoSendSending: sending }),
    setAutoSendSendingAll: (sending: boolean) => set({ autoSendSendingAll: sending })
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
        autoSendMode: state.autoSendMode,
    }),
    onRehydrateStorage: () => (state) => {
        if (state?.previewImageList) {
            state.previewImageList = state.previewImageList.map((item: any) => {
                const {
                    boundary: legacyBoundary,
                    boundaryUri: storedBoundaryUri,
                    maskUri: storedMaskUri,
                    ...rest
                } = item;
                const docId = typeof rest.docId === 'number' && Number.isFinite(rest.docId) ? rest.docId : 0;

                let normalizedBoundaryUri: string | null = null;
                if (typeof storedBoundaryUri === 'string' && storedBoundaryUri.length > 0) {
                    normalizedBoundaryUri = storedBoundaryUri;
                } else {
                    let boundarySetting: any = null;
                    if (legacyBoundary === 'canvas' || legacyBoundary === 'curlayer' || legacyBoundary === 'selection') {
                        boundarySetting = legacyBoundary;
                    } else if (legacyBoundary && typeof legacyBoundary === 'object') {
                        boundarySetting = legacyBoundary;
                    }
                    normalizedBoundaryUri = buildBoundaryUri(docId, boundarySetting ?? null);
                }

                const normalizedMaskUri = typeof storedMaskUri === 'string' && storedMaskUri.length > 0 ? storedMaskUri : null;

                return {
                    ...rest,
                    boundaryUri: normalizedBoundaryUri,
                    maskUri: normalizedMaskUri,
                    thumbnail: rest.thumbnail ?? undefined,
                    handle: null,
                    maskHandle: null,
                };
            });
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
