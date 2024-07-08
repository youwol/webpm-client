import {
    fromMarkdown,
    Views,
    installNotebookModule,
    Navigation,
    installCodeApiModule,
    Router,
} from '@youwol/mkdocs-ts'
import { setup } from '../auto-generated'
import { AnyVirtualDOM } from '@youwol/rx-vdom'

const tableOfContent = Views.tocView

const project = {
    name: 'webpm-client',
    docBasePath: `/api/assets-gateway/raw/package/${setup.assetId}/${setup.version}/assets/api`,
}

const url = (restOfPath: string) =>
    `/api/assets-gateway/raw/package/${setup.assetId}/${setup.version}/assets/${restOfPath}`

const placeholders = {
    '{{project}}': project.name,
    '{{webpm-version}}': setup.version,
}
function fromMd(file: string) {
    return fromMarkdown({
        url: url(file),
        placeholders,
    })
}
const CodeApiModule = await installCodeApiModule()
const NotebookModule = await installNotebookModule()
const notebookOptions = {
    runAtStart: true,
    defaultCellAttributes: {
        lineNumbers: false,
    },
    markdown: {
        latex: true,
        placeholders,
    },
}
await NotebookModule.SnippetEditorView.fetchCmDependencies$('javascript')

const icon = (faClass: string): AnyVirtualDOM => ({
    tag: 'i',
    class: `fas ${faClass}`,
    style: { width: '30px' },
})
export const navigation: Navigation = {
    name: 'Home',
    tableOfContent,
    decoration: {
        icon: icon('fa-home'),
    },
    html: ({ router }) =>
        new NotebookModule.NotebookPage({
            url: url('index.md'),
            router,
            options: notebookOptions,
        }),
    '/how-to': {
        name: 'How-To',
        decoration: {
            icon: icon('fa-file-medical-alt'),
        },
        html: fromMd('how-to.md'),
        tableOfContent,
        '/install': {
            name: 'Install',
            html: fromMd('how-to.install.md'),
            tableOfContent,
        },
        '/publish': {
            name: 'Publish',
            html: fromMd('how-to.publish.md'),
            tableOfContent,
        },
        '/py-youwol': {
            name: 'Py YouWol',
            html: fromMd('how-to.py-youwol.md'),
            tableOfContent,
        },
    },
    '/tutorials': {
        name: 'Tutorials',
        decoration: {
            icon: icon('fa-graduation-cap'),
        },
        html: fromMd('tutorials.md'),
        tableOfContent,
        '/esm': {
            name: 'ESM Modules',
            html: ({ router }) =>
                new NotebookModule.NotebookPage({
                    url: url('tutorials.esm.md'),
                    router,
                    options: notebookOptions,
                }),
            tableOfContent,
        },
        '/pyodide': {
            name: 'Pyodide',
            html: ({ router }) =>
                new NotebookModule.NotebookPage({
                    url: url('tutorials.pyodide.md'),
                    router,
                    options: notebookOptions,
                }),
            tableOfContent,
        },
        '/backends': {
            name: 'Backends',
            html: ({ router }) =>
                new NotebookModule.NotebookPage({
                    url: url('tutorials.backends.md'),
                    router,
                    options: notebookOptions,
                }),
            tableOfContent,
        },
        '/workers': {
            name: 'Workers Pool',
            html: ({ router }) =>
                new NotebookModule.NotebookPage({
                    url: url('tutorials.workers.md'),
                    router,
                    options: notebookOptions,
                }),
            tableOfContent,
        },
        '/events': {
            name: 'Events & Loading Screen',
            html: ({ router }) =>
                new NotebookModule.NotebookPage({
                    url: url('tutorials.events.md'),
                    router,
                    options: notebookOptions,
                }),
            tableOfContent,
        },
    },
    '/api': {
        name: 'API',
        decoration: {
            icon: icon('fa-code'),
        },
        html: fromMd('api.md'),
        tableOfContent,
        '...': ({ path, router }: { path: string; router: Router }) =>
            CodeApiModule.docNavigation({
                modulePath: path,
                router,
                project,
                configuration: {
                    ...CodeApiModule.configurationTsTypedoc,
                    notebook: true,
                },
            }),
    },
}
