import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import mammoth from 'mammoth';

const globals = globalThis as unknown as { DOMParser: unknown; XMLSerializer: unknown };
globals.DOMParser = DOMParser;
globals.XMLSerializer = XMLSerializer;

const { buildDocumentDocx, patchOriginalDocx } = await import('./src/lib/exportDocx');
const { readCleanLayout } = await import('./src/lib/docxLayout');
const { applyDecisionsAndInsertions } = await import('./src/lib/resumeModel');

const run = promisify(execFile);
const SOFFICE = '/opt/homebrew/bin/soffice';
const OUT_DIR = '.tmp-scale-check';

type PdfMetrics = { pages: number; lastBaseline: number; pageHeight: number };

const measurePdf = async (pdfPath: string): Promise<PdfMetrics> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await readFile(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let lastBaseline = 0;
  let pageHeight = 0;
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    pageHeight = page.view[3];
    const textContent = await page.getTextContent();
    const baselines = textContent.items
      .filter((item): item is { str: string; transform: number[] } => 'transform' in item)
      .filter((item) => item.str.trim().length > 0)
      .map((item) => pageHeight - item.transform[5]);
    if (baselines.length > 0) lastBaseline = Math.max(...baselines);
  }
  return { pages: doc.numPages, lastBaseline, pageHeight };
};

const toPdf = async (docxPath: string): Promise<string> => {
  await run(SOFFICE, [
    '--headless',
    '--norestore',
    '--convert-to',
    'pdf',
    '--outdir',
    OUT_DIR,
    docxPath,
  ]);
  return join(OUT_DIR, `${basename(docxPath).replace(/\.docx$/, '')}.pdf`);
};

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('usage: export-scale-check.tmp.ts <resume.docx>');

await mkdir(OUT_DIR, { recursive: true });

const sourceBytes = await readFile(sourcePath);
const { value: rawText } = await mammoth.extractRawText({ buffer: sourceBytes });
const resumeText = rawText.trim();

const makeFile = () =>
  new File([new Uint8Array(sourceBytes)], basename(sourcePath), {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

let layout = null;
try {
  layout = await readCleanLayout(makeFile(), resumeText);
} catch (error) {
  console.log('layout unavailable:', error);
}

const skillLines = Array.from({ length: 23 }, (_, index) => 14 + index * 2);
const entry = (
  id: string,
  title: string,
  organization: string | null,
  location: string | null,
  dateText: string | null,
  headingLine: number,
  bulletLines: number[],
) => ({
  kind: 'entry' as const,
  id,
  title,
  organization,
  location,
  dates: dateText ? { start: null, end: null, text: dateText } : null,
  headingSourceLines: [headingLine],
  bullets: bulletLines.map((line, index) => ({ id: `${id}.bullet.${index}`, sourceLines: [line] })),
});

const resumeDocument = {
  version: 1,
  header: {
    name: { id: 'h.name', sourceLines: [0] },
    contact: [
      { id: 'h.contact.0', sourceLines: [2] },
      { id: 'h.contact.1', sourceLines: [4] },
    ],
  },
  sections: [
    {
      id: 's.0',
      kind: 'summary',
      heading: { id: 's.0.heading', sourceLines: [6] },
      blocks: [{ kind: 'paragraph' as const, id: 's.0.b.0', sourceLines: [8] }],
    },
    {
      id: 's.1',
      kind: 'skills',
      heading: { id: 's.1.heading', sourceLines: [12] },
      blocks: skillLines.map((line, index) => ({
        kind: 'skillsGroup' as const,
        id: `s.1.b.${index}`,
        label: null,
        sourceLines: [line],
      })),
    },
    {
      id: 's.2',
      kind: 'experience',
      heading: { id: 's.2.heading', sourceLines: [64] },
      blocks: [
        entry('s.2.b.0', 'Senior Frontend Engineer', 'AutoStore', 'Remote', 'February 2022 – Present', 66, [68, 70, 72, 74, 76, 78]),
        entry('s.2.b.1', 'Frontend Engineer', 'F1V', 'Waltham, MA', 'November 2018 – February 2022', 82, [84, 86, 88, 90, 92]),
        entry('s.2.b.2', 'Web Developer Apprentice', 'General Assembly', 'Boston, MA', 'July 2018 – October 2018', 96, [98]),
      ],
    },
    {
      id: 's.3',
      kind: 'projects',
      heading: { id: 's.3.heading', sourceLines: [102] },
      blocks: [
        entry('s.3.b.0', 'Terminal Zoom', 'VSCode Marketplace', null, null, 104, [106, 108]),
        entry('s.3.b.1', 'TV Minder', 'tv-minder.com', null, null, 112, [114, 116]),
        entry('s.3.b.2', 'Trance Tuner', 'trancetuner.netlify.app', null, null, 120, [122]),
      ],
    },
    {
      id: 's.4',
      kind: 'education',
      heading: { id: 's.4.heading', sourceLines: [126] },
      blocks: [{ kind: 'paragraph' as const, id: 's.4.b.0', sourceLines: [128] }],
    },
  ],
};

const merged = applyDecisionsAndInsertions(resumeText, resumeDocument, [], {}, []);

const scales = [1.15, 1.05, 1, 0.95, 0.9, 0.85, 0.8, 0.75];

console.log('variant           scale  pages  lastBaseline/pageHeight');

const originalPath = join(OUT_DIR, 'original.docx');
await writeFile(originalPath, sourceBytes);
const originalMetrics = await measurePdf(await toPdf(originalPath));
console.log(
  `original           ----   ${originalMetrics.pages}      ${originalMetrics.lastBaseline.toFixed(0)}/${originalMetrics.pageHeight.toFixed(0)}`,
);

for (const scale of scales) {
  const blob = await buildDocumentDocx(resumeDocument, merged.textsByNodeId, layout, scale);
  const path = join(OUT_DIR, `clean-${scale}.docx`);
  await writeFile(path, Buffer.from(await blob.arrayBuffer()));
  const metrics = await measurePdf(await toPdf(path));
  console.log(
    `clean              ${scale.toFixed(2)}   ${metrics.pages}      ${metrics.lastBaseline.toFixed(0)}/${metrics.pageHeight.toFixed(0)}`,
  );
}

for (const scale of scales) {
  const blob = await patchOriginalDocx(makeFile(), [], [], scale);
  const path = join(OUT_DIR, `keep-${scale}.docx`);
  await writeFile(path, Buffer.from(await blob.arrayBuffer()));
  const metrics = await measurePdf(await toPdf(path));
  console.log(
    `keep-formatting    ${scale.toFixed(2)}   ${metrics.pages}      ${metrics.lastBaseline.toFixed(0)}/${metrics.pageHeight.toFixed(0)}`,
  );
}
