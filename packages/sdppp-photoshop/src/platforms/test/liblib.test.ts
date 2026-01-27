import { writeFile, mkdir, readFile } from 'fs/promises';
import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { SDPPPLiblib } from '../_liblib/client';

// API configuration
const LIBLIB_API_KEY = process.env.LIBLIB_API_KEY || '';
const LIBLIB_BASE_URL = process.env.LIBLIB_BASE_URL || '';

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

describe('liblib', () => {
    const testCases: { model: 'kontext-max-text2img' | 'kontext-pro-text2img' | 'kontext-max-img2img' | 'kontext-pro-img2img' }[] = [
        { model: 'kontext-max-text2img' },
        { model: 'kontext-pro-text2img' },
        { model: 'kontext-max-img2img' },
        { model: 'kontext-pro-img2img' }
    ];
    const client = new SDPPPLiblib({
        apiKey: LIBLIB_API_KEY,
        apiSecret: process.env.LIBLIB_API_SECRET || '',
        baseURL: LIBLIB_BASE_URL
    });

    testCases.forEach(({ model }) => {
        it(`should fetch widgetableWidgets for ${model}`, async () => {
            const result = await client.getWidgets(model);
            expect(result).toHaveProperty('widgetableWidgets');
            expect(result).toHaveProperty('defaultInput');
            expect(Array.isArray(result.widgetableWidgets)).toBe(true);
            expect(result.widgetableWidgets.length).toBeGreaterThan(0);
            
            result.widgetableWidgets.forEach((widget: any) => {
                expect(widget).toHaveProperty('name');
                expect(typeof widget.name).toBe('string');
                expect(widget).toHaveProperty('uiWeight');
                expect(typeof widget.uiWeight).toBe('number');
                expect(widget).toHaveProperty('outputType');
                expect(['string', 'number', 'boolean', 'images', 'combo', 'mask'].includes(widget.outputType)).toBe(true);
                if (widget.options) {
                    expect(typeof widget.options).toBe('object');
                }
            });

            // 针对不同模型做更细致的结构校验
            if (model === 'kontext-max-text2img' || model === 'kontext-pro-text2img') {
                const names = result.widgetableWidgets.map((w: any) => w.name);
                expect(names).toContain('prompt');
                expect(names).toContain('aspectRatio');
                expect(names).toContain('guidance_scale');
                expect(names).toContain('imgCount');
                
                // 检查 defaultInput
                expect(result.defaultInput).toHaveProperty('prompt');
                expect(result.defaultInput).toHaveProperty('aspectRatio');
                expect(result.defaultInput).toHaveProperty('guidance_scale');
                expect(result.defaultInput).toHaveProperty('imgCount');
            }

            if (model === 'kontext-max-img2img' || model === 'kontext-pro-img2img') {
                const names = result.widgetableWidgets.map((w: any) => w.name);
                expect(names).toContain('prompt');
                expect(names).toContain('aspectRatio');
                expect(names).toContain('guidance_scale');
                expect(names).toContain('imgCount');
                expect(names).toContain('image_list');
                
                // 检查 defaultInput
                expect(result.defaultInput).toHaveProperty('prompt');
                expect(result.defaultInput).toHaveProperty('aspectRatio');
                expect(result.defaultInput).toHaveProperty('guidance_scale');
                expect(result.defaultInput).toHaveProperty('imgCount');
                expect(result.defaultInput).toHaveProperty('image_list');
                expect(Array.isArray(result.defaultInput.image_list)).toBe(true);
            }
        });
    });

    it('should run kontext model', async () => {
        // Ensure testoutput directory exists
        const testOutputDir = join(import.meta.dirname, 'testoutput');
        await mkdir(testOutputDir, { recursive: true });

        // Use the specified input image
        const buffer = await readFile(join(import.meta.dirname, 'testoutput/liblib.text2img.test.0.png'));
        const uploadedUrl = await client.uploadImage(buffer, 'png');

        // Run img2img with the required prompt and input image
        const { defaultInput: defaultInputImg2Img } = await client.getWidgets('kontext-pro-img2img');
        defaultInputImg2Img.image_list = [uploadedUrl] as any;
        defaultInputImg2Img.prompt = 'change the man to a girl with mouth mask, light grey hair';

        const taskImg2Img = await client.run('kontext-pro-img2img', defaultInputImg2Img);

        // Validate task object
        expect(taskImg2Img).toBeDefined();
        expect(taskImg2Img).toHaveProperty('taskId');
        expect(taskImg2Img).toHaveProperty('promise');
        expect(typeof taskImg2Img.taskId).toBe('string');
        expect(taskImg2Img.promise).toBeInstanceOf(Promise);

        // Wait for results and download images
        const outputImg2Img = await taskImg2Img.promise as Array<{ url: string; rawData: any }>;
        expect(outputImg2Img).toBeDefined();
        expect(Array.isArray(outputImg2Img)).toBe(true);
        expect(outputImg2Img.length).toBeGreaterThan(0);

        for (let index = 0; index < outputImg2Img.length; index++) {
            const item = outputImg2Img[index];
            expect(item).toHaveProperty('url');
            expect(item).toHaveProperty('rawData');
            expect(typeof item.url).toBe('string');
            const fileName = `liblib.img2img.test.${index}.png`;
            const filePath = join(testOutputDir, fileName);
            try {
                await downloadImage(item.url, filePath);
            } catch (error) {
                // If direct download fails, at least persist the URL
                await writeFile(join(testOutputDir, `liblib.img2img.test.${index}.url.txt`), item.url).catch(() => {});
            }
        }
    });

    it('should throw error for unsupported model', async () => {
        await expect(client.getWidgets('unsupported-model' as any)).rejects.toThrow('Unsupported model: unsupported-model');
    });
});
