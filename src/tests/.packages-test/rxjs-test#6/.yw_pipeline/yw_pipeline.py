from youwol.environment.forward_declaration import YouwolEnvironment
from youwol.environment.models import IPipelineFactory
from youwol.environment.models_project import JsBundle, Link
from youwol.pipelines.pipeline_typescript_weback_npm import PipelineConfig, pipeline
from youwol_utils.context import Context


class PipelineFactory(IPipelineFactory):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    async def get(self, env: YouwolEnvironment, context: Context):
        config = PipelineConfig(target=JsBundle(links=[
            Link(name="bundle-analysis", url="dist/bundle-analysis.html")
        ]))
        return await pipeline(config, context)