import { randomUUID } from "node:crypto";
import { basename, extname } from "node:path";
import { tmpdir } from "node:os";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import {
  CreateYoutubeTranscriptBody,
  CreateYoutubeTranscriptResponse,
  DeleteProjectParams,
  GetProjectParams,
  GetProjectResponse,
  GetProjectSummaryResponse,
  ListProjectsResponse,
  ProjectSummaryResult,
  SummarizeProjectParams,
  SummarizeProjectResponse,
  TranscribeUploadResponse,
  TranslateProjectBody,
  TranslateProjectParams,
  TranslateProjectResponse,
  UpdateTranscriptBody,
  UpdateTranscriptParams,
  UpdateTranscriptResponse,
} from "@workspace/api-zod";
import {
  db,
  projectsTable,
  type Project as DbProject,
  type StoredTranscriptSegment,
  type StoredTranslation,
} from "@workspace/db";
import {
  summarizeTranscript,
  supportedLanguage,
  toStoredTranslation,
  transcribeVideoFile,
  transcribeYoutubeCaptions,
  translateSegments,
} from "../lib/transcription";
import { logger } from "../lib/logger";
import { rm } from "node:fs/promises";

const router: IRouter = Router();
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  ".aac",
  ".avi",
  ".flac",
  ".m4a",
  ".mkv",
  ".mov",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".oga",
  ".ogg",
  ".opus",
  ".wav",
  ".webm",
  ".wmv",
]);
const upload = multer({
  dest: tmpdir(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

function getOwnerId(res: Response): string {
  return res.locals.ownerId as string;
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}

function projectResponse(project: DbProject) {
  const translations = (project.translations ?? []).map((translation) => ({
    ...translation,
    createdAt: new Date(translation.createdAt).toISOString(),
  }));
  return {
    id: project.id,
    title: project.title,
    sourceType: project.sourceType,
    sourceName: project.sourceName,
    sourceUrl: project.sourceUrl,
    status: project.status,
    language: project.language,
    durationSeconds: project.durationSeconds,
    transcript: project.transcript,
    segments: project.segments,
    summary: project.summary,
    wordCount: project.wordCount,
    translations,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

async function findProject(
  projectId: string,
  ownerId: string,
): Promise<DbProject | undefined> {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  if (!project || project.ownerId !== ownerId) return undefined;
  return project;
}

function invalid(
  req: Request,
  res: Response,
  error: { message: string },
): void {
  req.log.warn({ errors: error.message }, "Invalid request");
  res.status(400).json({ error: error.message });
}

function projectTitle(fileName: string): string {
  const base = basename(fileName, extname(fileName))
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 160);
  return base || "Untitled transcription";
}

router.get("/projects", async (_req, res): Promise<void> => {
  const projects = await db
    .select({
      id: projectsTable.id,
      title: projectsTable.title,
      sourceType: projectsTable.sourceType,
      sourceName: projectsTable.sourceName,
      language: projectsTable.language,
      wordCount: projectsTable.wordCount,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .where(eq(projectsTable.ownerId, getOwnerId(res)))
    .orderBy(desc(projectsTable.updatedAt))
    .limit(100);
  res.json(
    ListProjectsResponse.parse(
      projects.map((project) => ({
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      })),
    ),
  );
});

router.get("/projects/summary", async (_req, res): Promise<void> => {
  const projects = await db
    .select({
      wordCount: projectsTable.wordCount,
      translations: projectsTable.translations,
    })
    .from(projectsTable)
    .where(eq(projectsTable.ownerId, getOwnerId(res)));
  const summary = {
    projectCount: projects.length,
    wordCount: projects.reduce((total, project) => total + project.wordCount, 0),
    translatedCount: projects.reduce(
      (total, project) => total + project.translations.length,
      0,
    ),
  };
  res.json(GetProjectSummaryResponse.parse(summary));
});

router.post("/projects", async (req, res): Promise<void> => {
  const body = CreateYoutubeTranscriptBody.safeParse(req.body);
  if (!body.success) {
    invalid(req, res, body.error);
    return;
  }

  let transcriptResult;
  try {
    transcriptResult = await transcribeYoutubeCaptions(
      body.data.url,
      body.data.language,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "YouTube captions could not be imported.";
    const status = message.includes("valid YouTube") ? 400 : 422;
    res.status(status).json({ error: message });
    return;
  }

  const [project] = await db
    .insert(projectsTable)
    .values({
      ownerId: getOwnerId(res),
      title: transcriptResult.title,
      sourceType: "youtube",
      sourceName: transcriptResult.title,
      sourceUrl: body.data.url,
      language: transcriptResult.language,
      durationSeconds: transcriptResult.durationSeconds,
      transcript: transcriptResult.transcript,
      segments: transcriptResult.segments,
      wordCount: countWords(transcriptResult.transcript),
    })
    .returning();
  res
    .status(201)
    .json(CreateYoutubeTranscriptResponse.parse(projectResponse(project)));
});

router.get("/projects/:projectId", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    invalid(req, res, params.error);
    return;
  }
  const project = await findProject(params.data.projectId, getOwnerId(res));
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  res.json(GetProjectResponse.parse(projectResponse(project)));
});

router.delete("/projects/:projectId", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    invalid(req, res, params.error);
    return;
  }
  const [deleted] = await db
    .delete(projectsTable)
    .where(
      and(
        eq(projectsTable.id, params.data.projectId),
        eq(projectsTable.ownerId, getOwnerId(res)),
      ),
    )
    .returning({ ownerId: projectsTable.ownerId });
  if (!deleted) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  res.sendStatus(204);
});

router.patch("/projects/:projectId/transcript", async (req, res): Promise<void> => {
  const params = UpdateTranscriptParams.safeParse(req.params);
  if (!params.success) {
    invalid(req, res, params.error);
    return;
  }
  const body = UpdateTranscriptBody.safeParse(req.body);
  if (!body.success) {
    invalid(req, res, body.error);
    return;
  }
  const project = await findProject(params.data.projectId, getOwnerId(res));
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const [updated] = await db
    .update(projectsTable)
    .set({
      transcript: body.data.transcript,
      segments: body.data.segments as StoredTranscriptSegment[],
      wordCount: countWords(body.data.transcript),
    })
    .where(
      and(
        eq(projectsTable.id, params.data.projectId),
        eq(projectsTable.ownerId, getOwnerId(res)),
      ),
    )
    .returning();
  res.json(UpdateTranscriptResponse.parse(projectResponse(updated)));
});

router.post("/projects/:projectId/translate", async (req, res): Promise<void> => {
  const params = TranslateProjectParams.safeParse(req.params);
  if (!params.success) {
    invalid(req, res, params.error);
    return;
  }
  const body = TranslateProjectBody.safeParse(req.body);
  if (!body.success) {
    invalid(req, res, body.error);
    return;
  }
  const project = await findProject(params.data.projectId, getOwnerId(res));
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const languageName = supportedLanguage(body.data.languageCode);
  if (!languageName) {
    res.status(400).json({
      error: "Choose a supported translation language.",
    });
    return;
  }

  try {
    const segments = await translateSegments(
      project.segments,
      body.data.languageCode,
    );
    const translation = toStoredTranslation(
      body.data.languageCode,
      languageName,
      segments,
    );
    const translations = [
      ...project.translations.filter(
        (entry) => entry.languageCode !== translation.languageCode,
      ),
      translation,
    ];
    await db
      .update(projectsTable)
      .set({ translations })
      .where(
        and(
          eq(projectsTable.id, project.id),
          eq(projectsTable.ownerId, getOwnerId(res)),
        ),
      );
    res.json(TranslateProjectResponse.parse(translation));
  } catch (error) {
    req.log.error({ err: error, projectId: project.id }, "Translation failed");
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Translation could not be completed.",
    });
  }
});

router.post("/projects/:projectId/summarize", async (req, res): Promise<void> => {
  const params = SummarizeProjectParams.safeParse(req.params);
  if (!params.success) {
    invalid(req, res, params.error);
    return;
  }
  const project = await findProject(params.data.projectId, getOwnerId(res));
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  try {
    const summary = await summarizeTranscript(project.transcript);
    await db
      .update(projectsTable)
      .set({ summary })
      .where(
        and(
          eq(projectsTable.id, project.id),
          eq(projectsTable.ownerId, getOwnerId(res)),
        ),
      );
    res.json(
      SummarizeProjectResponse.parse({ projectId: project.id, summary }),
    );
  } catch (error) {
    req.log.error({ err: error, projectId: project.id }, "Summary generation failed");
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Summary could not be generated.",
    });
  }
});

async function handleUpload(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "Choose a video or audio file to upload." });
    return;
  }

  const extension = extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    await rm(file.path, { force: true });
    res.status(400).json({
      error: "Use a supported video or audio file such as MP4, MOV, MP3, or WAV.",
    });
    return;
  }
  const language =
    typeof req.body.language === "string" &&
    /^[a-z]{2,3}$/i.test(req.body.language)
      ? req.body.language.toLowerCase()
      : undefined;
  try {
    const transcriptResult = await transcribeVideoFile(file.path, language);
    const title = projectTitle(file.originalname);
    const [project] = await db
      .insert(projectsTable)
      .values({
        ownerId: getOwnerId(res),
        title,
        sourceType: "upload",
        sourceName: basename(file.originalname).slice(0, 200),
        sourceUrl: null,
        language: transcriptResult.language,
        durationSeconds: transcriptResult.durationSeconds,
        transcript: transcriptResult.transcript,
        segments: transcriptResult.segments,
        wordCount: countWords(transcriptResult.transcript),
      })
      .returning();
    res
      .status(201)
      .json(TranscribeUploadResponse.parse(projectResponse(project)));
  } catch (error) {
    req.log.error({ err: error, uploadId: randomUUID() }, "Transcription failed");
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Transcription could not be completed.",
    });
  } finally {
    await rm(file.path, { force: true });
  }
}

router.post("/transcriptions/upload", (req, res, next): void => {
  upload.single("file")(req, res, (error: unknown) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        res.status(status).json({
          error:
            error.code === "LIMIT_FILE_SIZE"
              ? "This file exceeds the 500 MB upload limit."
              : "The upload could not be processed.",
        });
        return;
      }
      next(error);
      return;
    }
    void handleUpload(req, res).catch(next);
  });
});

export default router;
