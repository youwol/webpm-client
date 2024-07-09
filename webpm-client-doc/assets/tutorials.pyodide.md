# Pyodide

## Getting Started

<a href="https://pyodide.org/en/stable/index.html" target="_blank">Pyodide</a> 
allows you to run Python code directly in your web browser. It is a comprehensive
Python runtime, enabling a wide range of Python functionalities on the client side.

Two types of python modules can be installed within the Pyodide environment:
* **Pure Python Wheels from PyPi:** Any pure Python wheels available in the PyPi repository.
* **Ported Non-Pure Python Packages:** Pyodide includes a set of non-pure Python packages compiled to WebAssembly. 
You can find the list of supported packages 
<a href="https://pyodide.org/en/stable/usage/packages-in-pyodide.html" target="_blank">here</a>.

To install Pyodide modules, use the [install](@nav/api/MainModule.install) function with the `pyodide` attribute. 
Refer to the [InstallInputs](@nav/api/MainModule.InstallInputs) documentation for more details.

The following cell illustrates a Pyodide installation including the `numpy` package:

<js-cell>
const { pyodide } = await webpm.install({
    pyodide: ["numpy"],
    onEvent: (ev) => display(ev.text)
})
pyodide.registerJsModule("jsModule", { count: 1000 })
const pi = pyodide.runPython(`
import numpy as np
from jsModule import count

def calc_pi(n):
    data = np.random.uniform(-0.5, 0.5, size=(n, 2))
    norms = np.linalg.norm(data, axis=1)
    return len(np.argwhere(norms<0.5)) / n * 4

calc_pi(count)`
)

display(`pi: ${pi}` )
</js-cell>


<note level="warning" label="Important">
The above installation example implicitly uses the latest version of Pyodide. 
If the latest version includes breaking changes, it could lead to execution issues.

To avoid potential problems, specify the Pyodide version explicitly in the `webpm.install` function:

```javascript
const { pyodide } = await webpm.install({
    pyodide: { 
        version: "0.26.1",
        modules:["numpy"]
    }
})
```

</note>

## Advanced Usages

The `pyodide` attribute can be provided as an object rather than a simple list of modules.
This allows for additional configuration options during installation.
For detailed information on the available options, please refer to the
[API documentation](@nav/api/MainModule.PyodideInputs).
