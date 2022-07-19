import {
    CdnEvent,
    InstallDoneEvent,
    ParseErrorEvent,
    SourceLoadedEvent,
    SourceParsedEvent,
    SourceParsingFailed,
    Unauthorized,
    UnauthorizedEvent,
    UrlNotFound,
    UrlNotFoundEvent,
    InstallStyleSheetInput,
    ModuleSideEffectCallback,
    ModulesInput,
    InstallScriptsInput,
} from './models'
import { State } from './state'
import { LoadingScreenView } from './loader.view'
import { sanitizeCssId } from './utils.view'
import { Client, Origin } from './client'

import { major as getMajor } from 'semver'

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
            content, //content as any,
            progressEvent: event,
        })
    }
    if (req.status == 401) {
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

export function sanitizeBase(
    input: InstallScriptsInput | InstallStyleSheetInput,
):
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

export function sanitizeScripts(input: InstallScriptsInput): {
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

export function sanitizeCss(input: InstallStyleSheetInput): {
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

export async function applyModuleSideEffects(
    origin: Origin,
    htmlScriptElement: HTMLScriptElement,
    executingWindow: Window,
    userSideEffects: ModuleSideEffectCallback[],
) {
    const versionsAvailable = State.importedBundles.get(origin.name) || []
    State.importedBundles.set(origin.name, [
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

export function applyFinalSideEffects({
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

export function addScriptElements(
    sources: (Origin & { sideEffect?: (HTMLScriptElement) => void })[],
    executingWindow?: Window,
    onEvent?: (event: CdnEvent) => void,
) {
    const head = document.getElementsByTagName('head')[0]
    executingWindow = executingWindow || window
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
