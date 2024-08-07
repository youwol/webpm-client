import shutil
from pathlib import Path

from youwol.pipelines.pipeline_typescript_weback_npm import (
    Template,
    PackageType,
    Dependencies,
    RunTimeDeps,
    generate_template,
    Bundles,
    MainModule,
    AuxiliaryModule,
)
from youwol.utils import parse_json

folder_path = Path(__file__).parent

pkg_json = parse_json(folder_path / "package.json")
externals = {
    # `rxjs` is required by the 'workersPool' auxiliary module
    "rxjs": "^7.5.6",
    # `@youwol/http-primitives` is only used for typing & test, not in dev. dependencies to let consuming packages
    # have it in their `node_modules`.
    "@youwol/http-primitives": "^0.2.4",
}
template = Template(
    path=folder_path,
    type=PackageType.LIBRARY,
    name=pkg_json["name"],
    version=pkg_json["version"],
    shortDescription=pkg_json["description"],
    author=pkg_json["author"],
    dependencies=Dependencies(
        runTime=RunTimeDeps(externals=externals, includedInBundle={"semver": "^7.3.4"}),
        devTime={
            "brotli": "^1.3.2",
            "@youwol/http-clients": "^3.0.0",
            "util": "^0.12.5",
            "@jest/test-sequencer": "^29.5.0",
        },
    ),
    testConfig="https://github.com/youwol/integration-tests-conf",
    userGuide=False,
    bundles=Bundles(
        mainModule=MainModule(
            entryFile="./index.ts",
            aliases=['webpm']
        ),
        auxiliaryModules=[
            AuxiliaryModule(
                name="workersPool",
                entryFile="./lib/workers-pool/index.ts",
                loadDependencies=["rxjs"],
            ),
            AuxiliaryModule(
                name="testUtils",
                entryFile="./lib/test-utils/index.ts",
                loadDependencies=[],
            ),
        ],
    ),
)

generate_template(template)
shutil.copyfile(
    src=folder_path / ".template" / "src" / "auto-generated.ts",
    dst=folder_path / "src" / "auto-generated.ts",
)
for file in [
    # ".npmignore",  added 'webpm-client-doc'
    "LICENSE",
    "README.md",
    "package.json",
    # "tsconfig.json", added '"exclude": ["./webpm-client-doc"]'
    "webpack.config.ts",
]:
    shutil.copyfile(src=folder_path / ".template" / file, dst=folder_path / file)
