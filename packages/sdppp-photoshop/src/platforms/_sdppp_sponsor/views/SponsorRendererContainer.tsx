import { useCallback } from 'react';
import type { UploadPassInput } from '../../base/upload-pass-context';
import { UploadPassProvider } from '../../base/upload-pass-context';
import { WrappedSdpppWidgetProvider } from '../../base/widgetable-photoshop';
import { sponsorAuthStore } from './auth/authStore';
import SponsorPageContainer from './SponsorPageContainer';
import { sponsorTemplateStore } from './templates/templateStore';

export default function SponsorRendererContainer() {
  const uploadResource = useCallback(
    async (resourceId: string, options?: { fileName?: string; signal?: AbortSignal }) => {
      const client = sponsorAuthStore.getState().client;
      const templateId = sponsorTemplateStore.getState().templateId;
      const recommendedUploadProvider = sponsorTemplateStore
        .getState()
        .getRecommendedUploadProvider(templateId);
      if (!client) {
        throw new Error('TaskRouter 客户端未初始化');
      }
      if (!templateId) {
        throw new Error('未选择任务模板');
      }
      return client.uploadResource(templateId, resourceId, {
        fileName: options?.fileName,
        signal: options?.signal,
        uploadProviderHint: recommendedUploadProvider,
      });
    },
    []
  );

  const taskRouterUpload = useCallback(
    async (_uploadInput: UploadPassInput, _signal?: AbortSignal) => {
      throw new Error('UploadPassProvider is not fully compatible with TaskRouter upload mechanism. Please use the uploadResource prop instead.');
    },
    []
  );

  return (
    <UploadPassProvider uploader={taskRouterUpload}>
      <WrappedSdpppWidgetProvider uploadResource={uploadResource}>
        <SponsorPageContainer />
      </WrappedSdpppWidgetProvider>
    </UploadPassProvider>
  );
}
