/**
 * Integration Tests for Dialectic PR
 *
 * Tests the complete flow from PR analysis to review generation
 */

import { PRAnalyzer } from '../src/core/analyzer';
import { ConsensusEngine } from '../src/core/consensus-engine';
import { StrategySelector } from '../src/core/strategy-selector';
import { ExcludeFilter } from '../src/security/exclude-filter';
import { SmartFilter } from '../src/core/smart-filter';
import { FrameworkDetector } from '../src/frameworks/detector';
import { MetricsCalculator } from '../src/utils/metrics-calculator';
import { ConfigLoader } from '../src/utils/config-loader';
import type { ChangedFile } from '../src/core/types';
import * as fs from 'fs';
import * as path from 'path';

describe('Dialectic PR Integration Tests', () => {
  let analyzer: PRAnalyzer;
  let consensusEngine: ConsensusEngine;
  let strategySelector: StrategySelector;
  let configLoader: ConfigLoader;

  beforeAll(async () => {
    // Load test configuration
    configLoader = new ConfigLoader();
    const config = await configLoader.load(process.cwd());

    // Initialize components
    const excludeFilter = new ExcludeFilter(config.exclude_patterns);
    const smartFilter = new SmartFilter();
    const frameworkDetector = new FrameworkDetector();

    analyzer = new PRAnalyzer(excludeFilter, smartFilter, frameworkDetector);
    strategySelector = new StrategySelector();
  });

  describe('Module Initialization', () => {
    it('should initialize all modules without errors', () => {
      expect(analyzer).toBeDefined();
      expect(strategySelector).toBeDefined();
      expect(configLoader).toBeDefined();
    });

    it('should load default configuration', async () => {
      const config = await configLoader.load(process.cwd());
      expect(config.model).toBe('claude-sonnet-4-20250514');
      expect(config.exclude_patterns).toBeInstanceOf(Array);
      expect(config.strategies).toBeDefined();
    });
  });

  describe('PR Analysis Flow', () => {
    let sampleDiff: string;
    let changedFiles: ChangedFile[];

    beforeAll(() => {
      // Load sample PR diff
      const fixturePath = path.join(__dirname, '__fixtures__', 'sample-pr.diff');
      sampleDiff = fs.readFileSync(fixturePath, 'utf-8');

      // Create changed files array
      changedFiles = [
        {
          path: 'src/auth/auth.controller.ts',
          content: sampleDiff,
          additions: 5,
          deletions: 2,
        },
        {
          path: 'src/auth/dto/login.dto.ts',
          content: sampleDiff,
          additions: 12,
          deletions: 0,
        },
        {
          path: 'src/auth/auth.service.ts',
          content: sampleDiff,
          additions: 4,
          deletions: 1,
        },
      ];
    });

    it('should analyze PR and generate metrics', async () => {
      const prInfo = {
        owner: 'test-owner',
        repo: 'test-repo',
        pullNumber: 123,
        baseBranch: 'main',
        headBranch: 'feature/auth-improvements',
      };

      const analysis = await analyzer.analyze(
        sampleDiff,
        changedFiles,
        prInfo,
        process.cwd()
      );

      expect(analysis).toBeDefined();
      expect(analysis.metrics.fileCount).toBeGreaterThan(0);
      expect(analysis.context.framework).toBeDefined();
      expect(analysis.prioritizedFiles).toBeInstanceOf(Array);
    });

    it('should detect NestJS framework', async () => {
      const frameworkDetector = new FrameworkDetector();
      const framework = await frameworkDetector.detect(
        process.cwd(),
        changedFiles.map((f) => f.path)
      );

      // Should detect NestJS from controller files
      expect(framework.name).toBe('nestjs');
      expect(framework.confidence).toBeDefined();
    });

    it('should exclude sensitive files', () => {
      const excludeFilter = new ExcludeFilter([
        '**/*.lock',
        '**/node_modules/**',
        '**/.env',
      ]);

      expect(excludeFilter.shouldExclude('package-lock.json')).toBe(true);
      expect(excludeFilter.shouldExclude('node_modules/test/file.js')).toBe(true);
      expect(excludeFilter.shouldExclude('.env')).toBe(true);
      expect(excludeFilter.shouldExclude('src/auth/auth.controller.ts')).toBe(false);
    });

    it('should prioritize files correctly', () => {
      const smartFilter = new SmartFilter();
      const prioritized = smartFilter.prioritizeFiles(changedFiles);

      expect(prioritized).toBeInstanceOf(Array);
      expect(prioritized.length).toBeGreaterThan(0);
      expect(prioritized[0]).toHaveProperty('priority');
      expect(prioritized[0]).toHaveProperty('reason');
    });

    it('should select appropriate review strategy', async () => {
      const selector = new StrategySelector();

      // Create a mock analysis
      const prInfo = {
        owner: 'test-owner',
        repo: 'test-repo',
        pullNumber: 123,
        baseBranch: 'main',
        headBranch: 'feature/test',
      };

      const analysis = await analyzer.analyze(
        sampleDiff,
        changedFiles,
        prInfo,
        process.cwd()
      );

      const strategy = selector.select(analysis);

      expect(strategy).toBeDefined();
      expect(strategy.name).toMatch(/^(small|medium|large|xlarge|skip)$/);
      expect(strategy.maxTokens).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration Loading', () => {
    it('should load config from repository', async () => {
      const config = await configLoader.load(process.cwd());

      expect(config.model).toBeDefined();
      expect(config.exclude_patterns).toBeInstanceOf(Array);
      expect(config.strategies).toBeDefined();
      expect(config.false_positive_patterns).toBeInstanceOf(Array);
    });

    it('should return default config when file does not exist', async () => {
      const config = await configLoader.load('/nonexistent/path');

      expect(config.model).toBe('claude-sonnet-4-20250514');
      expect(config.exclude_patterns).toBeInstanceOf(Array);
      expect(config.strategies).toBeDefined();
    });
  });

  describe('File Filtering', () => {
    it('should filter out non-source files', () => {
      const excludeFilter = new ExcludeFilter([
        '**/*.lock',
        '**/*.json',
      ]);

      expect(excludeFilter.isSourceFile('src/auth/auth.controller.ts')).toBe(true);
      expect(excludeFilter.isSourceFile('src/index.js')).toBe(true);
      expect(excludeFilter.isSourceFile('package.json')).toBe(false);
      expect(excludeFilter.isSourceFile('package-lock.json')).toBe(false);
      // .js files in dist are still source files unless explicitly excluded
      expect(excludeFilter.isSourceFile('dist/bundle.js')).toBe(true);
    });

    it('should detect test files', () => {
      const excludeFilter = new ExcludeFilter([]);

      expect(excludeFilter.isTestFile('src/auth/auth.controller.spec.ts')).toBe(true);
      expect(excludeFilter.isTestFile('src/auth/auth.test.ts')).toBe(true);
      expect(excludeFilter.isTestFile('tests/integration.test.ts')).toBe(true);
      expect(excludeFilter.isTestFile('src/auth/auth.controller.ts')).toBe(false);
    });

    it('should detect config files', () => {
      const excludeFilter = new ExcludeFilter([]);

      expect(excludeFilter.isConfigFile('tsconfig.json')).toBe(true);
      expect(excludeFilter.isConfigFile('jest.config.js')).toBe(true);
      expect(excludeFilter.isConfigFile('next.config.ts')).toBe(true);
      expect(excludeFilter.isConfigFile('package.json')).toBe(true);
      expect(excludeFilter.isConfigFile('src/config/database.ts')).toBe(false);
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate PR metrics correctly', () => {
      const metricsCalculator = new MetricsCalculator();
      const diff = fs.readFileSync(
        path.join(__dirname, '__fixtures__', 'sample-pr.diff'),
        'utf-8'
      );
      const files = ['src/auth/auth.controller.ts', 'src/auth/dto/login.dto.ts'];

      const metrics = metricsCalculator.calculate(diff, files);

      expect(metrics.fileCount).toBe(2);
      expect(metrics.addedLines).toBeGreaterThan(0);
      expect(metrics.deletedLines).toBeGreaterThanOrEqual(0);
      expect(metrics.diffSize).toBeGreaterThan(0);
      expect(metrics.tsFileCount).toBe(2);
      expect(metrics.jsFileCount).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', async () => {
      const loader = new ConfigLoader();

      // Should return default config when file doesn't exist
      const config = await loader.load('/nonexistent/path');

      expect(config).toBeDefined();
      expect(config.model).toBeDefined();
    });

    it('should validate configuration structure', async () => {
      const loader = new ConfigLoader();
      const config = await loader.load(process.cwd());

      expect(config).toHaveProperty('model');
      expect(config).toHaveProperty('exclude_patterns');
      expect(config).toHaveProperty('strategies');
      expect(config).toHaveProperty('false_positive_patterns');
    });
  });
});
