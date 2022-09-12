import { FetchedScript, FetchScriptInputs, LoadingGraph } from './models'
import {
    Client,
    installLoadingGraph,
    installScripts,
    installStyleSheets,
    queryLoadingGraph,
} from './client'

/**
 *
 * Use [[installScripts]] instead.
 *
 *
 * @deprecated
 * @category Deprecated
 *
 * @param resources
 * @param executingWindow
 * @param onEvent
 */
export function fetchJavascriptAddOn(
    resources: string | Array<string>,
    executingWindow: Window,
    onEvent: (ev) => void,
) {
    const scripts = typeof resources == 'string' ? [resources] : resources

    return installScripts({
        scripts,
        executingWindow,
        onEvent,
    })
}

/**
 * Use [[fetchScript]] instead.
 *
 * @deprecated
 * @category Deprecated
 *
 * @param inputs
 */
export function fetchSource(inputs: FetchScriptInputs): Promise<FetchedScript> {
    return new Client().fetchScript(inputs)
}

/**
 * Use [[installLoadingGraph]] instead.
 *
 * @deprecated
 * @category Deprecated
 *
 * @param loadingGraph
 * @param executingWindow
 * @param _
 * @param onEvent
 */
export function fetchLoadingGraph(
    loadingGraph: LoadingGraph,
    executingWindow: Window,
    _,
    onEvent?: (CdnEvent) => void,
) {
    return installLoadingGraph({
        loadingGraph,
        executingWindow,
        onEvent,
    })
}

/**
 * Use [[queryLoadingGraph]] instead.
 *
 * @deprecated
 * @category Deprecated
 *
 * @param body
 */
export function getLoadingGraph(body: {
    libraries: { [key: string]: string }
}) {
    return queryLoadingGraph({
        modules: Object.entries(body.libraries).map(([k, v]) => `${k}#${v}`),
    })
}

/**
 * Use [[installStyleSheets]] instead.
 *
 * @deprecated
 * @category Deprecated
 *
 * @param resources
 * @param renderingWindow
 */
export function fetchStyleSheets(
    resources: string | Array<string>,
    renderingWindow: Window,
) {
    const css = typeof resources == 'string' ? [resources] : resources

    return installStyleSheets({
        css,
        renderingWindow,
    })
}
