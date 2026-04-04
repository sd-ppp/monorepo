import type { Form } from '@formily/core';
import { t } from '@sdppp/common';
import type { DeferredUploadValue } from '@sdppp/formily-widgets';

/**
 * 检查一个值是否是 DeferredUploadValue
 */
function isDeferredUploadValue(value: any): value is DeferredUploadValue {
  const result = (
    value &&
    typeof value === 'object' &&
    value.type === 'deferred' &&
    typeof value.resourceId === 'string'
  );
  
  if (value && typeof value === 'object' && value.type === 'deferred') {
    console.log('[TaskRouter:DeferredUpload] isDeferredUploadValue check:', {
      result,
      hasResourceId: 'resourceId' in value,
      resourceIdType: typeof value.resourceId,
      resourceId: value.resourceId,
      valueKeys: Object.keys(value),
    });
  }
  
  return result;
}

/**
 * 递归遍历并转换表单值中的所有 deferred 字段
 * 
 * @param obj 要转换的对象
 * @param uploadResource 上传函数
 * @returns 转换后的对象
 */
async function deepTransformDeferredFields(
  obj: any,
  uploadResource: (resourceId: string, options?: { fileName?: string }) => Promise<string>
): Promise<any> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // 检查是否是 DeferredUploadValue
  if (isDeferredUploadValue(obj)) {
    console.log('[TaskRouter:DeferredUpload] Processing deferred upload value:', {
      resourceId: obj.resourceId,
      previewUrl: obj.previewUrl,
      contentUri: obj.contentUri,
    });
    
    try {
      // 执行上传
      const url = await uploadResource(obj.resourceId);
      
      console.log('[TaskRouter:DeferredUpload] Upload completed:', {
        resourceId: obj.resourceId,
        uploadedUrl: url,
      });

      // 返回数组格式（与手动上传保持一致）
      return [url];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[TaskRouter:DeferredUpload] Upload failed:', {
        resourceId: obj.resourceId,
        error: message,
      });
      throw new Error(
        t('taskrouter.error.deferred_upload_failed', { error: message })
      );
    }
  }

  // 递归处理数组
  if (Array.isArray(obj)) {
    console.log('[TaskRouter:DeferredUpload] Processing array with length:', obj.length);
    return Promise.all(obj.map(item => deepTransformDeferredFields(item, uploadResource)));
  }

  // 递归处理对象
  console.log('[TaskRouter:DeferredUpload] Processing object with keys:', Object.keys(obj));
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const originalValue = obj[key];
      const transformedValue = await deepTransformDeferredFields(originalValue, uploadResource);
      
      // 如果值发生了变化，记录日志
      if (originalValue !== transformedValue) {
        console.log('[TaskRouter:DeferredUpload] Field transformed:', {
          key,
          originalType: typeof originalValue,
          originalIsArray: Array.isArray(originalValue),
          transformedType: typeof transformedValue,
          transformedIsArray: Array.isArray(transformedValue),
          originalValue: originalValue && typeof originalValue === 'object' ? Object.keys(originalValue) : originalValue,
          transformedValue,
        });
      }
      
      result[key] = transformedValue;
    }
  }
  return result;
}

/**
 * 在表单提交前转换所有延迟上传字段
 * 
 * 此函数会：
 * 1. 遍历表单的所有值
 * 2. 找到所有 type === 'deferred' 的字段
 * 3. 调用 uploadResource 上传临时资源
 * 4. 将上传后的 URL 替换原值
 * 5. 更新表单值
 * 
 * @param form Formily 表单实例
 * @param uploadResource 上传函数
 * 
 * @example
 * ```ts
 * await transformDeferredUploadFieldsBeforeSubmit(form, uploadResource);
 * const result = await form.submit();
 * ```
 */
export async function transformDeferredUploadFieldsBeforeSubmit(
  form: Form,
  uploadResource: (resourceId: string, options?: { fileName?: string }) => Promise<string>
): Promise<void> {
  const values = form.values;
  
  console.log('[TaskRouter:DeferredUpload] Starting transformation:', {
    formValuesKeys: Object.keys(values),
    formValues: JSON.stringify(values, null, 2),
  });
  
  // 递归转换所有 deferred 字段
  const transformedValues = await deepTransformDeferredFields(values, uploadResource);
  
  console.log('[TaskRouter:DeferredUpload] Transformation complete:', {
    transformedValuesKeys: Object.keys(transformedValues),
    transformedValues: JSON.stringify(transformedValues, null, 2),
  });
  
  // 更新表单值
  form.setValues(transformedValues);
  
  console.log('[TaskRouter:DeferredUpload] Form values updated');
}
