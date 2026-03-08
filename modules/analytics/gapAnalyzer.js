// modules/analytics/gapAnalyzer.js
import fs from 'fs/promises';
import path from 'path';

export class GapAnalyzer {
    constructor(database, quizLogger, llm) {
        this.db = database;
        this.logger = quizLogger;
        this.llm = llm;
        const jsTopics = [
            // Core Fundamentals
            'lexical-environment',
            'execution-context',
            'variable-environment',
            'scope-chain',
            'temporal-dead-zone',
            'garbage-collection',
            'memory-leaks',
            'tail-call-optimization',

            // Your Existing Topics
            'closures',
            'prototypes',
            'promises',
            'async-await',
            'event-loop',
            'scope',
            'hoisting',
            'this-keyword',
            'classes',
            'modules',
            'generators',
            'iterators',
            'proxy',
            'reflect',
            'symbols',
            'weakmap-weakset',
            'set-map',
            'array-methods',
            'object-methods',
            'destructuring',
            'spread-operator',
            'rest-parameters',
            'template-literals',
            'tagged-templates',
            'arrow-functions',
            'default-parameters',
            'optional-chaining',
            'nullish-coalescing',
            'bigint',
            'symbol',
            'typed-arrays',
            'shared-memory',
            'atomics',
            'web-workers',
            'service-workers',
            'indexeddb',
            'fetch-api',
            'websockets',
            'shadow-dom',
            'custom-elements',
            'html-templates',
            'decorators',
            'reflect-metadata',
            'error-handling',
            'strict-mode',
            'ecmascript-proposals',

            // Advanced Functions
            'higher-order-functions',
            'pure-functions',
            'side-effects',
            'function-composition',
            'currying',
            'partial-application',
            'memoization',
            'throttling',
            'debouncing',
            'recursion-patterns',
            'trampoline-functions',
            'iife-patterns',
            'callback-patterns',
            'function-borrowing',

            // Objects & Prototypes Deep Dive
            'prototypal-inheritance',
            'property-descriptors',
            'getters-setters',
            'object-freeze-seal',
            'object-prevent-extensions',
            'property-enumeration',
            'object-create-patterns',
            'factory-functions',
            'constructor-functions',

            // Advanced Classes
            'private-class-fields',
            'private-class-methods',
            'static-class-fields',
            'static-initialization-blocks',
            'class-inheritance',
            'abstract-classes',
            'mixins',
            'computed-property-names',
            'brand-checking',
            'weakmap-private-data',

            // Arrays Deep Dive
            'sparse-arrays',
            'dense-arrays',
            'array-like-objects',
            'array-from',
            'array-of',
            'array-at-method',
            'array-grouping',
            'array-to-sorted',
            'array-to-reversed',
            'array-with',
            'array-flat-flatmap',
            'custom-array-iterables',

            // Strings & Text Processing
            'string-methods',
            'unicode-javascript',
            'string-normalization',
            'string-match-all',
            'string-replace-all',
            'intl-api',
            'intl-collator',
            'intl-datetimeformat',
            'intl-numberformat',
            'intl-listformat',
            'intl-relativetimeformat',
            'intl-segmenter',

            // Numbers & Mathematics
            'ieee-754',
            'number-epsilon',
            'safe-integers',
            'bitwise-operators',
            'math-object',
            'math-fround',
            'math-imul',
            'math-clz32',
            'arbitrary-precision',

            // Well-Known Symbols
            'symbol-for',
            'symbol-hasinstance',
            'symbol-isconcatspreadable',
            'symbol-iterator',
            'symbol-asynciterator',
            'symbol-match',
            'symbol-replace',
            'symbol-search',
            'symbol-split',
            'symbol-species',
            'symbol-toprimitive',
            'symbol-tostringtag',
            'symbol-dispose',

            // Maps, Sets & Weak Collections
            'map-weakmap',
            'set-weakset',
            'weakref',
            'finalizationregistry',
            'map-performance',
            'set-operations',

            // Advanced Promises & Async
            'promise-states',
            'promise-all',
            'promise-allsettled',
            'promise-race',
            'promise-any',
            'promise-chaining',
            'async-iterators',
            'async-generators',
            'for-await-of',
            'abortcontroller',
            'observable-patterns',

            // Event Loop Deep Dive
            'call-stack',
            'memory-heap',
            'macro-tasks',
            'micro-tasks',
            'job-queue',
            'render-queue',
            'requestanimationframe',
            'requestidlecallback',
            'queuemicrotask',

            // Modules & Code Organization
            'es6-modules',
            'commonjs',
            'dynamic-imports',
            'import-meta',
            'tree-shaking',
            'circular-dependencies',
            'module-federation',

            // Proxy & Reflection
            'proxy-traps',
            'revocable-proxies',
            'proxy-use-cases',
            'reflect-api',
            'metaprogramming',
            'virtual-objects',

            // Error Handling
            'custom-errors',
            'error-cause',
            'aggregateerror',
            'try-catch-finally',
            'error-boundaries',
            'stack-trace',
            'unhandled-rejection',

            // Memory & Performance
            'memory-profiling',
            'performance-api',
            'high-resolution-time',
            'transferable-objects',

            // Web APIs
            'intersection-observer',
            'mutation-observer',
            'resize-observer',
            'performance-observer',
            'geolocation-api',
            'clipboard-api',
            'fullscreen-api',
            'screen-orientation',
            'battery-api',
            'network-information',
            'device-memory',
            'hardware-concurrency',
            'web-crypto',
            'credential-management',
            'payment-request',
            'web-bluetooth',
            'web-usb',
            'web-serial',
            'web-nfc',
            'web-audio',
            'webrtc',

            // Storage & Persistence
            'localstorage',
            'sessionstorage',
            'cookies',
            'cache-api',
            'indexeddb-advanced',
            'file-system-access',
            'file-reader',
            'streams-api',
            'compression-streams',
            'web-locks',

            // Advanced DOM APIs
            'shadow-dom-open-closed',
            'custom-elements-lifecycle',
            'html-templates-slots',
            'declarative-shadow-dom',
            'range-api',
            'selection-api',
            'content-editable',
            'drag-and-drop',
            'pointer-events',
            'touch-events',
            'gesture-events',
            'scroll-behavior',
            'view-transitions',
            'css-typed-om',
            'css-painting-api',
            'css-layout-api',
            'web-animations',
            'element-timing',
            'largest-contentful-paint',

            // Network & Communication
            'fetch-advanced',
            'abort-fetch',
            'fetch-streaming',
            'websocket-advanced',
            'server-sent-events',
            'webtransport',
            'graphql-client',
            'cors-deep-dive',
            'content-security-policy',
            'subresource-integrity',

            // Security & Privacy
            'same-origin-policy',
            'xss-prevention',
            'csrf-prevention',
            'trusted-types',
            'iframe-sandbox',
            'permissions-policy',
            'secure-contexts',

            // Testing & Debugging
            'unit-testing',
            'integration-testing',
            'mocking-strategies',
            'test-coverage',
            'chrome-devtools',
            'performance-profiling',
            'memory-profiling',
            'async-debugging',
            'source-maps',
            'console-api',

            // Build Tools
            'babel-presets',
            'typescript-integration',
            'webpack-module-federation',
            'rollup',
            'esbuild',
            'swc-compiler',
            'code-splitting',
            'lazy-loading',
            'hot-module-replacement',
            'minification',
            'obfuscation',

            // Design Patterns
            'functional-programming',
            'reactive-programming',
            'rxjs',
            'observer-pattern',
            'pubsub-pattern',
            'singleton-pattern',
            'factory-pattern',
            'builder-pattern',
            'adapter-pattern',
            'facade-pattern',
            'decorator-pattern',
            'command-pattern',
            'state-pattern',
            'strategy-pattern',
            'mvc-pattern',
            'mvvm-pattern',
            'flux-pattern',
            'redux-pattern',

            // ECMAScript Proposals (Stage 3+)
            'record-tuple',
            'temporal-api',
            'decorators-new',
            'regexp-modifiers',
            'regexp-match-indices',
            'import-assertions',
            'json-modules',
            'array-grouping-proposal',
            'array-from-async',
            'iterator-helpers',
            'set-methods',
            'map-methods',
            'promise-try',
            'shadowrealm',
            'module-expressions',
            'pattern-matching',
            'do-expressions',
            'pipeline-operator',
            'partial-application',
            'function-bind',
            'decimal-api',

            // Performance Optimization
            'critical-rendering-path',
            'lazy-loading-strategies',
            'image-optimization',
            'font-loading',
            'virtual-scrolling',
            'jit-compilation',
            'hidden-classes',
            'inline-caching',

            // Modern Frameworks
            'react-advanced',
            'vue-composition-api',
            'angular-signals',
            'svelte-compilation',
            'solid-reactivity',
            'qwik-resumability',
            'server-components',
            'islands-architecture',
            'hydration-strategies',

            // Desktop & Mobile
            'electron-advanced',
            'react-native-bridge',
            'nativescript',
            'capacitor',
            'pwa-advanced',
            'webview-communication',
            'mobile-gestures',

            // Machine Learning
            'tensorflow-js',
            'onnx-runtime',
            'webgpu',
            'webnn',
            'transformers-js',
            'client-side-inference',

            // Advanced WebAssembly
            'wasm-integration',
            'wasm-gc',
            'wasi',
            'simd-operations',
            'sharedarraybuffer',
            'broadcast-channel',
            'channel-messaging',
            'beacon-api',
            'page-lifecycle',
            'idle-detection',
            'window-management',
            'webhid',
            'webauthn',
            'digital-goods',
            'handwriting-recognition',
            'shape-detection',
            'webcodecs',
            'webgpu-shading',
            'wasm-threads',
            'wasm-exception-handling',
            'wasm-reference-types',
            'wasm-tail-calls'
        ];
    }

    async analyzeGaps() {
        console.log('\n🔍 Analyzing knowledge gaps...');

        // Get all existing examples
        const examples = await this.db.getAllExamples();
        const existingTopics = new Set();
        const topicCoverage = {};

        // Analyze current examples
        examples.forEach(example => {
            const metadata = example.metadata;
            if (metadata.topic) {
                existingTopics.add(metadata.topic);
                topicCoverage[metadata.topic] = (topicCoverage[metadata.topic] || 0) + 1;
            }
        });

        // Get performance data
        const performance = await this.logger.getPerformanceByTopic();

        // Find missing topics
        const missingTopics = this.jsTopics.filter(t => !existingTopics.has(t));

        // Find weak topics (based on performance)
        const weakTopics = Object.entries(performance)
            .filter(([_, stats]) => stats.successRate < 70)
            .map(([topic]) => topic);

        // Find underrepresented topics (less than 3 examples)
        const underrepresented = Object.entries(topicCoverage)
            .filter(([_, count]) => count < 3)
            .map(([topic]) => topic);

        return {
            missingTopics,
            weakTopics,
            underrepresented,
            coverage: topicCoverage,
            performance
        };
    }

    async generateRecommendations() {
        const gaps = await this.analyzeGaps();
        const recommendations = [];

        // Priority 1: Weak topics you're struggling with
        if (gaps.weakTopics.length > 0) {
            for (const topic of gaps.weakTopics.slice(0, 2)) {
                recommendations.push({
                    priority: 'HIGH',
                    reason: `You're struggling with ${topic} (success rate < 70%)`,
                    topic,
                    action: 'create',
                    suggestedCount: 3
                });
            }
        }

        // Priority 2: Missing fundamental topics
        const fundamentalTopics = [
            'closures', 'prototypes', 'promises', 'async-await', 'event-loop'
        ];

        const missingFundamental = fundamentalTopics.filter(
            t => gaps.missingTopics.includes(t)
        );

        if (missingFundamental.length > 0) {
            recommendations.push({
                priority: 'HIGH',
                reason: `Missing fundamental topic: ${missingFundamental.join(', ')}`,
                topic: missingFundamental[0],
                action: 'create',
                suggestedCount: 2
            });
        }

        // Priority 3: Underrepresented topics
        if (gaps.underrepresented.length > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                reason: `Topic needs more examples: ${gaps.underrepresented[0]}`,
                topic: gaps.underrepresented[0],
                action: 'add',
                suggestedCount: 2
            });
        }

        // Priority 4: Advanced topics not covered
        const advancedTopics = [
            'proxy', 'reflect', 'generators', 'weakmap-weakset', 'shared-memory'
        ];

        const missingAdvanced = advancedTopics.filter(
            t => gaps.missingTopics.includes(t)
        );

        if (missingAdvanced.length > 0 && recommendations.length < 3) {
            recommendations.push({
                priority: 'LOW',
                reason: `Advanced topic not covered: ${missingAdvanced[0]}`,
                topic: missingAdvanced[0],
                action: 'create',
                suggestedCount: 1
            });
        }

        return recommendations;
    }

    async suggestNewTopic() {
        const gaps = await this.analyzeGaps();

        // Use LLM to suggest the most relevant missing topic
        const prompt = `Based on this JavaScript learning data:
    
Existing topics with example counts:
${Object.entries(gaps.coverage).map(([t, c]) => `- ${t}: ${c} examples`).join('\n')}

Missing topics:
${gaps.missingTopics.join(', ')}

Performance on weak topics:
${Object.entries(gaps.performance)
                .filter(([_, p]) => p.successRate < 70)
                .map(([t, p]) => `- ${t}: ${p.successRate}% success rate`)
                .join('\n')}

Which ONE JavaScript topic would be MOST valuable to add next? 
Consider:
1. Fill knowledge gaps
2. Build on existing examples
3. Address weak performance areas
4. Follow logical learning progression

Return ONLY the topic name.`;

        const response = await this.llm.generate(prompt);
        return response.trim();
    }
}