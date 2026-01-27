import { useTranslation } from '@sdppp/common';
import { ProviderCard } from './ProviderCard';
import { PROVIDER_METADATA } from '../../platforms';

interface ProviderCardSelectorProps {
    selectedProvider?: string;
    onProviderSelect: (providerId: string) => void;
    availableProviders?: string[];
}

export function ProviderCardSelector({ 
    selectedProvider, 
    onProviderSelect, 
    availableProviders 
}: ProviderCardSelectorProps) {
    const { t } = useTranslation();

    // Use all providers if none specified
    const providersToShow = availableProviders || Object.keys(PROVIDER_METADATA);

    return (
        <div className="provider-card-selector">
            <div className="provider-card-grid">
                {providersToShow.map(providerId => {
                    const provider = PROVIDER_METADATA[providerId];
                    if (!provider) return null;

                    return (
                        <ProviderCard
                            key={provider.id}
                            provider={provider}
                            isSelected={selectedProvider === provider.id}
                            onClick={() => onProviderSelect(provider.id)}
                        />
                    );
                })}
            </div>
        </div>
    );
}