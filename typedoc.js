/* eslint-env node -- eslint-comment add exception because the running context is node environment */
module.exports = {
    entryPoints: ['./src/index.ts', './src/lib/workers-pool/index.ts'],
    exclude: ['src/tests'],
    out: 'dist/docs',
    theme: 'default',
    categorizeByGroup: false,
    categoryOrder: [
        'Getting Started',
        'Entry Points',
        'Loading screen',
        'State',
        'WorkersPool',
        'Worker',
        "Client's method inputs",
        'Events',
        "Worker's Message",
        'Errors',
        'Helpers',
        '*',
    ],
}
