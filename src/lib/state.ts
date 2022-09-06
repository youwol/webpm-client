import { LoadingGraph, FetchedScript } from './models'
import { lt, gt, major as getMajor } from 'semver'
import { getFullExportedSymbol, getFullExportedSymbolDeprecated } from './utils'

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
     * Dictionary of `${libName}#${libVersion}` -> { symbol: string; apiKey: string }
     */
    static exportedSymbolsDict: {
        [k: string]: { symbol: string; apiKey: string }
    } = {}

    /**
     * Return the exported symbol name of a library.
     *
     * For now implementation is based on a hard coded dictionary.
     *
     * @param name name of the library
     * @param version version of the library
     */
    static getExportedSymbol(
        name: string,
        version: string,
    ): { symbol: string; apiKey: string } {
        return State.exportedSymbolsDict[`${name}#${version}`]
    }

    static updateExportedSymbolsDict(
        modules: {
            name: string
            version: string
            exportedSymbol: string
            apiKey: string
        }[],
    ) {
        const newEntries = modules.reduce(
            (acc, e) => ({
                ...acc,
                [`${e.name}#${e.version}`]: {
                    symbol: e.exportedSymbol,
                    apiKey: e.apiKey,
                },
            }),
            {},
        )
        State.exportedSymbolsDict = {
            ...State.exportedSymbolsDict,
            ...newEntries,
        }
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
     * Return whether a library at particular version hase been already installed with a compatible version.
     * Compatible version means a greater version with same major.
     *
     * @param libName library name
     * @param version version
     */
    static isCompatibleVersionInstalled(
        libName: string,
        version: string,
    ): boolean {
        if (libName == '@youwol/cdn-client') {
            return true
        }
        if (!State.importedBundles.has(libName)) {
            return false
        }

        if (State.importedBundles.get(libName).includes(version)) {
            return true
        }

        const installedVersions = State.importedBundles.get(libName)
        const compatibleVersion = installedVersions
            .filter(
                (installedVersion) =>
                    getMajor(installedVersion) == getMajor(version),
            )
            .find((installedVersion) => {
                return gt(installedVersion, version)
            })

        if (compatibleVersion) {
            console.log(
                `${libName}: a greater compatible version is already installed (${compatibleVersion}), skip install`,
                {
                    libName,
                    queriedVersion: version,
                    compatibleVersion,
                },
            )
        }
        return compatibleVersion != undefined
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
     * Remove installed modules & reset the cache
     *
     * @param executingWindow where the resources have been installed
     */
    static clear(executingWindow?: Window) {
        executingWindow = executingWindow || window
        Array.from(State.importedBundles.entries())
            .map(([lib, versions]) => {
                return versions.map((version) => [lib, version])
            })
            .flat()
            .map(([lib, version]) => {
                const symbolName = this.getExportedSymbol(lib, version).symbol
                return [
                    symbolName,
                    getFullExportedSymbol(lib, version),
                    getFullExportedSymbolDeprecated(lib, version),
                ]
            })
            .flat()
            .forEach((toDelete) => {
                executingWindow[toDelete] && delete executingWindow[toDelete]
            })

        State.resetCache()
    }

    /**
     * Update [[State.latestVersion]] given a provided installed [[LoadingGraph]].
     * It also exposes the latest version in `executingWindow` using original symbol name if need be.
     *
     * @param modules installed [[LoadingGraph]]
     * @param executingWindow where to expose the latest version if change need be
     */
    static updateLatestBundleVersion(
        modules: { name: string; version: string }[],
        executingWindow: Window,
    ) {
        const toConsiderForUpdate = modules.filter(({ name, version }) => {
            return !(
                State.latestVersion.has(name) &&
                State.latestVersion.get(name) == version
            )
        })
        toConsiderForUpdate.forEach(({ name, version }) => {
            if (
                State.latestVersion.has(name) &&
                lt(version, State.latestVersion.get(name))
            ) {
                return
            }
            const symbol = State.getExportedSymbol(name, version).symbol
            const exportedName = getFullExportedSymbol(name, version)

            if (
                executingWindow[exportedName] &&
                !State.latestVersion.has(name)
            ) {
                executingWindow[symbol] = executingWindow[exportedName]
                State.latestVersion.set(name, version)
                State.importedBundles.set(name, [version])
                return
            }

            executingWindow[symbol] = executingWindow[exportedName]
            if (!executingWindow[symbol]) {
                console.error(
                    `Problem with package "${name}" & export symbol "${symbol}"`,
                )
            }
            State.latestVersion.set(name, version)
            const existingVersions = State.importedBundles.has(name)
                ? State.importedBundles.get(name)
                : []
            State.importedBundles.set(name, [...existingVersions, version])
        })
    }
}
