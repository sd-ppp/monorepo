import { readFile, writeFile } from 'fs/promises';
import { SDPPPReplicate } from '../_replicate/client';
import { describe, it, expect, test } from 'vitest';
import { join } from 'path';

describe('replicate', () => {
    const client = new SDPPPReplicate({
        apiKey: process.env.REPLICATE_API_KEY || ''
    });
    const testCases = [
        { provider: 'stability-ai', model: 'stable-diffusion' },
        { provider: 'stability-ai', model: 'stable-diffusion-inpainting' },
        { provider: 'stability-ai', model: 'sdxl' },
        { provider: 'black-forest-labs', model: 'flux-kontext-pro' },
        { provider: 'black-forest-labs', model: 'flux-kontext-max' },
        { provider: 'black-forest-labs', model: 'flux-1.1-pro' },
        { provider: 'minimax', model: 'image-01' },
        { provider: 'google', model: 'imagen-4' },
        { provider: 'openai', model: "gpt-image-1" },
    ];
    testCases.forEach(({ provider, model }, index) => {
        it(`should fetch modelId and widgetableWidgets for ${provider}/${model}`, async () => {
            const result = await client.getWidgets(`${provider}/${model}`);
            await writeFile(join(import.meta.dirname, `testoutput/replicate.${provider}.${model}.json`), JSON.stringify(result.rawData, null, 2));
            expect(result).toHaveProperty('widgetableWidgets');
            expect(Array.isArray(result.widgetableWidgets)).toBe(true);
            expect(result.widgetableWidgets.length).toBeGreaterThan(2);
            result.widgetableWidgets.forEach((widget: any) => {
                expect(widget).toHaveProperty('name');
                expect(typeof widget.name).toBe('string');
                expect(widget).toHaveProperty('uiWeight');
                expect(typeof widget.uiWeight).toBe('number');
                expect(widget).toHaveProperty('outputType');
                expect(['string', 'number', 'boolean', 'images', 'combo', 'masks'].includes(widget.outputType)).toBe(true);
                if (widget.options) {
                    expect(typeof widget.options).toBe('object');
                }
            });
            // 针对不同模型做更细致的结构校验
            if (provider === 'stability-ai' && model === 'sdxl') {
                // sdxl 特有字段
                const names = result.widgetableWidgets.map((w: any) => w.name);
                expect(names).toContain('apply_watermark');
                expect(names).toContain('refine');
            }
            if (provider === 'minimax' && model === 'image-01') {
                const names = result.widgetableWidgets.map((w: any) => w.name);
                expect(names).toContain('prompt_optimizer');
                expect(names).toContain('subject_reference');
            }
            if (provider === 'google' && model === 'imagen-4') {
                const names = result.widgetableWidgets.map((w: any) => w.name);
                expect(names).toContain('safety_filter_level');
                expect(names).toContain('output_format');
            }
            if (provider === 'black-forest-labs' && model === 'flux-1.1-pro') {
                const names = result.widgetableWidgets.map((w: any) => w.name);
                expect(names).toContain('prompt_upsampling');
                expect(names).toContain('output_quality');
            }
        });
    });

    it('should run model', async () => {
        const { defaultInput: defaultInputTxt2Img } = await client.getWidgets('stability-ai/stable-diffusion');
        const taskTxt2Img = await client.run(
            'stability-ai/stable-diffusion', 
            defaultInputTxt2Img
        );
        const imagesTxt2Img: { url: string }[] = await taskTxt2Img.promise as { url: string }[]
        await Promise.all(imagesTxt2Img.map(async (image, index) => {
            await downloadImage(image.url, join(import.meta.dirname, `testoutput/replicate.sd15txt2img.test.${index}.png`))
        }))
        
        const { defaultInput: defaultInputImg2Img } = await client.getWidgets('stability-ai/stable-diffusion-inpainting');
        defaultInputImg2Img.image = await client.uploadImage(await readFile(join(import.meta.dirname, `testoutput/replicate.sd15txt2img.test.0.png`)), 'png');
        const taskImg2Img = await client.run(
            'stability-ai/stable-diffusion-inpainting', 
            defaultInputImg2Img
        );
        const imagesImg2Img: { url: string }[] = await taskImg2Img.promise as { url: string }[]
        await Promise.all(imagesImg2Img.map(async (image, index) => {
            await downloadImage(image.url, join(import.meta.dirname, `testoutput/replicate.sd15img2img.test.${index}.png`))
        }))
    });
});


// 下载图片的辅助函数
async function downloadImage(url: string, filePath: string): Promise<void> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        await writeFile(filePath, Buffer.from(buffer));
    } catch (error) {
        console.error(`Failed to download image from ${url}:`, error);
        throw error;
    }
}