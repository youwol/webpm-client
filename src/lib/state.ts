import {
    LoadingGraph,
    FetchedScript,
    LightLibraryQueryString,
} from './inputs.models'
import { lt, gt, gte } from 'semver'
import {
    getInstalledFullExportedSymbol,
    getFullExportedSymbolAlias,
    getExpectedFullExportedSymbol,
} from './utils'
import { ChildrenLike, VirtualDOM } from './rx-vdom.types'
import { setup } from '../auto-generated'

export type LibraryName = string
export type Version = string

/**
 * Encapsulates installations data at the time of instance creation.
 *
 *  @category State
 */
export class Monitoring {
    /**
     * Dictionary with key of form `${libName}#${libVersion}`
     */
    public readonly exportedSymbols: {
        [k: string]: { symbol: string; apiKey: string }
    }
    /**
     *  Dictionary `libName->versions`.
     */
    public readonly importedBundles: {
        [k: string]: string[]
    }
    /**
     * Dictionary `libName->latest version`.
     */
    public readonly latestVersion: {
        [k: string]: string
    }
    /**
     * Create a VirtualDOM (see [fluxView](https://github.com/youwol/flux-view))
     * representing the current state of installation (modules installed & available symbols).
     */
    public readonly view: VirtualDOM<'div'>

    constructor() {
        this.exportedSymbols = { ...StateImplementation.getExportedSymbol }
        this.importedBundles = [
            ...StateImplementation.importedBundles.entries(),
        ].reduce(
            (acc, [k, v]) => ({
                ...acc,
                [k]: v,
            }),
            {},
        )
        this.latestVersion = [
            ...StateImplementation.latestVersion.entries(),
        ].reduce(
            (acc, [k, v]) => ({
                ...acc,
                [k]: v,
            }),
            {},
        )
        this.view = StateImplementation.view()
    }
}

/**
 * Provides extra-controls regarding dependencies and URL resolution.
 *
 * None of the methods exposed should be used in regular scenario.
 *
 *  @category State
 */
export class State {
    /**
     * Pin some dependencies to use whenever a loading graph is resolved,
     * it will over-ride natural resolution from packages description.
     *
     */
    static pinDependencies(dependencies: LightLibraryQueryString[]) {
        StateImplementation.pinDependencies(dependencies)
    }

    /**
     * Register a 'patcher' for URLs to fetch resource: any time a request is done to the target resource,
     * the URL is actually replaced by the registered patch.
     *
     * This is provided if somehow a saved loading graph reference resources that have been moved to other location.
     * @param patcher function that takes `{ name, version, assetId, url }` as argument and return the patched URLs
     * (which should be the original if no transformation is required).
     */
    static registerUrlPatcher(
        patcher: ({ name, version, assetId, url }) => string,
    ) {
        StateImplementation.registerUrlPatcher(patcher)
    }

    /**
     * Remove installed modules & reset the cache.
     * It makes its best to clear modules & associated side effects, but it is not perfect.
     * It is mostly intended at helping 'tear down' methods in tests.
     *
     * @param executingWindow where the resources have been installed
     */
    static clear(executingWindow?: Window) {
        StateImplementation.clear(executingWindow)
    }
}
/**
 * Singleton object that gathers history of fetched modules, scripts & CSS.
 * It also acts as a cache store.
 *
 * This is essentially a 'friend' class used by {@link Client} which should not be exposed.
 */
export class StateImplementation {
    /**
     * Dictionary of `${libName}#${libVersion}` -> `{ symbol: string; apiKey: string }`
     *
     */
    static exportedSymbolsDict: {
        [k: string]: { symbol: string; apiKey: string; aliases: string[] }
    } = {
        [`${setup.name}#${setup.version}`]: {
            symbol: setup.name,
            apiKey: setup.apiVersion,
            aliases: ['webpmClient'],
        },
    }

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
    ): { symbol: string; apiKey: string; aliases: string[] } {
        const exported =
            StateImplementation.exportedSymbolsDict[`${name}#${version}`]
        if (exported.aliases === undefined) {
            // This case can happen when installing a saved loading graph that did not included aliases at that time.
            return { ...exported, aliases: [] }
        }
        return exported
    }

    static updateExportedSymbolsDict(
        modules: {
            name: string
            version: string
            exportedSymbol: string
            apiKey: string
            aliases: string[]
        }[],
    ) {
        const newEntries = modules.reduce(
            (acc, e) => ({
                ...acc,
                [`${e.name}#${e.version}`]: {
                    symbol: e.exportedSymbol,
                    apiKey: e.apiKey,
                    aliases: e.aliases,
                },
            }),
            {},
        )
        StateImplementation.exportedSymbolsDict = {
            ...StateImplementation.exportedSymbolsDict,
            ...newEntries,
        }
    }
    /**
     * Imported modules: mapping between {@link LibraryName} and list of installed {@link Version}.
     */
    static importedBundles = new Map<LibraryName, Version[]>([
        [setup.name, [setup.version]],
    ])

    /**
     * Fetched loading graph: mapping between a loading graph's body uid and corresponding computed loading graph.
     * @hidden
     */
    static fetchedLoadingGraph = new Map<string, Promise<LoadingGraph>>()

    /**
     * Installed loading graph: mapping between a loading graph's body uid and window state
     */
    static importedLoadingGraphs = new Map<string, Promise<Window>>()

    /**
     * Installed script: mapping between a script's uid and a {@link FetchedScript}.
     * @hidden
     */
    static importedScripts = new Map<string, Promise<FetchedScript>>()

    /**
     * Latest version of modules installed: mapping between library name and latest version
     */
    static latestVersion = new Map<string, Version>([
        [setup.name, setup.version],
    ])

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
        if (libName == '@youwol/webpm-client') {
            const symbol = getExpectedFullExportedSymbol(libName, version)
            const alreadyHere = window[symbol]
            const compatibleInstalled =
                alreadyHere && gte(alreadyHere.setup.version, version)
            return compatibleInstalled == undefined
                ? false
                : compatibleInstalled
        }
        if (!StateImplementation.importedBundles.has(libName)) {
            return false
        }

        if (
            StateImplementation.importedBundles.get(libName).includes(version)
        ) {
            return true
        }

        const installedVersions =
            StateImplementation.importedBundles.get(libName)
        const compatibleVersion = installedVersions
            .filter(
                (installedVersion) =>
                    StateImplementation.getExportedSymbol(
                        libName,
                        installedVersion,
                    ).apiKey ==
                    StateImplementation.getExportedSymbol(libName, version)
                        .apiKey,
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
                    apiKey: StateImplementation.getExportedSymbol(
                        libName,
                        version,
                    ).apiKey,
                },
            )
        }
        return compatibleVersion != undefined
    }

    /**
     * @param aliases
     * @param executingWindow
     * @hidden
     */
    static installAliases(
        aliases: { [key: string]: string | ((Window) => unknown) },
        executingWindow: WindowOrWorkerGlobalScope,
    ) {
        Object.entries(aliases).forEach(([alias, original]) => {
            const pointed =
                typeof original == 'string'
                    ? executingWindow[original]
                    : original(executingWindow)
            if (!pointed) {
                console.warn('can not create alias', { alias, original })
                return
            }
            executingWindow[alias] = pointed
            if (!pointed.__yw_aliases__) {
                pointed.__yw_aliases__ = new Set()
            }
            pointed.__yw_aliases__.add(alias)
        })
    }

    /**
     * Reset the cache, but keep installed modules.
     * @hidden
     */
    static resetCache() {
        StateImplementation.importedBundles = new Map<LibraryName, Version[]>()
        StateImplementation.importedLoadingGraphs = new Map<
            string,
            Promise<Window>
        >()
        StateImplementation.importedScripts = new Map<
            string,
            Promise<FetchedScript>
        >()
        StateImplementation.latestVersion = new Map<string, string>()
        StateImplementation.exportedSymbolsDict = {}
    }

    /**
     * Remove installed modules & reset the cache.
     * It makes its best to clear modules & associated side effects, but it is not perfect.
     * It is not expose anyway and serves at helping tests mostly.
     *
     * @param executingWindow where the resources have been installed
     * @hidden
     */
    static clear(executingWindow?: Window) {
        executingWindow = executingWindow || window
        Array.from(StateImplementation.importedBundles.entries())
            .map(([lib, versions]) => {
                return versions.map((version) => [lib, version])
            })
            .flat()
            .map(([lib, version]) => {
                const symbolName = this.getExportedSymbol(lib, version).symbol
                const aliases =
                    executingWindow[symbolName]?.__yw_aliases__ || []
                return [
                    symbolName,
                    getInstalledFullExportedSymbol(lib, version),
                    getFullExportedSymbolAlias(lib, version),
                    ...aliases,
                ]
            })
            .flat()
            .forEach((toDelete) => {
                executingWindow[toDelete] && delete executingWindow[toDelete]
            })

        StateImplementation.resetCache()
    }

    /**
     * Update the various properties after new modules have been imported.
     *
     * @param modules modules installed
     * @param executingWindow the executing window (where to expose the latest version if change need be).
     * @hidden
     */
    static registerImportedModules(
        modules: { name: string; version: string }[],
        executingWindow: WindowOrWorkerGlobalScope,
    ) {
        modules.forEach(({ name, version }) => {
            const existingVersions = StateImplementation.importedBundles.has(
                name,
            )
                ? StateImplementation.importedBundles.get(name)
                : []
            StateImplementation.importedBundles.set(name, [
                ...existingVersions,
                version,
            ])
        })
        StateImplementation.updateLatestBundleVersion(modules, executingWindow)
    }
    /**
     * Update {@link StateImplementation.latestVersion} given a provided installed {@link LoadingGraph}.
     * It also exposes the latest version in `executingWindow` using original symbol name if need be.
     *
     * @param modules installed {@link LoadingGraph}
     * @param executingWindow where to expose the latest version if change need be
     * @hidden
     */
    private static updateLatestBundleVersion(
        modules: { name: string; version: string }[],
        executingWindow: WindowOrWorkerGlobalScope,
    ) {
        const toConsiderForUpdate = modules.filter(({ name, version }) => {
            return !(
                StateImplementation.latestVersion.has(name) &&
                StateImplementation.latestVersion.get(name) == version
            )
        })
        toConsiderForUpdate.forEach(({ name, version }) => {
            if (
                StateImplementation.latestVersion.has(name) &&
                lt(version, StateImplementation.latestVersion.get(name))
            ) {
                return
            }
            const { symbol, aliases } = StateImplementation.getExportedSymbol(
                name,
                version,
            )
            const exportedName = getInstalledFullExportedSymbol(name, version)

            if (!executingWindow[exportedName]) {
                console.error(
                    `Problem with package "${name}" & export symbol "${exportedName}"`,
                    {
                        name,
                        version,
                        symbol,
                        exportedName,
                    },
                )
            }
            if (StateImplementation.latestVersion.has(name)) {
                const prevLatestVersion =
                    StateImplementation.latestVersion.get(name)
                const { symbol, aliases } =
                    StateImplementation.getExportedSymbol(
                        name,
                        prevLatestVersion,
                    )
                const toRemove = [symbol, ...aliases]
                toRemove.forEach((alias) => {
                    delete executingWindow[alias]
                })
            }
            const toAdd = [symbol, ...aliases]
            toAdd.forEach((alias) => {
                executingWindow[alias] = executingWindow[exportedName]
            })
            StateImplementation.latestVersion.set(name, version)
        })
    }

    private static pinedDependencies: LightLibraryQueryString[] = []

    /**
     * return the (static) list of pined dependencies.
     */
    static getPinedDependencies() {
        return [...StateImplementation.pinedDependencies]
    }
    /**
     * Pin some dependencies to use whenever a loading graph is resolved,
     * it will over-ride natural resolution from packages description.
     *
     */
    static pinDependencies(dependencies: LightLibraryQueryString[]) {
        StateImplementation.pinedDependencies = [
            ...StateImplementation.pinedDependencies,
            ...dependencies,
        ]
    }

    /**
     *
     * @hidden
     */
    private static urlPatcher: ({ name, version, assetId, url }) => string = ({
        url,
    }) => url

    /**
     *
     * @param name name of the asset
     * @param version version of the asset
     * @param assetId id of the asset
     * @param url original URL
     */
    static getPatchedUrl({ name, version, assetId, url }) {
        return StateImplementation.urlPatcher({ name, version, assetId, url })
    }
    /**
     * Register a 'patcher' for URLs to fetch resource: any time a request is done to the target resource,
     * the URL is actually replaced by the registered patch.
     *
     * This is provided if somehow a saved loading graph reference resources that have been moved to other location.
     */
    static registerUrlPatcher(
        patcher: ({ name, version, assetId, url }) => string,
    ) {
        StateImplementation.urlPatcher = patcher
    }

    static view(): VirtualDOM<'div'> {
        return {
            tag: 'div',
            class: 'StateView',
            children: [
                { tag: 'h5', innerText: `I'm ${setup.name}#${setup.version}` },
                { tag: 'h3', innerText: 'Modules installed' },
                {
                    tag: 'div',
                    class: 'px-3 py-2 container',
                    children: [
                        new ModulesView({
                            importedBundles:
                                StateImplementation.importedBundles,
                        }),
                    ],
                },
                { tag: 'h3', innerText: 'Available symbols' },
                {
                    tag: 'div',
                    class: 'px-3 py-2 container',
                    children: [
                        new SymbolsView({
                            exportedSymbolsDict:
                                StateImplementation.exportedSymbolsDict,
                        }),
                    ],
                },
            ],
        }
    }
}

class ModulesView implements VirtualDOM<'div'> {
    public readonly tag = 'div'
    public readonly children: ChildrenLike
    constructor({ importedBundles }) {
        this.children = Array.from(importedBundles.entries()).map(
            ([k, versions]) => {
                return {
                    tag: 'div',
                    class: 'd-flex align-items-center my-1 row',
                    children: [
                        {
                            tag: 'div',
                            class: 'col-sm',
                            style: { fontWeight: 'bolder' },
                            innerText: k,
                        },
                        {
                            tag: 'div',
                            class: 'd-flex align-items-center col',
                            children: versions.map((v) => ({
                                class: 'border rounded p-1 mx-2 d-flex align-items-center',
                                children: [
                                    { tag: 'div', class: 'fas fa-tag mx-1' },
                                    { tag: 'div', innerText: v },
                                ],
                            })),
                        },
                    ],
                }
            },
        )
    }
}

class SymbolsView implements VirtualDOM<'div'> {
    public readonly tag = 'div'
    public readonly children: ChildrenLike
    constructor({
        exportedSymbolsDict,
    }: {
        exportedSymbolsDict: {
            [_k: string]: { symbol: string; apiKey: string }
        }
    }) {
        this.children = Array.from(Object.entries(exportedSymbolsDict)).map(
            ([k, symbol]) => {
                const symbolKey = `${symbol.symbol}_APIv${symbol.apiKey}`
                const aliases = window[symbolKey]?.__yw_aliases__ || new Set()
                return {
                    tag: 'div',
                    class: 'd-flex align-items-center my-1 row',
                    children: [
                        {
                            tag: 'div',
                            class: 'col-sm',
                            style: { fontWeight: 'bolder' },
                            innerText: k,
                        },
                        {
                            tag: 'div',
                            class: 'd-flex align-items-center col',
                            children: [symbolKey, ...aliases].map((v) => ({
                                tag: 'div',
                                class: 'border rounded p-1 mx-2 d-flex align-items-center',
                                children: [
                                    /*{
                                    class: 'fas fa-tag mx-1',
                                },*/
                                    { tag: 'div', innerText: v },
                                ],
                            })),
                        },
                    ],
                }
            },
        )
    }
}
