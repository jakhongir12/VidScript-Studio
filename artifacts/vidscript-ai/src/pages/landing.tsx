import { AudioLines, ArrowDownToLine, ArrowRight, Captions, Globe2, Sparkles, Upload } from 'lucide-react';
import { Link } from 'wouter';

export function LandingPage() {
  return (
    <main className="landing-shell">
      <header className="landing-nav">
        <Link href="/" className="landing-brand">
          <span className="landing-brand-mark"><AudioLines size={19} strokeWidth={2.3} /></span>
          <span>vidscript<span>.ai</span></span>
        </Link>
        <nav className="landing-nav-links" aria-label="Main navigation">
          <a href="#features">Features</a>
          <Link href="/sign-in">Log in</Link>
          <Link href="/sign-up" className="btn btn-primary landing-nav-cta">Create account <ArrowRight size={14} /></Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <div className="landing-eyebrow"><span /> AI transcription for video and audio</div>
          <h1>Make every word<br /><span>work harder.</span></h1>
          <p>Turn recordings into accurate transcripts, useful summaries, and ready-to-publish subtitles—in a workspace that stays yours.</p>
          <div className="landing-actions">
            <Link href="/sign-up" className="btn btn-primary landing-primary-cta">Create your free account <ArrowRight size={15} /></Link>
            <Link href="/sign-in" className="landing-secondary-cta">I already have an account</Link>
          </div>
          <div className="landing-trust"><span><LockKeyholeIcon /> Private transcripts</span><span>MP3, MP4, MOV, WAV and more</span></div>
        </div>

        <div className="landing-preview" aria-label="Example of an edited transcript">
          <div className="preview-window-bar"><span /><span /><span /><div>Project · Product interview</div></div>
          <div className="preview-header"><div><span className="preview-label">TRANSCRIPT</span><h2>Product interview</h2></div><span className="preview-ready"><i /> Ready</span></div>
          <div className="preview-quote"><time>00:14</time><p>“We wanted to make it easier for people to turn a conversation into something they could share.”</p></div>
          <div className="preview-quote muted"><time>00:21</time><p>“Now I can edit the transcript, translate it, and export captions without switching tools.”</p></div>
          <div className="preview-actions"><span><Sparkles size={14} /> Summary ready</span><span><Captions size={14} /> SRT <ArrowDownToLine size={13} /></span></div>
        </div>
      </section>

      <section className="landing-features" id="features">
        <div className="landing-section-heading"><span className="eyebrow">From recording to finished</span><h2>One workspace for the whole process.</h2></div>
        <div className="landing-feature-grid">
          <article className="landing-feature-card"><span className="landing-feature-icon"><Upload size={18} /></span><h3>Transcribe your media</h3><p>Upload audio or video and get an editable transcript with timed subtitle segments.</p></article>
          <article className="landing-feature-card"><span className="landing-feature-icon"><Globe2 size={18} /></span><h3>Reach more people</h3><p>Translate your transcript into another language while keeping the original unchanged.</p></article>
          <article className="landing-feature-card"><span className="landing-feature-icon"><Captions size={18} /></span><h3>Export and publish</h3><p>Generate a short summary and download standard SRT or VTT subtitle files.</p></article>
        </div>
      </section>

      <section className="landing-bottom-cta">
        <div><span className="eyebrow">Ready when you are</span><h2>Start with your next recording.</h2><p>Create an account to keep your transcript library with you.</p></div>
        <Link href="/sign-up" className="btn btn-primary landing-primary-cta">Get started <ArrowRight size={15} /></Link>
      </section>
      <footer className="landing-footer"><Link href="/" className="landing-brand"><span className="landing-brand-mark"><AudioLines size={16} /></span><span>vidscript<span>.ai</span></span></Link><span>Transcripts made useful.</span></footer>
    </main>
  );
}

function LockKeyholeIcon() {
  return <span className="landing-lock-dot" aria-hidden="true" />;
}
