#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { PDFDocument } = require('pdf-lib');

const MAX_PDF_BYTES = 250 * 1024 * 1024;
const MAX_PAGES = 5000;
const PAGE_WIDTH = 4;

function usage() {
  return [
    'Usage:',
    '  node scripts/convert.js extract <input.pdf> <output-dir>',
    '  node scripts/convert.js markdown <output-dir> [--title <title>] [--source-language <language>]',
  ].join('\n');
}

function pageName(pageNumber) {
  return `page-${String(pageNumber).padStart(PAGE_WIDTH, '0')}`;
}

function parseOptions(args, allowed) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (!allowed.includes(option)) {
      throw new Error(`Unknown option: ${option}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Option ${option} requires a value.`);
    }
    options[option] = value;
    index += 1;
  }
  return options;
}

async function loadPdfJs() {
  try {
    return await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND') {
      throw new Error('Dependencies are missing. Run: npm install', { cause: error });
    }
    throw error;
  }
}

async function extractPdf(inputPath, outputPath) {
  const absoluteInput = path.resolve(inputPath);
  const absoluteOutput = path.resolve(outputPath);
  const inputStat = await fs.stat(absoluteInput).catch((error) => {
    if (error.code === 'ENOENT') {
      throw new Error(`Input PDF not found: ${absoluteInput}`);
    }
    throw error;
  });
  if (!inputStat.isFile()) {
    throw new Error(`Input is not a file: ${absoluteInput}`);
  }
  if (inputStat.size === 0 || inputStat.size > MAX_PDF_BYTES) {
    throw new Error(`PDF size must be between 1 byte and ${MAX_PDF_BYTES} bytes.`);
  }

  const bytes = await fs.readFile(absoluteInput);
  const pdfjs = await loadPdfJs();
  let loadingTask;
  let sourcePdf;
  try {
    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
      isEvalSupported: false,
    });
    const parsedPdf = await loadingTask.promise;
    if (parsedPdf.numPages > MAX_PAGES) {
      throw new Error(`PDF has ${parsedPdf.numPages} pages; the maximum supported is ${MAX_PAGES}.`);
    }
    sourcePdf = await PDFDocument.load(bytes, { updateMetadata: false });
    await fs.mkdir(absoluteOutput, { recursive: true });

    for (let pageNumber = 1; pageNumber <= parsedPdf.numPages; pageNumber += 1) {
      const name = pageName(pageNumber);
      const pageDirectory = path.join(absoluteOutput, 'original_pages', name);
      await fs.mkdir(pageDirectory, { recursive: true });

      const sourcePage = await parsedPdf.getPage(pageNumber);
      const textContent = await sourcePage.getTextContent();
      let text = '';
      for (const item of textContent.items) {
        if (typeof item.str !== 'string' || item.str.length === 0) {
          continue;
        }
        if (text && !text.endsWith('\n')) {
          text += ' ';
        }
        text += item.str;
        if (item.hasEOL) {
          text += '\n';
        }
      }
      text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      await fs.writeFile(path.join(pageDirectory, 'source.txt'), `${text}\n`, 'utf8');

      const outputPdf = await PDFDocument.create();
      const [copiedPage] = await outputPdf.copyPages(sourcePdf, [pageNumber - 1]);
      outputPdf.addPage(copiedPage);
      const pageBytes = await outputPdf.save();
      await fs.writeFile(path.join(pageDirectory, `${name}.pdf`), pageBytes);
      await sourcePage.cleanup();
      console.log(`${name}: ${text ? `${text.length} characters extracted` : 'no selectable text; OCR/visual reading required'}`);
    }

    const draftsDirectory = path.join(absoluteOutput, 'translation_drafts');
    await fs.mkdir(draftsDirectory, { recursive: true });
    const assetsDirectory = path.join(absoluteOutput, '_assets');
    await fs.mkdir(assetsDirectory, { recursive: true });
    await fs.copyFile(
      path.join(__dirname, '..', 'assets', 'uyghur-rtl.css'),
      path.join(assetsDirectory, 'uyghur-rtl.css'),
    );
    console.log(`Extracted ${parsedPdf.numPages} pages to ${absoluteOutput}`);
  } catch (error) {
    if (error.name === 'PasswordException') {
      throw new Error('This PDF is password-protected. Provide an unlocked copy to continue.', { cause: error });
    }
    throw error;
  } finally {
    if (loadingTask) {
      await loadingTask.destroy();
    }
  }
}

function yamlString(value) {
  return JSON.stringify(value);
}

function markdownBody(text) {
  const body = text.replace(/^\uFEFF/, '').trim();
  if (!body) {
    throw new Error('Translation draft is empty.');
  }
  if (/^---(?:\r?\n|$)/.test(body)) {
    throw new Error('Do not add YAML frontmatter to translation drafts; it is generated automatically.');
  }
  return body;
}

async function packageMarkdown(outputPath, options) {
  const absoluteOutput = path.resolve(outputPath);
  const originalsPath = path.join(absoluteOutput, 'original_pages');
  const entries = await fs.readdir(originalsPath, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') {
      throw new Error(`Original page folders not found: ${originalsPath}. Run the extract command first.`);
    }
    throw error;
  });
  const pages = entries
    .filter((entry) => entry.isDirectory() && /^page-\d{4,}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => Number(left.slice(5)) - Number(right.slice(5)));
  if (pages.length === 0) {
    throw new Error('No extracted page folders were found.');
  }

  const draftDirectory = path.join(absoluteOutput, 'translation_drafts');
  const translatedDirectory = path.join(absoluteOutput, 'translated_pages');
  await fs.mkdir(translatedDirectory, { recursive: true });
  const missing = [];
  const translatedPages = [];

  for (const page of pages) {
    const draftPath = path.join(draftDirectory, `${page}.md`);
    const draft = await fs.readFile(draftPath, 'utf8').catch((error) => {
      if (error.code === 'ENOENT') {
        missing.push(page);
        return null;
      }
      throw error;
    });
    if (draft === null) {
      continue;
    }

    const pageNumber = Number(page.slice(5));
    translatedPages.push({ page, pageNumber, body: markdownBody(draft) });
  }

  if (missing.length > 0) {
    throw new Error(`Missing translation drafts for: ${missing.join(', ')}. No output was written.`);
  }

  for (const { page, pageNumber, body } of translatedPages) {
    const frontmatter = [
      '---',
      `title: ${yamlString(`${options.title} — ${pageNumber}-بەت`)}`,
      `page: ${pageNumber}`,
      `source_language: ${yamlString(options.sourceLanguage)}`,
      'target_language: "ug"',
      'cssclasses:',
      '  - uyghur-rtl',
      '---',
      '',
    ].join('\n');
    await fs.mkdir(path.join(translatedDirectory, page), { recursive: true });
    await fs.writeFile(
      path.join(translatedDirectory, page, `${page}.md`),
      `${frontmatter}${body}\n`,
      'utf8',
    );
  }

  console.log(`Created ${pages.length} Obsidian Markdown pages in ${translatedDirectory}`);
}

async function main(args) {
  const [command, ...rest] = args;
  if (command === 'extract') {
    if (rest.length !== 2) {
      throw new Error(usage());
    }
    await extractPdf(rest[0], rest[1]);
    return;
  }
  if (command === 'markdown') {
    if (rest.length < 1) {
      throw new Error(usage());
    }
    const outputPath = rest[0];
    const options = parseOptions(rest.slice(1), ['--title', '--source-language']);
    await packageMarkdown(outputPath, {
      title: options['--title'] || 'PDF تەرجىمىسى',
      sourceLanguage: options['--source-language'] || 'نامەلۇم',
    });
    return;
  }
  throw new Error(usage());
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main, markdownBody, pageName };
