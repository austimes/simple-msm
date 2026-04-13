import React from 'react';
import { Link } from 'react-router-dom';
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
        The packaged library includes a JSON schema for `sector_state_curves_balanced.csv`. The dedicated State
        Schema page explains the contribution unit, milestone-year expectations, CSV encodings, and
        every field in plain language.
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
      <div className="configuration-action-row">
        <Link className="configuration-button configuration-button--ghost" to="/state-schema">
          Open State Schema
        </Link>
      </div>
    </section>
  );
}
