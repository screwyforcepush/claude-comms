/**
 * Root-file fetch gate tests (ROOT_FILES single source of truth).
 *
 * These tests prove that the GitHub fetcher's root-file handling is driven by
 * the ROOT_FILES array in src/utils/constants.js — NOT by hardcoded filenames.
 * Coverage:
 *   - tarball strategy extracts every ROOT_FILES entry (CLAUDE.md AND GEMINI.md)
 *     as sibling top-level keys on the result object
 *   - raw-URL fallback strategy fetches every ROOT_FILES entry
 *   - adding a hypothetical third filename to ROOT_FILES requires no code change
 *     beyond the array (the gate is data-driven)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const tar = require('tar');

const { GitHubFetcher } = require('../../../src/fetcher/github');
const { ROOT_FILES } = require('../../../src/utils/constants');
const GitHubAPIMock = require('../../mocks/github-api');

/**
 * Build an in-memory GitHub-style tarball buffer.
 * GitHub tarballs are rooted at "owner-repo-hash/...". We mirror that so the
 * fetcher's root-prefix stripping is exercised exactly as in production.
 *
 * @param {Object} fileMap - { '<relativePath>': '<content>' }
 * @returns {Promise<Buffer>}
 */
async function buildTarball(fileMap) {
  const rootDir = 'screwyforcepush-claude-comms-deadbeef';
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roottar-stage-'));
  const repoRoot = path.join(stageDir, rootDir);

  for (const [relPath, content] of Object.entries(fileMap)) {
    const full = path.join(repoRoot, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
  }

  const tarPath = path.join(stageDir, 'repo.tar.gz');
  await tar.create({ gzip: true, cwd: stageDir, file: tarPath }, [rootDir]);
  const buffer = fs.readFileSync(tarPath);

  fs.rmSync(stageDir, { recursive: true, force: true });
  return buffer;
}

/** Default fake-repo contents covering all current ROOT_FILES plus dir files. */
function defaultRepoFiles(extra = {}) {
  const files = {
    '.claude/settings.json': JSON.stringify({ version: '1.0.0' }),
    '.claude/hooks/comms/send_message.py': 'print("send")',
    '.agents/AGENTS.md': '# Agents'
  };
  for (const name of ROOT_FILES) {
    files[name] = `# ${name}\n\nRoot file content for ${name}.`;
  }
  return { ...files, ...extra };
}

describe('GitHubFetcher root-file gate (ROOT_FILES)', () => {
  let fetcher;

  beforeEach(() => {
    fetcher = new GitHubFetcher();
  });

  describe('tarball strategy', () => {
    it('extracts every ROOT_FILES entry as a sibling top-level key', async () => {
      const buffer = await buildTarball(defaultRepoFiles());

      const result = await fetcher._extractTarballFiles(buffer, {});

      // CLAUDE.md (existing behavior) and GEMINI.md (new) are siblings.
      // NB: pass the dotted filename as an array so Jest treats it as a literal
      // key, not a nested path.
      for (const name of ROOT_FILES) {
        expect(result).toHaveProperty([name]);
        expect(result[name]).toBeDefined();
        expect(result[name].path).toBe(name);
        expect(result[name].content).toContain(name);
        expect(result[name].type).toBe('file');
      }

      // Regression: keep the per-filename keys (no rootFiles:{} bucket).
      expect(result).not.toHaveProperty(['rootFiles']);

      // Directory groups still present and populated.
      expect(result['.claude'].files.length).toBeGreaterThan(0);
      expect(result['.agents'].files.length).toBeGreaterThan(0);
    });

    it('extracts GEMINI.md specifically from the tarball', async () => {
      const buffer = await buildTarball(defaultRepoFiles());

      const result = await fetcher._extractTarballFiles(buffer, {});

      expect(result).toHaveProperty(['GEMINI.md']);
      expect(result['GEMINI.md'].content).toContain('GEMINI.md');
    });

    it('reports a ROOT_FILES entry as missing when absent (required semantics)', async () => {
      // Tarball that omits GEMINI.md.
      const files = defaultRepoFiles();
      delete files['GEMINI.md'];
      const buffer = await buildTarball(files);

      const result = await fetcher._extractTarballFiles(buffer, {});

      expect(result['CLAUDE.md']).toBeDefined();
      // Missing root file is left unset so downstream required-checks can detect it.
      expect(result['GEMINI.md']).toBeUndefined();
    });

    it('is data-driven: a hypothetical third ROOT_FILES entry needs no code change', async () => {
      const HYPOTHETICAL = 'HYPOTHETICAL_ROOT.md';
      ROOT_FILES.push(HYPOTHETICAL);
      try {
        const buffer = await buildTarball(
          defaultRepoFiles({ [HYPOTHETICAL]: '# Hypothetical root file' })
        );

        const result = await fetcher._extractTarballFiles(buffer, {});

        // The new filename is extracted with zero changes to github.js.
        expect(result).toHaveProperty([HYPOTHETICAL]);
        expect(result[HYPOTHETICAL].path).toBe(HYPOTHETICAL);
        expect(result[HYPOTHETICAL].content).toContain('Hypothetical');
      } finally {
        // Restore the shared array for other tests.
        const idx = ROOT_FILES.indexOf(HYPOTHETICAL);
        if (idx !== -1) ROOT_FILES.splice(idx, 1);
      }
    });
  });

  describe('raw-URL fallback strategy', () => {
    let mockApi;
    let rawFetcher;

    beforeEach(() => {
      mockApi = new GitHubAPIMock();
      // Match the mock's repo (alexsavage/claude-comms) so raw URLs resolve.
      // retryCount:1 keeps a single attempt so one mocked error -> raw fallback,
      // with no retry re-requests that would need extra interceptors.
      rawFetcher = new GitHubFetcher({
        repository: { owner: 'alexsavage', repo: 'claude-comms', branch: 'main' },
        retryCount: 1,
        retryDelay: 1
      });
    });

    afterEach(() => {
      mockApi.cleanup();
    });

    it('allowlists every ROOT_FILES entry in the raw-URL directory strategy', async () => {
      // The gate is `(ROOT_FILES.includes(path) && filePath === path)` in
      // _fetchWithRawUrls. Each root filename must be fetchable as its own path.
      for (const name of ROOT_FILES) {
        mockApi.mockRawDownload(name, `# ${name} via raw`);

        const tree = await rawFetcher._fetchWithRawUrls(name, { version: 'main' });

        const fetched = tree.files.map(f => f.path);
        expect(fetched).toContain(name);
      }
    });

    it('raw-URL directory fallback includes GEMINI.md in the known root files', async () => {
      // _fetchWithRawUrls allowlists root files via `(ROOT_FILES.includes(path) && filePath === path)`.
      // Exercise the GEMINI.md path directly.
      mockApi.mockRawDownload('GEMINI.md', '# GEMINI via raw url strategy');

      const tree = await rawFetcher._fetchWithRawUrls('GEMINI.md', { version: 'main' });

      const fetched = tree.files.map(f => f.path);
      expect(fetched).toContain('GEMINI.md');
    });
  });
});
