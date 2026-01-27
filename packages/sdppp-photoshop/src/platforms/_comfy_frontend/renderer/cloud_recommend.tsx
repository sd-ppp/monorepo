import { useEffect, useState } from "react";
import { sdpppSDK } from '@sdppp/common';
import { Button } from "antd";
import { loadRemoteConfig } from "@sdppp/vite-remote-config-loader";
import { useTranslation } from '@sdppp/common';


export function ComfyCloudRecommendBanner() {
    const { t, language } = useTranslation()
    const [shuffledBanners, setShuffledBanners] = useState<{
        link: string,
        name_chn: string,
        icon: string
    }[]>([]);

    useEffect(() => {
        const comfyCloudRecommend: {
            link: string,
            name_chn: string,
            icon: string
        }[] = loadRemoteConfig('banners').filter((banner: any) => banner.type === 'comfy_cloud' && banner.locale === language);

        if (comfyCloudRecommend.length === 0) return;

        const shuffleArray = (array: any[]) => {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        };

        const updateBanners = () => {
            const shuffled = shuffleArray(comfyCloudRecommend);
            setShuffledBanners(shuffled.slice(0, 3));
        };

        updateBanners();
        const interval = setInterval(updateBanners, 10000);

        return () => clearInterval(interval);
    }, [language]);

    if (shuffledBanners.length === 0) return null;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--sdppp-host-text-color-secondary)' }}>{t('comfy.cloud_recommend')}</span>
            {shuffledBanners.map((banner, index) => (
                <Button
                    key={`${banner.link}-${index}`}
                    type="link"
                    onClick={() => {
                        sdpppSDK.plugins.photoshop.openExternalLink({ url: banner.link });
                    }}
                    style={{ 
                        padding: 0, 
                        color: 'var(--sdppp-host-text-color)',
                        textDecoration: 'none'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.textDecoration = 'none';
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {banner.icon && (
                            <div style={{ 
                                backgroundColor: 'var(--sdppp-host-text-color-secondary)', 
                                borderRadius: 4, 
                                padding: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <img 
                                    src={banner.icon} 
                                    alt="" 
                                    style={{ width: 12, height: 12 }}
                                />
                            </div>
                        )}
                        <span>{banner.name_chn}</span>
                    </div>
                </Button>
            ))}
        </div>
    );
}