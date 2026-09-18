import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { websiteTrafficIdentity } from '../../app/lib/website-traffic.ts';
import { randomUUID } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

test('tracker sends once after successful mount/navigation, cancels StrictMode and excludes preview paths', async () => {
  const source = await readFile(new URL('../../app/components/WebsiteTrafficTracker.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let pathname = '/business/studio', cleanup;
  const events = [], timers = new Map(); let timerId = 0;
  const memory = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v) }; };
  const module = { exports: {} };
  const context = { module, exports: module.exports, crypto: { randomUUID }, localStorage: memory(), sessionStorage: memory(), document: { referrer: '' }, navigator: {},
    window: { location: { search: '', origin: 'https://app.test' }, setTimeout: fn => { timers.set(++timerId,fn); return timerId; }, clearTimeout: id => timers.delete(id) },
    fetch: async (_, init) => { events.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); },
    require: name => name === 'react' ? { useEffect: fn => { cleanup = fn(); } } : name === 'next/navigation' ? { usePathname: () => pathname } : { websiteTrafficIdentity },
  };
  vm.runInNewContext(code, context);
  const render = (pagePath = '/') => module.exports.default({ kind: 'business', publicationId: 'pub-a', slug: 'studio', pagePath });
  const flush = async () => { const queued = [...timers.values()]; timers.clear(); for (const fn of queued) await fn(); };
  render(); cleanup(); render(); await flush(); assert.equal(events.length, 1);
  cleanup(); pathname='/business/studio/about'; render('/about'); await flush(); assert.equal(events.length, 2);
  assert.equal(events[1].pagePath, '/about'); assert.equal(events[0].visitorId, events[1].visitorId); assert.notEqual(events[0].eventId, events[1].eventId);
  for (const path of ['/business-preview','/dashboard/website-ai','/business/studio/missing']) { cleanup?.(); pathname=path; render(); await flush(); }
  assert.equal(events.length, 2);
  for (const file of ['app/dashboard/components/WebsitePreview.tsx','app/dashboard/components/WebsiteSiteRenderer.tsx','app/business-preview/page.tsx','app/dashboard/website-ai/page.tsx']) assert.doesNotMatch(await readFile(file,'utf8'), /<WebsiteTrafficTracker/);
});

test('all public route branches mount a tracker only after publication loading, outside shared renderers', async () => {
  for (const file of ['app/business/[slug]/page.tsx','app/business/[slug]/[...path]/page.tsx','app/published-sites/[slug]/page.tsx','app/published-sites/[slug]/[...path]/page.tsx']) {
    const source = await readFile(file,'utf8');
    assert.match(source, /<WebsiteTrafficTracker/);
    assert.ok(source.indexOf('notFound()') < source.indexOf('<WebsiteTrafficTracker'));
    const expected = file === 'app/business/[slug]/page.tsx' ? 2 : 1; // two mutually exclusive root rendering branches
    assert.equal((source.match(/<WebsiteTrafficTracker/g) || []).length, expected);
  }
});

test('traffic panel separates loading, empty and error states and hides another project or user data', async () => {
  const source = await readFile(new URL('../../app/components/WebsiteTrafficPanel.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  let state, index;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name === 'react' ? { ...React, useEffect: () => {}, useState: initial => [index++ === 2 ? state : initial, () => {}] } : name.startsWith('react/') ? require(name) : name.endsWith('/auth') && name !== 'firebase/auth' ? { __esModule: true, default: { currentUser: { uid: 'A' } } } : {} });
  const html = (next) => { index=0; state=next; return renderToStaticMarkup(React.createElement(module.exports.default, {projectId:'project-a'})); };
  assert.match(html({ projectId:'',uid:'' }), /Loading website traffic/);
  assert.match(html({ projectId:'project-a',uid:'A',error:'Tracking unavailable' }), /role="alert"/);
  const zero = { visitorsToday:0,pageViewsToday:0,visitors7Days:0,visitors30Days:0,pageViews7Days:0,pageViews30Days:0,daily:[],periods:{'7':{pages:[],referrers:[],sources:[]},'30':{pages:[],referrers:[],sources:[]}} };
  assert.match(html({projectId:'project-a',uid:'A',data:zero}),/No traffic recorded/);
  assert.doesNotMatch(html({projectId:'project-b',uid:'A',data:zero}),/No traffic recorded/);
  assert.doesNotMatch(html({projectId:'project-a',uid:'B',data:zero}),/No traffic recorded/);
});
