import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  useClaimGuestLibrary,
  useCreateYoutubeTranscript,
  useDeleteProject,
  useGetProject,
  useGetProjectSummary,
  useListProjects,
  useSummarizeProject,
  useTranscribeUpload,
  useTranslateProject,
  useUpdateTranscript,
  getGetProjectQueryKey,
  getGetProjectSummaryQueryKey,
  getListProjectsQueryKey,
  type Project,
  type ProjectListItem,
  type TranscriptSegment,
} from '@workspace/api-client-react';
import {
  AlignLeft,
  ArrowDownToLine,
  ArrowLeft,
  AudioLines,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Globe2,
  Languages,
  Link2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Youtube,
} from 'lucide-react';
import { Link, Redirect, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LandingPage } from '@/pages/landing';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#236c65',
    colorForeground: '#253c3e',
    colorMutedForeground: '#778582',
    colorDanger: '#a24c43',
    colorBackground: '#fbfaf5',
    colorInput: '#fcfbf6',
    colorInputForeground: '#263c3e',
    colorNeutral: '#d7d8cf',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '8px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: '!bg-[#fbfaf5] !rounded-2xl !w-[440px] !max-w-full !overflow-hidden !shadow-[0_20px_60px_rgba(23,42,42,0.16)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: '!text-[#253c3e] !font-[Manrope]',
    headerSubtitle: '!text-[#778582]',
    socialButtonsBlockButtonText: '!text-[#3d5251] !font-semibold',
    socialButtonsBlockButton: '!border-[#d8d5c9] !bg-[#fcfbf6]',
    formFieldLabel: '!text-[#3d5251] !font-semibold',
    formFieldInput: '!border-[#d7d8cf] !bg-[#fcfbf6] !text-[#263c3e]',
    formButtonPrimary: '!bg-[#236c65] hover:!bg-[#1d5d57] !text-[#f8f4e9]',
    footerActionLink: '!text-[#236c65] !font-semibold',
    footerActionText: '!text-[#778582]',
    dividerText: '!text-[#778582]',
    identityPreviewEditButton: '!text-[#236c65]',
    formFieldSuccessText: '!text-[#236c65]',
    alertText: '!text-[#963f38]',
    logoBox: 'rounded-lg overflow-hidden',
    logoImage: 'w-8 h-8',
    footerAction: 'border-t border-[#e4dfd3]',
    dividerLine: '!bg-[#e4dfd3]',
    alert: '!border-[#e5c5be] !bg-[#fff9f5]',
    otpCodeFieldInput: '!border-[#d7d8cf] !bg-[#fcfbf6] !text-[#263c3e]',
    formFieldRow: 'gap-2',
    main: 'gap-4',
  },
};

type ToastMessage = { text: string; tone?: 'success' | 'error' };

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const SUPPORTED_UPLOAD_EXTENSIONS = new Set([
  '.aac', '.avi', '.flac', '.m4a', '.mkv', '.mov', '.mp3', '.mp4',
  '.mpeg', '.mpga', '.oga', '.ogg', '.opus', '.wav', '.webm', '.wmv',
]);

function uploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/no credits remaining|insufficient_quota|billing hard limit/i.test(message)) {
    return 'The file was uploaded, but your OpenAI API account has no credits. Add API credits, then retry the transcription.';
  }
  if (/\b429\b/.test(message)) {
    return 'The transcription service is busy. Wait a moment, then try again.';
  }
  return message.replace(/^HTTP \d+ [^:]+:\s*/i, '') || 'Upload could not be transcribed. Check the file format and try again.';
}

function AppFrame({ children, current = 'library' }: { children: ReactNode; current?: string }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="VidScript home">
          <span className="brand-mark"><AudioLines size={19} strokeWidth={2.3} /></span>
          <span className="brand-name">vidscript<span>.ai</span></span>
        </Link>
        <div className="workspace-label">Workspace</div>
        <nav>
          <Link href="/workspace" className={`nav-link ${current === 'library' ? 'active' : ''}`} data-testid="link-library">
            <AlignLeft size={16} /> Transcript library
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <strong><LockKeyhole size={13} /> Your private workspace</strong>
            Your videos and transcripts stay yours. Only you can access this library.
          </div>
          <div className="profile">
            <div className="profile-avatar">{user?.firstName?.slice(0, 1) || 'V'}</div>
            <div className="profile-meta"><b>{user?.fullName || 'Your workspace'}</b><small>{user?.primaryEmailAddress?.emailAddress || 'Personal library'}</small></div>
            <button className="btn btn-quiet sign-out-button" type="button" title="Sign out" aria-label="Sign out" onClick={() => void signOut({ redirectUrl: basePath || '/' })}><LogOut size={15} /></button>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="crumb">
            <span>Workspace</span><ChevronRight size={13} />
            <strong>{location.startsWith('/projects/') ? 'Transcript editor' : 'Library'}</strong>
          </div>
          <div className="topbar-right"><span className="secure-dot" /> Private by design</div>
        </header>
        {children}
      </main>
    </div>
  );
}

function Toast({ message, onClose }: { message: ToastMessage | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, 3400);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  return <div className="toast-note" role="status" style={message.tone === 'error' ? { color: '#963f38', borderColor: '#e5c5be' } : undefined}>{message.text}</div>;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatDuration(value?: number | null) {
  if (!value) return '—';
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function SkeletonRows() {
  return (
    <div className="project-list" aria-label="Loading projects">
      {[0, 1, 2].map((item) => <div key={item} className="project-row">
        <div><div className="skeleton" style={{ height: 13, width: '65%' }} /><div className="skeleton" style={{ height: 9, width: '42%', marginTop: 10 }} /></div>
        <div className="skeleton hide-mobile" style={{ height: 11, width: '65%' }} />
        <div className="skeleton hide-mobile" style={{ height: 11, width: '50%' }} />
        <div className="skeleton hide-mobile" style={{ height: 11, width: '60%' }} />
      </div>)}
    </div>
  );
}

function ProjectRow({ item, onDelete }: { item: ProjectListItem; onDelete: (project: ProjectListItem) => void }) {
  return (
    <div className="project-row" data-testid={`row-project-${item.id}`}>
      <div>
        <Link href={`/projects/${item.id}`} className="project-title" data-testid={`link-project-${item.id}`}>{item.title || item.sourceName}</Link>
        <div className="source-meta">
          <span className="source-badge">{item.sourceType === 'youtube' ? <Youtube size={12} /> : <Video size={12} />}</span>
          <span>{item.sourceName || (item.sourceType === 'youtube' ? 'YouTube video' : 'Uploaded media')}</span>
        </div>
      </div>
      <div className="row-data hide-mobile"><strong>{item.language || '—'}</strong><small>Source language</small></div>
      <div className="row-data hide-mobile"><strong>{item.wordCount.toLocaleString()}</strong><small>Words</small></div>
      <div className="row-data"><strong>{formatDate(item.updatedAt)}</strong><small>Last edited</small></div>
      <button className="btn btn-quiet row-menu" title="Delete project" aria-label={`Delete ${item.title}`} data-testid={`button-delete-${item.id}`} onClick={() => onDelete(item)}><Trash2 size={15} /></button>
    </div>
  );
}

function Library() {
  const [search, setSearch] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeLanguage, setYoutubeLanguage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadLanguage, setUploadLanguage] = useState('');
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<ProjectListItem | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const projectsQuery = useListProjects();
  const summaryQuery = useGetProjectSummary();
  const youtubeMutation = useCreateYoutubeTranscript();
  const uploadMutation = useTranscribeUpload();
  const deleteMutation = useDeleteProject();

  const projects = projectsQuery.data ?? [];
  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) => `${project.title} ${project.sourceName} ${project.language}`.toLowerCase().includes(term));
  }, [projects, search]);

  const refreshLibrary = () => {
    void queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetProjectSummaryQueryKey() });
  };

  const submitYoutube = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    if (!youtubeUrl.trim()) { setFormError('Paste a YouTube video link to continue.'); return; }
    youtubeMutation.mutate({ data: { url: youtubeUrl.trim(), ...(youtubeLanguage ? { language: youtubeLanguage } : {}) } }, {
      onSuccess: (project) => {
        refreshLibrary();
        setToast({ text: 'Captions imported. Your transcript is ready.' });
        setLocation(`/projects/${project.id}`);
      },
      onError: () => setFormError('We couldn’t import captions from that link. Try a video with public captions, or upload the original file.'),
    });
  };

  const submitUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    if (!file) { setFormError('Choose a video or audio file first.'); return; }
    uploadMutation.mutate({ data: { file, ...(uploadLanguage ? { language: uploadLanguage } : {}) } }, {
      onSuccess: (project) => {
        refreshLibrary();
        setToast({ text: 'Upload received. Your transcript is ready.' });
        setLocation(`/projects/${project.id}`);
      },
      onError: (error) => setFormError(uploadErrorMessage(error)),
    });
  };

  const chooseFile = (selected: File | null) => {
    setFile(selected);
    setFormError('');
    if (!selected) return;
    const extension = selected.name.slice(selected.name.lastIndexOf('.')).toLowerCase();
    if (!SUPPORTED_UPLOAD_EXTENSIONS.has(extension)) {
      setFormError('Choose a supported audio or video file, such as MP3, MP4, MOV, or WAV.');
      setFile(null);
      return;
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      setFormError('This file is larger than the 500 MB upload limit.');
      setFile(null);
    }
  };

  const removeProject = () => {
    if (!confirmDelete) return;
    deleteMutation.mutate({ projectId: confirmDelete.id }, {
      onSuccess: () => {
        refreshLibrary();
        setConfirmDelete(null);
        setToast({ text: 'Project removed from your library.' });
      },
      onError: () => setToast({ text: 'Could not delete this project. Please try again.', tone: 'error' }),
    });
  };

  const isCreating = youtubeMutation.isPending || uploadMutation.isPending;

  return (
    <AppFrame>
      <section className="page-wrap animate-in">
        <div className="page-heading">
          <div><div className="eyebrow">Your creator workspace</div><h1>Words from your work.</h1><p>Every video, one searchable transcript away.</p></div>
          <div className="topbar-right"><LockKeyhole size={14} /> Only you can see these projects</div>
        </div>
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-label"><FileText size={13} /> Projects</div><div className="stat-value" data-testid="text-project-count">{summaryQuery.data?.projectCount ?? '—'}</div></div>
          <div className="stat-card"><div className="stat-label"><AlignLeft size={13} /> Words transcribed</div><div className="stat-value" data-testid="text-word-count">{summaryQuery.data?.wordCount?.toLocaleString() ?? '—'}</div></div>
          <div className="stat-card"><div className="stat-label"><Languages size={13} /> Translations</div><div className="stat-value" data-testid="text-translated-count">{summaryQuery.data?.translatedCount ?? '—'}</div></div>
        </div>
        <div className="create-panel">
          <div className="create-option">
            <div className="option-title"><span className="option-icon"><Youtube size={16} /></span> Import from YouTube</div>
            <p className="option-copy">Bring in an existing caption track. Works with publicly available captions only.</p>
            <form className="inline-form" onSubmit={submitYoutube}>
              <input className="field" type="url" placeholder="Paste a YouTube link" aria-label="YouTube video link" data-testid="input-youtube-url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} />
              <select className="field select-field" aria-label="YouTube caption language" value={youtubeLanguage} onChange={(event) => setYoutubeLanguage(event.target.value)} data-testid="select-youtube-language">
                <option value="">Auto</option><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="ja">Japanese</option>
              </select>
              <button className="btn btn-primary" type="submit" disabled={isCreating} data-testid="button-import-youtube">{youtubeMutation.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Link2 size={15} />} Import</button>
            </form>
          </div>
          <div className="create-option">
            <div className="option-title"><span className="option-icon"><Upload size={16} /></span> Transcribe a file</div>
            <p className="option-copy">Upload your own video or audio when captions aren’t available.</p>
            <form onSubmit={submitUpload}>
              <div className="upload-box">
                <span>{file ? file.name : 'MP3, MP4, MOV, WAV and more (up to 500 MB)'}</span>
                <input id="media-file" className="file-input" type="file" accept=".aac,.avi,.flac,.m4a,.mkv,.mov,.mp3,.mp4,.mpeg,.mpga,.oga,.ogg,.opus,.wav,.webm,.wmv,audio/*,video/*" aria-label="Choose an audio or video file" data-testid="input-upload-file" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
                <label className="btn btn-secondary btn-small" htmlFor="media-file"><Plus size={13} /> Choose file</label>
              </div>
              <div className="inline-form" style={{ marginTop: 8 }}>
                <select className="field" aria-label="Upload language" value={uploadLanguage} onChange={(event) => setUploadLanguage(event.target.value)} data-testid="select-upload-language">
                  <option value="">Detect source language</option><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="ja">Japanese</option>
                </select>
                <button className="btn btn-primary" type="submit" disabled={isCreating} data-testid="button-upload-transcribe">{uploadMutation.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />} {uploadMutation.isPending ? 'Transcribing' : 'Transcribe'}</button>
              </div>
            </form>
          </div>
          {formError && <div className="form-error" role="alert">{formError}</div>}
          {isCreating && <div className="form-error" style={{ color: '#5e7b71' }} role="status">Working on your media. This can take a moment.</div>}
        </div>
        <div className="library-head">
          <div><h2>Your library</h2><p>Transcripts you’ve created or imported</p></div>
          <div className="search-wrap"><Search size={15} /><input className="field" type="search" placeholder="Search your library" aria-label="Search projects" data-testid="input-project-search" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        </div>
        {projectsQuery.isLoading ? <SkeletonRows /> :
          projectsQuery.isError ? <div className="error-state"><div className="empty-symbol"><CircleAlert size={20} /></div><h3>Library couldn’t load</h3><p>Check your connection and try again.</p><button className="btn btn-secondary" style={{ marginTop: 15 }} onClick={() => projectsQuery.refetch()} data-testid="button-retry-projects">Try again</button></div> :
          filteredProjects.length ? <div className="project-list">{filteredProjects.map((item) => <ProjectRow key={item.id} item={item} onDelete={setConfirmDelete} />)}</div> :
          <div className="project-list"><div className="empty-state"><div className="empty-symbol">{search ? <Search size={19} /> : <AudioLines size={19} />}</div><h3>{search ? 'No matches in this library' : 'Your next transcript starts here'}</h3><p>{search ? 'Try a different title, source name, or language.' : 'Import captions from a public YouTube video, or upload your own media to create a transcript.'}</p></div></div>}
      </section>
      {confirmDelete && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmDelete(null); }}>
        <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <h2 id="delete-title">Delete this project?</h2>
          <p><strong>{confirmDelete.title}</strong> and its transcript will be removed from your library. This can’t be undone.</p>
          <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Keep project</button><button className="btn btn-danger" disabled={deleteMutation.isPending} onClick={removeProject} data-testid="button-confirm-delete">{deleteMutation.isPending ? 'Deleting…' : 'Delete project'}</button></div>
        </section>
      </div>}
      <Toast message={toast} onClose={() => setToast(null)} />
    </AppFrame>
  );
}

const languageOptions = [
  { name: 'Spanish', code: 'es' }, { name: 'French', code: 'fr' }, { name: 'German', code: 'de' },
  { name: 'Portuguese', code: 'pt' }, { name: 'Japanese', code: 'ja' }, { name: 'Italian', code: 'it' },
  { name: 'Korean', code: 'ko' }, { name: 'Chinese (Simplified)', code: 'zh-CN' },
];

function timestamp(seconds: number, separator = ',') {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const millis = Math.floor((safe % 1) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}${separator}${String(millis).padStart(3, '0')}`;
}

function downloadSubtitle(project: Project, segments: TranscriptSegment[], format: 'srt' | 'vtt', language?: string) {
  const content = format === 'srt'
    ? segments.map((segment, index) => `${index + 1}\n${timestamp(segment.start)} --> ${timestamp(segment.end)}\n${segment.text}`).join('\n\n')
    : `WEBVTT\n\n${segments.map((segment) => `${timestamp(segment.start, '.') } --> ${timestamp(segment.end, '.')}\n${segment.text}`).join('\n\n')}`;
  const blob = new Blob([content], { type: format === 'srt' ? 'application/x-subrip' : 'text/vtt' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${(project.title || 'transcript').replace(/[^\w-]+/g, '-').toLowerCase()}${language ? `-${language}` : ''}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ProjectEditor() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId || '';
  const queryClient = useQueryClient();
  const projectQuery = useGetProject(projectId, { query: { queryKey: getGetProjectQueryKey(projectId), enabled: !!projectId } });
  const project = projectQuery.data;
  const updateMutation = useUpdateTranscript();
  const translateMutation = useTranslateProject();
  const summarizeMutation = useSummarizeProject();
  const [transcript, setTranscript] = useState('');
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeTab, setActiveTab] = useState<'transcript' | 'segments'>('transcript');
  const [languageChoice, setLanguageChoice] = useState('es');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [summaryOverride, setSummaryOverride] = useState<string | null>(null);
  const [initializedId, setInitializedId] = useState('');

  useEffect(() => {
    if (project && initializedId !== project.id) {
      setTranscript(project.transcript);
      setSegments(project.segments ?? []);
      setSummaryOverride(project.summary ?? null);
      setInitializedId(project.id);
    }
  }, [project, initializedId]);

  const isDirty = !!project && (transcript !== project.transcript || JSON.stringify(segments) !== JSON.stringify(project.segments ?? []));
  const selectedTranslation = project?.translations.find((translation) => translation.languageCode === languageChoice);

  const saveTranscript = () => {
    if (!project) return;
    const nextTranscript = activeTab === 'segments' ? segments.map((segment) => segment.text.trim()).filter(Boolean).join(' ') : transcript;
    const nextSegments = activeTab === 'segments' ? segments : project.segments;
    updateMutation.mutate({ projectId: project.id, data: { transcript: nextTranscript, segments: nextSegments } }, {
      onSuccess: (updated) => {
        setTranscript(updated.transcript);
        setSegments(updated.segments ?? []);
        queryClient.setQueryData(getGetProjectQueryKey(project.id), updated);
        void queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetProjectSummaryQueryKey() });
        setToast({ text: 'Transcript changes saved.' });
      },
      onError: () => setToast({ text: 'Changes weren’t saved. Try again.', tone: 'error' }),
    });
  };

  const translate = () => {
    if (!project) return;
    const language = languageOptions.find((option) => option.code === languageChoice);
    if (!language) return;
    translateMutation.mutate({ projectId: project.id, data: { language: language.name, languageCode: language.code } }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(project.id) });
        setToast({ text: `Translation to ${language.name} is ready.` });
      },
      onError: () => setToast({ text: 'Translation could not be created. Please try again.', tone: 'error' }),
    });
  };

  const summarize = () => {
    if (!project) return;
    summarizeMutation.mutate({ projectId: project.id }, {
      onSuccess: (result) => {
        setSummaryOverride(result.summary);
        queryClient.setQueryData<Project | undefined>(getGetProjectQueryKey(project.id), (old) => old ? { ...old, summary: result.summary } : old);
        setToast({ text: 'Summary generated.' });
      },
      onError: () => setToast({ text: 'Summary could not be generated. Try again.', tone: 'error' }),
    });
  };

  const editSegment = (index: number, text: string) => {
    setSegments((previous) => previous.map((segment, current) => current === index ? { ...segment, text } : segment));
  };

  return (
    <AppFrame current="editor">
      <section className="page-wrap animate-in">
        <Link href="/workspace" className="back-link" data-testid="link-back-library"><ArrowLeft size={14} /> Back to library</Link>
        {projectQuery.isLoading ? <div className="editor-grid"><div className="panel" style={{ padding: 20 }}><div className="skeleton" style={{ height: 24, width: '55%', marginBottom: 18 }} /><div className="skeleton" style={{ height: 320 }} /></div><div className="panel" style={{ height: 220 }} /></div> :
        projectQuery.isError ? <div className="error-state panel"><div className="empty-symbol"><CircleAlert size={20} /></div><h3>Transcript unavailable</h3><p>This project couldn’t be opened. It may have been removed, or your connection may be interrupted.</p><button className="btn btn-secondary" style={{ marginTop: 15 }} onClick={() => projectQuery.refetch()} data-testid="button-retry-project">Try again</button></div> :
        project && <>
          <div className="editor-heading">
            <div>
              <div className="eyebrow">{project.sourceType === 'youtube' ? 'YouTube captions' : 'Uploaded media'} · {project.language || 'Language not set'}</div>
              <h1>{project.title || project.sourceName}</h1>
              <div className="editor-meta">
                <span><Clock3 size={13} /> {formatDuration(project.durationSeconds)}</span>
                <span><AlignLeft size={13} /> {project.wordCount.toLocaleString()} words</span>
                <span><Clock3 size={13} /> Updated {formatDate(project.updatedAt)}</span>
              </div>
            </div>
            <div className="editor-actions"><button className="btn btn-secondary" onClick={() => downloadSubtitle(project, selectedTranslation?.segments ?? segments, 'vtt', selectedTranslation?.languageCode)} disabled={!(selectedTranslation?.segments ?? segments).length} data-testid="button-export-vtt"><ArrowDownToLine size={15} /> Export VTT</button><button className="btn btn-primary" onClick={() => downloadSubtitle(project, selectedTranslation?.segments ?? segments, 'srt', selectedTranslation?.languageCode)} disabled={!(selectedTranslation?.segments ?? segments).length} data-testid="button-export-srt"><ArrowDownToLine size={15} /> Export SRT</button></div>
          </div>
          <div className="editor-grid">
            <section className="panel">
              <div className="panel-head">
                <div className="panel-title"><FileText size={15} /> Source transcript <span className="panel-subtitle">· {project.language}</span></div>
                <div className="tabs" role="tablist" aria-label="Transcript view">
                  <button className={`tab ${activeTab === 'transcript' ? 'active' : ''}`} onClick={() => setActiveTab('transcript')} role="tab" aria-selected={activeTab === 'transcript'} data-testid="tab-transcript">Transcript</button>
                  <button className={`tab ${activeTab === 'segments' ? 'active' : ''}`} onClick={() => setActiveTab('segments')} role="tab" aria-selected={activeTab === 'segments'} data-testid="tab-segments">Subtitle segments</button>
                </div>
              </div>
              <div className="editor-toolbar"><span>{activeTab === 'transcript' ? 'Edit your transcript directly' : `${segments.length} timed subtitle segments`}</span><span className={`save-status ${!isDirty ? 'saved' : ''}`}>{isDirty ? 'Unsaved changes' : <><Check size={12} /> Up to date</>}</span></div>
              {activeTab === 'transcript' ? <div className="editor-surface"><textarea className="transcript-textarea" value={transcript} aria-label="Editable source transcript" data-testid="textarea-transcript" onChange={(event) => setTranscript(event.target.value)} placeholder="Your transcript will appear here." /></div> :
                <div className="segment-list">{segments.length ? segments.map((segment, index) => <div className="segment-row" key={`${segment.start}-${index}`} data-testid={`segment-row-${index}`}><span className="segment-time">{timestamp(segment.start, '.').slice(3, 11)}</span><textarea className="segment-input" aria-label={`Subtitle segment ${index + 1}`} value={segment.text} onChange={(event) => editSegment(index, event.target.value)} data-testid={`textarea-segment-${index}`} /></div>) : <div className="empty-state"><div className="empty-symbol"><Clock3 size={18} /></div><h3>No timed segments</h3><p>This transcript doesn’t include subtitle timing data, so subtitle downloads aren’t available.</p></div>}</div>}
              <div className="save-strip"><span className={`save-status ${!isDirty ? 'saved' : ''}`}>{updateMutation.isPending ? <><LoaderCircle size={12} className="animate-spin" /> Saving transcript…</> : updateMutation.isError ? <><CircleAlert size={12} /> Save failed</> : isDirty ? 'Changes are ready to save' : <><Check size={12} /> Saved to your private workspace</>}</span><button className="btn btn-primary btn-small" onClick={saveTranscript} disabled={!isDirty || updateMutation.isPending} data-testid="button-save-transcript">{updateMutation.isPending ? 'Saving…' : 'Save changes'}</button></div>
            </section>
            <div className="side-stack">
              <section className="panel">
                <div className="panel-head"><div className="panel-title"><Sparkles size={15} /> Summary</div><button className="btn btn-secondary btn-small" onClick={summarize} disabled={summarizeMutation.isPending} data-testid="button-generate-summary">{summarizeMutation.isPending ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />}{summaryOverride ? 'Refresh' : 'Generate'}</button></div>
                <div className="side-panel-body">{summaryOverride ? <div className="summary-copy" data-testid="text-project-summary">{summaryOverride}</div> : <div className="summary-placeholder"><span>Get the essential points without replaying the whole video.</span><span>Generate a concise summary from this transcript.</span></div>}</div>
              </section>
              <section className="panel">
                <div className="panel-head"><div className="panel-title"><Globe2 size={15} /> Translation</div></div>
                <div className="side-panel-body">
                  <div className="translation-selects">
                    <select className="field select-field" aria-label="Translation language" value={languageChoice} onChange={(event) => setLanguageChoice(event.target.value)} data-testid="select-translation-language">{languageOptions.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}</select>
                    <button className="btn btn-secondary btn-small" onClick={translate} disabled={translateMutation.isPending} data-testid="button-translate">{translateMutation.isPending ? <LoaderCircle size={13} className="animate-spin" /> : <Languages size={13} />} Translate</button>
                  </div>
                  {project.translations.length ? project.translations.map((translation) => <div className="translation-item" key={translation.languageCode}>
                    <h4>{translation.language}<span>{formatDate(translation.createdAt)}</span></h4><p>{translation.transcript}</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}><button className="btn btn-secondary btn-small" onClick={() => setLanguageChoice(translation.languageCode)} data-testid={`button-select-translation-${translation.languageCode}`}>Use for export</button></div>
                  </div>) : <div className="summary-placeholder" style={{ minHeight: 52 }}>Create a translated transcript and timed subtitle track.</div>}
                  <div className="notice"><LockKeyhole size={13} /> Your source transcript stays unchanged. Translations are saved alongside it.</div>
                </div>
              </section>
              <section className="panel">
                <div className="panel-head"><div className="panel-title"><ArrowDownToLine size={15} /> Subtitle files</div></div>
                <div className="side-panel-body">
                  <div className="export-row">
                    <button className="btn btn-secondary btn-small" onClick={() => downloadSubtitle(project, selectedTranslation?.segments ?? segments, 'srt', selectedTranslation?.languageCode)} disabled={!(selectedTranslation?.segments ?? segments).length} data-testid="button-download-srt">SRT file</button>
                    <button className="btn btn-secondary btn-small" onClick={() => downloadSubtitle(project, selectedTranslation?.segments ?? segments, 'vtt', selectedTranslation?.languageCode)} disabled={!(selectedTranslation?.segments ?? segments).length} data-testid="button-download-vtt">VTT file</button>
                  </div>
                  <div className="notice"><FileText size={13} /> Editable timed segments export as standard subtitle files.</div>
                </div>
              </section>
            </div>
          </div>
        </>}
      </section>
      <Toast message={toast} onClose={() => setToast(null)} />
    </AppFrame>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) {
        queryClient.clear();
      }
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClaimGuestProjects() {
  const { user, isLoaded, isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const claimMutation = useClaimGuestLibrary();
  const lastClaimedUser = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id || lastClaimedUser.current === user.id) return;
    lastClaimedUser.current = user.id;
    claimMutation.mutate(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetProjectSummaryQueryKey() });
      },
      onError: () => {
        lastClaimedUser.current = null;
      },
    });
  }, [claimMutation.mutate, isLoaded, isSignedIn, queryClient, user?.id]);

  return null;
}

function SignInPage() {
  return (
    <main className="auth-page">
      <Link href="/" className="auth-back-link"><AudioLines size={17} /> vidscript.ai</Link>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={`${basePath}/workspace`} />
    </main>
  );
}

function SignUpPage() {
  return (
    <main className="auth-page">
      <Link href="/" className="auth-back-link"><AudioLines size={17} /> vidscript.ai</Link>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/workspace`} />
    </main>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/workspace" /></Show>
      <Show when="signed-out"><LandingPage /></Show>
    </>
  );
}

function SignedInWorkspace() {
  return (
    <>
      <Show when="signed-in"><Library /></Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}

function SignedInProjectEditor() {
  return (
    <>
      <Show when="signed-in"><ProjectEditor /></Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}

function RoutedContent() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={HomeRedirect} />
    <Route path="/workspace" component={SignedInWorkspace} />
    <Route path="/projects/:projectId" component={SignedInProjectEditor} />
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function ClerkProviderWithRoutes({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your transcripts' } },
        signUp: { start: { title: 'Create your account', subtitle: 'Save your transcripts in a private workspace' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes>
        <QueryClientProvider client={queryClient}>
          <ClerkQueryClientCacheInvalidator />
          <ClaimGuestProjects />
          <TooltipProvider>
            <RoutedContent />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ClerkProviderWithRoutes>
    </WouterRouter>
  );
}

export default App;
