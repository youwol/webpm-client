from pathlib import Path

from youwol.pipelines.pipeline_typescript_weback_npm import Template, PackageType, Dependencies, \
    RunTimeDeps, generate_template

template = Template(
    path=Path(__file__).parent,
    type=PackageType.Library,
    name="@youwol/cdn-client",
    version="0.1.5-wip",
    shortDescription="Library for dynamic npm's libraries installation from YouWol's CDN.",
    author="greinisch@youwol.com",
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
