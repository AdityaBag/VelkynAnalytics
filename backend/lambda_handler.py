from mangum import Mangum

from backend.main import app


# Lambda handler for API Gateway HTTP API integration.
handler = Mangum(app)
