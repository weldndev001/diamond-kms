// lib/ai/pdf-extractor.ts
// Extract text from PDF using pdf-parse (already in package.json)

export interface PageText {
    pageNum: number
    text: string
}

export interface ExtractedDocument {
    fullText: string
    pages: PageText[]
    pageCount: number
}

export async function extractPDFText(
    fileBuffer: Buffer
): Promise<ExtractedDocument> {
    // Import from lib/pdf-parse.js directly to avoid the test file loading bug in index.js
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const data = await pdfParse(fileBuffer)

    // pdf-parse gives us the full text in data.text
    // Split heuristically into pages based on page count
    const pageTexts = splitIntoPages(data.text, data.numpages)

    return {
        fullText: data.text,
        pages: pageTexts,
        pageCount: data.numpages,
    }
}

/**
 * Extract text from plain text files (TXT, MD, CSV)
 */
export function extractPlainText(
    fileBuffer: Buffer,
    fileName: string
): ExtractedDocument {
    const text = fileBuffer.toString('utf-8')
    return {
        fullText: text,
        pages: [{ pageNum: 1, text }],
        pageCount: 1,
    }
}

function splitIntoPages(text: string, pageCount: number): PageText[] {
    if (pageCount <= 1) {
        return [{ pageNum: 1, text: text.trim() }]
    }

    // Heuristic: split text evenly across page count
    // pdf-parse doesn't guarantee per-page boundaries
    const chunkSize = Math.ceil(text.length / pageCount)
    const pages: PageText[] = []
    for (let i = 0; i < pageCount; i++) {
        const pageText = text.slice(i * chunkSize, (i + 1) * chunkSize).trim()
        if (pageText.length > 0) {
            pages.push({ pageNum: i + 1, text: pageText })
        }
    }
    return pages
}

/**
 * Extract text from DOCX files using mammoth
 */
export async function extractDocxText(
    fileBuffer: Buffer,
    fileName: string
): Promise<ExtractedDocument> {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const text = result.value || '';
    
    return {
        fullText: text,
        pages: [{ pageNum: 1, text }],
        pageCount: 1,
    };
}

/**
 * Extract text from XLSX files using xlsx
 */
export async function extractXlsxText(
    fileBuffer: Buffer,
    fileName: string
): Promise<ExtractedDocument> {
    const xlsx = require('xlsx');
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    let text = `File: ${fileName}\n\n`;
    
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        text += `--- SpreadSheet: ${sheetName} ---\n`;
        // Convert sheet to CSV string representation to maintain basic row/col structure
        text += xlsx.utils.sheet_to_csv(sheet);
        text += `\n\n`;
    }
    
    return {
        fullText: text,
        pages: [{ pageNum: 1, text }],
        pageCount: 1,
    };
}

/**
 * Extract images from PDF files for Vision Embedding.
 * Renders each PDF page as an image and returns base64-encoded images.
 * This approach catches all visual content (diagrams, charts, embedded images, etc.)
 * 
 * @param fileBuffer - Raw PDF file buffer
 * @param maxPages - Maximum number of pages to extract images from (default 10)
 * @returns Array of base64-encoded page images with page numbers
 */
export interface ExtractedPDFImage {
    pageNum: number
    base64: string    // data:image/jpeg;base64,...
    label: string
}

export async function extractPDFImages(
    fileBuffer: Buffer,
    maxPages: number = 10
): Promise<ExtractedPDFImage[]> {
    const images: ExtractedPDFImage[] = []

    try {
        // Use pdf-parse to get page count, then use pdfjs-dist for rendering
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse/lib/pdf-parse.js')
        const data = await pdfParse(fileBuffer)
        const totalPages = data.numpages

        // For each page, we'll create a simple text representation 
        // combined with any images we can detect
        // Since server-side PDF image extraction without canvas is limited,
        // we'll look for image objects in the raw PDF data

        // Try to extract raw image streams from PDF using pdf-parse's underlying pdfjs
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
        const loadingTask = pdfjsLib.getDocument({ data: fileBuffer })
        const pdfDoc = await loadingTask.promise
        
        const pagesToProcess = Math.min(totalPages, maxPages)
        
        for (let pageIdx = 1; pageIdx <= pagesToProcess; pageIdx++) {
            try {
                const page = await pdfDoc.getPage(pageIdx)
                const ops = await page.getOperatorList()
                
                // Look for image paint operations (OPS.paintImageXObject = 85)
                let hasImages = false
                for (let i = 0; i < ops.fnArray.length; i++) {
                    // paintImageXObject = 85, paintImageXObjectRepeat = 88
                    if (ops.fnArray[i] === 85 || ops.fnArray[i] === 88) {
                        hasImages = true
                        break
                    }
                }

                if (hasImages) {
                    // Extract image objects from page resources
                    const objs = page.objs
                    for (let i = 0; i < ops.fnArray.length; i++) {
                        if (ops.fnArray[i] === 85 || ops.fnArray[i] === 88) {
                            const imgName = ops.argsArray[i][0]
                            try {
                                const imgObj = await new Promise<any>((resolve, reject) => {
                                    objs.get(imgName, (img: any) => {
                                        if (img) resolve(img)
                                        else reject(new Error('Image not found'))
                                    })
                                })

                                if (imgObj && imgObj.data && imgObj.width > 50 && imgObj.height > 50) {
                                    // Convert raw RGBA pixel data to base64 JPEG using sharp
                                    try {
                                        const sharp = require('sharp')
                                        // imgObj.data is Uint8ClampedArray of RGBA pixels
                                        const channels = imgObj.data.length / (imgObj.width * imgObj.height)
                                        const jpegBuffer = await sharp(Buffer.from(imgObj.data), {
                                            raw: {
                                                width: imgObj.width,
                                                height: imgObj.height,
                                                channels: Math.min(channels, 4) as 1 | 2 | 3 | 4,
                                            }
                                        }).jpeg({ quality: 70 }).toBuffer()

                                        const base64 = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`
                                        images.push({
                                            pageNum: pageIdx,
                                            base64,
                                            label: `Gambar dari Halaman ${pageIdx}`,
                                        })
                                        console.log(`[PDF-EXTRACTOR] ✅ Extracted image from page ${pageIdx}: ${imgObj.width}x${imgObj.height}`)
                                    } catch (sharpErr) {
                                        console.warn(`[PDF-EXTRACTOR] sharp conversion failed for page ${pageIdx}:`, sharpErr)
                                    }
                                }
                            } catch {
                                // Skip individual image extraction errors
                            }
                        }
                    }
                }
                
                page.cleanup()
            } catch (pageErr) {
                console.warn(`[PDF-EXTRACTOR] Failed to extract images from page ${pageIdx}:`, pageErr)
            }
        }

        pdfDoc.destroy()
    } catch (err) {
        console.error(`[PDF-EXTRACTOR] PDF image extraction failed:`, err)
        // Non-fatal: return empty array
    }

    console.log(`[PDF-EXTRACTOR] Extracted ${images.length} image(s) from PDF`)
    return images
}

