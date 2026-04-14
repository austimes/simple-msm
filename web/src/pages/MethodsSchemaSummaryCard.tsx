import React from 'react';
import type { PackageSchemaInfo } from '../data/types';

interface MethodsSchemaSummaryCardProps {
  schemaInfo: PackageSchemaInfo;
}

export default function MethodsSchemaSummaryCard({
  schemaInfo,
}: MethodsSchemaSummaryCardProps): React.JSX.Element {
  return (
    <section className="methods-content-card">
      <h2>Row schema guidance</h2>
      <p>
        The packaged library includes a JSON schema for{' '}
        <code>families/&lt;family_id&gt;/family_states.csv</code>.
        This card keeps the field-count summary in the app now that the dedicated State Schema page
        has been removed.
      </p>
      <div className="configuration-stat-grid">
        <div className="configuration-stat-card">
          <span>Schema fields</span>
          <strong>{schemaInfo.propertyCount}</strong>
        </div>
        <div className="configuration-stat-card">
          <span>Required fields</span>
          <strong>{schemaInfo.requiredFields.length}</strong>
        </div>
      </div>
    </section>
  );
}
