import { HistoricalPostReference } from './historical-post.types';

export function rankHistoricalPosts(
  sourceText: string,
  posts: Array<{
    id: string;
    text: string;
    platform: HistoricalPostReference['platform'];
  }>,
  limit: number,
): HistoricalPostReference[] {
  const sourceTerms = terms(sourceText);
  if (sourceTerms.size === 0) return [];
  return posts
    .map((post) => ({ ...post, score: jaccard(sourceTerms, terms(post.text)) }))
    .filter((post) => post.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.id.localeCompare(right.id),
    )
    .slice(0, limit);
}

function terms(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase('es-MX')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .match(/[\p{L}\p{N}]{3,}/gu) ?? [],
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  const intersection = [...left].filter((term) => right.has(term)).length;
  return intersection / new Set([...left, ...right]).size;
}
