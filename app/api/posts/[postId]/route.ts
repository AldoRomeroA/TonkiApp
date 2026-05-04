import { rm, unlink } from "fs/promises";
import path from "path";

import { z } from "zod";

import prisma from "src/lib/db";
import { apiError, apiSuccess } from "src/lib/api/response";
import { requireActiveAdminSession } from "src/lib/api/requireActiveAdmin";
import { getSessionFromCookies } from "src/lib/auth/session";
import { PostUploadError, savePostUpload } from "src/lib/posts/savePostUpload";
import { resolveSafePostAttachmentPath } from "src/lib/posts/resolveSafePostAttachmentPath";
import {
  POST_MAX_ATTACHMENTS,
  postUploadMaxSizeLabelEs,
} from "src/lib/posts/constants";
import { updatePostFormFieldsSchema } from "src/lib/posts/schemas";

const postIdParamSchema = z.string().uuid();

const removedIdsSchema = z.array(z.string().uuid()).max(20);

export async function GET(
  _req: Request,
  context: { params: Promise<{ postId: string }> }
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return apiError("No autenticado", 401);

    const account = await prisma.user.findUnique({
      where: { user_id: session.userId },
      select: { status: true },
    });
    if (!account || account.status !== "active") {
      return apiError("Cuenta suspendida", 403);
    }

    const { postId } = await context.params;
    const pid = postIdParamSchema.safeParse(postId);
    if (!pid.success) {
      return apiError("Post inválido", 400);
    }

    const post = await prisma.post.findUnique({
      where: { post_id: pid.data },
      select: {
        post_id: true,
        title: true,
        body: true,
        view_count: true,
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
    if (!post) return apiError("Publicación no encontrada", 404);

    return apiSuccess({
      post: {
        post_id: post.post_id,
        title: post.title,
        body: post.body ?? null,
        view_count: post.view_count,
        created_at: post.created_at.toISOString(),
        updated_at: post.updated_at.toISOString(),
        was_edited: post.content_edited_at != null,
        author: {
          user_id: post.author.user_id,
          name: post.author.name,
        },
        attachments: post.attachments.map((a) => ({
          attachment_id: a.attachment_id,
          url: a.url,
          mime_type: a.mime_type,
          original_name: a.original_name,
        })),
      },
    });
  } catch {
    return apiError("Error al cargar la publicación", 500);
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ postId: string }> }
) {
  try {
    const gate = await requireActiveAdminSession();
    if (!gate.ok) return gate.response;
    const userId = gate.userId;

    const { postId } = await context.params;
    const pid = postIdParamSchema.safeParse(postId);
    if (!pid.success) {
      return apiError("Post inválido", 400);
    }

    const existingPost = await prisma.post.findUnique({
      where: { post_id: pid.data },
      select: {
        author_id: true,
        title: true,
        body: true,
        content_edited_at: true,
        updated_at: true,
      },
    });
    if (!existingPost) {
      return apiError("Publicación no encontrada", 404);
    }
    if (existingPost.author_id !== userId) {
      return apiError("Prohibido", 403);
    }

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

    const fieldsParsed = updatePostFormFieldsSchema.safeParse({
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

    let removedAttachmentIds: string[] = [];
    const removedRaw = formData.get("removedAttachmentIds");
    if (typeof removedRaw === "string" && removedRaw.trim()) {
      try {
        const parsedJson: unknown = JSON.parse(removedRaw);
        const arr = removedIdsSchema.safeParse(parsedJson);
        if (!arr.success) {
          return apiError("removedAttachmentIds inválido", 400);
        }
        removedAttachmentIds = arr.data;
      } catch {
        return apiError("removedAttachmentIds inválido", 400);
      }
    }

    const candidates = formData.getAll("files");
    const newFiles = candidates.filter(
      (f): f is File => f instanceof File && f.size > 0
    );

    const uniqueRemovedIds = [...new Set(removedAttachmentIds)];
    const attachmentMutation =
      uniqueRemovedIds.length > 0 || newFiles.length > 0;
    const sameText =
      existingPost.title === title &&
      (existingPost.body ?? null) === body;

    if (!attachmentMutation) {
      if (sameText) {
        return apiSuccess({
          message: "Sin cambios",
          post_id: pid.data,
          updated_at: existingPost.updated_at.toISOString(),
          was_edited: existingPost.content_edited_at != null,
        });
      }
      const row = await prisma.post.update({
        where: { post_id: pid.data },
        data: {
          title,
          body,
          ...(existingPost.content_edited_at == null
            ? { content_edited_at: new Date() }
            : {}),
        },
        select: { updated_at: true, content_edited_at: true },
      });
      return apiSuccess({
        message: "Actualizado",
        post_id: pid.data,
        updated_at: row.updated_at.toISOString(),
        was_edited: row.content_edited_at != null,
      });
    }


    if (uniqueRemovedIds.length > 0) {
      const removable = await prisma.postAttachment.findMany({
        where: {
          post_id: pid.data,
          attachment_id: { in: uniqueRemovedIds },
        },
      });
      if (removable.length !== uniqueRemovedIds.length) {
        return apiError("Adjunto que no pertenece a esta publicación", 400);
      }

      for (const a of removable) {
        const fsPath = resolveSafePostAttachmentPath(a.url, pid.data);
        if (!fsPath) continue;
        try {
          await unlink(fsPath);
        } catch {
          /* archivo ausente en disco: no abortar el PATCH por ello */
        }
      }

      await prisma.postAttachment.deleteMany({
        where: {
          post_id: pid.data,
          attachment_id: { in: uniqueRemovedIds },
        },
      });
    }

    const remaining = await prisma.postAttachment.count({
      where: { post_id: pid.data },
    });

    if (remaining + newFiles.length > POST_MAX_ATTACHMENTS) {
      return apiError(`Máximo ${POST_MAX_ATTACHMENTS} archivos`, 400);
    }

    if (newFiles.length > 0) {
      try {
        const savedRows: {
          url: string;
          mime_type: string;
          original_name: string | null;
        }[] = [];
        for (let i = 0; i < newFiles.length; i++) {
          savedRows.push(
            await savePostUpload(newFiles[i], pid.data, {
              index: remaining + i,
            })
          );
        }
        await prisma.postAttachment.createMany({
          data: savedRows.map((s) => ({
            post_id: pid.data,
            url: s.url,
            mime_type: s.mime_type,
            original_name: s.original_name,
          })),
        });
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

    const row = await prisma.post.update({
      where: { post_id: pid.data },
      data: {
        title,
        body,
        ...(existingPost.content_edited_at == null
          ? { content_edited_at: new Date() }
          : {}),
      },
      select: { updated_at: true, content_edited_at: true },
    });

    return apiSuccess({
      message: "Actualizado",
      post_id: pid.data,
      updated_at: row.updated_at.toISOString(),
      was_edited: row.content_edited_at != null,
    });
  } catch {
    return apiError("Error al actualizar la publicación", 500);
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ postId: string }> }
) {
  try {
    const gate = await requireActiveAdminSession();
    if (!gate.ok) return gate.response;
    const userId = gate.userId;

    const { postId } = await context.params;
    const pid = postIdParamSchema.safeParse(postId);
    if (!pid.success) {
      return apiError("Post inválido", 400);
    }

    const existingPost = await prisma.post.findUnique({
      where: { post_id: pid.data },
      select: { author_id: true },
    });
    if (!existingPost) {
      return apiError("Publicación no encontrada", 404);
    }
    if (existingPost.author_id !== userId) {
      return apiError("Prohibido", 403);
    }

    const postDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "posts",
      pid.data
    );
    await rm(postDir, { recursive: true, force: true }).catch(() => {});

    await prisma.post.delete({
      where: { post_id: pid.data },
    });

    return apiSuccess({
      message: "Eliminado",
      post_id: pid.data,
    });
  } catch {
    return apiError("Error al eliminar la publicación", 500);
  }
}
