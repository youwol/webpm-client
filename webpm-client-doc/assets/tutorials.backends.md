# Backend

<note level="warning">
The features described here are available only when applications are run through the py-youwol server.
For more details, visit the [py-youwol page](@nav/how-to/py-youwol).
</note>

## Getting Started

Backends are microservices running locally on your PC and accessible via HTTP. 
They offer flexibility by supporting various languages and technology stacks.
However, they can only communicate using serializable data due to the constraints of HTTP.

To install a backend service, use the `webpm.install` function with the `backends` attribute:

<js-cell>
const { ywDemoClient } = await webpm.install({
    backends:['demo_yw_backend#^0.1.1 as ywDemoClient'],
    onEvent: (ev) => display(ev.text)
})
</js-cell>

<note level="warning" label="Important">
When a backend is requested for the first time, it needs to be installed on your machine, which may take some time.
Subsequent calls will be faster (couple of seconds) as the backend only needs to be started.
</note>

Once installed, backends can be accessed via a JavaScript client using the provided alias name 
(`ywDemoClient` in this case). This client uses fetch-like methods to make HTTP requests to the backend.
For detailed information, see the [BackendClient documentation](@nav/api/MainModule.BackendClient).

Here's an example of how to call the `/cow-say` endpoint of `demo_yw_backend`:

<js-cell>

display(new Views.Text(`**Backend's base path:** \`${ywDemoClient.urlBase}\``))

let body = { 
    message: 'hello backends',
    character: 'trex'
}

resp = await ywDemoClient.fetchJson(
    '/cow-say', 
    {   method: 'post',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' }
    })

display({
    tag: 'pre', 
    style:{
        fontSize: '0.7rem',
        lineHeight: '0.7rem'
    },
    innerText: resp
})
</js-cell>

<note level="hint">
Most backends provide documentation at the `/docs` endpoint. For example, see 
<a target="_blank" href="/backends/demo_yw_backend/0.1.1/docs">/backends/demo_yw_backend/0.1.1/docs</a>.
</note>

<note level="hint">
The currently running backends can be explored in the **backends** section of the Co-Lab application, 
available <a target="_blank" 
href="/applications/@youwol/co-lab/latest?nav=/environment/backends">here</a>.
</note>

## Advanced Usages

The `backends` attribute can be an object instead of a simple list, allowing for more advanced configuration 
options during installation, particularly regarding **configurations** and **partitions**.

### Configuration

When installing backends, you can provide specific parameters to configure them.

Configurations are unique to each backend. For example, the `pyrun_backend` (a backend for running Python code) 
can be configured to use a specific Python version and include certain Python modules:

<js-cell>
const { pyRunner } = await webpm.install({
    backends:{
        modules:['pyrun_backend#^0.1.0 as pyRunner'],
        configurations: {
            'pyrun_backend': {
                build: { 
                    python:'python3.10',
                    modules:'numpy',
                }
            }
        }
    },
    onEvent: (ev) => display(ev.text)
})
</js-cell>

This example configures pyrun_backend to use python3.10 and include numpy in the environment.

<note level="hint">
You can run multiple versions of the same backend with different configurations using partitions as 
explained in the next section.
</note>

Here's how to use the installed backend:

<js-cell>
body = {
    cellId: 'tutorials.backend',
    capturedIn: {},
    capturedOut: ['resp'],
    code: `
import numpy
import sys

resp = {
    "python": sys.version,
    "numpy": numpy.__version__
}
`
}

resp = await pyRunner.fetchJson(
    '/run',
    {   method: 'post',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' }
    }
)
display("Python version:", Views.mx1, resp.capturedOut['resp'].python)
display("Numpy version:", Views.mx1, resp.capturedOut['resp'].numpy)
</js-cell>

<note level="hint">
As previously mentioned, the `pyrun_backend` service acts as an interpreter for running custom code directly 
within notebook cells. In the example below, the `pyRunner` interpreter is used to capture the 
`pyVersion` and `npVersion` variables:


<interpreter-cell interpreter="pyRunner" language="python" captured-out="pyVersion npVersion">
import numpy
import sys

pyVersion = sys.version
npVersion = numpy.__version__
</interpreter-cell>

The captured variables can be latter used in JavaScript cells:
<js-cell>
display(pyVersion)
display(npVersion)
</js-cell>


For further details, please visit our
<a target="_blank" href="/applications/@youwol/mkdocs-ts-doc/latest?nav=/tutorials/notebook/interpreter">
notebook interpreter tutorial</a>.
</note>


### Partition

Backends can run in different partitions to isolate execution environments.
This is useful if applications require stateful backends or backends running with different configurations.

<note level="info">
The backend clients use the `X-Backends-Partition` header to route requests to a specific partition. 
Once an HTTP call reaches a backend within a particular partition, all later HTTP calls from that backend 
will be directed exclusively to other backends within the same partition.
</note>

By default, partitions are managed automatically, and each browser tab is assigned a unique partition ID.

To specify a custom partition ID, use the `partition` attribute during installation:



<js-cell>
const { ywDemoClientInFoo } = await webpm.install({
    backends:{ 
        modules: ['demo_yw_backend#^0.1.1 as ywDemoClient'],
        partition: 'Foo'
    },
    onEvent: (ev) => display(ev.text)
})
</js-cell>
