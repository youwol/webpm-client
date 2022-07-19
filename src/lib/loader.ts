import {
    CdnEvent,
    CdnFetchEvent,
    CssInput,
    LoadingGraph,
    ModuleSideEffectCallback,
    ModulesInput,
    ScriptsInput,
} from './models'
import { Client } from './client'

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
    return new Client().queryLoadingGraph(body)
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
export function fetchLoadingGraph(
    loadingGraph: LoadingGraph,
    executingWindow?: Window,
    sideEffects?: { [key: string]: ModuleSideEffectCallback },
    onEvent?: (event: CdnFetchEvent) => void,
) {
    return new Client().installLoadingGraph(
        { loadingGraph, sideEffects },
        { executingWindow, onEvent },
    )
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
export function fetchStyleSheets(
    resources: CssInput,
    renderingWindow?: Window,
): Promise<Array<HTMLLinkElement>> {
    return new Client().installStyleSheets(resources, { renderingWindow })
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
async function fetchBundles({
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
    return new Client().installModules(
        { modules, modulesSideEffects, usingDependencies },
        { executingWindow, onEvent },
    )
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
export function fetchJavascriptAddOn(
    resources: ScriptsInput,
    executingWindow?: Window,
    onEvent?: (CdnEvent) => void,
): Promise<{ assetName; assetId; url; src }[]> {
    return new Client().installScripts(resources, { executingWindow, onEvent })
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
    return new Client().fetchScript({ name, url, onEvent })
}
