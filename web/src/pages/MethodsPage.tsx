import { type ReactNode, useMemo, useState } from 'react';
import { buildSectorStateFamilies } from '../data/libraryInsights';
import { usePackageStore } from '../data/packageStore';
import MethodsSchemaSummaryCard from './MethodsSchemaSummaryCard';

type MethodsTab = 'about' | 'conventions' | 'confidence' | 'phase2' | 'evidence';

const sectorDerivationAliases: Record<string, string> = {
  cement_clinker: 'cement',
};

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

function getFirstParagraph(markdown: string): string {
  return markdown
    .split(/\n\s*\n/)
    .map((paragraph) => cleanInlineMarkdown(paragraph.trim()))
    .find(Boolean) ?? '';
}

function getSectionExcerpt(markdown: string, titles: string[]): string {
  for (const title of titles) {
    const section = getSection(markdown, title);
    if (section) {
      return getFirstParagraph(section);
    }
  }

  return '';
}

function renderSectionOrNote(content: string, keyPrefix: string, fallback: string): ReactNode[] {
  return content
    ? renderMarkdownBlocks(content, keyPrefix)
    : [<p key={`${keyPrefix}-fallback`}>{fallback}</p>];
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
  const enrichment = usePackageStore((state) => state.enrichment);
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
      methodsObjective: getSection(enrichment.methodsOverview, 'Objective'),
      methodsHierarchy: getSection(enrichment.methodsOverview, 'Source hierarchy actually used'),
      methodsCostConvention: getSection(enrichment.methodsOverview, 'Cost convention'),
      methodsEmissionsBoundary: getSection(enrichment.methodsOverview, 'Emissions boundary'),
      calibrationJudgement: getSection(enrichment.calibrationValidation, 'Overall calibration judgement'),
      calibrationDeviations: getSection(enrichment.calibrationValidation, 'Main deviations that matter'),
      uncertaintyPractical: getSection(enrichment.uncertaintyConfidence, 'Practical interpretation for model users'),
      uncertaintyTests: getSection(enrichment.uncertaintyConfidence, 'What to sensitivity-test first'),
      uncertaintyBottomLine: getSection(enrichment.uncertaintyConfidence, 'Bottom line'),
    };
  }, [
    enrichment.calibrationValidation,
    enrichment.methodsOverview,
    enrichment.uncertaintyConfidence,
    phase2Memo,
    readme,
  ]);

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

  const optionalCompanionCount = useMemo(() => {
    return enrichment.availablePaths.filter((path) => path !== 'data/sector_state_curves_balanced.csv').length;
  }, [enrichment.availablePaths]);

  return (
    <div className="page page--methods">
      <h1>Methods</h1>
      <p>
        This trust page is driven from the packaged library itself, then enriched with any README,
        ledgers, schema files, and explanatory docs that happen to be present.
      </p>

      <section className="configuration-overview-grid">
        <article className="configuration-panel configuration-panel--hero">
          <span className="configuration-badge">Package guidance</span>
          <h2>Why this library exists</h2>
          {introParagraphs.length > 0 ? (
            introParagraphs.map((paragraph) => (
              <p key={paragraph} className="methods-lead-paragraph">
                {paragraph}
              </p>
            ))
          ) : (
            <p className="methods-lead-paragraph">
              The explorer can still run from the main sector-state table alone, even when package-level
              companion notes are absent.
            </p>
          )}
          {enrichment.warnings.length > 0 ? (
            <div className="configuration-provenance-note">
              <strong>Some optional companions were skipped.</strong>
              <p>{enrichment.warnings.join(' ')}</p>
            </div>
          ) : null}
        </article>

        <article className="configuration-panel">
          <h2>Coverage at a glance</h2>
          <div className="configuration-stat-grid">
            <div className="configuration-stat-card">
              <span>State-year rows</span>
              <strong>{sectorStates.length}</strong>
            </div>
            <div className="configuration-stat-card">
              <span>State families</span>
              <strong>{families.length}</strong>
            </div>
            <div className="configuration-stat-card">
              <span>Sector groups</span>
              <strong>{new Set(sectorStates.map((row) => row.sector)).size}</strong>
            </div>
            <div className="configuration-stat-card">
              <span>Confidence classes</span>
              <strong>{Object.keys(confidenceCounts).length}</strong>
            </div>
            <div className="configuration-stat-card">
              <span>Optional companions</span>
              <strong>{optionalCompanionCount}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="configuration-panel methods-tab-panel">
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
              {renderSectionOrNote(
                sections.included,
                'included',
                'No package README section was bundled, so this view is falling back to the core library rows only.',
              )}
            </section>

            <section className="methods-content-grid">
              <article className="methods-content-card">
                <h2>Phase 1 strengths</h2>
                {renderSectionOrNote(
                  sections.strengths,
                  'strengths',
                  'Strength notes were not packaged with this build.',
                )}
              </article>
              <article className="methods-content-card">
                <h2>Phase 1 weaknesses</h2>
                {renderSectionOrNote(
                  sections.weaknesses,
                  'weaknesses',
                  'Weakness notes were not packaged with this build.',
                )}
              </article>
            </section>

            {sections.calibrationJudgement || sections.calibrationDeviations ? (
              <section className="methods-content-card">
                <h2>Calibration judgement</h2>
                {renderSectionOrNote(
                  sections.calibrationJudgement,
                  'calibration-judgement',
                  'No calibration judgement note was packaged with this build.',
                )}
                {sections.calibrationDeviations
                  ? renderMarkdownBlocks(sections.calibrationDeviations, 'calibration-deviations')
                  : null}
              </section>
            ) : null}

            <section className="methods-content-card">
              <h2>Provenance note</h2>
              {renderSectionOrNote(
                sections.provenance,
                'provenance',
                'The packaged README did not include a provenance note.',
              )}
            </section>
          </div>
        ) : null}

        {activeTab === 'conventions' ? (
          <div className="methods-section-stack">
            <section className="methods-content-card">
              <h2>Core modeling conventions</h2>
              {renderSectionOrNote(
                sections.conventions,
                'conventions',
                'No README convention section was packaged, so the app is using only the normalized library fields.',
              )}
            </section>
            <section className="methods-content-card">
              <h2>Short guidance on use</h2>
              {renderSectionOrNote(
                sections.guidance,
                'guidance',
                'No short guidance note was packaged with this build.',
              )}
            </section>

            {sections.methodsObjective || sections.methodsHierarchy || sections.methodsCostConvention || sections.methodsEmissionsBoundary ? (
              <section className="methods-content-grid">
                <article className="methods-content-card">
                  <h2>Methods overview</h2>
                  {sections.methodsObjective
                    ? renderMarkdownBlocks(sections.methodsObjective, 'methods-objective')
                    : null}
                  {renderSectionOrNote(
                    sections.methodsHierarchy,
                    'methods-hierarchy',
                    'No package-level methods overview was bundled.',
                  )}
                </article>

                <article className="methods-content-card">
                  <h2>Cost and emissions conventions</h2>
                  {renderSectionOrNote(
                    sections.methodsCostConvention,
                    'methods-cost',
                    'No explicit cost convention note was bundled.',
                  )}
                  {sections.methodsEmissionsBoundary
                    ? renderMarkdownBlocks(sections.methodsEmissionsBoundary, 'methods-emissions-boundary')
                    : null}
                </article>
              </section>
            ) : null}

            {enrichment.sectorStatesSchema ? (
              <MethodsSchemaSummaryCard schemaInfo={enrichment.sectorStatesSchema} />
            ) : null}
          </div>
        ) : null}

        {activeTab === 'confidence' ? (
          <div className="methods-section-stack">
            <section className="methods-content-card">
              <h2>Confidence distribution</h2>
              <div className="configuration-stat-grid">
                {Object.entries(confidenceCounts).map(([rating, count]) => (
                  <div key={rating} className="configuration-stat-card">
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
              {renderSectionOrNote(
                sections.phase2Judgement,
                'phase2-judgement',
                'No Phase 2 judgement note was packaged with this build.',
              )}
              {sections.phase2Weakest
                ? renderMarkdownBlocks(sections.phase2Weakest, 'phase2-weakest-inline')
                : null}
            </section>

            {sections.uncertaintyPractical ? (
              <section className="methods-content-card">
                <h2>How to use the uncertainty labels</h2>
                {renderMarkdownBlocks(sections.uncertaintyPractical, 'uncertainty-practical')}
              </section>
            ) : null}

            {sections.uncertaintyTests || sections.uncertaintyBottomLine ? (
              <section className="methods-content-card">
                <h2>First sensitivity tests</h2>
                {renderSectionOrNote(
                  sections.uncertaintyTests,
                  'uncertainty-tests',
                  'No uncertainty sensitivity guidance was bundled with this build.',
                )}
                {sections.uncertaintyBottomLine
                  ? renderMarkdownBlocks(sections.uncertaintyBottomLine, 'uncertainty-bottom-line')
                  : null}
              </section>
            ) : null}
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
              {evidenceFamilies.map((family) => {
                const sectorDocKey = sectorDerivationAliases[family.sector] ?? family.sector;
                const sectorDerivation = enrichment.sectorDerivations[sectorDocKey];
                const derivationExcerpt = sectorDerivation
                  ? getSectionExcerpt(sectorDerivation.content, ['Why this output was chosen', 'Key caveat'])
                  : '';

                return (
                  <article key={family.stateId} className="methods-evidence-card">
                  <div className="library-badge-row">
                    <span className="configuration-badge">{family.sector}</span>
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
                  {derivationExcerpt ? (
                    <div className="configuration-provenance-note">
                      <strong>{sectorDerivation?.title ?? 'Sector derivation note'}</strong>
                      <p>{derivationExcerpt}</p>
                    </div>
                  ) : null}
                  </article>
                );
              })}
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
