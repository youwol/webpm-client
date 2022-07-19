import {
    CdnEvent,
    CdnFetchEvent,
    CdnLoadingGraphErrorEvent,
    CssInput,
    errorFactory,
    FetchErrors,
    LoadingGraph,
    ModuleSideEffectCallback,
    ModulesInput,
    ScriptsInput,
    SourceLoadedEvent,
    SourceLoadingEvent,
    StartEvent,
} from './models'
import { State } from './state'
import { LoadingScreenView } from './loader.view'
import { sanitizeCssId } from './utils.view'
import { satisfies } from 'semver'
import {
    addScriptElements,
    applyFinalSideEffects,
    applyModuleSideEffects,
    onHttpRequestLoad,
    sanitizeCss,
    sanitizeModules,
    sanitizeScripts,
    parseResourceId,
} from './utils'

export type Origin = {
    name: string
    version?: string
    assetId: string
    url: string
    content: string
    progressEvent: ProgressEvent
}

/** Install a set of resources.
 *
 * Modules stand for javascript's module.
 * If some required dependencies of the module are missing they are also loaded.
 *
 * Scripts stand for standalone javascript file; they are fetched after all modules
 * have been loaded.
 *
 * CSS stands for stylesheets.
 *
 * Aliases allow to use a different name to refer to the loaded resources.
 * @param resources what needs to be installed
 * @param resources.modules the bundles
 * @param resources.sideEffects Whenever a library is installed, if the side-effects object contains a matching element
 * the corresponding callback is executed. The keys are in the form '{libraryName}#{query-version}' where query-version
 * obeys to semantic versioning, the values are of type [[ModuleSideEffectCallback]]
 * @param resources.scripts the scripts
 * @param resources.css the css
 * @param resources.aliases a set of aliases that are applied after all the resources
 * have been loaded. A dictionary {key: value} where key is the alias in
 * executingWindow and value is either:
 *       - a string => `executingWindow[alias] = executingWindow[value]`
 *       - a function => `executingWindow[alias] = value(executingWindow)`
 *
 * @param options extra options
 * @param options.displayLoadingScreen if not provided or *false* => no loading screen displayed.
 * If *true*, display the loading screen by filling the 'body' of the current document.
 * If an *HTMLElement*, display the loading screen inside this element
 * @param options.executingWindow the 'window' object where the 'install' is done.
 * If not provided, use 'window'
 * @param options.onEvent callback called at every CDN event
 * @returns a promise over the executingWindow
 */
export function install(
    resources: {
        modules?: ModulesInput
        usingDependencies?: string[]
        modulesSideEffects?: {
            [key: string]: ModuleSideEffectCallback
        }
        scripts?: ScriptsInput
        css?: CssInput
        aliases?: { [key: string]: string | ((Window) => unknown) }
    },
    options: {
        executingWindow?: Window
        onEvent?: (event: CdnEvent) => void
        displayLoadingScreen?: boolean
    } = {},
): Promise<Window> {
    return new Client().install(resources, options)
}

export function queryLoadingGraph(...params) {
    return new Client().queryLoadingGraph(params[0])
}

export function fetchScript(...params): Promise<Origin> {
    return new Client().fetchScript(params[0])
}

export function installLoadingGraph(...params) {
    return new Client().installLoadingGraph(params[0])
}

export function installModules(...params) {
    return new Client().installModules(params[0], params[1])
}

export function installScripts(...params) {
    return new Client().installScripts(params[0], params[1])
}

export function installStyleSheets(...params) {
    return new Client().installStyleSheets(params[0], params[1])
}

export class Client {
    static Headers: { [key: string]: string } = {}
    static HostName = '' // By default, relative resolution is used. Otherwise, protocol + hostname

    static getExportedSymbolName(name: string) {
        const variants = {
            lodash: '_',
            three: 'THREE',
            typescript: 'ts',
            'three-trackballcontrols': 'TrackballControls',
            codemirror: 'CodeMirror',
            'highlight.js': 'hljs',
        }
        return Object.keys(variants).includes(name) ? variants[name] : name
    }

    async queryLoadingGraph(body): Promise<LoadingGraph> {
        const key = JSON.stringify(body)
        const finalize = async () => {
            const content = await State.fetchedLoadingGraph[key]
            if (content.lock) {
                return content
            }
            throw errorFactory(content)
        }
        if (State.fetchedLoadingGraph[key]) {
            return finalize()
        }
        const url = `${Client.HostName}/api/assets-gateway/cdn-backend/queries/loading-graph`
        const request = new Request(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { ...Client.Headers, 'content-type': 'application/json' },
        })
        State.fetchedLoadingGraph[key] = fetch(request).then((resp) =>
            resp.json(),
        )
        return finalize()
    }

    async fetchScript({
        name,
        url,
        onEvent,
    }: {
        url: string
        name?: string
        onEvent?: (event: CdnFetchEvent) => void
    }): Promise<Origin> {
        if (!url.startsWith('/api/assets-gateway/raw/package')) {
            url = url.startsWith('/') ? url : `/${url}`
            url = `/api/assets-gateway/raw/package${url}`
        }

        const parts = url.split('/')
        const assetId = parts[5]
        const version = parts[6]
        name = name || parts[parts.length - 1]

        if (State.importedScripts[url]) {
            const { progressEvent } = await State.importedScripts[url]
            onEvent &&
                onEvent(
                    new SourceLoadedEvent(name, assetId, url, progressEvent),
                )
            return State.importedScripts[url]
        }
        State.importedScripts[url] = new Promise((resolve, reject) => {
            const req = new XMLHttpRequest()
            // report progress events
            req.addEventListener(
                'progress',
                function (event) {
                    onEvent &&
                        onEvent(
                            new SourceLoadingEvent(name, assetId, url, event),
                        )
                },
                false,
            )

            req.addEventListener(
                'load',
                function (event: ProgressEvent<XMLHttpRequestEventTarget>) {
                    onHttpRequestLoad(
                        req,
                        event,
                        resolve,
                        reject,
                        { url, name, assetId, version },
                        onEvent,
                    )
                },
                false,
            )
            req.open('GET', url)
            req.responseType = 'text' // Client.responseParser ? 'blob' : 'text'
            req.send()
            onEvent && onEvent(new StartEvent(name, assetId, url))
        })
        return State.importedScripts[url]
    }

    install(
        resources: {
            modules?: ModulesInput
            usingDependencies?: string[]
            modulesSideEffects?: {
                [key: string]: ModuleSideEffectCallback
            }
            scripts?: ScriptsInput
            css?: CssInput
            aliases?: { [key: string]: string | ((Window) => unknown) }
        },
        options: {
            executingWindow?: Window
            onEvent?: (event: CdnEvent) => void
            displayLoadingScreen?: boolean
        } = {},
    ): Promise<Window> {
        const modules = sanitizeModules(resources.modules || [])
        const css = sanitizeCss(resources.css || [])
        const scripts = sanitizeScripts(resources.scripts || [])
        const executingWindow = options.executingWindow || window
        const aliases = resources.aliases || {}
        const display = options.displayLoadingScreen || false
        let loadingScreen = undefined

        if (display) {
            loadingScreen = new LoadingScreenView()
            loadingScreen.render()
        }
        const onEvent = (ev) => {
            loadingScreen && loadingScreen.next(ev)
            options.onEvent && options.onEvent(ev)
        }

        const bundlePromise = this.installModules(
            {
                modules,
                modulesSideEffects: resources.modulesSideEffects,
                usingDependencies: resources.usingDependencies,
            },
            {
                executingWindow,
                onEvent,
            },
        )

        const cssPromise = this.installStyleSheets(css || [], {
            renderingWindow: options?.executingWindow,
        })
        const jsPromise = bundlePromise.then((resp) => {
            State.updateLatestBundleVersion(resp, executingWindow)
            return this.installScripts(scripts || [], { executingWindow })
        })

        return Promise.all([jsPromise, cssPromise]).then(() => {
            applyFinalSideEffects({
                aliases,
                executingWindow,
                onEvent,
                loadingScreen,
            })
            return executingWindow
        })
    }
    async installLoadingGraph(
        resources: {
            loadingGraph: LoadingGraph
            sideEffects?: { [key: string]: ModuleSideEffectCallback }
        },
        options?: {
            executingWindow?: Window
            onEvent?: (event: CdnFetchEvent) => void
        },
    ) {
        const executingWindow = options?.executingWindow || window

        const libraries = resources.loadingGraph.lock.reduce(
            (acc, e) => ({ ...acc, ...{ [e.id]: e } }),
            {},
        )

        const packagesSelected = resources.loadingGraph.definition
            .flat()
            .map(([assetId, cdn_url]) => {
                return {
                    assetId,
                    url: `/api/assets-gateway/raw/package/${cdn_url}`,
                    name: libraries[assetId].name,
                    version: libraries[assetId].version,
                }
            })

        const errors = []
        const futures = packagesSelected.map(({ name, url }) => {
            return this.fetchScript({
                name,
                url,
                onEvent: options?.onEvent,
            }).catch((error) => {
                errors.push(error)
            })
        })
        const sourcesOrErrors = await Promise.all(futures)
        if (errors.length > 0) {
            throw new FetchErrors({ errors })
        }
        const sources = sourcesOrErrors
            .filter((d) => d != undefined)
            .map((d) => d as Origin)
            .filter(({ name, version }) => !State.isInstalled(name, version))
            .map((origin: Origin) => {
                const userSideEffects = Object.entries(
                    resources?.sideEffects || {},
                )
                    .filter(([_, val]) => {
                        return val != undefined
                    })
                    .filter(([key, _]) => {
                        const query = key.includes('#') ? key : `${key}#*`
                        if (query.split('#')[0] != origin.name) return false
                        return satisfies(origin.version, query.split('#')[1])
                    })
                    .map(([_, value]) => value)
                return {
                    ...origin,
                    sideEffect: (scriptNode: HTMLScriptElement) => {
                        applyModuleSideEffects(
                            origin,
                            scriptNode,
                            executingWindow,
                            userSideEffects,
                        )
                    },
                }
            })

        addScriptElements(sources, executingWindow, options?.onEvent)
    }

    async installModules(
        resources: {
            modules: {
                name: string
                version: string
                sideEffects?: (Window) => void
            }[]
            modulesSideEffects: { [_key: string]: ModuleSideEffectCallback }
            usingDependencies: string[]
        },
        options?: {
            executingWindow: Window
            onEvent: (event: CdnEvent) => void
        },
    ): Promise<LoadingGraph> {
        const usingDependencies = resources?.usingDependencies || []
        const body = {
            libraries: resources.modules,
            using: usingDependencies.reduce((acc, dependency) => {
                return {
                    ...acc,
                    [dependency.split('#')[0]]: dependency.split('#')[1],
                }
            }, {}),
        }
        const sideEffects = resources.modules.reduce(
            (acc, dependency) => ({
                ...acc,
                [`${dependency.name}#${dependency.version}`]:
                    dependency.sideEffects,
            }),
            resources.modulesSideEffects,
        )
        try {
            const loadingGraph = await this.queryLoadingGraph(body)
            await this.installLoadingGraph(
                { loadingGraph, sideEffects },
                options,
            )
            return loadingGraph
        } catch (error) {
            options?.onEvent &&
                options.onEvent(new CdnLoadingGraphErrorEvent(error))
            throw error
        }
    }

    async installScripts(
        resources: ScriptsInput,
        options?: {
            executingWindow?: Window
            onEvent?: (CdnEvent) => void
        },
    ): Promise<{ assetName; assetId; url; src }[]> {
        const client = new Client()
        const inputs = sanitizeScripts(resources)

        const scripts = inputs.map((elem) => ({
            ...elem,
            ...parseResourceId(elem.resource),
        }))

        const futures = scripts.map(({ name, url }) =>
            client.fetchScript({ name, url, onEvent: options?.onEvent }),
        )

        const sourcesOrErrors = await Promise.all(futures)
        const sources = sourcesOrErrors.filter(
            (d) => !(d instanceof ErrorEvent),
        )

        addScriptElements(sources, options?.executingWindow, options?.onEvent)

        return sources.map(({ assetId, url, name, content }) => {
            return { assetId, url, assetName: name, src: content }
        })
    }

    installStyleSheets(
        resources: CssInput,
        options?: { renderingWindow?: Window },
    ): Promise<Array<HTMLLinkElement>> {
        const css = sanitizeCss(resources)
        const renderingWindow = options?.renderingWindow || window

        const getLinkElement = (url) => {
            return Array.from(
                renderingWindow.document.head.querySelectorAll('link'),
            ).find((e) => e.id == url)
        }
        const futures = css
            .map((elem) => ({ ...elem, ...parseResourceId(elem.resource) }))
            .filter(({ url }) => !getLinkElement(url))
            .map(({ assetId, version, name, url }) => {
                return new Promise<HTMLLinkElement>((resolveCb) => {
                    const link = renderingWindow.document.createElement('link')
                    link.id = url
                    const classes = [assetId, name, version].map((key) =>
                        sanitizeCssId(key),
                    )
                    link.classList.add(...classes)
                    link.setAttribute('type', 'text/css')
                    link.href = Client.HostName + url
                    link.rel = 'stylesheet'
                    renderingWindow.document
                        .getElementsByTagName('head')[0]
                        .appendChild(link)
                    link.onload = () => {
                        resolveCb(link)
                    }
                })
            })
        return Promise.all(futures)
    }
}
