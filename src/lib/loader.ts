import {
    CdnError,
    CdnEvent,
    CdnFetchEvent,
    CdnLoadingGraphErrorEvent,
    ErrorEvent,
    LoadingGraph,
    LoadingGraphError,
    SourceParsedEvent,
} from './models'
import { Client } from './client'
import { LoadingGraphErrorScreen } from './error.view'

const importedBundles = {}

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
}): Promise<LoadingGraph | LoadingGraphError> {
    return new Client().getLoadingGraph(body)
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
    sideEffects?: { [key: string]: (Window) => void },
    onEvent?: (event: CdnFetchEvent) => void,
) {
    executingWindow = executingWindow || window
    const client = new Client()
    const libraries = loadingGraph.lock.reduce(
        (acc, e) => ({ ...acc, ...{ [e.id]: e } }),
        {},
    )

    const isToDownload = (assetId: string) => {
        const libName = libraries[assetId].name
        const version = libraries[assetId].version
        // This one essentially prevent clearing the cache
        // ...we need extra care on backward compatibility
        if (libName == '@youwol/cdn-client') {
            return false
        }

        if (!importedBundles[libName]) {
            return true
        }

        if (importedBundles[libName] != version) {
            console.warn(
                `Loading ${libName}#${version}: A different version of the package has been already fetched (${importedBundles[libName]}), the initial version is not updated`,
            )
            return false
        }
        sideEffects &&
            sideEffects[libName] &&
            sideEffects[libName](executingWindow)
        return false
    }
    const packagesSelected = loadingGraph.definition
        .flat()
        .filter(([assetId]) => isToDownload(assetId))
        .map(([assetId, cdn_url]) => {
            return {
                assetId,
                url: `/api/assets-gateway/raw/package/${cdn_url}`,
                name: libraries[assetId].name,
                version: libraries[assetId].version,
            }
        })

    const futures = packagesSelected.map(({ assetId, name, version, url }) => {
        return client.fetchSource({ name, version, assetId, url, onEvent })
    })
    const sourcesOrErrors = await Promise.all(futures)
    const contents = sourcesOrErrors.filter(
        (d) => !(d instanceof ErrorEvent),
    ) as { name; version; assetId; url; content }[]

    const head = document.getElementsByTagName('head')[0]
    contents.forEach(({ name, version, assetId, url, content }) => {
        const script = document.createElement('script')
        script.innerHTML = content
        script.id = url
        script.classList.add(name, version, assetId)
        head.appendChild(script)
        const sideEffect = sideEffects && sideEffects[name]
        const target = getLoadedModule(name, executingWindow)
        if (target && !executingWindow[name]) {
            executingWindow[name] = target
        }
        sideEffect && sideEffect(executingWindow)
        onEvent && onEvent(new SourceParsedEvent(name, assetId, url))
        importedBundles[name] = libraries[assetId].version
    })
}

/**
 *
 * Install a set of resources.
 *
 * Modules stand for javascript's module.
 * If some required dependencies of the module are missing they are also loaded.
 *
 * Scripts stand for standalone javascript file; they are fetched after all modules
 * have been loaded.
 *
 * CSS stand for stylesheets.
 *
 * Aliases allow to use a different name to refer to the loaded resources.
 * @param resources what needs to be installed
 * @param resources.modules: either a `{name, version}` object or a string.
 * If a string is provided, version is 'latest'.
 * @param resources.scripts: array of path for javascript scripts in the format
 * {libraryName}#{version}~{rest-of-path}
 * @param resources.css: array of path for css stylesheets in the format
 * {libraryName}#{version}~{rest-of-path}
 * @param resources.aliases: a set of aliases that are applied after all the resources
 * have been loaded. A dictionary {key: value} where key is the alias in
 * executingWindow and value is either:
 *       - a string => `executingWindow[alias] = executingWindow[value]`
 *       - a function => `executingWindow[alias] = value(executingWindow)`
 *
 * @param options extra options
 * @param options.executingWindow the 'window' object where the install is done.
 * If not provided, use 'window'
 * @param options.onEvent callback called at every CDN event
 * @param options.onError callback called with the first occurring error.
 * If not provided, a callback displaying the error as a full screen modal is used
 * @returns a promise over the executingWindow
 */
export function install(
    resources: {
        modules?: (
            | {
                  name: string
                  version: string
              }
            | string
        )[]
        scripts?: string[]
        css?: string[]
        aliases?: { [key: string]: string | ((Window) => unknown) }
    },
    options: {
        executingWindow?: Window
        onEvent?: (event: CdnFetchEvent) => void
        onError?: (event: CdnError) => void
    } = {},
): Promise<Window | CdnError> {
    const modules = resources.modules || []
    const scripts = resources.scripts || []
    const css = resources.css || []
    const aliases = resources.aliases || {}
    const executingWindow = options.executingWindow || window
    const onError =
        options.onError ||
        ((error) => {
            const screen = new LoadingGraphErrorScreen({
                container: window.document.body,
                error,
            })
            screen.render()
        })
    const cssPromise = fetchStyleSheets(css, executingWindow)

    const bundles = modules.reduce((acc, e) => {
        const elem =
            typeof e == 'string'
                ? {
                      name: e,
                      version: 'latest',
                  }
                : e

        return {
            ...acc,
            [elem.name]: elem,
        }
    }, {})

    const jsPromise: Promise<
        | CdnError
        | {
              fetchedBundles
              jsAddOns
          }
    > = fetchBundles(bundles, executingWindow, options.onEvent).then(
        (fetchedBundles) => {
            if (fetchedBundles instanceof CdnError) {
                return Promise.resolve(fetchedBundles)
            }
            return fetchJavascriptAddOn(scripts, executingWindow).then(
                (jsAddOns) => ({
                    fetchedBundles,
                    jsAddOns,
                }),
            )
        },
    )

    return Promise.all([jsPromise, cssPromise]).then(([jsResult, _]) => {
        if (jsResult instanceof CdnError) {
            onError(jsResult)
            return jsResult
        }
        Object.entries(aliases).forEach(([alias, original]) => {
            executingWindow[alias] =
                typeof original == 'string'
                    ? executingWindow[original]
                    : original(executingWindow)
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
    resources: string | Array<string>,
    renderingWindow?: Window,
): Promise<Array<HTMLLinkElement>> {
    const _resources = typeof resources == 'string' ? [resources] : resources
    renderingWindow = renderingWindow || window
    const hrefs = Array.from(renderingWindow.document.links).map(
        (link) => link.href,
    )

    const futures = _resources
        .map((resourceId) => parseResourceId(resourceId))
        .filter(({ url }) => !hrefs.includes(url))
        .map(({ url }) => {
            return new Promise<HTMLLinkElement>((resolveCb) => {
                const link = renderingWindow.document.createElement('link')
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

function mapObjectValues<T0, T1>(
    obj: { [k: string]: T0 },
    mapFct: (v: T0) => T1,
): { [k: string]: T1 } {
    return Object.entries(obj)
        .map(([k, v]) => {
            return [k, mapFct(v)]
        })
        .reduce((acc, [k, v]: [k: string, v: T1]) => ({ ...acc, [k]: v }), {})
}

/**
 *
 * @param dependencies mapping *libraryName*=>*version* or *libraryName*=>*{version, sideEffects}*
 * If sideEffects is provided, it will be called using the executingWindow as argument when the library
 * has been installed.
 * @param executingWindow the window used to install the dependencies, default to the global window
 * @param onEvent if provided, callback called at each HTTP request event
 * @returns Promise resolving to the argument *dependencies* provided as a mapping *libraryName*=>*{version, sideEffects}*
 */
export async function fetchBundles(
    dependencies: {
        [key: string]:
            | string
            | { version: string; sideEffects: (Window) => void }
    },
    executingWindow?: Window,
    onEvent?: (event: CdnEvent) => void,
): Promise<
    | {
          [key: string]: { version: string; sideEffects: (Window) => void }
      }
    | CdnError
> {
    executingWindow = executingWindow || window
    type TTargetValue = { version: string; sideEffects: (Window) => void }

    const cleanedDependencies = mapObjectValues(
        dependencies,
        (v: string | TTargetValue): TTargetValue =>
            typeof v == 'string'
                ? {
                      version: v,
                      sideEffects: () => {
                          /*no op*/
                      },
                  }
                : v,
    )

    const body = {
        libraries: Object.entries(cleanedDependencies).reduce(
            (acc, [k, v]) => ({ ...acc, ...{ [k]: v.version } }),
            {},
        ),
    }
    const sideEffects = Object.entries(cleanedDependencies).reduce(
        (acc, [k, v]) => ({ ...acc, ...{ [k]: v.sideEffects } }),
        {},
    )
    const loadingGraph = await new Client().getLoadingGraph(body)
    if (loadingGraph instanceof LoadingGraphError) {
        onEvent && onEvent(new CdnLoadingGraphErrorEvent(loadingGraph))
        console.error('Failed to resolve packages versions', loadingGraph)
        return loadingGraph
    }

    await fetchLoadingGraph(loadingGraph, executingWindow, sideEffects, onEvent)
    return cleanedDependencies
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
    resources: string | Array<string>,
    executingWindow?: Window,
    onEvent?: (CdnEvent) => void,
): Promise<{ assetName; assetId; url; src }[]> {
    const client = new Client()
    const _resources = typeof resources == 'string' ? [resources] : resources

    const ids = _resources.map((resourceId) => parseResourceId(resourceId))

    const futures = ids.map(({ name, assetId, url }) =>
        client.fetchSource({ name, assetId, url, onEvent }),
    )

    const sourcesOrErrors = await Promise.all(futures)
    const sources = sourcesOrErrors.filter(
        (d) => !(d instanceof ErrorEvent),
    ) as { name; assetId; url; content }[]

    const head = document.getElementsByTagName('head')[0]

    sources.forEach(({ name, assetId, url, content }) => {
        const script = document.createElement('script')
        script.innerHTML = content
        head.appendChild(script)
        onEvent && onEvent(new SourceParsedEvent(name, assetId, url))
    })

    return sources.map(({ assetId, url, name, content }) => {
        return { assetId, url, assetName: name, src: content }
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

function getLoadedModule(fullname: string, executingWindow?: Window) {
    executingWindow = executingWindow || window

    if (
        executingWindow[fullname] &&
        Object.entries(executingWindow[fullname]).length > 0
    ) {
        return executingWindow[fullname]
    }

    if (fullname.includes('/')) {
        const namespace = fullname.split('/')[0].slice(1)
        const name = fullname.split('/')[1]
        return executingWindow[namespace][name]
    }
    return undefined
}
