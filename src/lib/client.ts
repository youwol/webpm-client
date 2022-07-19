import {
    CdnEvent,
    CdnFetchEvent,
    CdnLoadingGraphErrorEvent,
    errorFactory,
    FetchErrors,
    LoadingGraph,
    SourceLoadedEvent,
    SourceLoadingEvent,
    StartEvent,
} from './models'
import {
    CssInput,
    fetchJavascriptAddOn,
    fetchLoadingGraph,
    fetchStyleSheets,
    ModuleSideEffectCallback,
    ModulesInput,
    parseResourceId,
    ScriptsInput,
} from './loader'
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
} from './utils'

export type Origin = {
    name: string
    version?: string
    assetId: string
    url: string
    content: string
    progressEvent: ProgressEvent
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

    async getLoadingGraph(body): Promise<LoadingGraph> {
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

        const cssPromise = fetchStyleSheets(css || [], executingWindow)
        const jsPromise = bundlePromise.then((resp) => {
            State.updateLatestBundleVersion(resp, executingWindow)
            return fetchJavascriptAddOn(scripts || [], executingWindow)
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
                const userSideEffects = Object.entries(resources?.sideEffects)
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
        const executingWindow = options?.executingWindow || window
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
            const loadingGraph = await this.getLoadingGraph(body)
            await fetchLoadingGraph(
                loadingGraph,
                executingWindow,
                sideEffects,
                options?.onEvent,
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
