import { sdpppSDK } from '@sdppp/common';
import { getDefaultValues, WidgetableNode } from '@sdppp/common/schemas/schemas';
import Replicate from "replicate";
import { Client } from "../base/Client";
import { Task } from "../base/Task";

const log = sdpppSDK.logger.extend('replicate')

sdpppSDK.plugins.fetchProxy.registerProxyDomains('api.replicate.com');

const modelIds: Record<string, string> = {
}

export const availableModels = [
    'google/nano-banana',
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
    private replicate: Replicate;

    constructor(config: { apiKey: string }) {
        super(config);
        this.replicate = new Replicate({
            auth: config.apiKey
        })
    }

    async getNodes(model: string): Promise<{
        widgetableNodes: WidgetableNode[],
        defaultInput: Record<string, any>,
        rawData: any
    }> {
        log('getNodes called', { model });

        try {
            const [modelProvider, modelId] = model.split('/');
            log('getNodes request', { modelProvider, modelId });

            const modelInfo = await this.replicate.models.get(modelProvider, modelId)
            if (!modelInfo.latest_version) {
                const errorMsg = `getNodes API failed - No latest version found for model ${model}`;
                log('getNodes error', { model, error: 'No latest version found' });
                throw new Error(errorMsg)
            }
            modelIds[model] = modelInfo.latest_version.id;
            const widgetableNodes = convertInputSchemaToWidgetableNodes(modelInfo.latest_version.openapi_schema['components']?.schemas);
            const defaultInput = modelInfo.default_example?.input ?? {};
            widgetableNodes.forEach((node) => {
                node.widgets.forEach((widget) => {
                    if (!(widget.name in defaultInput)) {
                        defaultInput[widget.name] = getDefaultValues(widget.outputType, widget.options)
                    }
                })
            })

            log('getNodes success', { model, nodesCount: widgetableNodes.length });
            return {
                widgetableNodes,
                defaultInput,
                rawData: modelInfo
            }
        } catch (error: any) {
            log('getNodes exception', { model, error: error.message });
            console.error('Error fetching model info:', error);
            throw error;
        }
    }
    async run(model: string, input: any, signal?: AbortSignal) {
        log('run called', { model, input });

        try {
            // Check if already aborted
            if (signal?.aborted) {
                throw new DOMException('Task creation aborted', 'AbortError');
            }

            const id = modelIds[model];
            if (!id) {
                log('run - model id not found, calling getNodes', { model });
                await this.getNodes(model);
            }

            const [modelProvider, modelId] = model.split('/');
            const requestData = {
                model: `${modelProvider}/${modelId}`,
                version: modelIds[model],
                input
            };

            log('run request', { model, requestData });
            const result = await this.replicate.predictions.create(requestData)
            log('run success', { model, taskId: result.id });

            return new Task(result.id, {
                statusGetter: async (id) => {
                    log('statusGetter called', { taskId: id });

                    // Check if aborted before making status request
                    if (signal?.aborted) {
                        throw new DOMException('Status check aborted', 'AbortError');
                    }

                    try {
                        const r = await this.replicate.predictions.get(id)
                        log('statusGetter response', { taskId: id, status: r.status });

                        if (r.status === 'failed') {
                            const errorMsg = `status API failed - ${String(r.error)}`;
                            log('statusGetter error', { taskId: id, error: r.error });
                            throw new Error(errorMsg)
                        }
                        return {
                            isCompleted: r.status === 'succeeded',
                            progress: 0,
                            progressMessage: r.status,
                            rawData: r
                        }
                    } catch (error: any) {
                        log('statusGetter exception', { taskId: id, error: error.message });
                        throw error;
                    }
                },
                resultGetter: async (id, lastStatusResult) => {
                    log('resultGetter called', { taskId: id });

                    // Check if aborted before getting results
                    if (signal?.aborted) {
                        throw new DOMException('Result fetch aborted', 'AbortError');
                    }

                    try {
                        const outputs = lastStatusResult.rawData.output instanceof Array ? lastStatusResult.rawData.output : [lastStatusResult.rawData.output];
                        const results = outputs.map((item: any) => ({
                            url: item
                        }));

                        log('resultGetter success', { taskId: id, resultsCount: results.length });
                        return results;
                    } catch (error: any) {
                        log('resultGetter exception', { taskId: id, error: error.message });
                        throw error;
                    }
                },
                canceler: async (id: string) => {
                    log('canceler called', { taskId: id });
                    try {
                        await this.replicate.predictions.cancel(id)
                        log('canceler success', { taskId: id });
                    } catch (error: any) {
                        log('canceler exception', { taskId: id, error: error.message });
                        throw error;
                    }
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
            // Check if already aborted
            if (signal?.aborted) {
                throw new DOMException('Upload aborted', 'AbortError');
            }

            if (type === 'resource') {
                // Check if aborted before file upload
                if (signal?.aborted) {
                    throw new DOMException('File upload aborted', 'AbortError');
                }

                log('uploadImage - creating file via Replicate API');
                const file = await this.replicate.files.create(new Blob([image as string], {
                    type: `image/uxp`
                }));

                log('uploadImage success', { type, url: file.urls.get });
                return file.urls.get;
            }

            log('uploadImage - converting to base64 data URL');
            const base64 = Buffer.from(image as ArrayBuffer).toString('base64');
            const dataUrl = `data:image/${format};base64,${base64}`;

            log('uploadImage success', { type, format });
            return dataUrl;
        } catch (error: any) {
            log('uploadImage exception', { type, format, error: error.message });
            console.error('Error uploading image:', error);
            throw error;
        }
    }
}

function convertInputSchemaToWidgetableNodes(schemas: any): WidgetableNode[] {
    return Object.entries(schemas.Input.properties as Record<string, any>)
        .sort((a, b) => a[1]['x-order'] - b[1]['x-order'])
        .map(([name, prop]: [string, any]) => {
            let outputType: any = prop.type;
            let options: any = undefined;

            // combo 类型（enum/oneOf/allOf）
            if (prop.enum || prop.oneOf || prop.allOf) {
                outputType = 'combo';
                if (prop.allOf[0].$ref) {
                    const refSchema = schemas[prop.allOf[0].$ref.split('/').pop()];
                    options = {
                        values: refSchema.enum,
                        description: refSchema.description
                    }
                } else {
                    options = {
                        values: prop.enum || (prop.oneOf ? prop.oneOf.map((o: any) => o.const ?? o) : prop.allOf)
                    };
                }
            }
            // number/integer 类型
            else if (prop.type === 'integer' || prop.type === 'number') {
                outputType = 'number';
                options = {
                    max: prop.maximum ?? undefined,
                    min: prop.minimum ?? undefined,
                    step: prop.type === 'integer' ? 1 : 0.01
                };
            } else if (prop.type === 'string' || prop.type === 'password') {
                if (prop.format === 'uri') {
                    outputType = 'images';
                    options = { maxCount: 1 };
                } else {
                    outputType = 'string';
                }
            } else if (prop.type === 'array') {
                if (prop.items.type === 'string' && prop.items.format === 'uri') {
                    outputType = 'images';
                    options = { maxCount: 4 };
                }
            }

            options = {
                ...options,
                required: schemas.Input.required && schemas.Input.required.indexOf(name) !== -1,
            }

            const widget = {
                name: '',
                uiWeight: 12,
                outputType,
                options
            };
            return {
                id: name,
                title: name,
                widgets: [widget],
                uiWeightSum: 12
            };
        });
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
