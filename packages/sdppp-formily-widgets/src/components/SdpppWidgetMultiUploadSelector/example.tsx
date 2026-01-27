/**
 * 使用示例：SdpppWidgetMultiUploadSelector
 * 
 * 这个文件展示了如何使用 SdpppWidgetMultiUploadSelector 组件
 */

import React, { useState } from 'react';
import { SdpppWidgetMultiUploadSelector } from './SdpppWidgetMultiUploadSelector';
import type { DeferredUploadValue } from '../SdpppWidgetDeferredUploadSelector/types';
import type { AggregatedUploadState } from './types';

/**
 * 示例 1: Deferred 模式（延迟上传）
 */
export const DeferredModeExample: React.FC = () => {
  const [images, setImages] = useState<(string | DeferredUploadValue)[]>([]);
  const [uploadState, setUploadState] = useState<AggregatedUploadState | null>(null);

  return (
    <div style={{ padding: 20, maxWidth: 600 }}>
      <h2>Deferred 模式示例</h2>
      <p>延迟上传模式：只生成预览，不立即上传</p>

      <SdpppWidgetMultiUploadSelector
        variant="deferred"
        maxCount={3}
        workBoundary="uxp://boundary/0/canvas"
        sourceHints={{
          content: 'canvas',
          boundary: 'selection',
        }}
        value={images}
        onChange={setImages}
        onUploadStateChange={setUploadState}
      />

      <div style={{ marginTop: 20, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
        <h4>当前值:</h4>
        <pre style={{ fontSize: 12, overflow: 'auto' }}>
          {JSON.stringify(images, null, 2)}
        </pre>

        {uploadState && uploadState.status !== 'idle' && (
          <>
            <h4>上传状态:</h4>
            <pre style={{ fontSize: 12 }}>
              {JSON.stringify(uploadState, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * 示例 2: Nomask 模式（立即上传）
 */
export const NomaskModeExample: React.FC = () => {
  const [imageUrls, setImageUrls] = useState<(string | DeferredUploadValue)[]>([]);
  const [uploadState, setUploadState] = useState<AggregatedUploadState | null>(null);

  return (
    <div style={{ padding: 20, maxWidth: 600 }}>
      <h2>Nomask 模式示例</h2>
      <p>立即上传模式：上传后返回 URL 数组</p>

      <SdpppWidgetMultiUploadSelector
        variant="nomask"
        maxCount={5}
        workBoundary="uxp://boundary/0/canvas"
        value={imageUrls}
        onChange={setImageUrls}
        onUploadStateChange={setUploadState}
        showActionButtons={true}
      />

      <div style={{ marginTop: 20, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
        <h4>当前 URLs:</h4>
        <ul style={{ fontSize: 12 }}>
          {imageUrls.map((item, index) => {
            const url = typeof item === 'string' ? item : item.previewUrl || item.resourceId || '';
            return (
              <li key={index}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {url}
                </a>
              </li>
            );
          })}
        </ul>

        {uploadState && uploadState.status !== 'idle' && (
          <>
            <h4>上传状态:</h4>
            <pre style={{ fontSize: 12 }}>
              {JSON.stringify(uploadState, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * 示例 3: 与 Formily 集成
 */
import { createForm } from '@formily/core';
import { FormProvider, Field } from '@formily/react';

const form = createForm();

export const FormilyIntegrationExample: React.FC = () => {
  const handleSubmit = async (values: any) => {
    console.log('表单提交:', values);

    // 如果是 deferred 模式，需要批量上传
    if (values.images && Array.isArray(values.images)) {
      const deferredImages = values.images as DeferredUploadValue[];
      
      // TODO: 批量调用 uploadResource
      const uploadedUrls = await Promise.all(
        deferredImages.map(async (item) => {
          if (item.resourceId) {
            // 调用实际的上传函数
            // return await uploadResource(item.resourceId);
            return `https://example.com/${item.resourceId}`;
          }
          return null;
        })
      );

      console.log('上传完成:', uploadedUrls.filter(Boolean));
    }

    alert('表单提交成功，查看控制台输出');
  };

  return (
    <div style={{ padding: 20, maxWidth: 600 }}>
      <h2>Formily 集成示例</h2>
      <p>注意：需要安装 @formily/antd-v5 包才能使用 FormItem 等组件</p>

      <FormProvider form={form}>
        <div>
          <Field
            name="images"
            title="产品图片"
            required
            component={[
              SdpppWidgetMultiUploadSelector,
              {
                variant: 'deferred',
                maxCount: 4,
                workBoundary: 'uxp://boundary/0/canvas',
                sourceHints: {
                  content: 'canvas',
                  boundary: 'selection',
                },
              },
            ]}
          />

          <button onClick={() => handleSubmit(form.values)}>提交</button>
        </div>
      </FormProvider>
    </div>
  );
};

/**
 * 示例 4: 自定义配置
 */
export const CustomConfigExample: React.FC = () => {
  const [images, setImages] = useState<(string | DeferredUploadValue)[]>([]);

  return (
    <div style={{ padding: 20, maxWidth: 600 }}>
      <h2>自定义配置示例</h2>

      <SdpppWidgetMultiUploadSelector
        widgetableId="custom-multi-upload"
        variant="deferred"
        maxCount={10}
        workBoundary="uxp://boundary/0/canvas"
        sourceHints={{
          content: 'curlayer',
          mask: 'selection',
          boundary: 'curlayer',
        }}
        value={images}
        onChange={setImages}
        showActionButtons={false}  // 隐藏操作按钮
        label="自定义标签"
        onUploadStateChange={(state) => {
          console.log('状态变化:', state);
        }}
      />

      <div style={{ marginTop: 20 }}>
        <p>已选择 {images.length} 张图片</p>
      </div>
    </div>
  );
};

/**
 * 主示例组件
 */
export const MultiUploadSelectorExamples: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'deferred' | 'nomask' | 'formily' | 'custom'>('deferred');

  return (
    <div>
      <div style={{ borderBottom: '1px solid #d9d9d9', padding: '10px 20px' }}>
        <button
          onClick={() => setActiveTab('deferred')}
          style={{
            marginRight: 10,
            fontWeight: activeTab === 'deferred' ? 'bold' : 'normal',
          }}
        >
          Deferred 模式
        </button>
        <button
          onClick={() => setActiveTab('nomask')}
          style={{
            marginRight: 10,
            fontWeight: activeTab === 'nomask' ? 'bold' : 'normal',
          }}
        >
          Nomask 模式
        </button>
        <button
          onClick={() => setActiveTab('formily')}
          style={{
            marginRight: 10,
            fontWeight: activeTab === 'formily' ? 'bold' : 'normal',
          }}
        >
          Formily 集成
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          style={{
            fontWeight: activeTab === 'custom' ? 'bold' : 'normal',
          }}
        >
          自定义配置
        </button>
      </div>

      {activeTab === 'deferred' && <DeferredModeExample />}
      {activeTab === 'nomask' && <NomaskModeExample />}
      {activeTab === 'formily' && <FormilyIntegrationExample />}
      {activeTab === 'custom' && <CustomConfigExample />}
    </div>
  );
};

export default MultiUploadSelectorExamples;
