from youwol.app.environment import YouwolEnvironment
from youwol.app.environment.models_project import (
    IPipelineFactory,
    JsBundle,
    Artifact,
    FileListing,
    Link,
)
from youwol.pipelines.pipeline_typescript_weback_npm import (
    pipeline,
    PipelineConfig,
    TestStepConfig,
    test_result,
    test_coverage,
    PublishConfig,
)
from youwol.utils.context import Context

test_html_outputs: Artifact = Artifact(
    id="test-html-outputs",
    files=FileListing(
        include=["src/tests/.html-outputs/*"],
    ),
    links=[Link(name="HTML outputs", url="src/tests/.html-outputs/index.html")],
)


class PipelineFactory(IPipelineFactory):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    async def get(self, env: YouwolEnvironment, context: Context):
        config = PipelineConfig(
            target=JsBundle(
                links=[
                    Link(name="doc", url="dist/docs/modules/MainModule.html"),
                    Link(name="coverage", url="coverage/lcov-report/index.html"),
                    Link(name="bundle-analysis", url="dist/bundle-analysis.html"),
                ]
            ),
            testConfig=TestStepConfig(
                artifacts=[test_result, test_coverage, test_html_outputs]
            ),
            publishConfig=PublishConfig(
                packagedArtifacts=["dist", "docs", "test-coverage", "test-html-outputs"]
            ),
        )
        return await pipeline(config, context)
