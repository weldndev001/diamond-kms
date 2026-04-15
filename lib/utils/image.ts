/**
 * Utility to help with image cropping using canvas
 */

export const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image()
        image.addEventListener('load', () => resolve(image))
        image.addEventListener('error', (error) => reject(error))
        image.setAttribute('crossOrigin', 'anonymous') // needed to avoid cross-origin issues
        image.src = url
    })

export async function getCroppedImg(
    imageSrc: string,
    pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<Blob | null> {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        return null
    }

    // Set maximum dimensions to keep file size small (for base64 DB storage on Vercel)
    let targetWidth = pixelCrop.width
    let targetHeight = pixelCrop.height
    const MAX_WIDTH = 800
    
    if (targetWidth > MAX_WIDTH) {
        const ratio = MAX_WIDTH / targetWidth
        targetWidth = MAX_WIDTH
        targetHeight = Math.round(targetHeight * ratio)
    }

    // set canvas size to match the desired crop size
    canvas.width = targetWidth
    canvas.height = targetHeight

    // draw the cropped image onto the canvas
    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        targetWidth,
        targetHeight
    )

    // as a blob
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob)
        }, 'image/webp', 0.8) // Use webp for efficiency
    })
}
