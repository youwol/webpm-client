import { LoadingGraph, FetchedScript } from './models'
import { lt, major as getMajor } from 'semver'

export type LibraryName = string
export type Version = string

/**
 * Singleton object that gathers history of fetched modules, scripts & CSS.
 * It also acts as a cache store.
 *
 * > At any point in time, info about resources fetched can be retrieved from here.
 *
 * @category State
 */
export class State {
    /**
     * Return the exported symbol name of a library.
     *
     * For now implementation is based on a hard coded dictionary.
     *
     * @param name name of the library
     */
    static getExportedSymbolName(name: string): string {
        const variants = {
            lodash: '_',
            three: 'THREE',
            typescript: 'ts',
            'three-trackballcontrols': 'TrackballControls',
            codemirror: 'CodeMirror',
            'highlight.js': 'hljs',
            '@pyodide/pyodide': 'loadPyodide',
        }
        return Object.keys(variants).includes(name) ? variants[name] : name
    }

    /**
     * Imported modules: mapping between [[LibraryName]] and list of installed [[Version]]
     */
    static importedBundles = new Map<LibraryName, Version[]>()

    /**
     * Fetched loading graph: mapping between a loading graph's body uid and corresponding computed loading graph.
     */
    static fetchedLoadingGraph = new Map<string, Promise<LoadingGraph>>()

    /**
     * Installed loading graph: mapping between a loading graph's body uid and window state
     */
    static importedLoadingGraphs = new Map<string, Promise<Window>>()

    /**
     * Installed script: mapping between a script's uid and a [[FetchedScript]]
     */
    static importedScripts = new Map<string, Promise<FetchedScript>>()

    /**
     * Latest version of modules installed: mapping between library name and latest version
     */
    static latestVersion = new Map<string, Version>()

    /**
     * Return whether a library at particular version hase been installed
     * @param libName library name
     * @param version version
     */
    static isInstalled(libName: string, version: string): boolean {
        if (libName == '@youwol/cdn-client') {
            return true
        }
        return (
            State.importedBundles.has(libName) &&
            State.importedBundles.get(libName).includes(version)
        )
    }

    /**
     * Reset the cache, but keep installed modules.
     */
    static resetCache() {
        State.importedBundles = new Map<LibraryName, Version[]>()
        State.importedLoadingGraphs = new Map<string, Promise<Window>>()
        State.importedScripts = new Map<string, Promise<FetchedScript>>()
        State.latestVersion = new Map<string, string>()
    }

    /**
     * Update [[State.latestVersion]] given a provided installed [[LoadingGraph]].
     * It also exposes the latest version in `executingWindow` using original symbol name if need be.
     *
     * @param loadingGraph installed [[LoadingGraph]]
     * @param executingWindow where to expose the latest version if change need be
     */
    static updateLatestBundleVersion(
        loadingGraph: LoadingGraph,
        executingWindow: Window,
    ) {
        const toConsiderForUpdate = loadingGraph.lock.filter(
            ({ name, version }) => {
                return !(
                    State.latestVersion.has(name) &&
                    State.latestVersion.get(name) == version
                )
            },
        )
        toConsiderForUpdate.forEach(({ name, version }) => {
            if (
                State.latestVersion.has(name) &&
                lt(version, State.latestVersion.get(name))
            ) {
                return
            }
            const symbol = State.getExportedSymbolName(name)
            const major = getMajor(version)
            if (window[symbol] && !window[symbol]['__yw_set_from_version__']) {
                console.warn(
                    `Package "${name}" export symbol "${symbol}" with no major attached (should be ${major})`,
                )
                executingWindow[`${symbol}#${major}`] = executingWindow[symbol]
            }

            executingWindow[symbol] = executingWindow[`${symbol}#${major}`]
            if (!executingWindow[symbol]) {
                console.error(
                    `Problem with package "${name}" & export symbol "${symbol}"`,
                )
            }
            executingWindow[symbol]['__yw_set_from_version__'] = version
            State.latestVersion.set(name, version)
        })
    }
}
