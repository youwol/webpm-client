/* eslint-env node -- eslint-comment add exception because the running context is node environment */
module.exports = {
    // The order below is intentional, it is related to symbols being re-exported.
    entryPoints: ['./src/lib/workers-pool/index.ts', './src/index.ts'],
    exclude: ['src/tests'],
    intentionallyNotExported: [
        'InstallModulesInputs',
        'InstallScriptsInputs',
        'InstallStyleSheetsInputs',
        'StateImplementation',
    ],
    out: 'dist/docs',
    theme: 'default',
    categorizeByGroup: false,
    categoryOrder: [
        'Getting Started',
        'Entry Points',
        'Loading screen',
        'State',
        'WorkersPool',
        'Worker Environment',
        "Client's method inputs",
        'Events',
        "Worker's Message",
        'Errors',
        'View',
        'Helpers',
        '*',
    ],
}
