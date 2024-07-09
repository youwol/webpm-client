# Events & Loading Screen

## Events

The webpm client offers detailed feedback on the installation of various resources, including `esm`, `pyodide`, and 
`backends` modules.

Events are communicated through the `onEvent` callback specified during the resource installation process. 
For example:


<js-cell>
const eventView = (ev) => ({
    tag: 'div',
    class: 'border rounded p-2 my-1',
    children: [{
        tag: 'div',
        innerText: `ID: ${ev.id}`
    },{
        tag: 'div',
        innerText: `step: ${ev.step}`
    },{
        tag: 'div',
        innerText: `text: ${ev.text}`
    }]

})

const {VSF, Canvas, rxDom} = await webpm.install({
    esm:[
        '@youwol/vsf-core#^0.3.1 as VSF', 
    ],
    onEvent: (ev) => display(eventView(ev))
})
</js-cell>

For a comprehensive list of events and their attributes, please refer to the 
[events documentation](@nav/api/MainModule.events.models.ts).

Events often include an ID, which helps track the progress of specific tasks.

## Loading Screen

You can display progress feedback for installations using a loading screen.

The default loading screen can be enabled by setting the `displayLoadingScreen` option to `true` in the
`webpm.install` function. 
It displays a full-screen loading indicator (the same as the one shown when this application loads), 
displayed on top of everything. 
Note that only the first click will actually show the loading screen, as subsequent clicks will use already 
installed resources.

<js-cell>
display({
    tag:'button',
    class:'btn btn-primary my-1',
    innerText:'Click me to start install',
    onclick: () => webpm.install({
        esm: ["chart.js"],
        displayLoadingScreen: true
    })
})
</js-cell>

For more customization, you can create a (somewhat) custom loading screen using the class
[LoadingScreenView](@nav/api/MainModule.LoadingScreenView). This requires:
*  To have a reference on a HTMLElement in which the loading screen will be displayed
*  To forward events when calling `webpm.install`

<js-cell>
const container = document.createElement('div')
display(container)
const loadingScreen = new webpm.LoadingScreenView({
    container,
    logo: `<div style='font-size:xxx-large'>🎉</div>`,
    wrapperStyle: {
         width: '100%', height: '500px', 'font-weight': 'bolder',
    },
})
// Start rendering the loading screen, has to happen before webpm.install
loadingScreen.render()

await webpm.install({
    esm:[
       '@youwol/vsf-canvas', 
    ], 
    onEvent: (ev) => {
        // event forwarding
        loadingScreen.next(ev)
    },
})

display({
    tag:'button',
    class:'btn btn-primary my-1', 
    innerText:'Click me when done',
    onclick: () => loadingScreen.done()
})
</js-cell>

<note level="info">
The `@youwol/vsf-canvas` module depends on several packages. 
However, because compatible versions are already available, they are neither reinstalled nor shown.
</note>
