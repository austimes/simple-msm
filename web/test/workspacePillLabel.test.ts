import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  formatWorkspacePillLabel,
  WORKSPACE_PILL_LABEL_MAX_CHARS,
} from '../src/components/workspace/workspacePillLabel.ts';

describe('formatWorkspacePillLabel', () => {
  test('preserves short labels', () => {
    assert.equal(formatWorkspacePillLabel('Grid mix'), 'Grid mix');
  });

  test('truncates long labels at the shared fixed length', () => {
    const label = 'Incumbent thermal-heavy grid mix';
    const truncated = formatWorkspacePillLabel(label);

    assert.equal(truncated, 'Incumbent thermal-heavy g...');
    assert.equal(truncated.length, WORKSPACE_PILL_LABEL_MAX_CHARS);
  });
});
