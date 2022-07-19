import {
    CdnEvent,
    CdnFetchEvent,
    CdnLoadingGraphErrorEvent,
    FetchErrors,
    InstallDoneEvent,
    LoadingGraph,
    ParseErrorEvent,
    SourceParsedEvent,
    SourceParsingFailed,
} from './models'
import { Client, Origin } from './client'
import { LoadingScreenView } from './loader.view'
import { sanitizeCssId } from './utils.view'
import { satisfies, major as getMajor } from 'semver'

/**
 * Return the loading graph from a mapping *library-name*=>*version*.
 * If dependencies are missings from the provided mapping,
 * latest available version are used
 *
 * @param body libraries is a mapping *library-name*=>*version*
 * @returns Promise on a [[LoadingGraph]]
 */
export async function getLoadingGraph(body: {
    libraries: { [key: string]: string }
}): Promise<LoadingGraph> {
    return new Client().getLoadingGraph(body)
}

async function applyModuleSideEffects(
    origin: Origin,
    htmlScriptElement: HTMLScriptElement,
    executingWindow: Window,
    userSideEffects: ModuleSideEffectCallback[],
) {
    const versionsAvailable = Client.importedBundles.get(origin.name) || []
    Client.importedBundles.set(origin.name, [
        ...versionsAvailable,
        origin.version,
    ])
    const exportedName = `${Client.getExportedSymbolName(
        origin.name,
    )}#${getMajor(origin.version)}`

    for (const sideEffectFct of userSideEffects) {
        const r = sideEffectFct({
            module: window[exportedName],
            origin,
            htmlScriptElement,
            executingWindow,
        })
        if (r && r instanceof Promise) {
            await r
        }
    }
}

/**
 * Fetch the dependencies as described by a [[LoadingGraph]]
 *
 * @param loadingGraph loading graph descriptor
 * @param executingWindow the window used to install the dependencies, default to the global window
 * @param sideEffects if sideEffects[*libName*] exist => execute the associated function after
 * the library has been installed in executingWindow
 * @param onEvent if provided, callback called at each HTTP request event
 */
export async function fetchLoadingGraph(
    loadingGraph: LoadingGraph,
    executingWindow?: Window,
    sideEffects?: { [key: string]: ModuleSideEffectCallback },
    onEvent?: (event: CdnFetchEvent) => void,
) {
    executingWindow = executingWindow || window
    const client = new Client()
    const libraries = loadingGraph.lock.reduce(
        (acc, e) => ({ ...acc, ...{ [e.id]: e } }),
        {},
    )

    const packagesSelected = loadingGraph.definition
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
        return client.fetchSource({ name, url, onEvent }).catch((error) => {
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
        .filter(({ name, version }) => !Client.isInstalled(name, version))
        .map((origin: Origin) => {
            const userSideEffects = Object.entries(sideEffects)
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

    addScriptElements(sources, executingWindow, onEvent)
}

/**
 * Describe multiple bundle resource(s).
 */
export type ModulesInput = (
    | {
          name: string
          version: string
          sideEffects?: (Window) => void
      }
    | string
)[]

/**
 * Describe one or multiple CSS resource(s).
 *
 * Resource are like: {libraryName}#{version}~{rest-of-path}
 */
export type CssInput =
    | (
          | {
                resource: string
            }
          | string
      )[]
    | string

/**
 * Describe one or multiple scripts resource(s).
 *
 * Resource are like: {libraryName}#{version}~{rest-of-path}
 */
export type ScriptsInput =
    | (
          | {
                resource: string
            }
          | string
      )[]
    | string

function sanitizeModules(
    modules: ModulesInput,
): { name: string; version: string }[] {
    return modules.reduce((acc, e) => {
        const elem =
            typeof e == 'string'
                ? {
                      name: e.includes('#') ? e.split('#')[0] : e,
                      version: e.includes('#') ? e.split('#')[1] : 'latest',
                  }
                : e

        return [...acc, elem]
    }, [])
}

function sanitizeBase(input: ScriptsInput | CssInput):
    | {
          resource: string
          domId?: string
      }[]
    | undefined {
    if (typeof input == 'string') {
        return [{ resource: input }]
    }
    if (Array.isArray(input)) {
        return input.map((elem) => {
            if (typeof elem == 'string') {
                return { resource: elem }
            }
            return elem
        })
    }
    return undefined
}

function sanitizeScripts(input: ScriptsInput): {
    resource: string
    domId?: string
}[] {
    const sanitized = sanitizeBase(input)
    if (sanitized) {
        return sanitized
    }
    console.error('@youwol/cdn-client: Can not parse scripts input', input)
    return []
}

function sanitizeCss(input: CssInput): {
    resource: string
    domId?: string
}[] {
    const sanitized = sanitizeBase(input)
    if (sanitized) {
        return sanitized
    }
    console.error('@youwol/cdn-client: Can not parse css input', input)
    return []
}

function applyFinalSideEffects({
    aliases,
    executingWindow,
    onEvent,
    loadingScreen,
}: {
    aliases: Record<string, string | ((window: Window) => unknown)>
    executingWindow: Window
    onEvent?: (event: CdnEvent) => void
    loadingScreen?: LoadingScreenView
}) {
    Object.entries(aliases).forEach(([alias, original]) => {
        executingWindow[alias] =
            typeof original == 'string'
                ? executingWindow[original]
                : original(executingWindow)
    })
    onEvent && onEvent(new InstallDoneEvent())
    loadingScreen && loadingScreen.done()
}

/**
 * Type definition of a module installation side effects.
 * The callback takes an object as argument of structure:
 * ```{
 *  module: any, // the installed module
 *  scriptHtmlNode: HTMLScriptElement, // the html script element added
 *  executingWindow: Window, // the executing window
 * }```
 */
export type ModuleSideEffectCallback = (params: {
    module: any
    origin: Origin
    htmlScriptElement: HTMLScriptElement
    executingWindow: Window
}) => void | Promise<void>

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

    const bundlePromise = fetchBundles({
        modules,
        modulesSideEffects: resources.modulesSideEffects,
        usingDependencies: resources.usingDependencies,
        executingWindow,
        onEvent,
    })

    const cssPromise = fetchStyleSheets(css || [], executingWindow)
    const jsPromise = bundlePromise.then((resp) => {
        Client.updateLatestBundleVersion(resp, executingWindow)
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

/**
 *
 * @param resources a resource description or a list of resource description.
 * A resource description is a string of pattern *{libraryName}#{version}~{rest-of-path}* where:
 * -    libraryName is the name of the library
 * -    version is the target version
 * -    rest-of-path is the partial url from the package's directory to the target CSS
 *
 * An example of resource description: "@youwol/fv-widgets#0.0.3~dist/assets/styles/style.youwol.css"
 * @param renderingWindow the window used to install the stylesheets, default to global window
 * @returns a Promise on created HTMLLinkElement(s)
 */
export async function fetchStyleSheets(
    resources: CssInput,
    renderingWindow?: Window,
): Promise<Array<HTMLLinkElement>> {
    const css = sanitizeCss(resources)
    renderingWindow = renderingWindow || window

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

/**
 *
 * @param modules specify the modules to load.
 * If sideEffects is provided, it will be called using the executingWindow as argument when the library
 * has been installed.
 * @param modulesSideEffects Whenever a library is installed, if the side-effects object contains a matching element
 * the corresponding callback is executed. The keys are in the form '{libraryName}#{query-version}' where query-version
 * obeys to semantic versioning, the values are of type [[ModuleSideEffectCallback]]
 * @param usingDependencies if provided & whenever the requested library is needed, the version provided is used.
 * Each element is in the form of '{libraryName}#{version}'
 * @param executingWindow the window used to install the dependencies, default to the global window
 * @param onEvent if provided, callback called at each HTTP request event
 * @returns Promise resolving to the loading graph installed
 */
export async function fetchBundles({
    modules,
    modulesSideEffects,
    usingDependencies,
    executingWindow,
    onEvent,
}: {
    modules: {
        name: string
        version: string
        sideEffects?: (Window) => void
        domClasses?: string[]
    }[]
    modulesSideEffects?: { [_key: string]: ModuleSideEffectCallback }
    usingDependencies?: string[]
    executingWindow?: Window
    onEvent?: (event: CdnEvent) => void
}): Promise<LoadingGraph> {
    executingWindow = executingWindow || window
    usingDependencies = usingDependencies || []
    const body = {
        libraries: modules,
        using: usingDependencies.reduce((acc, dependency) => {
            return {
                ...acc,
                [dependency.split('#')[0]]: dependency.split('#')[1],
            }
        }, {}),
    }
    const sideEffects = modules.reduce(
        (acc, dependency) => ({
            ...acc,
            [`${dependency.name}#${dependency.version}`]:
                dependency.sideEffects,
        }),
        modulesSideEffects,
    )
    try {
        const loadingGraph = await new Client().getLoadingGraph(body)
        await fetchLoadingGraph(
            loadingGraph,
            executingWindow,
            sideEffects,
            onEvent,
        )
        return loadingGraph
    } catch (error) {
        onEvent && onEvent(new CdnLoadingGraphErrorEvent(error))
        throw error
    }
}

/**
 * Fetch some javascript 'add-ons' of some libraries.
 *
 * @param resources a resource description or a list of resource description.
 * A resource description is a string of pattern *{libraryName}#{version}~{rest-of-path}* where:
 * -    libraryName is the name of the library
 * -    version is the target version
 * -    rest-of-path is the partial url from the package's directory to the target CSS
 * @param executingWindow
 * @param onEvent if provided, callback called at each HTTP request event
 */
export async function fetchJavascriptAddOn(
    resources: ScriptsInput,
    executingWindow?: Window,
    onEvent?: (CdnEvent) => void,
): Promise<{ assetName; assetId; url; src }[]> {
    const client = new Client()
    const inputs = sanitizeScripts(resources)

    const scripts = inputs.map((elem) => ({
        ...elem,
        ...parseResourceId(elem.resource),
    }))

    const futures = scripts.map(({ name, url }) =>
        client.fetchSource({ name, url, onEvent }),
    )

    const sourcesOrErrors = await Promise.all(futures)
    const sources = sourcesOrErrors.filter((d) => !(d instanceof ErrorEvent))

    addScriptElements(sources, executingWindow, onEvent)

    return sources.map(({ assetId, url, name, content }) => {
        return { assetId, url, assetName: name, src: content }
    })
}

function addScriptElements(
    sources: (Origin & { sideEffect?: (HTMLScriptElement) => void })[],
    executingWindow: Window,
    onEvent: (event: CdnEvent) => void,
) {
    const head = document.getElementsByTagName('head')[0]

    sources.forEach(({ name, assetId, version, url, content, sideEffect }) => {
        if (executingWindow.document.getElementById(url)) {
            return
        }
        const script = document.createElement('script')
        script.id = url
        const classes = [assetId, name, version].map((key) =>
            sanitizeCssId(key),
        )
        script.classList.add(...classes)
        script.innerHTML = content
        let error: string
        const onErrorParsing = (d: ErrorEvent) => {
            error = d.message
        }
        executingWindow.addEventListener('error', onErrorParsing)
        head.appendChild(script)
        onEvent && onEvent(new SourceParsedEvent(name, assetId, url))
        executingWindow.removeEventListener('error', onErrorParsing)
        if (error) {
            onEvent && onEvent(new ParseErrorEvent(name, assetId, url))
            throw new SourceParsingFailed({
                assetId,
                name,
                url,
                message: error,
            })
        }
        sideEffect && sideEffect(script)
    })
}
/**
 * Returns the assetId in the assets store of a CDN asset from its name.
 * It does not imply that the asset exist.
 *
 * @param name name of the package (as defined in package.json)
 * @returns assetId used in the assets store
 */
export function getAssetId(name: string) {
    return btoa(name)
}

/**
 * Returns the base url to access a CDN asset from its name & version.
 * It does not imply that the asset exist.
 *
 * @param name name of the package (as defined in package.json)
 * @param version version of the package (as defined in package.json)
 * @returns base url to access the CDN resource (valid only if the asset is actually stored in the asset store)
 */
export function getUrlBase(name: string, version: string) {
    const assetId = getAssetId(name)
    return `/api/assets-gateway/raw/package/${assetId}/${version}`
}

/**
 * Parse a resource id in the form *{libraryName}#{version}~{rest-of-path}* where:
 * -    libraryName is the name of the library
 * -    version is the target version
 * -    rest-of-path is the partial url from the package's directory to the target CSS
 *
 * @param resourceId resource id in the form *{libraryName}#{version}~{rest-of-path}*
 */
export function parseResourceId(resourceId: string): {
    name: string
    version: string
    path: string
    assetId: string
    url: string
} {
    const name = resourceId.split('#')[0]
    const version = resourceId.split('#')[1].split('~')[0]
    const path = resourceId.split('#')[1].split('~')[1]
    const assetId = getAssetId(name)
    const url = `${getUrlBase(name, version)}/${path}`
    return { name, version, path, assetId, url }
}

/**
 * @param url
 * @param name name used for display purpose the resource, if not provided this is the last part of the url
 * @param onEvent if provided, callback called at each HTTP request event
 */
export function fetchSource({
    url,
    name,
    onEvent,
}: {
    url: string
    name?: string
    onEvent?: (event: CdnEvent) => void
}): Promise<{ name: string; assetId: string; url: string; content: string }> {
    return new Client().fetchSource({ name, url, onEvent })
}
