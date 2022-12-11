import {
    CdnEvent,
    ParseErrorEvent,
    SourceLoadedEvent,
    SourceParsedEvent,
    SourceParsingFailed,
    Unauthorized,
    UnauthorizedEvent,
    UrlNotFound,
    UrlNotFoundEvent,
    ModuleSideEffectCallback,
    ModuleInput,
    FetchedScript,
    ScriptSideEffectCallback,
    CustomInstaller,
} from './models'
import { State } from './state'
import { sanitizeCssId } from './utils.view'
import { Client, install } from './client'

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

        onEvent && onEvent(new SourceLoadedEvent(name, assetId, url, event))
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
        onEvent && onEvent(unauthorized)
        reject(new Unauthorized({ assetId, name, url }))
    }
    if (req.status == 404) {
        const urlNotFound = new UrlNotFoundEvent(name, assetId, url)
        onEvent && onEvent(urlNotFound)
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
 * Parse a resource id in the form *{libraryName}#{version}~{rest-of-path}* where:
 * -    libraryName is the name of the library
 * -    version is the target version
 * -    rest-of-path is the partial url from the package's directory to the target CSS
 *
 * @param resourceId resource id in the form *{libraryName}#{version}~{rest-of-path}*
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

export async function applyModuleSideEffects(
    origin: FetchedScript,
    htmlScriptElement: HTMLScriptElement,
    executingWindow: Window,
    userSideEffects: ModuleSideEffectCallback[],
    onEvent: (CdnEvent) => void,
) {
    const versionsAvailable = State.importedBundles.get(origin.name) || []
    State.importedBundles.set(origin.name, [
        ...versionsAvailable,
        origin.version,
    ])
    const exportedName = getFullExportedSymbol(origin.name, origin.version)
    const symbolBase = State.getExportedSymbol(
        origin.name,
        origin.version,
    ).symbol
    const aliasExportedName = getFullExportedSymbolAlias(
        origin.name,
        origin.version,
    )

    if (executingWindow[symbolBase] && !executingWindow[exportedName]) {
        console.warn(
            `Package "${origin.name}#${origin.version}" export symbol "${symbolBase}" with no API version`,
        )
    }

    executingWindow[exportedName] =
        executingWindow[exportedName] ||
        executingWindow[aliasExportedName] ||
        executingWindow[symbolBase]
    executingWindow[aliasExportedName] = executingWindow[exportedName]

    if (!executingWindow[exportedName]) {
        console.warn(
            `Can not find exported symbol of library ${origin.name}#${origin.version} in current context`,
            {
                exportedName,
                aliasExportedName,
                symbolBase,
                contextKeys: Object.keys(window),
            },
        )
        return
    }
    executingWindow[exportedName]['__yw_set_from_version__'] = origin.version

    State.updateLatestBundleVersion([origin], executingWindow)

    for (const sideEffectFct of userSideEffects) {
        const args = {
            module: executingWindow[exportedName],
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
    const classes = [assetId, name, version].map((key) => sanitizeCssId(key))
    script.classList.add(...classes)
    script.innerHTML = content
    const onErrorParsing = (d: ErrorEvent) => {
        executingWindow.removeEventListener('error', onErrorParsing)
        return d
    }
    executingWindow.addEventListener('error', onErrorParsing)
    head.appendChild(script)
    executingWindow.removeEventListener('error', onErrorParsing)
    return script
}

export function importScriptWebWorker({ url }): undefined | Error {
    const importedScripts = self['cdnClientImportedScriptUrls'] || []

    if (importedScripts.includes[url]) {
        return
    }
    try {
        self['importScripts'](`${Client.HostName}${url}`)
        self['cdnClientImportedScriptUrls'] = [...importedScripts, url]
    } catch (error) {
        console.error(`Failed to import script ${url} in WebWorker`, error)
        return error
    }
}

export async function addScriptElements(
    sources: (FetchedScript & { sideEffect?: ScriptSideEffectCallback })[],
    executingWindow?: Window,
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
                const scriptOrError = executingWindow.document
                    ? importScriptMainWindow({
                          url,
                          assetId,
                          version,
                          name,
                          content,
                          executingWindow,
                      })
                    : importScriptWebWorker({ url })

                if (
                    scriptOrError instanceof Error ||
                    scriptOrError instanceof ErrorEvent
                ) {
                    console.error(
                        `Failed to parse source code of ${name}#${version}: ${scriptOrError.message}`,
                    )
                    onEvent && onEvent(new ParseErrorEvent(name, assetId, url))
                    throw new SourceParsingFailed({
                        assetId,
                        name,
                        url,
                        message: scriptOrError.message,
                    })
                }
                onEvent && onEvent(new SourceParsedEvent(name, assetId, url))
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
 * @param name name of the package (as defined in package.json)
 * @param version version of the package (as defined in package.json)
 * @returns base url to access the CDN resource (valid only if the asset is actually stored in the asset store)
 * @category Helpers
 */
export function getUrlBase(name: string, version: string) {
    const assetId = getAssetId(name)
    return `/api/assets-gateway/raw/package/${assetId}/${version}`
}

/**
 * Return the full exported symbol name of a library (including API version)
 *
 * @param name name of the library
 * @param version version of the library
 */
export function getFullExportedSymbol(name: string, version: string) {
    const exported = State.getExportedSymbol(name, version)
    return `${exported.symbol}_APIv${exported.apiKey}`
}

/**
 * Return the alias (using '#') of full exported symbol name of a library (including API version)
 *
 * @param name name of the library
 * @param version version of the library
 */
export function getFullExportedSymbolAlias(name: string, version: string) {
    return getFullExportedSymbol(name, version).replace('_APIv', '#')
}

/**
 * Install resources using a custom installer.
 *
 * @param installer
 */
export function resolveCustomInstaller(installer: CustomInstaller) {
    const moduleName = installer.module.includes('#')
        ? installer.module.split('#')[0]
        : installer.module
    const promise = install({
        modules: [installer.module],
        aliases: {
            installerModule: moduleName,
        },
    }) as unknown as Promise<{
        installerModule: { install: (unknown) => unknown }
    }>
    return promise.then(({ installerModule }) => {
        return installerModule.install(installer.installInputs)
    })
}

export function installAliases(
    aliases: { [key: string]: string | ((Window) => unknown) },
    executingWindow: Window,
) {
    Object.entries(aliases).forEach(([alias, original]) => {
        executingWindow[alias] =
            typeof original == 'string'
                ? executingWindow[original]
                : original(executingWindow)
    })
}
