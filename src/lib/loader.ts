let importedBundles = {}

export class LoadingGraphError extends Error {

    constructor(public readonly errorResponse) {
        super("Failed to retrieve the loading graph"); // (1)
        this.name = "LoadingGraphError"; // (2)
    }
}

/**
 * Base class for CDN's HTTP request event
 */
export class CdnEvent {
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string) { }
}

/**
 * Request just sent
 */
export class StartEvent extends CdnEvent {
    constructor(
        targetName: string,
        assetId: string,
        url: string) {
        super(targetName, assetId, url)
    }
}
/**
 * Request loading content
 */
export class SourceLoadingEvent extends CdnEvent {
    constructor(
        targetName: string,
        assetId: string,
        url: string,
        public readonly progress: ProgressEvent<XMLHttpRequestEventTarget>
    ) {
        super(targetName, assetId, url)
    }
}
/**
 * Request's content loaded
 */
export class SourceLoadedEvent extends CdnEvent {
    constructor(
        targetName: string,
        assetId: string,
        url: string,
        public readonly progress: ProgressEvent<XMLHttpRequestEventTarget>) {
        super(targetName, assetId, url)
    }
}
/**
 * Request's content parsed
 */
export class SourceParsedEvent extends CdnEvent {
    constructor(
        targetName: string,
        assetId: string,
        url: string) {
        super(targetName, assetId, url)
    }
}
/**
 * Unauthorized to fetch resource
 */
export class UnauthorizedEvent extends CdnEvent {
    constructor(
        targetName: string,
        assetId: string,
        url: string) {
        super(targetName, assetId, url)
    }
}

export interface Library {

    /**
     * id of the library in the asset store
     */
    id: string

    /**
     * name of the library, e.g. @youwol/cdn-client
     */
    name: string

    /**
     * Version of the library, e.g. 0.0.0
     */
    version: string

    /**
     * Type of the library, e.g. '*library*, *flux-pack*
     */
    type: string
}
/**
 * Define a structure that allows to resolve dependencies fetching in the correct order.
 * This structure is defined by the CDN service, it is associated to *graphType=='sequential-v1'*.
 * 
 * See also:
 * -    [[getLoadingGraph]]: return the loading graph from a list of package's name and version.
 * -    [[fetchBundles]]: directly fetch dependenceis from a list of package's name and version
 */
export interface LoadingGraph {

    /**
     * 
     * List of javascript libraries to fetch by batch:
     * -    *definition[i]* defines a batch of libraries that can be fetched in any order (or at the same time), provided 
     * that all the libraries for the batches j<i have already be fetched 
     * -    *definition[i][j]* defines the j'th library for the batch i: 
     * a tuple of [*id*, *cdn-url*] where *id* is the asset id and *cdn-url* the CDN's URL
     */
    definition: Array<Array<[string, string]>>

    /**
     * 
     * Describes the libraries included in the loading graph
     */
    lock: Array<Library>

    /**
     * Type of the graph (versioning to be able to change the fetching mecanism)
     */
    graphType: string
}


/**
 * Return the loading graph from a mapping *library-name*=>*version*.
 * If dependencies are missings from the provided mapping,
 * latest available version are used
 * 
 * @param body libraries is a mapping *library-name*=>*version* 
 * @returns Promise on a [[LoadingGraph]]
 */
export async function getLoadingGraph(
    body: { libraries: { [key: string]: string } }
): Promise<LoadingGraph> {

    let url = `/api/assets-gateway/cdn/queries/loading-graph`
    let request = new Request(url, { method: 'POST', body: JSON.stringify(body) })

    return await fetch(request).then(content => content.json())
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
export async function fetchLoadingGraph(
    loadingGraph: LoadingGraph,
    executingWindow?: Window,
    sideEffects?: { [key: string]: (Window) => void },
    onEvent?: (event: CdnEvent) => void
) {

    executingWindow = executingWindow || window
    let libraries = loadingGraph.lock.reduce((acc, e) => ({ ...acc, ...{ [e.id]: e } }), {})

    let isToDownload = (assetId: string) => {
        let libName = libraries[assetId].name
        let version = libraries[assetId].version
        // This one essentially prevent clearing the cache
        // ...we need extra care on backward compatibility  
        if (libName == '@youwol/cdn-client')
            return false

        if (!importedBundles[libName])
            return true

        if (importedBundles[libName] != version) {
            console.warn(`Loading ${libName}#${version}: A different version of the package has been already fetched (${importedBundles[libName]}), the initial version is not updated`)
            return false
        }
        sideEffects && sideEffects[libName] && sideEffects[libName](executingWindow)
        return false
    }
    let selecteds = loadingGraph.definition
        .flat()
        .filter(([assetId, cdn_url]) => isToDownload(assetId))
        .map(([assetId, cdn_url]) => {
            return {
                assetId,
                url: `/api/assets-gateway/raw/package/${cdn_url}`,
                name: libraries[assetId].name
            }
        })
    let sources = selecteds.map(({ assetId, name, url }) => {
        return fetchSource(name, assetId, url, onEvent)
    })

    let contents = await Promise.all(sources)
    var head = document.getElementsByTagName('head')[0];
    contents.forEach(({ name, assetId, url, content }) => {
        var script = document.createElement("script") as any;
        //script.async = 'true';
        script.innerHTML = content

        head.appendChild(script);
        let sideEffect = sideEffects && sideEffects[name]
        let target = getLoadedModule(name, executingWindow)
        if (target && !executingWindow[name])
            executingWindow[name] = target
        sideEffect && sideEffect(executingWindow)
        onEvent && onEvent(new SourceParsedEvent(name, assetId, url))
        importedBundles[name] = libraries[assetId].version
    })
}


/**
 * 
 * Install a set of resources. 
 * 
 * Modules stand for javascript's module. 
 * If some required dependencies of the module are missing they are also loaded. 
 * 
 * Scripts stand for standalone javascript file; they are fetched after all modules 
 * have been loaded.
 * 
 * CSS stand for stylesheets.
 * 
 * Aliases allow to use a different name to refer to the loaded resources.
 * @param resources The resources:
 * -    modules: either a `{name, version}` object or a string. 
 * If a string is provided, version is 'latest'.
 * -    scripts: array of path for javascript scripts in the format 
 * {libraryName}#{version}~{rest-of-path}
 * -    css: array of path for css stylesheets in the format 
 * {libraryName}#{version}~{rest-of-path}
 * -    aliases: a set of aliases that are applied after all the resources 
 * have been loaded. A dictionary {key: value} where key is the alias in 
 * executingWindow and value is either:
 *       - a string => `executingWindow[alias] = executingWindow[value]`
 *       - a function => `executingWindow[alias] = value(executingWindow)`
 * 
 * @param executingWindow the window in witch to load scripts & stylesheets
 * @returns a promise over the executingWindow
 */
export function install(
    resources: {
        modules?: ({
            name: string,
            version: string
        } | string)[],
        scripts?: string[],
        css?: string[],
        aliases?: { [key: string]: (string | ((Window) => unknown)) }
    },
    executingWindow: Window = window
):
    Promise<Window> {

    let modules = resources.modules || []
    let scripts = resources.scripts || []
    let css = resources.css || []
    let aliases = resources.aliases || {}

    let cssPromise = fetchStyleSheets(css, executingWindow)

    let bundles = modules.reduce((acc, e) => {
        let elem = (typeof (e) == 'string')
            ? {
                name: e,
                version: 'latest'
            }
            : e

        return {
            ...acc,
            [elem.name]: elem
        }
    }, {})

    let jsPromise = fetchBundles(bundles, executingWindow)
        .then((bundles) =>
            fetchJavascriptAddOn(scripts, executingWindow)
                .then(jsAddOns => ({ bundles, jsAddOns })))

    return Promise
        .all([jsPromise, cssPromise])
        .then(() => {
            Object.entries(aliases).forEach(([alias, original]) => {
                executingWindow[alias] = typeof (original) == 'string'
                    ? executingWindow[original]
                    : original(executingWindow)
            })
            return executingWindow
        })
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
export async function fetchStyleSheets(
    resources: string | Array<string>,
    renderingWindow?: Window): Promise<Array<HTMLLinkElement>> {

    let _resources = typeof resources == 'string' ? [resources] : resources
    renderingWindow = renderingWindow || window
    let hrefs = Array.from(renderingWindow.document.links).map(link => link.href)

    let futures = _resources
        .map(resourceId => parseResourceId(resourceId))
        .filter(({ url }) => !hrefs.includes(url))
        .map(({ url }) => {
            return new Promise<HTMLLinkElement>((resolveCb) => {
                var link = renderingWindow.document.createElement("link") as HTMLLinkElement
                link.setAttribute("type", "text/css")
                link.href = url
                link.rel = "stylesheet"
                renderingWindow.document.getElementsByTagName("head")[0].appendChild(link)
                link.onload = () => {
                    resolveCb(link);
                };
            })
        })
    return await Promise.all(futures)
}

/**
 * 
 * @param dependencies mapping *libraryName*=>*version* or *libraryName*=>*{version, sideEffects}*
 * If sideEffects is provided, it will be called using the executingWindow as argument when the library 
 * has been installed.
 * @param executingWindow the window used to install the dependencies, default to the global window
 * @param onEvent if provided, callback called at each HTTP request event
 * @returns Promise resolving to the argument *dependencies* provided as a mapping *libraryName*=>*{version, sideEffects}*
 */
export async function fetchBundles(
    dependencies: { [key: string]: string | { version: string, sideEffects: ((Window) => void) } },
    executingWindow?: Window,
    onEvent?: (event: CdnEvent) => void
): Promise<{ [key: string]: { version: string, sideEffects: ((Window) => void) } }> {

    executingWindow = executingWindow || window
    dependencies = Object
        .entries(dependencies)
        .map(([k, v]) => typeof (v) == "string" ? [k, { version: v, sideEffects: (w) => { } }] : [k, v])
        .reduce((acc, [k, v]: [k: string, v: any]) => ({ ...acc, ...{ [k]: v } }), {})

    let body = {
        libraries: Object.entries(dependencies as any)
            .reduce((acc, [k, v]: [string, any]) => ({ ...acc, ...{ [k]: v.version } }), {})
    }
    let sideEffects = Object
        .entries(dependencies)
        .reduce((acc, [k, v]: [string, any]) => ({ ...acc, ...{ [k]: v.sideEffects } }), {})

    let request = new Request(
        "/api/assets-gateway/cdn/queries/loading-graph",
        {
            method: 'POST',
            body: JSON.stringify(body)
        })

    let loadingGraph = await fetch(request)
        .then(resp => {
            if (resp.status == 200)
                return resp.json()
            else {
                throw new LoadingGraphError(resp.json())
            }
        })
    await fetchLoadingGraph(loadingGraph, executingWindow, sideEffects, onEvent)
    return loadingGraph
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
export async function fetchJavascriptAddOn(
    resources: string | Array<string>,
    executingWindow?: Window,
    onEvent?: (CdnEvent) => void): Promise<{ assetName, assetId, url, src }[]> {

    let _resources = typeof resources == 'string' ? [resources] : resources

    executingWindow = executingWindow || window
    let ids = _resources
        .map(resourceId => parseResourceId(resourceId))

    let futures = ids.map(({ name, assetId, url }) => fetchSource(name, assetId, url, onEvent))

    let sources = await Promise.all(futures)

    var head = document.getElementsByTagName('head')[0];
    sources.forEach(({ name, assetId, url, content }) => {
        var script = document.createElement("script") as any;
        script.innerHTML = content
        head.appendChild(script);
        onEvent && onEvent(new SourceParsedEvent(name, assetId, url))
    })

    return sources.map(({ assetId, url, name, content }) => { return { assetId, url, assetName: name, src: content } })
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
    //.replace(/\+/g, '-') // Convert '+' to '-'
    //.replace(/\//g, '_') // Convert '/' to '_'
    //.replace(/=+$/, ''); // Remove ending '='
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

    let assetId = getAssetId(name)
    return `/api/assets-gateway/raw/package/${assetId}/${version}`
}

/**
 * Parse a resource id in the form *{libraryName}#{version}~{rest-of-path}* where:
 * -    libraryName is the name of the library
 * -    version is the target version
 * -    rest-of-path is the partial url from the package's directory to the target CSS 
 * 
 * @param resourceId resource id in the form *{libraryName}#{version}~{rest-of-path}*
 */
export function parseResourceId(resourceId: string
): { name: string, version: string, path: string, assetId: string, url: string } {

    let name = resourceId.split("#")[0]
    let version = resourceId.split("#")[1].split('~')[0]
    let path = resourceId.split("#")[1].split('~')[1]
    let assetId = getAssetId(name)
    let url = `${getUrlBase(name, version)}/${path}`
    return { name, version, path, assetId, url }
}


function getLoadedModule(fullname: string, executingWindow?: Window) {

    executingWindow = executingWindow || window

    if (executingWindow[fullname] && Object.entries(executingWindow[fullname]).length > 0)
        return executingWindow[fullname]

    if (fullname.includes('/')) {
        let namespace = fullname.split('/')[0].slice(1)
        let name = fullname.split('/')[1]
        return executingWindow[namespace][name]
    }
    return undefined
}


export function fetchSource(
    name: string,
    assetId: string,
    url: string,
    onEvent?: (event: CdnEvent) => void
): Promise<{ name, assetId, url, content }> {

    let promise = new Promise(
        (resolve, reject) => {
            var req = new XMLHttpRequest();

            // report progress events
            req.addEventListener("progress", function (event) {
                onEvent && onEvent(new SourceLoadingEvent(name, assetId, url, event))

            }, false);

            req.addEventListener("load", function (event: any) {
                if (event.target.status == 200) {
                    let content = event.target['responseText'] + `\n//# sourceURL=${url.split('/').slice(0, -1).join('/')}/`;
                    onEvent && onEvent(new SourceLoadedEvent(name, assetId, url, event))
                    resolve({ name, assetId, url, content })
                }
                if (event.target.status == 401) {
                    onEvent && onEvent(new UnauthorizedEvent(name, assetId, url))
                    resolve({})
                }
            },
                false);

            req.open("GET", url);
            req.send();
            onEvent && onEvent(new StartEvent(name, assetId, url))
        }
    )
    return promise as Promise<{ name, assetId, url, content }>
}
