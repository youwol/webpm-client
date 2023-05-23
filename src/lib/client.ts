import { satisfies } from 'semver'
import { BackendConfiguration } from './backend-configuration'
import { errorFactory, FetchErrors } from './errors.models'
import {
    CdnLoadingGraphErrorEvent,
    InstallDoneEvent,
    SourceLoadedEvent,
    SourceLoadingEvent,
    StartEvent,
} from './events.models'
import {
    FetchedScript,
    FetchScriptInputs,
    InstallInputs,
    InstallLoadingGraphInputs,
    InstallModulesInputs,
    InstallScriptsInputs,
    InstallStyleSheetsInputs,
    LoadingGraph,
    QueryLoadingGraphInputs,
} from './inputs.models'
import { LoadingScreenView } from './loader.view'
import { Monitoring, StateImplementation } from './state'
import {
    addScriptElements,
    applyModuleSideEffects,
    getAssetId,
    installAliases,
    isInstanceOfWindow,
    onHttpRequestLoad,
    parseResourceId,
    resolveCustomInstaller,
    sanitizeModules,
} from './utils'
import { sanitizeCssId } from './utils.view'

/**
 *
 * Use default {@link Client} to install resources; see documentation provided for {@link InstallInputs}.
 *
 * @category Getting Started
 * @category Entry Points
 * @param inputs
 */
export function install(
    inputs: InstallInputs,
): Promise<WindowOrWorkerGlobalScope> {
    return new Client().install(inputs)
}

/**
 *
 * Use default {@link Client} query a loading graph; see documentation provided for {@link QueryLoadingGraphInputs}.
 *
 * @param inputs
 * @category Entry Points
 */
export function queryLoadingGraph(inputs: QueryLoadingGraphInputs) {
    return new Client().queryLoadingGraph(inputs)
}

/**
 * Use default {@link Client} to fetch content of a javascript file.
 *
 * @param inputs
 * @category Entry Points
 */
export function fetchScript(inputs: FetchScriptInputs): Promise<FetchedScript> {
    return new Client().fetchScript(inputs)
}

/**
 * Use default {@link Client} to install {@link LoadingGraph}; see documentation provided for
 * {@link InstallLoadingGraphInputs}.
 *
 * @category Entry Points
 * @param inputs
 */
export function installLoadingGraph(inputs: InstallLoadingGraphInputs) {
    return new Client().installLoadingGraph(inputs)
}

/**
 * Returns {@link Monitoring} object that encapsulates read-only access to the
 * installation state at the time of call.
 *
 * @category Entry Points
 */
export function monitoring() {
    return new Monitoring()
}

/**
 * Gathers configuration & methods to dynamically install various set of resources (modules, scripts, stylesheets).
 *
 * For default client's configuration, the methods are also available as standalone functions:
 * {@link install}, {@link queryLoadingGraph}, {@link fetchScript}, {@link installLoadingGraph}, {@link installModules},
 * {@link installScripts},{@link installStyleSheets}.
 *
 * @category Entry Points
 */
export class Client {
    private static state = StateImplementation

    static Headers: { [key: string]: string } = {}

    static BackendConfiguration: BackendConfiguration | undefined = undefined

    /**
     * Headers used when doing HTTP requests.
     *
     * `this.headers =  headers ? {...Client.Headers, ...headers } : Client.Headers`
     */
    public readonly headers: { [key: string]: string } = {}

    public readonly backendConfiguration: BackendConfiguration

    /**
     * @param params options setting up HTTP requests regarding {@link Client.headers} & {@link Client.hostName}
     * @param params.headers headers forwarded by every request, in addition to {@link Client.Headers}.
     * @param params.hostName host name of the cdn server, if none provided use {@link Client.HostName}
     */
    constructor(
        params: {
            headers?: { [_key: string]: string }
            backendConfiguration?: BackendConfiguration
        } = {},
    ) {
        this.headers = { ...Client.Headers, ...(params.headers || {}) }
        if (
            params.backendConfiguration === undefined &&
            Client.BackendConfiguration === undefined
        ) {
            throw new Error(
                'Client.BackendConfiguration not configured and no explicit backendConfiguration param',
            )
        }
        this.backendConfiguration =
            params.backendConfiguration ?? Client.BackendConfiguration
    }

    /**
     * Query a loading graph provided a list of modules, see {@link QueryLoadingGraphInputs}.
     *
     * @param inputs
     */
    async queryLoadingGraph(
        inputs: QueryLoadingGraphInputs,
    ): Promise<LoadingGraph> {
        const key = JSON.stringify(inputs)
        const usingDependencies = inputs.usingDependencies || []
        const body = {
            libraries: sanitizeModules(inputs.modules),
            using: usingDependencies.reduce((acc, dependency) => {
                return {
                    ...acc,
                    [dependency.split('#')[0]]: dependency.split('#')[1],
                }
            }, {}),
        }
        const finalize = async () => {
            const content = await Client.state.fetchedLoadingGraph[key]
            if (content.lock) {
                return content
            }
            throw errorFactory(content)
        }
        if (Client.state.fetchedLoadingGraph[key]) {
            return finalize()
        }
        const request = new Request(this.backendConfiguration.urlLoadingGraph, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { ...this.headers, 'content-type': 'application/json' },
        })
        Client.state.fetchedLoadingGraph[key] = fetch(request).then((resp) =>
            resp.json(),
        )
        return finalize()
    }

    public static getUrlBase(name: string, version: string): string {
        const assetId = getAssetId(name)
        return `${Client.BackendConfiguration.urlRawPackage}/${assetId}/${version}`
    }

    /**
     * Fetch content of a javascript file.
     *
     * @param inputs
     */
    async fetchScript(inputs: FetchScriptInputs): Promise<FetchedScript> {
        let { url, name } = inputs
        const onEvent = inputs.onEvent
        if (!url.startsWith(this.backendConfiguration.urlRawPackage)) {
            url = url.startsWith('/') ? url : `/${url}`
            url = `${this.backendConfiguration.urlRawPackage}${url}`
        }

        const parts = url
            .substring(this.backendConfiguration.urlRawPackage.length)
            .split('/')
        const assetId = parts[1]
        const version = parts[2]
        name = name || parts[parts.length - 1]
        url = Client.state.getPatchedUrl({
            name,
            version,
            assetId,
            url,
        })
        if (Client.state.importedScripts[url]) {
            const { progressEvent } = await Client.state.importedScripts[url]
            onEvent &&
                onEvent(
                    new SourceLoadedEvent(name, assetId, url, progressEvent),
                )
            return Client.state.importedScripts[url]
        }
        if (!isInstanceOfWindow(globalThis)) {
            // In a web-worker the script will be imported using self.importScripts(url).
            // No need to pre-fetch the source file in this case.
            return new Promise((resolve) => {
                resolve({
                    name,
                    version,
                    assetId,
                    url,
                    content: undefined,
                    progressEvent: undefined,
                })
            })
        }
        Client.state.importedScripts[url] = new Promise((resolve, reject) => {
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
        return Client.state.importedScripts[url]
    }

    /**
     * Install a various set of modules, scripts & stylesheets; see documentation in {@link InstallInputs}.
     *
     * @param inputs
     */
    install(inputs: InstallInputs): Promise<WindowOrWorkerGlobalScope> {
        const css = inputs.css || []
        const executingWindow = inputs.executingWindow || globalThis
        const aliases = inputs.aliases || {}
        const display = inputs.displayLoadingScreen || false
        const customInstallers = inputs.customInstallers || []
        let loadingScreen = undefined
        if (display) {
            loadingScreen = new LoadingScreenView()
            loadingScreen.render()
        }
        const onEvent = (ev) => {
            loadingScreen && loadingScreen.next(ev)
            inputs.onEvent && inputs.onEvent(ev)
        }

        const bundlesPromise = this.installModules({
            modules: inputs.modules,
            modulesSideEffects: inputs.modulesSideEffects,
            usingDependencies: inputs.usingDependencies,
            aliases: aliases,
            executingWindow,
            onEvent,
        })
        const cssPromise = isInstanceOfWindow(executingWindow)
            ? this.installStyleSheets({
                  css,
                  renderingWindow: executingWindow,
              })
            : Promise.resolve()
        const jsPromise = bundlesPromise.then(() => {
            return this.installScripts({
                scripts: inputs.scripts || [],
                executingWindow,
                aliases: inputs.aliases,
            })
        })

        const customInstallersPromises = customInstallers.map((installer) =>
            resolveCustomInstaller(installer),
        )
        return Promise.all([
            jsPromise,
            cssPromise,
            ...customInstallersPromises,
        ]).then(() => {
            onEvent && onEvent(new InstallDoneEvent())
            loadingScreen && loadingScreen.done()
            return executingWindow
        })
    }

    /**
     * Install a loading graph; see {@link InstallLoadingGraphInputs}.
     *
     * Loading graph can be retrieved using {@link Client.queryLoadingGraph} or
     * {@link queryLoadingGraph}.
     *
     * @param inputs
     */
    async installLoadingGraph(inputs: InstallLoadingGraphInputs) {
        const executingWindow = inputs.executingWindow || window
        const customInstallers = inputs.customInstallers || []
        Client.state.updateExportedSymbolsDict(inputs.loadingGraph.lock)

        const customInstallersFuture = customInstallers.map((installer) => {
            return resolveCustomInstaller(installer)
        })
        const packagesSelected = inputs.loadingGraph.definition
            .flat()
            .map(([assetId, cdn_url]) => {
                const version = cdn_url.split('/')[1]
                const asset = inputs.loadingGraph.lock.find(
                    (asset) => asset.id == assetId && asset.version == version,
                )
                return {
                    assetId,
                    url: `${this.backendConfiguration.urlRawPackage}/${cdn_url}`,
                    name: asset.name,
                    version: asset.version,
                }
            })
            .filter(
                ({ name, version }) =>
                    !Client.state.isCompatibleVersionInstalled(name, version),
            )
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
        const sourcesOrErrors = await Promise.all([
            ...customInstallersFuture,
            ...futures,
        ])
        if (errors.length > 0) {
            throw new FetchErrors({ errors })
        }
        const sources = sourcesOrErrors
            .slice(customInstallersFuture.length)
            .filter((d) => d != undefined)
            .map((d) => d as FetchedScript)
            .map((origin: FetchedScript) => {
                const userSideEffects = Object.entries(
                    inputs.modulesSideEffects || {},
                )
                    .filter(([_, val]) => {
                        return val != undefined
                    })
                    .filter(([key, _]) => {
                        const query = key.includes('#') ? key : `${key}#*`
                        if (query.split('#')[0] != origin.name) {
                            return false
                        }
                        return satisfies(
                            origin.version.replace('-wip', ''),
                            query.split('#')[1],
                        )
                    })
                    .map(([_, value]) => value)
                return {
                    ...origin,
                    sideEffect: async ({
                        htmlScriptElement,
                    }: {
                        htmlScriptElement: HTMLScriptElement
                    }) => {
                        await applyModuleSideEffects(
                            origin,
                            htmlScriptElement,
                            executingWindow,
                            userSideEffects,
                            inputs.onEvent,
                        )
                    },
                }
            })

        await addScriptElements(sources, executingWindow, inputs.onEvent)
        if (inputs.aliases) {
            installAliases(inputs.aliases, executingWindow)
        }
    }

    private async installModules(
        inputs: InstallModulesInputs,
    ): Promise<LoadingGraph> {
        const usingDependencies = [
            ...Client.state.getPinedDependencies(),
            ...(inputs.usingDependencies || []),
        ]
        inputs.modules = inputs.modules || []
        const modules = sanitizeModules(inputs.modules)
        const body = {
            modules: inputs.modules,
            usingDependencies,
        }
        const modulesSideEffects = modules.reduce(
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
                modulesSideEffects,
                executingWindow: inputs.executingWindow,
                onEvent: inputs.onEvent,
                aliases: inputs.aliases,
            })
            return loadingGraph
        } catch (error) {
            inputs.onEvent &&
                inputs.onEvent(new CdnLoadingGraphErrorEvent(error))
            throw error
        }
    }

    private async installScripts(
        inputs: InstallScriptsInputs,
    ): Promise<{ assetName; assetId; url; src }[]> {
        const client = new Client()
        const executingWindow = inputs.executingWindow || window
        const scripts = inputs.scripts
            .map((elem) =>
                typeof elem == 'string'
                    ? { location: elem, sideEffects: undefined }
                    : elem,
            )
            .map((elem) => ({ ...elem, ...parseResourceId(elem.location) }))

        const futures = scripts.map(({ name, url, sideEffects }) =>
            client
                .fetchScript({
                    name,
                    url,
                    onEvent: inputs.onEvent,
                })
                .then((fetchedScript) => {
                    return { ...fetchedScript, sideEffects }
                }),
        )

        const sourcesOrErrors = await Promise.all(futures)
        const sources = sourcesOrErrors.filter(
            (d) => !(d instanceof ErrorEvent),
        )

        await addScriptElements(sources, inputs.executingWindow, inputs.onEvent)
        if (inputs.aliases) {
            installAliases(inputs.aliases, executingWindow)
        }
        return sources.map(({ assetId, url, name, content }) => {
            return { assetId, url, assetName: name, src: content }
        })
    }

    private installStyleSheets(
        inputs: InstallStyleSheetsInputs,
    ): Promise<Array<HTMLLinkElement>> {
        const css = inputs.css

        const renderingWindow = inputs.renderingWindow || window

        const getLinkElement = (url) => {
            return Array.from(
                renderingWindow.document.head.querySelectorAll('link'),
            ).find((e) => e.href == this.backendConfiguration.origin + url)
        }
        const futures = css
            .map((elem) => {
                /**
                 * The following 'hack' is a remaining left over regarding backward compatibility.
                 */
                if (elem['resource']) {
                    elem = elem['resource'] as string
                }
                return typeof elem == 'string'
                    ? {
                          location: elem,
                      }
                    : elem
            })
            .map((elem) => ({ ...elem, ...parseResourceId(elem.location) }))
            .map(({ assetId, version, name, url, sideEffects }) => {
                url = Client.state.getPatchedUrl({
                    name,
                    version,
                    assetId,
                    url,
                })
                return { assetId, version, name, url, sideEffects }
            })
            .filter(({ url }) => !getLinkElement(url))
            .map(({ assetId, version, name, url, sideEffects }) => {
                return new Promise<HTMLLinkElement>((resolveCb) => {
                    const link = renderingWindow.document.createElement('link')
                    link.id = url
                    const classes = [assetId, name, version].map((key) =>
                        sanitizeCssId(key),
                    )
                    link.classList.add(...classes)
                    link.setAttribute('type', 'text/css')
                    link.href = this.backendConfiguration.origin + url
                    link.rel = 'stylesheet'
                    renderingWindow.document
                        .getElementsByTagName('head')[0]
                        .appendChild(link)
                    link.onload = () => {
                        sideEffects &&
                            sideEffects({
                                origin: {
                                    moduleName: name,
                                    version,
                                    assetId,
                                    url,
                                },
                                htmlLinkElement: link,
                                renderingWindow,
                            })
                        resolveCb(link)
                    }
                })
            })
        return Promise.all(futures)
    }
}
