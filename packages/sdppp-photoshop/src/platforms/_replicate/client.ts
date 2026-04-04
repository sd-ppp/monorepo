import { sdpppSDK, t } from '@sdppp/common';
import { Buffer } from 'buffer';
import { WidgetableNode } from '@sdppp/common/schemas/schemas';
import { adaptFormilySchemaToWidgetable } from '@sdppp/formily-widgetable-adapter';
import type { FormilySchema } from '@sdppp/pptask';
import { createInlineExecutor } from '@sdppp/pptask/executors/inline';
import type { InlineExecutor } from '@sdppp/pptask/executors/inline';
import { Client } from "../base/Client";
import { Task } from "../base/Task";

const log = sdpppSDK.logger.extend('replicate')

sdpppSDK.plugins.fetchProxy.registerProxyDomains('api.replicate.com');

export const availableModels = [
    'google/nano-banana',
    'google/nano-banana-pro',
    'black-forest-labs/flux-kontext-dev',
    'black-forest-labs/flux-kontext-pro',
    'flux-kontext-apps/multi-image-kontext-pro',
    'black-forest-labs/flux-kontext-max',
    'flux-kontext-apps/multi-image-kontext-max',
    'black-forest-labs/flux-1.1-pro',
    'openai/gpt-image-1',
    'bytedance/seedream-3',
    'minimax/image-01',
    'google/imagen-4',
    'stability-ai/stable-diffusion',
    'stability-ai/stable-diffusion-inpainting',
    'stability-ai/sdxl',
]

export class SDPPPReplicate extends Client<{
    apiKey: string
}> {
    private readonly inline: InlineExecutor;
    private readonly schemaCache = new Map<string, FormilySchema>();

    constructor(config: { apiKey: string }) {
        super(config);
        this.inline = createInlineExecutor({
            platformConfig: () => this.buildPlatformConfig(),
        });
    }

    private buildLocator(model: string): string {
        const normalized = model?.trim() || '';
        return `replicate:///${normalized}`;
    }

    private buildPlatformConfig(): Record<string, any> {
        return {
            apiKey: this.config.apiKey,
        };
    }

    async getNodes(model: string): Promise<{
        widgetableNodes: WidgetableNode[],
        defaultInput: Record<string, any>,
        rawData: any
    }> {
        const locator = this.buildLocator(model);
        log('getNodes called', { model, locator });

        try {
            const describe = await this.inline.describe({ locator });
            const formSchema = describe.formSchema as FormilySchema;
            const formValues = (describe.formValues ?? {}) as Record<string, any>;
            this.schemaCache.set(locator, formSchema);
            const { nodes, defaultValues, warnings } = adaptFormilySchemaToWidgetable(formSchema);
            const mergedValues = { ...defaultValues, ...formValues };

            log('getNodes success', { model, nodesCount: nodes.length });
            return {
                widgetableNodes: nodes,
                defaultInput: mergedValues,
                rawData: {
                    locator,
                    schema: formSchema,
                    values: mergedValues,
                    warnings,
                    metadata: describe.metadata,
                }
            }
        } catch (error: any) {
            log('getNodes exception', { model, error: error.message });
            console.error('Error fetching model info:', error);
            throw error;
        }
    }
    async run(model: string, input: any, signal?: AbortSignal) {
        const locator = this.buildLocator(model);
        log('run called', { model, locator, input });

        try {
            if (signal?.aborted) {
                throw new DOMException('Task creation aborted', 'AbortError');
            }

            const taskId = `replicate_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            let taskResult: any = null;
            let remoteTaskId: string | null = null;
            let isCompleted = false;

            return new Task(taskId, {
                statusGetter: async () => {
                    if (!isCompleted && !taskResult) {
                        if (!this.schemaCache.has(locator)) {
                            await this.getNodes(model);
                        }
                        const response = await sdpppSDK.plugins.photoshop.pptaskRun({
                            locator,
                            payload: input as Record<string, any>,
                            platformConfig: this.buildPlatformConfig(),
                            context: { provider: 'replicate' },
                            schema: this.schemaCache.get(locator),
                        });
                        if (response?.ok === false || response?.error) {
                            const errorMessage = response?.error?.message || 'Replicate task failed';
                            const error = new Error(errorMessage);
                            (error as any).payload = response?.error?.payload ?? response;
                            throw error;
                        }
                        remoteTaskId = response?.taskId ?? null;
                        taskResult = response?.result ?? null;
                    }

                    isCompleted = true;

                    return {
                        isCompleted: true,
                        progress: 100,
                        progressMessage: t('common.success', { defaultValue: 'Success' }),
                        rawData: taskResult,
                    };
                },
                resultGetter: async (_id, lastStatusResult) => {
                    const result = lastStatusResult.rawData;
                    if (!result) {
                        throw new Error(t('replicate.error.result_fetch_failed'));
                    }
                    return result;
                },
                canceler: async () => {
                    if (!remoteTaskId) return;
                    await sdpppSDK.plugins.photoshop.pptaskCancel({ taskId: remoteTaskId });
                }
            })
        } catch (error: any) {
            log('run exception', { model, error: error.message });
            console.error('Error running task:', error);
            throw error;
        }
    }
    async uploadImage(type: 'resource', image: ArrayBuffer | string, format: 'png' | 'jpg' | 'jpeg' | 'webp', signal?: AbortSignal): Promise<string> {
        log('uploadImage called', { type, format });

        try {
            if (signal?.aborted) {
                throw new DOMException(
                    t('common.error.upload_aborted', { defaultValue: 'Upload aborted' }),
                    'AbortError'
                );
            }

            if (type !== 'resource') {
                throw new Error(t('upload_pass.error.unsupported_type', { type }));
            }

            if (typeof image === 'string') {
                return image;
            }

            const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
            const base64 = Buffer.from(image).toString('base64');
            return `data:${mime};base64,${base64}`;
        } catch (error: any) {
            log('uploadImage exception', { type, format, error: error.message });
            console.error('Error uploading image:', error);
            throw error;
        }
    }
}



// Input Schema example
// {
//     type: 'object',
//     title: 'Input',
//     properties: {
//       seed: {
//         type: 'integer',
//         title: 'Seed',
//         'x-order': 8,
//         description: 'Random seed. Leave blank to randomize the seed'
//       },
//       width: {
//         allOf: [Array],
//         default: 768,
//         'x-order': 2,
//         description: 'Width of generated image in pixels. Needs to be a multiple of 64'
//       },
//       height: {
//         allOf: [Array],
//         default: 768,
//         'x-order': 1,
//         description: 'Height of generated image in pixels. Needs to be a multiple of 64'
//       },
//       prompt: {
//         type: 'string',
//         title: 'Prompt',
//         default: 'a vision of paradise. unreal engine',
//         'x-order': 0,
//         description: 'Input prompt'
//       },
//       scheduler: {
//         allOf: [Array],
//         default: 'DPMSolverMultistep',
//         'x-order': 7,
//         description: 'Choose a scheduler.'
//       },
//       num_outputs: {
//         type: 'integer',
//         title: 'Num Outputs',
//         default: 1,
//         maximum: 4,
//         minimum: 1,
//         'x-order': 4,
//         description: 'Number of images to generate.'
//       },
//       guidance_scale: {
//         type: 'number',
//         title: 'Guidance Scale',
//         default: 7.5,
//         maximum: 20,
//         minimum: 1,
//         'x-order': 6,
//         description: 'Scale for classifier-free guidance'
//       },
//       negative_prompt: {
//         type: 'string',
//         title: 'Negative Prompt',
//         'x-order': 3,
//         description: 'Specify things to not see in the output'
//       },
//       num_inference_steps: {
//         type: 'integer',
//         title: 'Num Inference Steps',
//         default: 50,
//         maximum: 500,
//         minimum: 1,
//         'x-order': 5,
//         description: 'Number of denoising steps'
//       }
//     }
//   }
