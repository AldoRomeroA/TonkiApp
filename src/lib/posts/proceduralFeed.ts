import type { FeedPost } from "./feedTypes";

export const PROCEDURAL_BATCH_SIZE = 16;
export const PROCEDURAL_LOAD_DELAY_MS = 520;

export type FeedPostItem = FeedPost & {
  feedKey: string;
};

const DEMO_AUTHOR = { user_id: "tonki-demo", name: "Tonki" };

/** Posts usados cuando el feed real está vacío; se repiten al hacer scroll. */
export const PROCEDURAL_PLACEHOLDER_POSTS: FeedPost[] = [
  {
    post_id: "placeholder-tonki-1",
    title: "Bienvenido al feed de Tonki",
    body: "Cuando haya publicaciones reales, aparecerán aquí. Mientras tanto, desplázate para explorar más contenido de ejemplo.",
    view_count: 128,
    created_at: "2026-01-15T12:00:00.000Z",
    updated_at: "2026-01-15T12:00:00.000Z",
    was_edited: false,
    author: DEMO_AUTHOR,
    attachments: [],
  },
  {
    post_id: "placeholder-tonki-2",
    title: "Recompensas para negocios locales",
    body: "Tus clientes acumulan puntos y tú ves el impacto en ventas. Publica novedades, promos y avisos para tu comunidad.",
    view_count: 84,
    created_at: "2026-01-14T09:30:00.000Z",
    updated_at: "2026-01-14T09:30:00.000Z",
    was_edited: false,
    author: DEMO_AUTHOR,
    attachments: [],
  },
  {
    post_id: "placeholder-tonki-3",
    title: "¿Listo para publicar?",
    body: "Los administradores pueden crear posts desde el compositor de arriba. El feed seguirá cargando más contenido al llegar al final.",
    view_count: 42,
    created_at: "2026-01-13T18:45:00.000Z",
    updated_at: "2026-01-13T18:45:00.000Z",
    was_edited: false,
    author: DEMO_AUTHOR,
    attachments: [],
  },
];

export function resolveFeedSource(posts: FeedPost[]): FeedPost[] {
  return posts.length > 0 ? posts : PROCEDURAL_PLACEHOLDER_POSTS;
}

export function toFeedItems(posts: FeedPost[], keyPrefix: string): FeedPostItem[] {
  return posts.map((post, index) => ({
    ...post,
    feedKey: `${keyPrefix}:${post.post_id}:${index}`,
  }));
}

export function appendProceduralBatch(
  source: FeedPost[],
  batchIndex: number,
  batchSize = PROCEDURAL_BATCH_SIZE
): FeedPostItem[] {
  const pool = resolveFeedSource(source);
  const offset = batchIndex * batchSize;
  const items: FeedPostItem[] = [];

  for (let i = 0; i < batchSize; i++) {
    const post = pool[(offset + i) % pool.length]!;
    items.push({
      ...post,
      feedKey: `proc:${batchIndex}:${i}:${post.post_id}`,
    });
  }

  return items;
}

export function isProceduralPostId(postId: string): boolean {
  return postId.startsWith("placeholder-");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
