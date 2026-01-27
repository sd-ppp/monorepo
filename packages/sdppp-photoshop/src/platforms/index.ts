import { availableModels as replicateAvailableModels, SDPPPReplicate } from "./_replicate/client";
import { SDPPPRunningHub } from "./_runninghub/client";
import { SDPPPCustomAPI } from "./_customapi/client";
import ReplicateRenderer from "./_replicate/renderer/replicate";
import RunningHubRenderer from "./_runninghub/renderer/runninghub";
import CustomAPIRenderer from "./_customapi/renderer/customapi";
import { ComfyFrontendRenderer } from "./_comfy_frontend/renderer/comfy_frontend.tsx";
import { SDPPPSponsor } from "./_sdppp_sponsor/client";
import SDPPPSponsorRenderer from "./_sdppp_sponsor/renderer/sdppp_sponsor";

// Use public paths to access logos without bundling
const ComfyUILogo = './assets/provider-logos/comfy_160x160.jpg';
const ReplicateLogo = './assets/provider-logos/replicate_160x160.jpg';
const RunningHubLogo = './assets/provider-logos/runninghub_160x160.jpg';
const SDPPPSponsorLogo = './assets/provider-logos/sdppp_sponsor_160x160.jpg';

export interface ProviderMetadata {
    id: string;
    name: string;
    description: string;
    brandColor: string;
    logoPath: string;
}

const CustomAPIProvider = {
    client: SDPPPCustomAPI,
    Renderer: CustomAPIRenderer,
    metadata: {
        id: 'CustomAPI',
        name: 'Google/OpenAI',
        description: 'provider.google.description',
        brandColor: '#777',
        logoPath: ''
    }
} as const;

export const Providers = {
    Replicate: {
        client: SDPPPReplicate,
        Renderer: ReplicateRenderer,
        availableModels: replicateAvailableModels,
        metadata: {
            id: 'Replicate',
            name: 'Replicate',
            description: 'provider.replicate.description',
            brandColor: '#f03a68',
            logoPath: ReplicateLogo
        }
    },
    RunningHub: {
        client: SDPPPRunningHub,
        Renderer: RunningHubRenderer,
        metadata: {
            id: 'RunningHub',
            name: 'RunningHub',
            description: 'provider.runninghub.description',
            brandColor: '#02dba3',
            logoPath: RunningHubLogo
        }
    },
    ComfyUI: {
        Renderer: ComfyFrontendRenderer,
        metadata: {
            id: 'ComfyUI',
            name: 'ComfyUI',
            description: 'provider.comfyui.description',
            brandColor: '#172Ed8',
            logoPath: ComfyUILogo
        }
    },
    CustomAPI: CustomAPIProvider,
    SDPPPSponsor: {
        client: SDPPPSponsor,
        Renderer: SDPPPSponsorRenderer,
        metadata: {
            id: 'SDPPPSponsor',
            name: 'SDPPP Sponsor',
            description: 'provider.sdppp_sponsor.description',
            brandColor: '#4CAF50',
            logoPath: SDPPPSponsorLogo
        }
    }
}

export const PROVIDER_METADATA: Record<string, ProviderMetadata> = {
    Replicate: Providers.Replicate.metadata,
    RunningHub: Providers.RunningHub.metadata,
    ComfyUI: Providers.ComfyUI.metadata,
    CustomAPI: Providers.CustomAPI.metadata,
    SDPPPSponsor: Providers.SDPPPSponsor.metadata
};
