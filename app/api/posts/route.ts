import { randomUUID } from "crypto";

import prisma from "src/lib/db";
import { apiError, apiSuccess } from "src/lib/api/response";
import { requireActiveAdminSession } from "src/lib/api/requireActiveAdmin";
import { getSessionFromCookies } from "src/lib/auth/session";
import {
  postsListQuerySchema,
  parsePostCursor,
  encodePostCursor,
  createPostFormSchema,
} from "src/lib/posts/schemas";
import {
  POST_MAX_ATTACHMENTS,
  postUploadMaxSizeLabelEs,
} from "src/lib/posts/constants";
import { PostUploadError, savePostUpload } from "src/lib/posts/savePostUpload";

export async function GET(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return apiError("No autenticado", 401);
    }
    const userId = session.userId;

    const account = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { status: true, type: true },
    });
    if (!account || account.status !== "active") {
      return apiError("Cuenta suspendida", 403);
    }

    const url = new URL(req.url);
    const q = Object.fromEntries(url.searchParams.entries());
    const parsed = postsListQuerySchema.safeParse(q);
    if (!parsed.success) {
      return apiError("Parámetros inválidos", 400);
    }
    const { limit, cursor: cursorEncoded, mine } = parsed.data;

    if (mine && account.type !== "admin") {
      return apiError("Prohibido", 403);
    }

    const cursorDecoded =
      cursorEncoded && cursorEncoded.length > 0
        ? parsePostCursor(cursorEncoded)
        : null;
    if (cursorEncoded && cursorEncoded.length > 0 && cursorDecoded === null) {
      return apiError("Cursor inválido", 400);
    }

    const cursorFilter =
      cursorDecoded !== null
        ? {
            OR: [
              { created_at: { lt: cursorDecoded.created_at } },
              {
                AND: [
                  { created_at: cursorDecoded.created_at },
                  { post_id: { gt: cursorDecoded.post_id } },
                ],
              },
            ],
          }
        : null;

    const where =
      mine && account.type === "admin"
        ? cursorFilter
          ? { AND: [{ author_id: userId }, cursorFilter] }
          : { author_id: userId }
        : cursorFilter ?? undefined;

    const take = limit + 1;

    const rows = await prisma.post.findMany({
      where,
      orderBy: [{ created_at: "desc" }, { post_id: "asc" }],
      take,
      select: {
        post_id: true,
        title: true,
        body: true,
        view_count: true,
        share_count: true,
        created_at: true,
        updated_at: true,
        content_edited_at: true,
        author: {
          select: { user_id: true, name: true },
        },
        attachments: {
          select: {
            attachment_id: true,
            url: true,
            mime_type: true,
            original_name: true,
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    let nextCursor: string | null = null;
    if (hasMore && slice.length > 0) {
      const last = slice[slice.length - 1];
      nextCursor = encodePostCursor(last.created_at, last.post_id);
    }

    const posts = slice.map((p) => {
      const was_edited = p.content_edited_at != null;
      return {
        post_id: p.post_id,
        title: p.title,
        body: p.body ?? null,
        view_count: p.view_count,
        share_count: p.share_count,
        created_at: p.created_at.toISOString(),
        updated_at: p.updated_at.toISOString(),
        was_edited,
        author: {
          user_id: p.author.user_id,
          name: p.author.name,
        },
        attachments: p.attachments.map((a) => ({
          attachment_id: a.attachment_id,
          url: a.url,
          mime_type: a.mime_type,
          original_name: a.original_name,
        })),
      };
    });

    return apiSuccess({ posts, nextCursor });
  } catch {
    return apiError("Error al cargar el feed", 500);
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireActiveAdminSession();
    if (!gate.ok) return gate.response;
    const userId = gate.userId;

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return apiError("Cuerpo multipart inválido", 400);
    }

    const titleRaw = formData.get("title");
    const bodyRaw = formData.get("body");

    const bodyForSchema =
      typeof bodyRaw === "string" && bodyRaw.trim().length > 0
        ? bodyRaw
        : undefined;

    const fieldsParsed = createPostFormSchema.safeParse({
      title: typeof titleRaw === "string" ? titleRaw : "",
      body: bodyForSchema,
    });
    if (!fieldsParsed.success) {
      return apiError("Título o cuerpo inválido", 400);
    }
    const title = fieldsParsed.data.title;
    const rawBody = fieldsParsed.data.body;
    const body =
      rawBody !== undefined && rawBody.trim().length > 0
        ? rawBody.trim()
        : null;

    const candidates = formData.getAll("files");
    const files = candidates.filter(
      (f): f is File => f instanceof File && f.size > 0
    );

    if (files.length > POST_MAX_ATTACHMENTS) {
      return apiError(`Máximo ${POST_MAX_ATTACHMENTS} archivos`, 400);
    }

    const postId = randomUUID();

    const attachmentData: {
      url: string;
      mime_type: string;
      original_name: string | null;
    }[] = [];

    if (files.length > 0) {
      try {
        for (let i = 0; i < files.length; i++) {
          attachmentData.push(
            await savePostUpload(files[i], postId, { index: i })
          );
        }
      } catch (e) {
        if (e instanceof PostUploadError) {
          if (e.code === "TOO_LARGE") {
            return apiError(
              `Archivo demasiado grande (máx. ${postUploadMaxSizeLabelEs()})`,
              400
            );
          }
          return apiError(
            `Tipo no permitido: ${e.mime ?? "desconocido"}`,
            400
          );
        }
        throw e;
      }
    }

    await prisma.post.create({
      data: {
        post_id: postId,
        author_id: userId,
        title,
        body,
        ...(attachmentData.length > 0
          ? {
              attachments: {
                create: attachmentData,
              },
            }
          : {}),
      },
      select: { post_id: true },
    });

    return apiSuccess({
      message: "Publicado",
      postId,
    });
  } catch {
    return apiError("Error al crear la publicación", 500);
  }
}
