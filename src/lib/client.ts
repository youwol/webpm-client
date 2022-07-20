import {
    CdnLoadingGraphErrorEvent,
    errorFactory,
    FetchErrors,
    InstallModulesInputs,
    LoadingGraph,
    InstallScriptsInputs,
    SourceLoadedEvent,
    SourceLoadingEvent,
    StartEvent,
    InstallStyleSheetInputs,
    InstallLoadingGraphInputs,
    FetchScriptInputs,
    QueryLoadingGraphInputs,
    InstallInputs,
    CdnEvent,
    Origin,
    InstallStyleSheetDeprecated,
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
    sanitizeModules,
    parseResourceId,
} from './utils'

/**
 *
 * Use default [[Client]] to install a set of resources, see [[Client.install]]
 *
 * @category Getting Started
 * @param inputs
 */
export function install(inputs: InstallInputs): Promise<Window>

/**
 *
 * Use default [[Client]] to install a set of resources, see [[Client.install]]
 *
 * @deprecated
 * @category Getting Started
 * @param inputs
 * @param options
 */
export function install(
    inputs: InstallInputs,
    options?: {
        executingWindow?: Window
        onEvent?: (event: CdnEvent) => void
        displayLoadingScreen?: boolean
    },
): Promise<Window>

export function install(
    inputs: InstallInputs,
    options?: {
        executingWindow?: Window
        onEvent?: (event: CdnEvent) => void
        displayLoadingScreen?: boolean
    },
): Promise<Window> {
    return options
        ? new Client().install({ ...inputs, ...options })
        : new Client().install(inputs)
}

/**
 * @category Getting Started
 *
 * @param inputs
 */
export function queryLoadingGraph(inputs: QueryLoadingGraphInputs) {
    return new Client().queryLoadingGraph(inputs)
}

/**
 * @category Getting Started
 *
 * @param inputs
 */
export function fetchScript(inputs: FetchScriptInputs): Promise<Origin> {
    return new Client().fetchScript(inputs)
}
/**
 * Deprecated function, [[fetchScript]] is the replacing function
 *
 * @category Deprecated
 *
 * @param inputs
 */
export function fetchSource(inputs: FetchScriptInputs): Promise<Origin> {
    return new Client().fetchScript(inputs)
}

/**
 * @category Getting Started
 *
 * @param inputs
 */
export function installLoadingGraph(inputs: InstallLoadingGraphInputs) {
    return new Client().installLoadingGraph(inputs)
}

/**
 * @category Getting Started
 *
 * @param inputs
 */
export function installModules(inputs: InstallModulesInputs) {
    return new Client().installModules(inputs)
}

/**
 * @category Getting Started
 *
 * @param inputs
 */
export function installScripts(inputs: InstallScriptsInputs) {
    return new Client().installScripts(inputs)
}

/**
 * @category Getting Started
 *
 * @param inputs
 */
export function installStyleSheets(inputs: InstallStyleSheetInputs) {
    return new Client().installStyleSheets(inputs)
}

/**
 * @category Getting Started
 *
 * @param inputs
 */
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

    async queryLoadingGraph(
        body: QueryLoadingGraphInputs,
    ): Promise<LoadingGraph> {
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
    }: FetchScriptInputs): Promise<Origin> {
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

    install(inputs: InstallInputs): Promise<Window> {
        const modules = sanitizeModules(inputs.modules || [])
        const css = inputs.css || []
        const executingWindow = inputs.executingWindow || window
        const aliases = inputs.aliases || {}
        const display = inputs.displayLoadingScreen || false
        let loadingScreen = undefined

        if (display) {
            loadingScreen = new LoadingScreenView()
            loadingScreen.render()
        }
        const onEvent = (ev) => {
            loadingScreen && loadingScreen.next(ev)
            inputs.onEvent && inputs.onEvent(ev)
        }

        const bundlePromise = this.installModules({
            modules,
            modulesSideEffects: inputs.modulesSideEffects,
            usingDependencies: inputs.usingDependencies,
            executingWindow,
            onEvent,
        })

        const cssPromise = this.installStyleSheets({
            css,
            renderingWindow: inputs.executingWindow,
        })
        const jsPromise = bundlePromise.then((resp) => {
            State.updateLatestBundleVersion(resp, executingWindow)
            return this.installScripts({
                scripts: inputs.scripts || [],
                executingWindow,
            })
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

    async installLoadingGraph(inputs: InstallLoadingGraphInputs) {
        const executingWindow = inputs.executingWindow || window

        const libraries = inputs.loadingGraph.lock.reduce(
            (acc, e) => ({ ...acc, ...{ [e.id]: e } }),
            {},
        )

        const packagesSelected = inputs.loadingGraph.definition
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
                onEvent: inputs.onEvent,
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
                const userSideEffects = Object.entries(inputs.sideEffects || {})
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

        addScriptElements(sources, executingWindow, inputs.onEvent)
    }

    async installModules(inputs: InstallModulesInputs): Promise<LoadingGraph> {
        const usingDependencies = inputs.usingDependencies || []
        const body = {
            libraries: inputs.modules,
            using: usingDependencies.reduce((acc, dependency) => {
                return {
                    ...acc,
                    [dependency.split('#')[0]]: dependency.split('#')[1],
                }
            }, {}),
        }
        const sideEffects = inputs.modules.reduce(
            (acc, dependency) => ({
                ...acc,
                [`${dependency.name}#${dependency.version}`]:
                    dependency.sideEffects,
            }),
            inputs.modulesSideEffects || {},
        )
        try {
            const loadingGraph = await this.queryLoadingGraph(body)
            await this.installLoadingGraph({
                loadingGraph,
                sideEffects,
                executingWindow: inputs.executingWindow,
                onEvent: inputs.onEvent,
            })
            return loadingGraph
        } catch (error) {
            inputs.onEvent &&
                inputs.onEvent(new CdnLoadingGraphErrorEvent(error))
            throw error
        }
    }

    async installScripts(
        inputs: InstallScriptsInputs,
    ): Promise<{ assetName; assetId; url; src }[]> {
        const client = new Client()

        const scripts = inputs.scripts.map((elem) => parseResourceId(elem))

        const futures = scripts.map(({ name, url }) =>
            client.fetchScript({ name, url, onEvent: inputs.onEvent }),
        )

        const sourcesOrErrors = await Promise.all(futures)
        const sources = sourcesOrErrors.filter(
            (d) => !(d instanceof ErrorEvent),
        )

        addScriptElements(sources, inputs.executingWindow, inputs.onEvent)

        return sources.map(({ assetId, url, name, content }) => {
            return { assetId, url, assetName: name, src: content }
        })
    }

    installStyleSheets(
        inputs: InstallStyleSheetInputs | InstallStyleSheetDeprecated,
    ): Promise<Array<HTMLLinkElement>> {
        const css = inputs.css.map((stylesheet) =>
            stylesheet.resource ? stylesheet.resource : stylesheet,
        )
        const renderingWindow = inputs.renderingWindow || window

        const getLinkElement = (url) => {
            return Array.from(
                renderingWindow.document.head.querySelectorAll('link'),
            ).find((e) => e.id == url)
        }
        const futures = css
            .map((elem) => parseResourceId(elem))
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
