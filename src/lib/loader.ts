import { stringify } from "node:querystring"

let importedBundles = {}

export interface Library{

    /**
     * id of the library in the asset store
     */
    id:string

    /**
     * name of the library, e.g. @youwol/cdn-client
     */
    name: string

    /**
     * Version of the library, e.g. 0.0.0
     */
    version: string

    /**
     * Namespace of the library, e.g. @youwol
     */
    namespace:string

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
export interface LoadingGraph{

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
    body: { libraries:{[key:string]: string} } 
    ): Promise<LoadingGraph> {

    let url = `/api/cdn-backend/queries/loading-graph`
    let request = new Request(url, { method:'POST', body: JSON.stringify(body)})

    return await fetch(request).then( content => content.json())
}


/**
 * Fetch the dependencies as described by a [[LoadingGraph]]
 * 
 * @param loadingGraph loading graph descriptor
 * @param executingWindow the window used to install the dependencies, default to the global window
 * @param sideEffects if sideEffects[*libName*] exist => execute the associated function after
 * the library has been installed in executingWindow
 */
export async function fetchLoadingGraph(
    loadingGraph : LoadingGraph, 
    executingWindow?: Window, 
    sideEffects?: {[key:string]:(Window)=>void}
    ){
    
    executingWindow = executingWindow || window
    let libraries = loadingGraph.lock.reduce( (acc,e) => ({...acc, ...{[e.id]:e}}) ,  {})

    for( let batch of loadingGraph.definition ){
        let futures = (batch as any)
        .filter( ([assetId, cdn_url]) => {
            let libName = libraries[assetId].name
            let version = libraries[assetId].version
            // This one essentially prevent clearing the cache
            // ...we need extra care on backward compatibility 
            if(libName=='@youwol/cdn')
                return false

            if(!importedBundles[libName])
                return true

            if(importedBundles[libName] != version){
                console.warn(`Loading ${libName}#${version}: A different version of the package has been already fetched (${importedBundles[libName]}), the initial version is updated`)
                return true 
            }    
            sideEffects && sideEffects[libName] && sideEffects[libName](executingWindow)
            return false
        })
        .map( ([assetId, cdn_url]) => {
            let src =  `/api/assets-gateway/raw/package/${assetId}${cdn_url.replace('/api/cdn-backend','')}`
            let libName = libraries[assetId].name
            let sideEffect = sideEffects && sideEffects[libName] ? sideEffects[libName] : () => {}
            importedBundles[libName] = libraries[assetId].version
            
            return loadResource(libName, sideEffect, src, executingWindow)
        })
        await Promise.all(futures)
    }
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
    renderingWindow?: Window ) : Promise<Array<HTMLLinkElement>> { 

    let _resources = typeof resources == 'string' ? [resources] : resources
    renderingWindow = renderingWindow || window
    let hrefs = Array.from(renderingWindow.document.links).map(link => link.href)

    let futures = _resources
    .map( resourceId => parseResourceId(resourceId))
    .filter( ({url}) => !hrefs.includes(url) )
    .map( ({url}) => {  
        return new Promise<HTMLLinkElement>( (resolveCb) => {
            var link  = renderingWindow.document.createElement("link") as HTMLLinkElement
            link.setAttribute("type", "text/css")
            link.href = url
            link.rel  = "stylesheet"
            renderingWindow.document.getElementsByTagName("head")[0].appendChild(link)
            link.onload = () => {
                resolveCb(link);
                //Can add setTimeout to attempt to wait for the styles to be applied to DOM
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
 * @returns Promise resolving to the argument *dependencies* provided as a mapping *libraryName*=>*{version, sideEffects}*
 */
export async function fetchBundles(
    dependencies: { [key:string]: string | {version:string, sideEffects: ((Window)=>void)}}, 
    executingWindow?: Window
    ): Promise<{[key:string]: {version:string, sideEffects: ((Window)=>void)}}>{

    executingWindow = executingWindow || window
    let toLoad = {}
    dependencies = Object
    .entries(dependencies)
    .map( ([k,v]) => typeof(v) == "string" ? [k, { version: v, sideEffects: (w)=>{} }] : [k,v])
    .reduce( (acc, [k,v]:[k:string, v: any]) => ({...acc, ...{[k]:v}}), {})

    let body = { 
        libraries: Object.entries(dependencies as any)
        .reduce( (acc,[k,v]:[string, any]) => ({...acc, ...{[k]: v.version}}), {})
    }
    let sideEffects = Object
    .entries(dependencies)
    .reduce( (acc,[k,v]:[string, any]) => ({...acc,...{[k]: v.sideEffects}}), {} )

    let request = new Request(
        "/api/cdn-backend/queries/loading-graph",
        {
            method:'POST',
            body: JSON.stringify(body)
        })
        
    let loadingGraph = await fetch(request).then(resp=>resp.json())
    await fetchLoadingGraph( loadingGraph, executingWindow, sideEffects)
    return toLoad
} 

/**
 * Fetch some javascript 'add-ons' of some libraries.
 * 
 * @param resources a resource description or a list of resource description.
 * A resource description is a string of pattern *{libraryName}#{version}~{rest-of-path}* where:
 * -    libraryName is the name of the library
 * -    version is the target version
 * -    rest-of-path is the partial url from the package's directory to the target CSS 
 * 
 * @param executingWindow 
 */
export async function fetchJavascriptAddOn(
    resources: string | Array<string>, 
    executingWindow?: Window): Promise<string[]>{

    let _resources = typeof resources == 'string' ? [resources] : resources

    executingWindow = executingWindow || window
    let futures = _resources
    .map( resourceId =>  parseResourceId(resourceId))
    .map( ({name,url}) => loadResource(name, ()=>{}, url, executingWindow))

    return await Promise.all(futures)
} 



function encode_url_safe_b64(buffer){

    return btoa(buffer)
    //.replace(/\+/g, '-') // Convert '+' to '-'
    //.replace(/\//g, '_') // Convert '/' to '_'
    //.replace(/=+$/, ''); // Remove ending '='
}

function parseResourceId( resourceId: string ){

    let name = resourceId.split("#")[0]
    let version = resourceId.split("#")[1].split('~')[0]
    let path = resourceId.split("#")[1].split('~')[1]
    let assetId =  encode_url_safe_b64(name)
    let url = `/api/assets-gateway/raw/package/${assetId}/libraries/${name.replace('@','')}/${version}/${path}`
    return { name,version, path, assetId, url}
}


function getLoadedModule(fullname: string, executingWindow?: Window){

    executingWindow = executingWindow || window

    if(executingWindow[fullname] && Object.entries(executingWindow[fullname]).length>0)
        return executingWindow[fullname]

    if(fullname.includes('/')){
        let namespace = fullname.split('/')[0].slice(1)
        let name = fullname.split('/')[1]
        return executingWindow[namespace][name]
    }
    return undefined
}   

function loadResource( 
    libraryName: string,
    sideEffect: (Window)=> void, 
    src: string, 
    executingWindow?: Window
    ): Promise<string>{

    executingWindow = executingWindow || window

    let promise = new Promise(
        (resolve, reject) => {
            
            let document = executingWindow.document
            var script   = document.createElement('script') as any;

            var head     = document.getElementsByTagName('head')[0];
            script.async = 'true';

            script.onload = script.onreadystatechange = function (_, isAbort) {
                
                if (isAbort || !script.readyState || /loaded|complete/.test(script.readyState)) {
                    script.onload = script.onreadystatechange = null;
                }
                if (!isAbort ) {
                    let target = getLoadedModule(libraryName, executingWindow)
                    if(target && !executingWindow[libraryName])
                        executingWindow[libraryName] = target
                    sideEffect && sideEffect(executingWindow)     
                    resolve(src)
                };
            };
            script.src = src;
            head.appendChild(script);
        }
    )
    return promise as Promise<string>
}
