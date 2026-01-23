import React, { createContext, useContext } from 'react';
import type { WidgetRenderMeta } from '../widget-registry';

const WidgetRenderMetaContext = createContext<WidgetRenderMeta | null>(null);

export interface WidgetRenderMetaProviderProps {
    value?: WidgetRenderMeta | null;
    children: React.ReactNode;
}

export const WidgetRenderMetaProvider: React.FC<WidgetRenderMetaProviderProps> = ({
    value = null,
    children,
}) => {
    return (
        <WidgetRenderMetaContext.Provider value={value ?? null}>
            {children}
        </WidgetRenderMetaContext.Provider>
    );
};

export const useWidgetRenderMeta = (): WidgetRenderMeta | null => {
    return useContext(WidgetRenderMetaContext);
};
