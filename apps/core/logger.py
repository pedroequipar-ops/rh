import logging


class LoggerEngine:
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)

    def info(self, msg: str, **ctx):
        self.logger.info(msg, extra=ctx)

    def error(self, msg: str, **ctx):
        self.logger.error(msg, extra=ctx, exc_info=True)
