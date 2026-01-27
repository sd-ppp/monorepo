import { useTranslation } from '@sdppp/common';
import { ProviderMetadata } from '../../platforms';
import './ProviderCard.less';

interface ProviderCardProps {
    provider: ProviderMetadata;
    isSelected?: boolean;
    onClick: () => void;
}

export function ProviderCard({ provider, isSelected = false, onClick }: ProviderCardProps) {
    const { t } = useTranslation();

    const cardStyle = {
        '--provider-brand-color': provider.brandColor
    } as React.CSSProperties;

    return (
        <div
            className={`provider-card ${isSelected ? 'selected' : ''}`}
            onClick={onClick}
            style={cardStyle}
        >
            <div
                className="provider-logo-section"
                style={{ backgroundColor: provider.brandColor }}
            >
                <div className="provider-icon">
                    {provider.logoPath ? (
                        <img
                            src={provider.logoPath}
                            alt={provider.name}
                            onError={(e) => {
                                // Fallback to first letter if image fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) {
                                    fallback.style.display = 'flex';
                                }
                            }}
                        />
                    ) : null}
                    <div
                        className="provider-icon-fallback"
                        style={{ display: provider.logoPath ? 'none' : 'flex' }}
                    >
                        {provider.name.charAt(0)}
                    </div>
                </div>
            </div>
            <div
                className="provider-content-section"
                style={{ backgroundColor: provider.brandColor }}
            >
                <div className="provider-name">{provider.name}</div>
                <div className="provider-description">{t(provider.description, provider.name)}</div>
            </div>
        </div>
    );
}
