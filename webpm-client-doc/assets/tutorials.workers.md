# Workers Pool


Workers pools are pool of Web Workers featuring as specific environment.

## Setup

The module is an add-on, it requires to be explictly installed using `webpm.installWorkersPoolModule`.
The workers pool can be defined by specifying the install environment as well as sizing policy.

The install environment is the datastructure explained so far, featuring a combination of ESM, pyodide & backends 
modules.

The following example create a worker pool with pyodide runtime installed with the module 'numpy':

<js-cell>

const WPool = await webpm.installWorkersPoolModule()

const {rxVDOM, rxjs} = await webpm.install({
    esm: ['rxjs#^7.5.6 as rxjs'],
    css: [
        'bootstrap#^4.4.0~bootstrap.min.css',                
        'fontawesome#5.12.1~css/all.min.css', 
        '@youwol/fv-widgets#latest~dist/assets/styles/style.youwol.css'
    ]
})

const pool = new WPool.WorkersPool({
    install:{
        pyodide: {
            version: "0.26.1",
            modules: ["numpy"]
        }
    },
    pool: { startAt: 1, stretchTo: 10 }
})
</js-cell>

Let's wait for the pool to be ready:

<js-cell>
const poolView = pool.view()
display(poolView)
await pool.ready()
</js-cell>

## Task scheduling

To schedule a task within the pool, a function is first defined:

<js-cell>
const task = ({args, workerScope}) => {

    const { pyodide } = workerScope
    pyodide.registerJsModule('jsModule', {count: args.count})
    return pyodide.runPython(`
        import numpy as np
        from jsModule import count
        data = np.random.uniform(-0.5, 0.5, size=(count, 2))
        len(np.argwhere(np.linalg.norm(data, axis=1)<0.5)) / count * 4`)
}
</js-cell>

In the above cell:
*  **workerScope** allow retrieving symbols of installed resources, here `pyodide`
*  the return of the function will be associated to the last message of the channel insatnciated when scheduling the
   task.

A task is scheduled by providing a title, the entry point function, and eventually some parameters: 

<js-cell>
const message$ = pool.schedule({
    title: 'PI approx.', 
    entryPoint: task, 
    args: {count:1e5}
})
const messagesView = {
    tag:'div',
    children: {
        policy: 'append',
        source$: message$.pipe( rxjs.map((m)=>[m]) ),
        vdomMap: (m) => ({tag: 'div', innerText: JSON.stringify(m)})
    }
}

display("Messages:")
display(messagesView)
const lastMessage = await rxjs.lastValueFrom(message$)
display("Result:")
display(`pi=${lastMessage.data.result}`)

</js-cell>

When scheduling a task using `pool.schedule`, an Observable (from RxJS) is returned that transmits messages from 
the worker pool to the main thread. 


<note level="warning" label="Important">
Explains what kind of data can be transmitted between the main thread and a web worker.
</note>

## A thousand tasks

Let's first define a function scheduling 1000 tasks.
A `result$` Subject is used to ...:

<js-cell>
const results$ = new rxjs.Subject()

const scheduleThousandTasks = () => {
    for( let i=0; i<1000; i++){
        pool.schedule({title: 'PI approx.', entryPoint: task, args: {count:100000}})
            .pipe(rxjs.last())
            .subscribe(message => results$.next(message.data.result))
    }
}
</js-cell>

<js-cell>
const { scan, buffer, takeWhile, last, filter, map }   = rxjs
const resultsRate$ = results$.pipe(buffer(rxjs.interval(1000)))
const sumAndCount$ = results$.pipe(scan(({s, c},e)=>({s:s + e, c: c+1}), {s:0, c:0}))    
const workerCount$ = pool.workers$.pipe(map( workers => Object.keys(workers).length))

const button = {
    tag: 'div', class:'btn btn-primary fv-pointer', innerText: 'start 1000 runs', 
    onclick: scheduleThousandTasks
}
display({
    tag: 'div', 
    class:'p-5',
    children:[
        {
            source$: workerCount$.pipe( filter((count) => count > 0)),
            vdomMap: () => button,
            untilFirst: ({ innerHTML: '<i>Waiting for first worker readyness...</i>' })
        },
        { tag:'div', innerText: workerCount$.pipe( map( count => 'Workers count: '+ count))},
        { tag:'div', innerText: sumAndCount$.pipe( map(({s, c}) => 'Average: '+ s / c ))},
        { tag:'div', innerText: sumAndCount$.pipe( map(({c}) => 'Simulation count: '+ c ))},
        { tag:'div', innerText: resultsRate$.pipe( map(results=> 'Results /s: '+ results.length))},
        poolView
    ]
})
</js-cell>