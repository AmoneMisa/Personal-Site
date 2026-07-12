// Extract plain text from an uploaded CV file, entirely in the browser.
// .txt/.md are read directly. .pdf and .docx use libraries loaded on demand;
// if they aren't installed, we throw a friendly error and the user can paste text.

export async function extractCvText(file: File): Promise<string> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) {
    return file.text()
  }

  if (name.endsWith('.pdf')) {
    return extractPdf(file)
  }

  if (name.endsWith('.docx')) {
    return extractDocx(file)
  }

  throw new Error('Unsupported file. Upload .pdf, .docx or .txt, or paste your CV text.')
}

async function extractPdf(file: File): Promise<string> {
  let pdfjs: any
  try {
    pdfjs = await import('pdfjs-dist')
    // Use the bundled worker (Vite resolves the ?url import).
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  } catch {
    throw new Error('PDF support needs "pdfjs-dist". Install it, or paste your CV text instead.')
  }

  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  let text = ''
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    text += content.items.map((i: any) => i.str).join(' ') + '\n'
  }
  return text
}

async function extractDocx(file: File): Promise<string> {
  let mammoth: any
  try {
    mammoth = await import('mammoth')
  } catch {
    throw new Error('DOCX support needs "mammoth". Install it, or paste your CV text instead.')
  }
  const buf = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buf })
  return result.value || ''
}
