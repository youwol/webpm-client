import shutil
from pathlib import Path

from youwol.pipelines.pipeline_typescript_weback_npm import Template, PackageType, Dependencies, \
    RunTimeDeps, generate_template, Bundles, MainModule, AuxiliaryModule
from youwol_utils import parse_json

folder_path = Path(__file__).parent

pkg_json = parse_json(folder_path / 'package.json')
externals = {
    'rxjs': '^6.5.5',
    '@youwol/flux-view': '^1.1.0'
}
template = Template(
    path=folder_path,
    type=PackageType.Library,
    name=pkg_json['name'],
    version=pkg_json['version'],
    shortDescription=pkg_json['description'],
    author=pkg_json['author'],
    dependencies=Dependencies(
        runTime=RunTimeDeps(
            externals=externals,
            includedInBundle={
                "semver": "^7.3.4"
            }
        ),
        devTime={
            "brotli": "^1.3.2",
            "rxjs": "^6.5.5",
            "@youwol/http-clients": "^2.0.0",
            "@youwol/http-primitives": "^0.1.2"
        }),
    testConfig="https://github.com/youwol/integration-tests-conf",
    userGuide=False,
    bundles=Bundles(
        mainModule=MainModule(
            entryFile="./index.ts"
        ),
        auxiliaryModules=[
            AuxiliaryModule(
                name='workersPool',
                entryFile="./lib/workers-pool/index.ts",
                loadDependencies=list(externals.keys())
            )
        ]
    )
)

generate_template(template)
shutil.copyfile(
    src=folder_path / '.template' / 'src' / 'auto-generated.ts',
    dst=folder_path / 'src' / 'auto-generated.ts'
)
for file in ['README.md', '.npmignore', 'LICENSE', 'package.json',
             'tsconfig.json', 'webpack.config.ts']:
    shutil.copyfile(
        src=folder_path / '.template' / file,
        dst=folder_path / file
    )
