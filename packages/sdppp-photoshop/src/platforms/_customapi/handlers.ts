import { t } from '@sdppp/common'
import { GeminiImageGenerator } from './client'

export interface ImageRunResult {
  success: boolean
  imageUrl?: string
  apiTime?: number
  error?: string
}

export async function runGoogleGemini(generator: GeminiImageGenerator, imageBuffer: Buffer, prompt: string): Promise<ImageRunResult> {
  return await generator.generateSingleImage(imageBuffer, prompt)
}

export async function runOpenAIEditHttp(apiKey: string, baseURL: string, imageBuffer: Buffer, prompt: string, model?: string): Promise<ImageRunResult> {
  const apiStartTime = Date.now()
  try {
    const base = baseURL.replace(/\/$/, '')
    const url = `${base}/images/edits`
    const form = new FormData()
    const blob = new Blob([imageBuffer], { type: 'image/png' })
    form.append('image', blob, 'image.png')
    form.append('prompt', prompt)
    form.append('model', model || 'gpt-image-1')
    form.append('n', '1')
    form.append('size', '1024x1024')
    // response_format is not supported by some endpoints/versions; rely on default

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: form
    })
    if (!res.ok) {
      const text = await res.text()
      return { success: false, apiTime: Date.now() - apiStartTime, error: `HTTP ${res.status}: ${text}` }
    }
    const json: any = await res.json()
    const apiTime = Date.now() - apiStartTime
    const item = json?.data?.[0]
    let imageUrl: string | undefined
    if (item?.url) {
      imageUrl = item.url
    } else if (item?.b64_json) {
      imageUrl = `data:image/png;base64,${item.b64_json}`
    }
    if (imageUrl) {
      return { success: true, imageUrl, apiTime }
    }
    return {
      success: false,
      apiTime,
      error: t('customapi.error.no_image_returned', { defaultValue: 'No image returned' })
    }
  } catch (error: any) {
    const apiTime = Date.now() - apiStartTime
    return {
      success: false,
      apiTime,
      error:
        error?.message ||
        t('customapi.error.openai_api', { defaultValue: 'OpenAI API error' })
    }
  }
}
