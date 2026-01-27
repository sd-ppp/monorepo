import { useStore } from "zustand";
import { Providers, PROVIDER_METADATA } from "../../platforms";
import { MainStore } from "../App.store";
import { Select } from "antd";
import { useEffect, useMemo } from "react";
import { sdpppSDK, useTranslation } from '@sdppp/common';
import { ProviderCardSelector } from "../components/ProviderCardSelector";

export function SDPPPGateway() {
    const { t } = useTranslation()
    const provider = MainStore(state => state.provider)
    // Select only the nested field we care about to avoid re-renders from whole-object identity changes
    const forceProvider = useStore(sdpppSDK.stores.PhotoshopStore, state => state.sdpppX?.["settings.forceProvider"])
    // Removed tracking logs; keep minimal state

    const Renderer = useMemo(() => {
        // Backward compatibility: map old 'Google' key to 'CustomAPI'
        const key = provider
        return key && Providers[key as keyof typeof Providers] ? Providers[key as keyof typeof Providers].Renderer : null
    }, [provider])
    const showingPreview = MainStore(state => state.showingPreview)
    useEffect(()=> {
        if (forceProvider && forceProvider !== provider) {
            const mapped = forceProvider === 'Google' ? 'CustomAPI' : forceProvider
            MainStore.setState({ provider: mapped as (keyof typeof Providers) | '' })
        }
    }, [forceProvider])

    // Removed render tracking
    
    return <>
        {
            !showingPreview && !forceProvider ? (
                !provider ? (
                    <ProviderCardSelector
                        selectedProvider={provider}
                        onProviderSelect={(providerId) => MainStore.setState({ provider: providerId as (keyof typeof Providers) | '' })}
                        availableProviders={Object.keys(Providers)}
                    />
                ) : (
                    <Select
                        className='app-select'
                        showSearch={true}
                        value={provider}
                        onChange={value => MainStore.setState({ provider: value as (keyof typeof Providers) | '' })}
                    >
                        <Select.Option value="">{t('gateway.select_ai_service', 'Select AI Service')}</Select.Option>
                        {
                            Object.keys(Providers).map(key => (
                                <Select.Option key={key} value={key}>{PROVIDER_METADATA[key].name}</Select.Option>
                            ))
                        }
                    </Select>
                )
            ) : null
        }
        {Renderer && <Renderer showingPreview={showingPreview} />}
    </>
}
