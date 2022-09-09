// eslint-disable-next-line eslint-comments/disable-enable-pair -- to not have problem
/* eslint-disable jest/no-done-callback -- eslint-comment Find a good way to work with rxjs in jest */

import { writeFileSync } from 'fs'
import {
    State,
    queryLoadingGraph,
    getUrlBase,
    install,
    InstallDoneEvent,
    fetchScript,
    InstallInputs,
    QueryLoadingGraphInputs,
    getLoadingGraph,
    LightLibraryQueryString,
    installScripts,
    InstallScriptsInputs,
    fetchJavascriptAddOn,
    installLoadingGraph,
    InstallLoadingGraphInputs,
    fetchLoadingGraph,
    FetchScriptInputs,
    fetchSource,
    parseResourceId,
    installStyleSheets,
    InstallStyleSheetsInputs,
    fetchStyleSheets,
} from '../lib'

import { cleanDocument, expectEvents, installPackages$ } from './common'
import './mock-requests'

beforeAll((done) => {
    installPackages$([
        './.packages/root.zip',
        './.packages/a.zip',
        './.packages/b.zip',
        './.packages/c.zip',
        './.packages/d.zip',
    ]).subscribe(() => {
        done()
    })
})

beforeEach(() => {
    cleanDocument()
    State.clear()
})
function doFetchScript(
    body: FetchScriptInputs,
    version: 'deprecated' | 'regular',
) {
    return version == 'deprecated' ? fetchSource(body) : fetchScript(body)
}

function doInstallScripts(
    body: InstallScriptsInputs,
    version: 'deprecated' | 'regular',
) {
    return version == 'deprecated'
        ? fetchJavascriptAddOn(
              body.scripts as string[],
              body.executingWindow,
              body.onEvent,
          )
        : installScripts(body)
}

function doInstall(body: InstallInputs, version: 'deprecated' | 'regular') {
    return version == 'deprecated'
        ? install(
              {
                  modules: body.modules,
              },
              {
                  onEvent: body.onEvent,
              },
          )
        : install({
              modules: body.modules,
              onEvent: body.onEvent,
          })
}

function doQueryLoadingGraph(
    body: QueryLoadingGraphInputs,
    version: 'deprecated' | 'regular',
) {
    return version == 'deprecated'
        ? getLoadingGraph({
              libraries: body.modules.reduce(
                  (acc, e: LightLibraryQueryString) => ({
                      ...acc,
                      [e.split('#')[0]]: e.split('#')[1],
                  }),
                  {},
              ),
          })
        : queryLoadingGraph(body)
}

function doInstallLoadingGraph(
    body: InstallLoadingGraphInputs,
    version: 'deprecated' | 'regular',
) {
    return version == 'deprecated'
        ? fetchLoadingGraph(
              body.loadingGraph,
              body.executingWindow,
              undefined,
              body.onEvent,
          )
        : installLoadingGraph(body)
}

function doInstallStyleSheets(
    body: InstallStyleSheetsInputs,
    version: 'deprecated' | 'regular',
) {
    return version == 'deprecated'
        ? fetchStyleSheets(body.css as string[], body.renderingWindow)
        : installStyleSheets(body)
}

test('fetch script', async () => {
    for (const mode of ['regular', 'deprecated']) {
        cleanDocument()
        State.resetCache()
        // The script add-on.js suppose there is already the module 'a' installed
        window['a'] = {}
        const resource = parseResourceId('a#1.0.0~folder/add-on.js')
        const resp = await doFetchScript(
            resource,
            mode as 'deprecated' | 'regular',
        )
        delete resp['progressEvent']
        expect(resp).toEqual({
            name: 'a',
            version: '1.0.0',
            assetId: 'YQ==',
            url: '/api/assets-gateway/raw/package/YQ==/1.0.0/folder/add-on.js',
            content:
                "window.a.addOn = ['add-on']\n\n//# sourceURL=/api/assets-gateway/raw/package/YQ==/1.0.0/folder/",
        })
    }
})

test('install scripts', async () => {
    for (const mode of ['regular', 'deprecated']) {
        const events = []
        cleanDocument()
        State.resetCache()
        // The script add-on.js suppose there is already the module 'a' installed
        window['a'] = {}
        await doInstallScripts(
            {
                scripts: ['a#1.0.0~folder/add-on.js'],
                onEvent: (event) => {
                    events.push(event)
                },
            },
            mode as 'deprecated' | 'regular',
        )
        expect(document.scripts).toHaveLength(1)
    }
})

test('install loading graph', async () => {
    const loadingGraph = {
        graphType: 'sequential-v1',
        lock: [
            {
                name: 'a',
                fingerprint: '76270bd891a4fedd6fe6d68e83e0c025',
                version: '1.0.0',
                id: 'YQ==',
                namespace: '',
                type: 'library',
                exportedSymbol: 'a',
                apiKey: '1',
            },
            {
                name: 'root',
                fingerprint: '5cbfeecc7a6cf2e470d049043d57f3cb',
                version: '1.0.0',
                id: 'cm9vdA==',
                namespace: '',
                type: 'library',
                exportedSymbol: 'root',
                apiKey: '1',
            },
        ],
        definition: [
            [['cm9vdA==', 'cm9vdA==/1.0.0/root.js'] as [string, string]],
            [['YQ==', 'YQ==/1.0.0/a.js'] as [string, string]],
        ],
    }
    for (const mode of ['regular', 'deprecated']) {
        const events = []
        cleanDocument()
        State.resetCache()
        // The script add-on.js suppose there is already the module 'a' installed
        window['a'] = {}
        await doInstallLoadingGraph(
            {
                loadingGraph,
                onEvent: (event) => {
                    events.push(event)
                },
            },
            mode as 'deprecated' | 'regular',
        )
        expect(document.scripts).toHaveLength(2)
    }
})

test('install root', async () => {
    for (const mode of ['regular', 'deprecated']) {
        const events = []
        cleanDocument()
        State.resetCache()
        await doInstall(
            {
                modules: ['root'],
                onEvent: (event) => {
                    events.push(event)
                },
            },
            mode as 'deprecated' | 'regular',
        )
        expect(document.scripts).toHaveLength(1)
        const s0 = document.scripts.item(0)
        const target = getUrlBase('root', '1.0.0') + '/root.js'
        expect(s0.id).toBe(target)
        expect(window['root'].name).toBe('root')
        expectEvents(events, ['root'])
    }
})

test('loading graph a', async () => {
    for (const mode of ['regular', 'deprecated']) {
        cleanDocument()
        State.resetCache()
        const loadingGraph = await doQueryLoadingGraph(
            {
                modules: ['a#latest'],
            },
            mode as 'deprecated' | 'regular',
        )
        expect(loadingGraph).toEqual({
            graphType: 'sequential-v2',
            lock: [
                {
                    name: 'a',
                    fingerprint: '76270bd891a4fedd6fe6d68e83e0c025',
                    version: '1.0.0',
                    id: 'YQ==',
                    namespace: '',
                    type: 'library',
                    exportedSymbol: 'a',
                    apiKey: '1',
                },
                {
                    name: 'root',
                    fingerprint: '5cbfeecc7a6cf2e470d049043d57f3cb',
                    version: '1.0.0',
                    id: 'cm9vdA==',
                    namespace: '',
                    type: 'library',
                    exportedSymbol: 'root',
                    apiKey: '1',
                },
            ],
            definition: [
                [['cm9vdA==', 'cm9vdA==/1.0.0/root.js']],
                [['YQ==', 'YQ==/1.0.0/a.js']],
            ],
        })
        const src = await fetchScript({ name: 'a', url: 'YQ==/1.0.0/a.js' })
        expect(src.content).toBe(`window.a = {
    rootName: window['root'].name,
    name: 'a',
    addOn: [],
}

//# sourceURL=/api/assets-gateway/raw/package/YQ==/1.0.0/`)
    }
})

test('install a', async () => {
    const events = []
    await install(
        {
            modules: ['a'],
        },
        {
            displayLoadingScreen: true,
            onEvent: (event) => {
                events.push(event)
                if (event instanceof InstallDoneEvent) {
                    // eslint-disable-next-line jest/no-conditional-expect -- some comment
                    expect(
                        document.getElementById('loading-screen'),
                    ).toBeTruthy()
                    writeFileSync(
                        `${__dirname}/.html-outputs/loading-view.html`,
                        document.documentElement.innerHTML,
                    )
                }
            },
        },
    )
    expect(document.scripts).toHaveLength(2)
    expect(window['a']).toEqual({
        __yw_set_from_version__: '1.0.0',
        name: 'a',
        rootName: 'root',
        addOn: [],
    })

    expectEvents(events, ['a', 'root'])
    expect(events.filter((e) => e instanceof InstallDoneEvent)).toHaveLength(1)
    setTimeout(() => {
        expect(document.getElementById('loading-screen')).toBeFalsy()
    }, 0)
})

test('install a with add-on', async () => {
    await install({
        modules: ['a'],
        scripts: ['a#1.0.0~folder/add-on.js'],
    })
    expect(document.scripts).toHaveLength(3)
    expect(window['a']).toEqual({
        __yw_set_from_version__: '1.0.0',
        name: 'a',
        rootName: 'root',
        addOn: ['add-on'],
    })
})

test('double install a with add-on', async () => {
    const events1 = []
    const events2 = []
    await install(
        {
            modules: ['a'],
            scripts: ['a#1.0.0~folder/add-on.js'],
        },
        {
            onEvent: (event) => events1.push(event),
        },
    )
    await install(
        {
            modules: ['a'],
            scripts: ['a#1.0.0~folder/add-on.js'],
        },
        {
            onEvent: (event) => events2.push(event),
        },
    )
    expect(events1).toHaveLength(9)
    // events2 should contain the source loaded events for every scrip downloaded + InstallDoneEvent
    // even if the download was actually triggered from the first install
    /*expect(events2).toHaveLength(3)
    events2
        .splice(0, -1)
        .forEach((event) => expect(event).toBeInstanceOf(SourceLoadedEvent))

     */
    const scripts = Array.from(document.scripts).map((s) => s.id)
    expect(scripts).toHaveLength(3)
    expect(window['a']).toEqual({
        __yw_set_from_version__: '1.0.0',
        name: 'a',
        rootName: 'root',
        addOn: ['add-on'],
    })
    //expect(events2[2]).toBeInstanceOf(InstallDoneEvent)
})

document['createElementRegular'] = document.createElement
document['createElement'] = (tag) => {
    const element = document['createElementRegular'](tag)
    if (tag != 'link') {
        return element
    }
    setTimeout(() => {
        element.onload()
    }, 0)
    return element
}

test('install style sheet', async () => {
    for (const mode of ['regular', 'deprecated']) {
        cleanDocument()
        await doInstallStyleSheets(
            {
                css: ['a#1.0.0~style.css'],
            },
            mode as 'regular' | 'deprecated',
        )
        const link = document.querySelector('link')
        expect(link.id).toBe(
            '/api/assets-gateway/raw/package/YQ==/1.0.0/style.css',
        )
        expect(link.classList.contains('cdn-client_a')).toBeTruthy()
    }
})

test('install style sheet with side effects', async () => {
    await installStyleSheets({
        css: [
            {
                location: 'a#1.0.0~style.css',
                sideEffects: ({ origin, htmlLinkElement }) => {
                    htmlLinkElement.id = `${origin.moduleName}_${origin.version}`
                },
            },
            'a#1.0.0~style.css', // this guy should not be included (already here)
        ],
    })
    const link = document.querySelector('link')
    expect(link.id).toBe('a_1.0.0')
})
