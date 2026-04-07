import { type ReactNode, useMemo, useState } from 'react';
import { buildSectorStateFamilies } from '../data/libraryInsights';
import { usePackageStore } from '../data/packageStore';

type MethodsTab = 'about' | 'conventions' | 'confidence' | 'phase2' | 'evidence';

interface ConfidenceBreakdown {
  sector: string;
  total: number;
  lowOrExploratory: number;
  share: number;
}

const tabLabels: Record<MethodsTab, string> = {
  about: 'About the library',
  conventions: 'Modeling conventions',
  confidence: 'Confidence overview',
  phase2: 'Phase 2 caveats',
  evidence: 'State evidence browser',
};

function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\\/g, '')
    .trim();
}

function getDocumentIntro(markdown: string): string[] {
  const [intro] = markdown.split(/\n##\s+/);
  return intro
    .split(/\n\s*\n/)
    .map((paragraph) => cleanInlineMarkdown(paragraph.replace(/^#\s+.*$/m, '').trim()))
    .filter(Boolean);
}

function getSection(markdown: string, title: string): string {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(
    new RegExp(`^##\\s+${escapedTitle}\\s*$([\\s\\S]*?)(?=^##\\s+|$)`, 'm'),
  );
  return match?.[1].trim() ?? '';
}

function renderMarkdownBlocks(content: string, keyPrefix: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const lines = content.split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push(<h3 key={`${keyPrefix}-heading-${index}`}>{cleanInlineMarkdown(line.slice(4))}</h3>);
      index += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('> ')) {
        quoteLines.push(cleanInlineMarkdown(lines[index].trim().slice(2)));
        index += 1;
      }
      blocks.push(
        <blockquote key={`${keyPrefix}-quote-${index}`} className="methods-quote">
          {quoteLines.join(' ')}
        </blockquote>,
      );
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^-\s+/.test(lines[index].trim())) {
        let item = lines[index].trim().replace(/^-\s+/, '');
        index += 1;
        while (
          index < lines.length &&
          lines[index].trim() &&
          !/^-\s+/.test(lines[index].trim()) &&
          !/^\d+\.\s+/.test(lines[index].trim()) &&
          !lines[index].trim().startsWith('### ')
        ) {
          item += ` ${lines[index].trim()}`;
          index += 1;
        }
        items.push(cleanInlineMarkdown(item));
        while (index < lines.length && !lines[index].trim()) {
          index += 1;
        }
      }
      blocks.push(
        <ul key={`${keyPrefix}-list-${index}`} className="methods-list">
          {items.map((item) => (
            <li key={`${keyPrefix}-${item}`}>{item}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        let item = lines[index].trim().replace(/^\d+\.\s+/, '');
        index += 1;
        while (
          index < lines.length &&
          lines[index].trim() &&
          !/^\d+\.\s+/.test(lines[index].trim()) &&
          !/^-\s+/.test(lines[index].trim()) &&
          !lines[index].trim().startsWith('### ')
        ) {
          item += ` ${lines[index].trim()}`;
          index += 1;
        }
        items.push(cleanInlineMarkdown(item));
        while (index < lines.length && !lines[index].trim()) {
          index += 1;
        }
      }
      blocks.push(
        <ol key={`${keyPrefix}-ordered-${index}`} className="methods-list methods-list--ordered">
          {items.map((item) => (
            <li key={`${keyPrefix}-${item}`}>{item}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith('### ') &&
      !/^-\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim()) &&
      !lines[index].trim().startsWith('> ')
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(
      <p key={`${keyPrefix}-paragraph-${index}`}>
        {cleanInlineMarkdown(paragraphLines.join(' '))}
      </p>,
    );
  }

  return blocks;
}

export default function MethodsPage() {
  const readme = usePackageStore((state) => state.readme);
  const phase2Memo = usePackageStore((state) => state.phase2Memo);
  const sectorStates = usePackageStore((state) => state.sectorStates);
  const [activeTab, setActiveTab] = useState<MethodsTab>('about');
  const [evidenceSearch, setEvidenceSearch] = useState('');
  const [evidenceSector, setEvidenceSector] = useState('');
  const [evidenceConfidence, setEvidenceConfidence] = useState('');

  const families = useMemo(() => buildSectorStateFamilies(sectorStates), [sectorStates]);
  const introParagraphs = useMemo(() => getDocumentIntro(readme), [readme]);
  const sections = useMemo(() => {
    return {
      included: getSection(readme, 'What is included'),
      conventions: getSection(readme, 'Core modelling conventions'),
      guidance: getSection(readme, 'Short guidance on use'),
      strengths: getSection(readme, 'Main Phase 1 strengths'),
      weaknesses: getSection(readme, 'Main Phase 1 weaknesses'),
      provenance: getSection(readme, 'License / provenance note'),
      phase2Judgement: getSection(phase2Memo, 'Bottom-line judgement'),
      phase2Strongest: getSection(phase2Memo, 'Where the Phase 1 library is strongest'),
      phase2Weakest: getSection(phase2Memo, 'Where the Phase 1 library is weakest'),
      phase2Questions: getSection(phase2Memo, "Direct answers to the brief's open questions"),
      phase2WorkProgram: getSection(phase2Memo, 'Recommended Phase 2 work program'),
      phase2Recommendation: getSection(phase2Memo, 'Final recommendation'),
    };
  }, [phase2Memo, readme]);

  const confidenceCounts = useMemo(() => {
    return sectorStates.reduce<Record<string, number>>((counts, row) => {
      counts[row.confidence_rating] = (counts[row.confidence_rating] ?? 0) + 1;
      return counts;
    }, {});
  }, [sectorStates]);

  const confidenceBySector = useMemo<ConfidenceBreakdown[]>(() => {
    const grouped = sectorStates.reduce<Record<string, ConfidenceBreakdown>>((acc, row) => {
      const existing = acc[row.sector] ?? {
        sector: row.sector,
        total: 0,
        lowOrExploratory: 0,
        share: 0,
      };

      existing.total += 1;
      if (row.confidence_rating === 'Low' || row.confidence_rating === 'Exploratory') {
        existing.lowOrExploratory += 1;
      }

      acc[row.sector] = existing;
      return acc;
    }, {});

    return Object.values(grouped)
      .map((entry) => ({
        ...entry,
        share: entry.total === 0 ? 0 : entry.lowOrExploratory / entry.total,
      }))
      .sort((left, right) => right.share - left.share || left.sector.localeCompare(right.sector));
  }, [sectorStates]);

  const evidenceFamilies = useMemo(() => {
    const search = evidenceSearch.toLowerCase().trim();

    return families.filter((family) => {
      if (evidenceSector && family.sector !== evidenceSector) {
        return false;
      }

      if (evidenceConfidence && !family.confidenceRatings.includes(evidenceConfidence)) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        family.label,
        family.sector,
        family.subsector,
        family.serviceOrOutputName,
        family.representative.evidence_summary,
        family.representative.derivation_method,
        family.representative.review_notes,
        family.sourceIds.join(' '),
        family.assumptionIds.join(' '),
      ]
        .join(' ')
        .toLowerCase();

      return search.split(/\s+/).every((token) => haystack.includes(token));
    });
  }, [evidenceConfidence, evidenceSearch, evidenceSector, families]);

  const evidenceSectors = useMemo(() => {
    return Array.from(new Set(families.map((family) => family.sector))).sort((left, right) => left.localeCompare(right));
  }, [families]);

  const confidenceOptions = useMemo(() => {
    return Object.keys(confidenceCounts).sort((left, right) => left.localeCompare(right));
  }, [confidenceCounts]);

  return (
    <div className="page page--methods">
      <h1>Methods</h1>
      <p>
        This trust page is driven from the package README, the Phase 2 memo, and the state-level
        evidence fields embedded directly in `sector_states.csv`.
      </p>

      <section className="scenario-overview-grid">
        <article className="scenario-panel scenario-panel--hero">
          <span className="scenario-badge">Package guidance</span>
          <h2>Why this library exists</h2>
          {introParagraphs.map((paragraph) => (
            <p key={paragraph} className="methods-lead-paragraph">
              {paragraph}
            </p>
          ))}
        </article>

        <article className="scenario-panel">
          <h2>Coverage at a glance</h2>
          <div className="scenario-stat-grid">
            <div className="scenario-stat-card">
              <span>State-year rows</span>
              <strong>{sectorStates.length}</strong>
            </div>
            <div className="scenario-stat-card">
              <span>State families</span>
              <strong>{families.length}</strong>
            </div>
            <div className="scenario-stat-card">
              <span>Sector groups</span>
              <strong>{new Set(sectorStates.map((row) => row.sector)).size}</strong>
            </div>
            <div className="scenario-stat-card">
              <span>Confidence classes</span>
              <strong>{Object.keys(confidenceCounts).length}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="scenario-panel methods-tab-panel">
        <div className="methods-tab-list" role="tablist" aria-label="Methods sections">
          {(Object.keys(tabLabels) as MethodsTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={`methods-tab${activeTab === tab ? ' methods-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {activeTab === 'about' ? (
          <div className="methods-section-stack">
            <section className="methods-content-card">
              <h2>Included in the package</h2>
              {renderMarkdownBlocks(sections.included, 'included')}
            </section>

            <section className="methods-content-grid">
              <article className="methods-content-card">
                <h2>Phase 1 strengths</h2>
                {renderMarkdownBlocks(sections.strengths, 'strengths')}
              </article>
              <article className="methods-content-card">
                <h2>Phase 1 weaknesses</h2>
                {renderMarkdownBlocks(sections.weaknesses, 'weaknesses')}
              </article>
            </section>

            <section className="methods-content-card">
              <h2>Provenance note</h2>
              {renderMarkdownBlocks(sections.provenance, 'provenance')}
            </section>
          </div>
        ) : null}

        {activeTab === 'conventions' ? (
          <div className="methods-section-stack">
            <section className="methods-content-card">
              <h2>Core modeling conventions</h2>
              {renderMarkdownBlocks(sections.conventions, 'conventions')}
            </section>
            <section className="methods-content-card">
              <h2>Short guidance on use</h2>
              {renderMarkdownBlocks(sections.guidance, 'guidance')}
            </section>
          </div>
        ) : null}

        {activeTab === 'confidence' ? (
          <div className="methods-section-stack">
            <section className="methods-content-card">
              <h2>Confidence distribution</h2>
              <div className="scenario-stat-grid">
                {Object.entries(confidenceCounts).map(([rating, count]) => (
                  <div key={rating} className="scenario-stat-card">
                    <span>{rating}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="methods-content-card">
              <h2>Low-confidence exposure by sector</h2>
              <div className="library-mini-table">
                <div className="library-mini-table-row library-mini-table-row--header">
                  <span>Sector</span>
                  <span>Low + exploratory rows</span>
                  <span>Total rows</span>
                  <span>Share</span>
                </div>
                {confidenceBySector.map((entry) => (
                  <div key={entry.sector} className="library-mini-table-row">
                    <span>{entry.sector}</span>
                    <span>{entry.lowOrExploratory}</span>
                    <span>{entry.total}</span>
                    <span>{Math.round(entry.share * 100)}%</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="methods-content-card">
              <h2>Why confidence matters</h2>
              {renderMarkdownBlocks(sections.phase2Judgement, 'phase2-judgement')}
              {renderMarkdownBlocks(sections.phase2Weakest, 'phase2-weakest-inline')}
            </section>
          </div>
        ) : null}

        {activeTab === 'phase2' ? (
          <div className="methods-section-stack">
            <section className="methods-content-card">
              <h2>Bottom-line judgement</h2>
              {renderMarkdownBlocks(sections.phase2Judgement, 'phase2-judgement-full')}
            </section>

            <section className="methods-content-grid">
              <article className="methods-content-card">
                <h2>Strongest now</h2>
                {renderMarkdownBlocks(sections.phase2Strongest, 'phase2-strongest')}
              </article>
              <article className="methods-content-card">
                <h2>Needs tighter review</h2>
                {renderMarkdownBlocks(sections.phase2Weakest, 'phase2-weakest')}
              </article>
            </section>

            <section className="methods-content-card">
              <h2>Open questions answered</h2>
              {renderMarkdownBlocks(sections.phase2Questions, 'phase2-questions')}
            </section>

            <section className="methods-content-card">
              <h2>Recommended work program</h2>
              {renderMarkdownBlocks(sections.phase2WorkProgram, 'phase2-work-program')}
              {renderMarkdownBlocks(sections.phase2Recommendation, 'phase2-recommendation')}
            </section>
          </div>
        ) : null}

        {activeTab === 'evidence' ? (
          <div className="methods-section-stack">
            <section className="methods-content-card">
              <div className="library-panel-heading">
                <div>
                  <h2>State evidence browser</h2>
                  <p>Filter the state families by sector, confidence, or the raw evidence text.</p>
                </div>
              </div>

              <div className="library-filter-grid methods-filter-grid">
                <label className="library-field">
                  <span>Search</span>
                  <input
                    value={evidenceSearch}
                    onChange={(event) => setEvidenceSearch(event.target.value)}
                    placeholder="Evidence summary, review notes, IDs"
                  />
                </label>

                <label className="library-field">
                  <span>Sector</span>
                  <select value={evidenceSector} onChange={(event) => setEvidenceSector(event.target.value)}>
                    <option value="">All sectors</option>
                    {evidenceSectors.map((sector) => (
                      <option key={sector} value={sector}>
                        {sector}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="library-field">
                  <span>Confidence</span>
                  <select
                    value={evidenceConfidence}
                    onChange={(event) => setEvidenceConfidence(event.target.value)}
                  >
                    <option value="">All ratings</option>
                    {confidenceOptions.map((rating) => (
                      <option key={rating} value={rating}>
                        {rating}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="methods-evidence-grid">
              {evidenceFamilies.map((family) => (
                <article key={family.stateId} className="methods-evidence-card">
                  <div className="library-badge-row">
                    <span className="scenario-badge">{family.sector}</span>
                    {family.confidenceRatings.map((rating) => (
                      <span key={rating} className={`library-confidence-pill library-confidence-pill--${rating.toLowerCase()}`}>
                        {rating}
                      </span>
                    ))}
                  </div>
                  <h3>{family.label}</h3>
                  <p className="methods-evidence-meta">
                    {family.subsector} · {family.serviceOrOutputName} · {family.years.join(', ')}
                  </p>
                  <dl className="library-detail-list">
                    <div>
                      <dt>Evidence summary</dt>
                      <dd>{family.representative.evidence_summary}</dd>
                    </div>
                    <div>
                      <dt>Derivation method</dt>
                      <dd>{family.representative.derivation_method}</dd>
                    </div>
                    <div>
                      <dt>Review notes</dt>
                      <dd>{family.representative.review_notes}</dd>
                    </div>
                  </dl>
                  <div className="library-tag-groups">
                    <div>
                      <span className="library-tag-group-title">Source IDs</span>
                      <div className="library-tag-list">
                        {family.sourceIds.map((sourceId) => (
                          <span key={sourceId} className="library-tag">
                            {sourceId}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="library-tag-group-title">Assumption IDs</span>
                      <div className="library-tag-list">
                        {family.assumptionIds.map((assumptionId) => (
                          <span key={assumptionId} className="library-tag">
                            {assumptionId}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {evidenceFamilies.length === 0 ? (
                <article className="methods-evidence-card methods-evidence-card--empty">
                  <h3>No state families match the current evidence filters.</h3>
                  <p>Clear the browser filters to inspect the full embedded trust dataset.</p>
                </article>
              ) : null}
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
