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
