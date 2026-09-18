import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { withProjectId } from '../../app/lib/project-navigation.ts';

test('workspace traffic action uses only the current verified published project', async () => {
  const source = await readFile('app/master-workspace/page.tsx', 'utf8');
  const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  const visit = node => {
    if (ts.isJsxExpression(node) && node.expression && node.getText(ast).includes('>Website Traffic</Link>')) expression = node.expression.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(expression, 'workspace contains the traffic action');
  const code = ts.transpileModule(`result = (${expression});`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
  const base = { connected: true, project: { id: 'owned/a & b' }, projectId: 'owned/a & b', publicationProjectId: 'owned/a & b', publication: { status: 'active', publicUrl: '/business/studio' } };
  const render = overrides => {
    const context = { ...base, ...overrides, React, Link: 'a', withProjectId, result: null };
    vm.runInNewContext(code, context);
    return context.result;
  };
  const link = render({});
  const url = new URL(link.props.href, 'https://app.test');
  assert.equal(url.pathname, '/analytics-ai');
  assert.equal(url.searchParams.get('projectId'), base.projectId);
  assert.equal(url.hash, '');
  assert.equal(link.props.children, 'Website Traffic');
  for (const overrides of [
    { connected: false }, { project: null }, { project: { id: 'previous' } },
    { publicationProjectId: 'previous' }, { publicationProjectId: '' },
    { publication: { status: 'unpublished' } }, { publication: { status: 'inactive', publicUrl: '/business/studio' } },
    { publication: { status: 'active' } }, { projectId: '' },
  ]) assert.ok(!render(overrides), JSON.stringify(overrides));
  assert.match(source, /if \(response\.ok && active\) \{ setPublication\(data\.publication as BusinessPublication\); setPublicationProjectId\(projectId\);/);
});

test('sidebar retains one project-aware Analytics destination under Advanced Tools', async () => {
  const source = await readFile('app/dashboard/components/Sidebar.tsx', 'utf8');
  assert.equal((source.match(/href: "\/analytics-ai"/g) || []).length, 1);
  assert.match(source.slice(source.indexOf('const ADVANCED_ITEMS')), /label: "Analytics", href: "\/analytics-ai"/);
  assert.match(source, /withProjectId\(path, projectId\)/);
  assert.doesNotMatch(source, /\/admin\/platform-analytics/);
});
