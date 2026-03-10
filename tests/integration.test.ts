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
import { FrameworkService } from '../src/frameworks/framework-service';
import { MetricsCalculator } from '../src/utils/metrics-calculator';
import { ConfigLoader } from '../src/utils/config-loader';
import { DEFAULT_MODEL } from '../src/core/types';
import { isSourceFile, isTestFile, isConfigFile } from '../src/utils/file-classifier';
import { registerAllFrameworks } from '../src/frameworks/index';
import type { ChangedFile } from '../src/core/types';
import * as fs from 'fs';
import * as path from 'path';

describe('Dialectic PR Integration Tests', () => {
  let analyzer: PRAnalyzer;
  let consensusEngine: ConsensusEngine;
  let strategySelector: StrategySelector;
  let configLoader: ConfigLoader;

  beforeAll(async () => {
    registerAllFrameworks();

    // Load test configuration
    configLoader = new ConfigLoader();
    const config = await configLoader.load(process.cwd());

    // Initialize components
    const excludeFilter = new ExcludeFilter(config.exclude_patterns);
    const smartFilter = new SmartFilter();
    const frameworkDetector = new FrameworkDetector();

    analyzer = new PRAnalyzer(excludeFilter, smartFilter, frameworkDetector, new FrameworkService());
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
      expect(config.model).toBe(DEFAULT_MODEL);
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
      const analysis = await analyzer.analyze(
        sampleDiff,
        changedFiles,
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
      const analysis = await analyzer.analyze(
        sampleDiff,
        changedFiles,
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
    });

    it('should return default config when file does not exist', async () => {
      const config = await configLoader.load('/nonexistent/path');

      expect(config.model).toBe(DEFAULT_MODEL);
      expect(config.exclude_patterns).toBeInstanceOf(Array);
      expect(config.strategies).toBeDefined();
    });
  });

  describe('File Classification', () => {
    it('should identify source files', () => {
      expect(isSourceFile('src/auth/auth.controller.ts')).toBe(true);
      expect(isSourceFile('src/index.js')).toBe(true);
      expect(isSourceFile('package.json')).toBe(false);
      expect(isSourceFile('package-lock.json')).toBe(false);
      // .js files in dist are still source files unless explicitly excluded
      expect(isSourceFile('dist/bundle.js')).toBe(true);
    });

    it('should detect test files', () => {
      expect(isTestFile('src/auth/auth.controller.spec.ts')).toBe(true);
      expect(isTestFile('src/auth/auth.test.ts')).toBe(true);
      expect(isTestFile('tests/integration.test.ts')).toBe(true);
      expect(isTestFile('src/auth/auth.controller.ts')).toBe(false);
    });

    it('should detect config files', () => {
      expect(isConfigFile('tsconfig.json')).toBe(true);
      expect(isConfigFile('jest.config.js')).toBe(true);
      expect(isConfigFile('next.config.ts')).toBe(true);
      expect(isConfigFile('package.json')).toBe(true);
      expect(isConfigFile('src/config/database.ts')).toBe(false);
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate PR metrics correctly', () => {
      const diff = fs.readFileSync(
        path.join(__dirname, '__fixtures__', 'sample-pr.diff'),
        'utf-8'
      );
      const files = ['src/auth/auth.controller.ts', 'src/auth/dto/login.dto.ts'];

      const metrics = MetricsCalculator.calculate(diff, files);

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
    });
  });
});
