import {
    ModuleSideEffectCallback,
    ModuleInput,
    FetchedScript,
    ScriptSideEffectCallback,
    LightLibraryWithAliasQueryString,
    BackendInputs,
    EsmInputs,
    InstallInputs,
    QueryLoadingGraphInputs,
} from './inputs.models'
import {
    CdnEvent,
    ParseErrorEvent,
    SourceLoadedEvent,
    SourceParsedEvent,
    UnauthorizedEvent,
    UrlNotFoundEvent,
} from './events.models'
import { UrlNotFound, SourceParsingFailed, Unauthorized } from './errors.models'
import { StateImplementation } from './state'
import { sanitizeCssId } from './utils.view'
import { Client } from './client'
import { parse } from 'semver'

export function onHttpRequestLoad(
    req: XMLHttpRequest,
    event: ProgressEvent<XMLHttpRequestEventTarget>,
    resolve,
    reject,
    { url, name, assetId, version },
    onEvent?,
) {
    if (req.status == 200) {
        const content =
            req.responseText +
            `\n//# sourceURL=${url.split('/').slice(0, -1).join('/')}/`

        onEvent?.(new SourceLoadedEvent(name, assetId, url, event))
        resolve({
            name,
            version,
            assetId,
            url,
            content,
            progressEvent: event,
        } as FetchedScript)
    }
    if (req.status == 401 || req.status == 403) {
        const unauthorized = new UnauthorizedEvent(name, assetId, url)
        onEvent?.(unauthorized)
        reject(new Unauthorized({ assetId, name, url }))
    }
    if (req.status == 404) {
        const urlNotFound = new UrlNotFoundEvent(name, assetId, url)
        onEvent?.(urlNotFound)
        reject(new UrlNotFound({ assetId, name, url }))
    }
}

export function sanitizeModules(
    modules: ModuleInput[],
): { name: string; version: string; sideEffects?: ModuleSideEffectCallback }[] {
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

/**
 * Parse a resource id in the form `{libraryName}#{version}~{rest-of-path}` where:
 * -    libraryName is the name of the library
 * -    version is the target version
 * -    rest-of-path is the partial url from the package's directory to the target CSS
 *
 * @param resourceId resource id in the form `{libraryName}#{version}~{rest-of-path}`
 * @category Helpers
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

export function patchExportedSymbolForBackwardCompatibility(
    origin: FetchedScript,
    executingWindow: WindowOrWorkerGlobalScope,
) {
    const regularExported = getRegularFullExportedSymbol(
        origin.name,
        origin.version,
    )
    /**
     * All 3 variables below corresponds to deprecated symbols
     */
    const deprecatedExportedName = getInstalledFullExportedSymbol(
        origin.name,
        origin.version,
    )
    const symbolBase = StateImplementation.getExportedSymbol(
        origin.name,
        origin.version,
    ).symbol
    const aliasExportedName = getFullExportedSymbolAlias(
        origin.name,
        origin.version,
    )
    if (
        !executingWindow[regularExported] &&
        !executingWindow[deprecatedExportedName] &&
        !executingWindow[symbolBase]
    ) {
        console.warn(
            `Can not find exported symbol of library ${origin.name}#${origin.version} in current scope`,
            {
                exportedName: deprecatedExportedName,
                aliasExportedName,
                symbolBase,
            },
        )
        return
    }
    if (executingWindow[regularExported]) {
        executingWindow[deprecatedExportedName] =
            executingWindow[regularExported]
    }
    if (!executingWindow[regularExported]) {
        console.warn('The export symbol of the package is deprecated', {
            deprecatedExportedName,
            name: origin.name,
            version: origin.version,
        })
        if (
            executingWindow[symbolBase] &&
            !executingWindow[deprecatedExportedName]
        ) {
            console.warn(
                `Package "${origin.name}#${origin.version}" export symbol "${symbolBase}" with no API version`,
            )
        }
        window[regularExported] =
            executingWindow[deprecatedExportedName] ||
            executingWindow[aliasExportedName] ||
            executingWindow[symbolBase]
    }

    executingWindow[aliasExportedName] = executingWindow[regularExported]

    if (!executingWindow[regularExported]) {
        console.log('applyModuleSideEffects error', {
            exportedName: regularExported,
            symbolBase,
            aliasExportedName,
        })
        console.warn(
            `Can not find exported symbol of library ${origin.name}#${origin.version} in current context`,
            {
                exportedName: regularExported,
                aliasExportedName,
                symbolBase,
                contextKeys: Object.keys(window),
            },
        )
        return
    }
    return executingWindow[regularExported]
}

export async function applyModuleSideEffects(
    origin: FetchedScript,
    htmlScriptElement: HTMLScriptElement,
    executingWindow: WindowOrWorkerGlobalScope,
    userSideEffects: ModuleSideEffectCallback[],
    onEvent: (CdnEvent) => void,
) {
    const module = patchExportedSymbolForBackwardCompatibility(
        origin,
        executingWindow,
    )
    if (!module) {
        return
    }
    module['__yw_set_from_version__'] = origin.version

    StateImplementation.registerImportedModules([origin], executingWindow)

    // This is when this instance of webpm-client is installing either @youwol/webpm-client or @youwol/cdn-client
    // => the configuration needs to be propagated
    // The configuration is initially set by the root script of '@youwol/webpm-client'.
    if (['@youwol/webpm-client', '@youwol/cdn-client'].includes(origin.name)) {
        const installedClient = module.Client
        installedClient.FrontendConfiguration = Client.FrontendConfiguration
        installedClient.BackendConfiguration = Client.BackendConfiguration
    }
    for (const sideEffectFct of userSideEffects) {
        const args = {
            module,
            origin,
            htmlScriptElement,
            executingWindow,
            onEvent,
        }
        if (sideEffectFct.constructor.name === 'AsyncFunction') {
            await sideEffectFct(args)
            continue
        }
        sideEffectFct(args)
    }
}

export function importScriptMainWindow({
    url,
    assetId,
    version,
    name,
    content,
    executingWindow,
}: {
    url
    assetId
    version
    name
    content
    executingWindow: Window
}): HTMLScriptElement | ErrorEvent {
    const head = document.getElementsByTagName('head')[0]
    if (executingWindow.document.getElementById(url)) {
        return executingWindow.document.getElementById(url) as HTMLScriptElement
    }
    const script = document.createElement('script')
    script.id = url
    if (Client.FrontendConfiguration.crossOrigin != undefined) {
        script.crossOrigin = Client.FrontendConfiguration.crossOrigin
    }
    const classes = [assetId, name, version].map((key) => sanitizeCssId(key))
    script.classList.add(...classes)
    script.innerHTML = content
    let error: ErrorEvent
    const onErrorParsing = (d: ErrorEvent) => {
        executingWindow.removeEventListener('error', onErrorParsing)
        error = d
    }
    executingWindow.addEventListener('error', onErrorParsing)
    head.appendChild(script)
    executingWindow.removeEventListener('error', onErrorParsing)
    return error || script
}

export function importScriptWebWorker({ url }): undefined | Error {
    const cacheKey = 'cdnClientImportedScriptUrls'
    const importedScripts = self[cacheKey] || []
    if (importedScripts.includes(url)) {
        return
    }
    try {
        // The way scripts are imported into workers depend on FrontendConfiguration.crossOrigin attribute.
        // It is implemented in the function 'entryPointInstall'
        self['customImportScripts'](url)
        self[cacheKey] = [...importedScripts, url]
    } catch (error) {
        console.error(`Failed to import script ${url} in WebWorker`, error)
        return error
    }
}

export async function addScriptElements(
    sources: (FetchedScript & { sideEffect?: ScriptSideEffectCallback })[],
    executingWindow?: WindowOrWorkerGlobalScope,
    onEvent?: (event: CdnEvent) => void,
) {
    if (sources.length == 0) {
        return
    }
    executingWindow = executingWindow || window
    const sideEffects = sources
        .map(
            ({
                name,
                assetId,
                version,
                url,
                content,
                progressEvent,
                sideEffect,
            }) => {
                const scriptOrError = isInstanceOfWindow(executingWindow)
                    ? importScriptMainWindow({
                          url,
                          assetId,
                          version,
                          name,
                          content,
                          executingWindow: executingWindow,
                      })
                    : importScriptWebWorker({ url })

                if (
                    scriptOrError instanceof Error ||
                    scriptOrError instanceof ErrorEvent
                ) {
                    console.error(
                        `Failed to parse source code of ${name}#${version}: ${scriptOrError.message}`,
                    )
                    onEvent?.(new ParseErrorEvent(name, assetId, url))
                    throw new SourceParsingFailed({
                        assetId,
                        name,
                        url,
                        message: scriptOrError.message,
                    })
                }
                onEvent?.(new SourceParsedEvent(name, assetId, url))
                if (sideEffect) {
                    return sideEffect({
                        origin: {
                            name,
                            assetId,
                            version,
                            url,
                            content,
                            progressEvent,
                        },
                        // If the script has been imported in web-worker, scriptOrError is undefined.
                        // It can't be anything else as there is no concept of DOM in web-worker.
                        htmlScriptElement: scriptOrError,
                        executingWindow,
                    })
                }
            },
        )
        .filter((sideEffect) => sideEffect != undefined)
    await Promise.all(sideEffects)
}

/**
 * Returns the assetId from a name.
 * It does not imply that the asset exist.
 *
 * @param name name of the package (as defined in package.json)
 * @returns assetId used in the assets store
 * @category Helpers
 */
export function getAssetId(name: string) {
    return window.btoa(name)
}

/**
 * Returns the base url to access a CDN asset from its name & version.
 * It does not imply that the asset exist.
 *
 * @param name name of the package (as defined in package.json).
 * @param version version of the package (as defined in package.json).
 * @returns base url to access the resource.
 * @category Helpers
 */
export function getUrlBase(name: string, version: string) {
    const assetId = getAssetId(name)
    return `${Client.BackendConfiguration.urlResource}/${assetId}/${version}`
}

/**
 * Return the regular exported symbol name of a library (including API version).
 * Warning: Valid only for already installed package.
 *
 * @param name name of the library
 * @param version version of the library
 */
export function getRegularFullExportedSymbol(name: string, version: string) {
    const exported = StateImplementation.getExportedSymbol(name, version)
    return `${name}_APIv${exported.apiKey}`
}

/**
 * Return the full exported symbol name of a library (including API version).
 * Warning: Valid only for already installed package.
 *
 * @param name name of the library
 * @param version version of the library
 */
export function getInstalledFullExportedSymbol(name: string, version: string) {
    const exported = StateImplementation.getExportedSymbol(name, version)
    return `${exported.symbol}_APIv${exported.apiKey}`
}

/**
 * Return the full (expected) exported symbol name of a library (including API version)
 *
 * @param name name of the library
 * @param version version of the library
 */
export function getExpectedFullExportedSymbol(name: string, version: string) {
    const parsed = parse(version)
    return `${name}_APIv${parsed.major}${
        parsed.major == 0 ? parsed.minor : ''
    }${parsed.major == 0 && parsed.minor == 0 ? parsed.patch : ''}`
}

/**
 * Return the API key from a version.
 *
 * @param version version (conform to semver)
 */
export function getApiKey(version: string) {
    const parsed = parse(version)
    return `${parsed.major}${parsed.major == 0 ? parsed.minor : ''}${
        parsed.major == 0 && parsed.minor == 0 ? parsed.patch : ''
    }`
}

/**
 * Return the alias (using '#') of full exported symbol name of a library (including API version)
 *
 * @param name name of the library
 * @param version version of the library
 */
export function getFullExportedSymbolAlias(name: string, version: string) {
    return getInstalledFullExportedSymbol(name, version).replace('_APIv', '#')
}

export function installAliases(
    aliases: { [key: string]: string | ((Window) => unknown) },
    executingWindow: WindowOrWorkerGlobalScope,
) {
    StateImplementation.installAliases(aliases, executingWindow)
}

export function isInstanceOfWindow(
    scope: WindowOrWorkerGlobalScope,
): scope is Window {
    return (scope as Window).document != undefined
}

export function extractModulesToInstall(
    modules: LightLibraryWithAliasQueryString[],
) {
    return modules.map((module) => module.split(' as ')[0])
}

export function extractInlinedAliases(
    modules: LightLibraryWithAliasQueryString[],
    suffix: string = '',
) {
    const getKey = (module: string) => {
        const key = module.split(' as ')[0].trim()
        if (!key.includes('#')) {
            return key
        }
        let version = key.split('#')[1].trim()
        if (version == 'x' || version == '*' || version == 'latest') {
            return key.split('#')[0].trim()
        }
        if (version.startsWith('~') || version.startsWith('^')) {
            version = version.substring(1)
        }
        return `${key.split('#')[0].trim()}_APIv${getApiKey(version)}`
    }
    const getValue = (module: string) => {
        return module.split(' as ')[1].trim()
    }

    return modules
        .filter((module) => module.includes(' as '))
        .reduce(
            (acc, module) => ({
                ...acc,
                [getValue(module)]: getKey(module).replace(
                    '_APIv',
                    `${suffix}_APIv`,
                ),
            }),
            {},
        )
}

export const PARTITION_PREFIX = '%p-'

export function normalizeBackendInputs(inputs: InstallInputs): BackendInputs {
    const emptyInstaller = {
        modules: [],
        configurations: {},
        partition: Client.backendsPartitionId,
    }
    if (!inputs.backends) {
        return emptyInstaller
    }
    if (Array.isArray(inputs.backends)) {
        return {
            ...emptyInstaller,
            modules: inputs.backends,
        }
    }
    return {
        ...emptyInstaller,
        ...inputs.backends,
    }
}

export function normalizeEsmInputs(inputs: InstallInputs): EsmInputs {
    const emptyInstaller = {
        modules: [],
        scripts: [],
    }
    if (!inputs.esm) {
        return emptyInstaller
    }
    if (Array.isArray(inputs.esm)) {
        return {
            ...emptyInstaller,
            modules: inputs.esm,
        }
    }
    return {
        ...emptyInstaller,
        ...inputs.esm,
    }
}

export function normalizePyodideInputs(inputs: InstallInputs): EsmInputs {
    const emptyInstaller = {
        modules: [],
    }
    if (!inputs.pyodide) {
        return emptyInstaller
    }
    if (Array.isArray(inputs.pyodide)) {
        return {
            ...emptyInstaller,
            modules: inputs.pyodide,
        }
    }
    return {
        ...emptyInstaller,
        ...inputs.pyodide,
    }
}

export function normalizeLoadingGraphInputs(
    inputs: QueryLoadingGraphInputs,
): QueryLoadingGraphInputs {
    return {
        usingDependencies: [],
        ...inputs,
    }
}
