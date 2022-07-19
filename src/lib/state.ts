import { LoadingGraph, Origin } from './models'
import { Client } from './client'
import { lt, major as getMajor } from 'semver'

export type LibraryName = string
export type Version = string

export class State {
    static importedBundles = new Map<LibraryName, Version[]>()
    static fetchedLoadingGraph = new Map<string, Promise<LoadingGraph>>()
    static importedLoadingGraphs = new Map<string, Promise<Window>>()
    static importedScripts = new Map<string, Promise<Origin>>()
    static latestVersion = new Map<string, string>()

    static isInstalled(libName: string, version: string) {
        if (libName == '@youwol/cdn-client') {
            return false
        }
        return (
            State.importedBundles.has(libName) &&
            State.importedBundles.get(libName).includes(version)
        )
    }

    static resetCache() {
        State.importedBundles = new Map<LibraryName, Version[]>()
        State.importedLoadingGraphs = new Map<string, Promise<Window>>()
        State.importedScripts = new Map<string, Promise<Origin>>()
        State.latestVersion = new Map<string, string>()
    }

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
            const symbol = Client.getExportedSymbolName(name)
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
