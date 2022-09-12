import shutil
from pathlib import Path

from youwol.pipelines.pipeline_typescript_weback_npm import Template, PackageType, Dependencies, \
    RunTimeDeps, generate_template
from youwol_utils import parse_json

folder_path = Path(__file__).parent

pkg_json = parse_json(folder_path / 'package.json')

template = Template(
    path=folder_path,
    type=PackageType.Library,
    name=pkg_json['name'],
    version=pkg_json['version'],
    shortDescription=pkg_json['description'],
    author=pkg_json['author'],
    dependencies=Dependencies(
        runTime=RunTimeDeps(
            load={
                "semver": "^7.3.4"
            },
            differed={},
            includedInBundle=["semver"]
        ),
        devTime={
            "brotli": "^1.3.2",
            "rxjs": "^6.5.5",
            "@youwol/http-clients": "^0.1.9",
            "isomorphic-fetch": "^3.0.0",
        }),
    testConfig="https://github.com/youwol/integration-tests-conf",
    userGuide=True
    )

generate_template(template)
shutil.copyfile(
    src=folder_path / '.template' / 'src' / 'auto-generated.ts',
    dst=folder_path / 'src' / 'auto-generated.ts'
)
shutil.copyfile(
    src=folder_path / '.template' / 'README.md',
    dst=folder_path / 'README.md'
)
