// noinspection JSValidateJSDoc

/**
 * Add-on module of the library that handles resources installation in
 * [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).
 *
 * This add-on module is loaded using {@link MainModule.installWorkersPoolModule} from the main module.
 *
 * The following example illustrates the usage of {@link WorkersPool} by computing an approximation of 𝜋 using a
 * probabilistic approach with the help of Python and its numpy package.
 *
 * <iframe id="iFrameExample" src="" width="100%" height="800px"></iframe>
 * <script>
 *   const src = `<!--<!DOCTYPE html>
 * <html lang="en">
 *   <head><script src="https://webpm.org/^2.1.2/cdn-client.js"></script></head>
 *
 *   <body id="content"></body>
 *
 *   <script type="module">
 *       function inWorker({args, workerScope}){
 *           const {PY} = workerScope
 *           PY.registerJsModule('jsModule', {count: args.count})
 *           return PY.runPython(\`
 *              import numpy as np
 *              from jsModule import count
 *              data = np.random.uniform(-0.5, 0.5, size=(count, 2))
 *              len(np.argwhere(np.linalg.norm(data, axis=1)<0.5)) / count * 4
 *           \`)
 *        }
 *        const cdnClient = window['@youwol/webpm-client']
 *
 *        // workers pool module is an opt-in feature of cdnClient
 *        const WPool = await cdnClient.installWorkersPoolModule()
 *        // run-time of main thread
 *        const {FV, RX} = await cdnClient.install({
 *            modules: ['@youwol/flux-view as FV'],
 *            css: [
 *                'bootstrap#4.4.1~bootstrap.min.css',
 *                'fontawesome#5.12.1~css/all.min.css'
 *            ],
 *            aliases: { RX: "rxjs"},
 *        })
 *        const {scan, buffer, takeWhile, last}   = RX.operators
 *        // run-time of worker's thread
 *        const pool = new WPool.WorkersPool({
 *            install:{
 *                // rxjs not used in worker: just for illustration
 *                modules:['rxjs#^7.0.0'],
 *                customInstallers:[{
 *                    module: "@youwol/cdn-pyodide-loader#^0.1.2",
 *                    installInputs: { modules: [ "numpy" ], exportedPyodideInstanceName: "PY" }
 *                }]
 *            },
 *            pool: { startAt: 1, stretchTo: 10 }
 *        })
 *        const view = pool.view()
 *        // optional: wait for pool.startAt worker(s) ready
 *        // await pool.ready()
 *        const results$ = new RX.Subject()
 *        const perSecond$ = results$.pipe(buffer(RX.interval(1000)))
 *        const acc$ = results$.pipe(scan(({s, c},e)=>({s:s + e, c: c+1}), {s:0, c:0}))
 *        const compute = () => {
 *            for( let i=0; i<1000; i++){
 *                pool.schedule({title: 'PI', entryPoint: inWorker, args: {count:100000}})
 *                .pipe(
 *                    takeWhile( ({type}) => type != 'Exit', true),
 *                    last()
 *                )
 *                .subscribe(message => results$.next(message.data.result))
 *            }
 *        }
 *        const vDOM = {
 *            class:'fv-text-primary',
 *            children:[
 *                { class:'btn btn-primary', innerText: 'start 1000 runs', onclick: compute },
 *                { innerText: FV.attr$(pool.workers$, (workers) => 'Workers count: '+Object.keys(workers).length)},
 *                { innerText: FV.attr$(acc$, ({s, c}) => 'Average: '+ s / c )},
 *                { innerText: FV.attr$(acc$, ({c}) => 'Simulation count: '+ c)},
 *                { innerText: FV.attr$(perSecond$, (results) => 'Results /s: '+ results.length)},
 *                view
 *            ]
 *        }
 *        document.getElementById('content').appendChild(FV.render(vDOM));
 *   </script>
 * </html>
 * -->`
 *     const url = '/applications/@youwol/js-playground/latest?content='+encodeURIComponent(src.substring(4,src.length-4))
 *     document.getElementById('iFrameExample').setAttribute("src",url);
 * </script>
 * @module WorkersPoolModule
 */
export * from './workers-factory'
export * from './views'
export * from './web-worker.proxy'
