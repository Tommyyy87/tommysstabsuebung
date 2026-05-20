import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const sourcePath = resolve(root, '..', 'XML Export - karteikarten', 'karteikarten.xml');
const outputPath = resolve(root, 'src', 'data', 'cards.json');
const mediaOutput = resolve(root, 'public', 'cards-media');

const xml = readFileSync(sourcePath, 'utf8');

const decodeEntities = (value) =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const fixMojibake = (value) => {
  if (!/[ÃÂ]/.test(value)) return value;
  try {
    return Buffer.from(value, 'latin1').toString('utf8');
  } catch {
    return value;
  }
};

const toPlainText = (html) => {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  return fixMojibake(
    decodeEntities(
      body
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+\n/g, '\n')
        .replace(/\n\s+/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim(),
    ),
  );
};

const extractImages = (html) =>
  [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)].map(([, src]) => ({
    src,
    alt: fixMojibake(src.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')),
  }));

const cardBlocks = [...xml.matchAll(/<Multiplechoicefilecard\b[^>]*orderID="(\d+)"[^>]*>([\s\S]*?)<\/Multiplechoicefilecard>/g)];

const cards = cardBlocks.map(([, orderId, block], index) => {
  const questionHtml = block.match(/<Question><!\[CDATA\[([\s\S]*?)\]\]><\/Question>/)?.[1] ?? '';
  const media = extractImages(questionHtml);
  const answerBlocks = [...block.matchAll(/<MCAnswer\b[^>]*correct="(true|false)"[^>]*>([\s\S]*?)<\/MCAnswer>/g)];
  const answers = answerBlocks.map(([, correct, answerBlock], answerIndex) => {
    const answerHtml = answerBlock.match(/<Answer><!\[CDATA\[([\s\S]*?)\]\]><\/Answer>/)?.[1] ?? '';
    const explanationHtml = answerBlock.match(/<Explanation><!\[CDATA\[([\s\S]*?)\]\]><\/Explanation>/)?.[1] ?? '';
    return {
      id: `${index + 1}-${answerIndex + 1}`,
      text: toPlainText(answerHtml),
      correct: correct === 'true',
      explanation: toPlainText(explanationHtml),
    };
  });

  return {
    id: `karte-${String(index + 1).padStart(2, '0')}`,
    orderId: Number(orderId),
    question: toPlainText(questionHtml),
    media,
    answers,
    correctCount: answers.filter((answer) => answer.correct).length,
  };
});

mkdirSync(mediaOutput, { recursive: true });
const copied = new Set();
cards.flatMap((card) => card.media).forEach((item) => {
  if (copied.has(item.src)) return;
  copied.add(item.src);
  copyFileSync(resolve(dirname(sourcePath), item.src), resolve(mediaOutput, item.src));
});

writeFileSync(outputPath, `${JSON.stringify(cards, null, 2)}\n`, 'utf8');
console.log(`Imported ${cards.length} cards and ${copied.size} media files to ${outputPath}`);
