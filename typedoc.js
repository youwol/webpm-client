module.exports = {
    entryPoints: ['./src/index.ts'],
    exclude: ['src/tests'],
    out: 'dist/docs',
    theme: 'default',
    categorizeByGroup: false,
    categoryOrder: [
        'Getting Started',
        'Entry points',
        'Loading screen',
        'State',
        "Client's method inputs",
        'Events',
        'Errors',
        'Helpers',
        '*',
    ],
}
