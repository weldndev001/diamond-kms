// lib/ai/image-extractor.ts
// Utility to extract and analyze images from HTML content using AI Vision
import type { AIService } from './types'

export interface ExtractedImage {
    src: string       // Base64 data URL
    alt: string       // Alt text from HTML
    index: number     // Position index
    source: 'header' | 'body'
}

/**
 * Extract all base64 images from HTML body content.
 * Matches <img src="data:image/...;base64,..."> patterns from Tiptap editor.
 */
export function extractImagesFromHtml(html: string): ExtractedImage[] {
    const images: ExtractedImage[] = []
    // Match img tags with base64 src — handles both single and double quotes
    const imgRegex = /<img[^>]+src=["'](data:image\/[^"']+)["'][^>]*>/gi
    const altRegex = /alt=["']([^"']*)["']/i

    let match
    let index = 0
    while ((match = imgRegex.exec(html)) !== null) {
        const src = match[1]
        const altMatch = match[0].match(altRegex)
        const alt = altMatch?.[1] || ''

        images.push({
            src,
            alt,
            index: index++,
            source: 'body',
        })
    }

    return images
}

/**
 * Analyze all images in a content article using AI Vision/Multimodal.
 * Returns a combined text description of all images that can be appended to article text
 * before chunking and embedding.
 * 
 * @param ai - AI service instance (must support describeImage)
 * @param headerImage - Base64 header image (from content.image_url), or null
 * @param bodyHtml - HTML body of the content article
 * @param articleTitle - Title of the article (for context)
 * @returns Combined text descriptions of all images
 */
export async function analyzeContentImages(
    ai: AIService,
    headerImage: string | null,
    bodyHtml: string,
    articleTitle: string
): Promise<string> {
    if (!ai.describeImage) {
        console.log(`[IMAGE-EXTRACTOR] AI provider does not support image analysis, skipping.`)
        return ''
    }

    // Collect all images to analyze
    const allImages: ExtractedImage[] = []

    // 1. Header image
    if (headerImage && headerImage.startsWith('data:image')) {
        allImages.push({
            src: headerImage,
            alt: 'Header image',
            index: 0,
            source: 'header',
        })
    }

    // 2. Body images (base64 embedded in Tiptap HTML)
    const bodyImages = extractImagesFromHtml(bodyHtml)
    allImages.push(...bodyImages)

    if (allImages.length === 0) {
        console.log(`[IMAGE-EXTRACTOR] No images found in article "${articleTitle}"`)
        return ''
    }

    console.log(`[IMAGE-EXTRACTOR] Found ${allImages.length} image(s) to analyze in "${articleTitle}"`)

    // Limit to max 5 images to avoid excessive processing time & token usage
    const imagesToProcess = allImages.slice(0, 5)
    if (allImages.length > 5) {
        console.log(`[IMAGE-EXTRACTOR] Limiting analysis to first 5 of ${allImages.length} images`)
    }

    // Process images with concurrency limit of 2
    const pLimit = (await import('p-limit')).default
    const limit = pLimit(2)

    const descriptions: string[] = []

    await Promise.all(
        imagesToProcess.map((img, i) =>
            limit(async () => {
                try {
                    const label = img.source === 'header'
                        ? 'Gambar Header Artikel'
                        : `Gambar ${img.index + 1} di Body Artikel`

                    console.log(`[IMAGE-EXTRACTOR] Analyzing ${label}...`)

                    const description = await ai.describeImage!(img.src, articleTitle)

                    if (description && description.trim().length > 10) {
                        descriptions[i] = `[${label}]: ${description.trim()}`
                        console.log(`[IMAGE-EXTRACTOR] ✅ ${label} analyzed (${description.length} chars)`)
                    } else {
                        console.log(`[IMAGE-EXTRACTOR] ⚠️ ${label} returned empty/short description, skipping.`)
                    }
                } catch (err) {
                    console.error(`[IMAGE-EXTRACTOR] ❌ Failed to analyze image ${i}:`, err)
                    // Non-fatal: skip this image and continue
                }
            })
        )
    )

    // Filter out undefined entries and join
    const validDescriptions = descriptions.filter(Boolean)

    if (validDescriptions.length === 0) {
        console.log(`[IMAGE-EXTRACTOR] No valid descriptions generated for "${articleTitle}"`)
        return ''
    }

    console.log(`[IMAGE-EXTRACTOR] ✅ Generated ${validDescriptions.length} image description(s) for "${articleTitle}"`)
    return validDescriptions.join('\n\n')
}
