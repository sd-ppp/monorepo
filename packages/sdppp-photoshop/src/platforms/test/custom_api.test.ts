import { describe, it, expect } from 'vitest'
import { readFile, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { SDPPPCustomAPI } from '../_customapi/client'

// API configuration
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY 
const GOOGLE_BASE_URL = process.env.GOOGLE_BASE_URL 
const OPENAI_API_KEY = process.env.OPENAI_API_KEY 
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL 

async function writeImagePng(url: string, outPath: string) {
  if (url.startsWith('data:')) {
    const base64Data = url.split(',')[1]
    const buffer = Buffer.from(base64Data, 'base64')
    await writeFile(outPath, buffer)
  } else {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const arr = await res.arrayBuffer()
    await writeFile(outPath, Buffer.from(arr))
  }
}

describe('Custom API client (Google/OpenAI)', () => {
  it('google: run with input image and prompt', async () => {
    if (!globalThis.sdpppSDK?.plugins?.photoshop?.pptaskRun) {
      return
    }
    const client = new SDPPPCustomAPI({ apiKey: GOOGLE_API_KEY, baseURL: GOOGLE_BASE_URL, format: 'google' })

    const { widgetableNodes, defaultInput, rawData } = await client.getNodes('gemini-2.5-flash-image-preview')
    expect(Array.isArray(widgetableNodes)).toBe(true)
    expect(defaultInput).toHaveProperty('prompt')
    expect(rawData.format).toBe('google')

    const testOutputDir = join(import.meta.dirname, 'testoutput')
    await mkdir(testOutputDir, { recursive: true })
    const buffer = await readFile(join(import.meta.dirname, 'testoutput/liblib.text2img.test.0.png'))
    const imageDataUrl = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`

    const task = await client.run('gemini-2.5-flash-image-preview', {
      prompt: 'change the man to a girl with mouth mask, light grey hair',
      urls: [imageDataUrl],
    })
    const result = await task.promise as any
    const images = Array.isArray(result) ? result : result?.outputs
    expect(Array.isArray(images)).toBe(true)
    expect(images.length).toBeGreaterThan(0)

    // Persist first image as PNG
    const first = images[0]
    await writeImagePng(first.url, join(testOutputDir, 'customapi.google.result.0.png'))
  })

  it('openai: run with input image and prompt', async () => {
    if (!globalThis.sdpppSDK?.plugins?.photoshop?.pptaskRun) {
      return
    }
    const client = new SDPPPCustomAPI({ apiKey: OPENAI_API_KEY, baseURL: OPENAI_BASE_URL, format: 'openai' })

    const { widgetableNodes, defaultInput, rawData } = await client.getNodes('edits')
    expect(Array.isArray(widgetableNodes)).toBe(true)
    expect(defaultInput).toHaveProperty('prompt')
    expect(rawData.format).toBe('openai')

    const testOutputDir = join(import.meta.dirname, 'testoutput')
    await mkdir(testOutputDir, { recursive: true })
    const buffer = await readFile(join(import.meta.dirname, 'testoutput/liblib.text2img.test.0.png'))
    const imageDataUrl = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`

    const task = await client.run('edits', {
      image: imageDataUrl,
      prompt: 'change the man to a girl with mouth mask, light grey hair',
      model: 'dall-e-2',
    })
    const result = await task.promise as any
    const images = Array.isArray(result) ? result : result?.outputs
    expect(Array.isArray(images)).toBe(true)
    expect(images.length).toBeGreaterThan(0)

    const first = images[0]
    await writeImagePng(first.url, join(testOutputDir, 'customapi.openai.result.0.png'))
  })
})
