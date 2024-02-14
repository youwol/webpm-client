import { writeFileSync } from 'fs'
import {
    queryLoadingGraph,
    getUrlBase,
    install,
    InstallDoneEvent,
    fetchScript,
    InstallInputs,
    installLoadingGraph,
    parseResourceId,
    Client,
} from '../lib'
import '../lib/inputs.models'
import {
    cleanDocument,
    expectEvents,
    installPackages$,
    testBackendConfig,
} from './common'
import './mock-requests'
import { StateImplementation } from '../lib/state'
import { lastValueFrom } from 'rxjs'

const originString = 'http://localhost:2001'

beforeAll(async () => {
    Client.BackendConfiguration = testBackendConfig
    await lastValueFrom(
        installPackages$([
            './.packages/root.zip',
            './.packages/a.zip',
            './.packages/b.zip',
            './.packages/c.zip',
            './.packages/d.zip',
        ]),
    )
})

beforeEach(() => {
    cleanDocument()
    StateImplementation.clear()
})

function doInstall(body: InstallInputs, version: 'deprecated' | 'regular') {
    return version == 'deprecated'
        ? install({
              modules: body.modules,
              onEvent: body.onEvent,
          })
        : install({
              modules: body.modules,
              onEvent: body.onEvent,
          })
}

test('fetch script', async () => {
    cleanDocument()
    StateImplementation.resetCache()
    // The script add-on.js suppose there is already the module 'a' installed
    window['a'] = {}
    const resource = parseResourceId('a#1.0.0~folder/add-on.js')
    const resp = await fetchScript(resource)
    delete resp['progressEvent']
    expect(resp).toEqual({
        name: 'a',
        version: '1.0.0',
        assetId: 'YQ==',
        url: `${originString}/api/assets-gateway/raw/package/YQ==/1.0.0/folder/add-on.js`,
        content: `window.a.addOn = ['add-on']\n\n//# sourceURL=${originString}/api/assets-gateway/raw/package/YQ==/1.0.0/folder/`,
    })
})

test('install scripts', async () => {
    const events = []
    cleanDocument()
    StateImplementation.resetCache()
    // The script add-on.js suppose there is already the module 'a' installed
    window['a'] = {}
    await install({
        scripts: ['a#1.0.0~folder/add-on.js'],
        onEvent: (event) => {
            events.push(event)
        },
    })
    expect(document.scripts).toHaveLength(1)
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
                aliases: [],
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
                aliases: [],
            },
        ],
        definition: [
            [['cm9vdA==', 'cm9vdA==/1.0.0/root.js'] as [string, string]],
            [['YQ==', 'YQ==/1.0.0/a.js'] as [string, string]],
        ],
    }
    const events = []
    cleanDocument()
    StateImplementation.resetCache()
    // The script add-on.js suppose there is already the module 'a' installed
    window['a'] = {}
    await installLoadingGraph({
        loadingGraph,
        onEvent: (event) => {
            events.push(event)
        },
    })
    expect(document.scripts).toHaveLength(2)
})

test('install root', async () => {
    for (const mode of ['regular', 'deprecated']) {
        const events = []
        cleanDocument()
        StateImplementation.resetCache()
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
    cleanDocument()
    StateImplementation.resetCache()
    const loadingGraph = await queryLoadingGraph({
        modules: ['a#latest'],
    })
    expect(loadingGraph).toEqual({
        graphType: 'sequential-v2',
        lock: [
            {
                name: 'a',
                fingerprint: 'ff112efc2e5ca845654a11ef333e6f04',
                version: '1.0.0',
                id: 'YQ==',
                namespace: '',
                type: 'js/wasm',
                exportedSymbol: 'a',
                apiKey: '1',
                aliases: [],
            },
            {
                name: 'root',
                fingerprint: '9f28cd4094d663c2989fa735f58a00fd',
                version: '1.0.0',
                id: 'cm9vdA==',
                namespace: '',
                type: 'js/wasm',
                exportedSymbol: 'root',
                apiKey: '1',
                aliases: [],
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

//# sourceURL=${originString}/api/assets-gateway/raw/package/YQ==/1.0.0/`)
})

test('install a', async () => {
    const events = []
    await install({
        modules: ['a'],
        displayLoadingScreen: true,
        onEvent: (event) => {
            events.push(event)
            if (event instanceof InstallDoneEvent) {
                // eslint-disable-next-line jest/no-conditional-expect -- some comment
                expect(document.getElementById('loading-screen')).toBeTruthy()
                writeFileSync(
                    `${__dirname}/.html-outputs/loading-view.html`,
                    document.documentElement.innerHTML,
                )
            }
        },
    })
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
    await install({
        modules: ['a'],
        scripts: ['a#1.0.0~folder/add-on.js'],
        onEvent: (event) => events1.push(event),
    })
    await install({
        modules: ['a'],
        scripts: ['a#1.0.0~folder/add-on.js'],
        onEvent: (event) => events2.push(event),
    })
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
    cleanDocument()
    await install({
        css: ['a#1.0.0~style.css'],
    })
    const link = document.querySelector('link')
    expect(link.id).toBe(
        `${originString}/api/assets-gateway/raw/package/YQ==/1.0.0/style.css`,
    )
    expect(link.classList.contains('cdn-client_a')).toBeTruthy()
})

test('install style sheet with side effects', async () => {
    await install({
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
