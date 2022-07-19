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
} from './models'
import {
    CssInput,
    ModuleSideEffectCallback,
    ModulesInput,
    ScriptsInput,
} from './loader'
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

export function sanitizeBase(input: ScriptsInput | CssInput):
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

export function sanitizeScripts(input: ScriptsInput): {
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

export function sanitizeCss(input: CssInput): {
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
    executingWindow: Window,
    onEvent: (event: CdnEvent) => void,
) {
    const head = document.getElementsByTagName('head')[0]

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
