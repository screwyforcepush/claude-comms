/**
 * Orchestrator root-file tests (ROOT_FILES single source of truth).
 *
 * Verifies that the Installer treats every ROOT_FILES entry with the same
 * "required" semantics CLAUDE.md has always had:
 *   - individual fetch builds a sibling per-filename key for each ROOT_FILE
 *   - _validateFetchedFiles reports incomplete when ANY ROOT_FILE is missing
 *   - verify requiredPaths includes every ROOT_FILE
 *   - the checks are data-driven (a third filename needs no code change)
 */

const { Installer } = require('../../../src/orchestrator/installer');
const { ROOT_FILES } = require('../../../src/utils/constants');

function makeInstaller(overrides = {}) {
  const mockFetcher = {
    fetchDirectory: jest.fn().mockResolvedValue({ path: '.claude', type: 'dir', children: [] }),
    fetchFile: jest.fn().mockImplementation((p) =>
      Promise.resolve({ path: p, content: `# ${p}`, encoding: 'utf-8' })
    ),
    validateConnection: jest.fn().mockResolvedValue(true)
  };
  const mockWriter = {
    writeFile: jest.fn(),
    writeDirectory: jest.fn().mockResolvedValue({ written: [], skipped: [], backed_up: new Map(), errors: [] }),
    backup: jest.fn(),
    rollback: jest.fn(),
    removeFile: jest.fn(),
    validateInstallationCompleteness: jest.fn().mockResolvedValue({ complete: true, issues: [] })
  };
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const mockValidator = {
    validateTargetDirectory: jest.fn().mockResolvedValue(null),
    validatePythonEnvironment: jest.fn().mockResolvedValue(null),
    checkExistingFiles: jest.fn().mockResolvedValue(null),
    validateNetworkAccess: jest.fn().mockResolvedValue(null),
    pathExists: jest.fn().mockResolvedValue(true)
  };

  const installer = new Installer({
    fetcher: mockFetcher,
    writer: mockWriter,
    logger: mockLogger,
    validator: mockValidator,
    ...overrides
  });
  installer.options = { targetDir: '/test/target', version: 'main', cache: false };
  return { installer, mockFetcher, mockWriter, mockValidator, mockLogger };
}

describe('Installer ROOT_FILES handling', () => {
  describe('individual fetch builds sibling per-filename keys', () => {
    it('fetches every ROOT_FILES entry and stores it under its own key', async () => {
      const { installer, mockFetcher } = makeInstaller();

      const fetched = await installer._fetchInstallationFiles();

      for (const name of ROOT_FILES) {
        expect(mockFetcher.fetchFile).toHaveBeenCalledWith(name, expect.any(Object));
        expect(fetched[name]).toBeDefined();
        // No rootFiles:{} bucket — siblings only.
        expect(fetched).not.toHaveProperty('rootFiles');
      }
      // Specifically: GEMINI.md is fetched alongside CLAUDE.md.
      expect(mockFetcher.fetchFile).toHaveBeenCalledWith('GEMINI.md', expect.any(Object));
    });
  });

  describe('_validateFetchedFiles required semantics', () => {
    const baseDirs = () => ({
      '.claude': { path: '.claude', type: 'dir', children: [
        { path: 'hooks', type: 'dir', children: [] },
        { path: 'agents', type: 'dir', children: [] },
        { path: 'commands', type: 'dir', children: [] }
      ] },
      '.agents': { path: '.agents', type: 'dir', children: [] }
    });

    it('is complete when every ROOT_FILES entry is present', () => {
      const { installer } = makeInstaller();
      const fetched = baseDirs();
      for (const name of ROOT_FILES) fetched[name] = { path: name, content: '# x' };

      const result = installer._validateFetchedFiles(fetched);

      expect(result.complete).toBe(true);
    });

    it('FAILS validation when GEMINI.md is missing (required, mirrors CLAUDE.md)', () => {
      const { installer } = makeInstaller();
      const fetched = baseDirs();
      fetched['CLAUDE.md'] = { path: 'CLAUDE.md', content: '# c' };
      // GEMINI.md intentionally omitted.

      const result = installer._validateFetchedFiles(fetched);

      expect(result.complete).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ component: 'GEMINI.md', message: 'Missing GEMINI.md file' })
        ])
      );
    });

    it('FAILS validation when CLAUDE.md is missing (unchanged behavior)', () => {
      const { installer } = makeInstaller();
      const fetched = baseDirs();
      fetched['GEMINI.md'] = { path: 'GEMINI.md', content: '# g' };

      const result = installer._validateFetchedFiles(fetched);

      expect(result.complete).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ component: 'CLAUDE.md' })
        ])
      );
    });
  });

  describe('verify requires every ROOT_FILES entry on disk', () => {
    it('throws when a ROOT_FILE is absent after install', async () => {
      const { installer, mockValidator } = makeInstaller();
      // .claude/.agents exist; CLAUDE.md exists; GEMINI.md is missing on disk.
      mockValidator.pathExists.mockImplementation((p) =>
        Promise.resolve(!p.endsWith(`${require('path').sep}GEMINI.md`))
      );

      await expect(installer._verifyInstallation()).rejects.toThrow(/GEMINI\.md/);
    });

    it('passes verification when all ROOT_FILES entries are present', async () => {
      const { installer, mockValidator } = makeInstaller();
      mockValidator.pathExists.mockResolvedValue(true);

      await expect(installer._verifyInstallation()).resolves.toBeUndefined();
    });
  });

  describe('data-driven: a third ROOT_FILES entry requires no code change', () => {
    it('fetches and requires a hypothetical third root file', async () => {
      const HYPO = 'HYPOTHETICAL_ROOT.md';
      ROOT_FILES.push(HYPO);
      try {
        const { installer, mockFetcher } = makeInstaller();

        const fetched = await installer._fetchInstallationFiles();
        expect(mockFetcher.fetchFile).toHaveBeenCalledWith(HYPO, expect.any(Object));
        expect(fetched[HYPO]).toBeDefined();

        // Validation now requires it too, with zero source changes.
        const validation = installer._validateFetchedFiles({
          '.claude': { path: '.claude', type: 'dir', children: [] },
          '.agents': { path: '.agents', type: 'dir', children: [] },
          'CLAUDE.md': { path: 'CLAUDE.md', content: '# c' },
          'GEMINI.md': { path: 'GEMINI.md', content: '# g' }
          // HYPO omitted -> must be flagged missing
        });
        expect(validation.complete).toBe(false);
        expect(validation.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ component: HYPO })])
        );
      } finally {
        const idx = ROOT_FILES.indexOf(HYPO);
        if (idx !== -1) ROOT_FILES.splice(idx, 1);
      }
    });
  });
});
