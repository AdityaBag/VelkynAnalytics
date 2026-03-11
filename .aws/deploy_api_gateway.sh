#!/usr/bin/env bash
set -euo pipefail

REGION="eu-west-2"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
FUNC_NAME="velkyn-analytics-api"
FUNC_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNC_NAME}"

API_ID="$(aws apigatewayv2 get-apis --region "$REGION" --query "Items[?Name=='velkyn-analytics-http-api'].ApiId | [0]" --output text)"
if [[ "$API_ID" == "None" || -z "$API_ID" ]]; then
  API_ID="$(aws apigatewayv2 create-api --name velkyn-analytics-http-api --protocol-type HTTP --region "$REGION" --query ApiId --output text)"
fi

INTEGRATION_ID="$(aws apigatewayv2 get-integrations --api-id "$API_ID" --region "$REGION" --query "Items[?IntegrationUri=='${FUNC_ARN}'].IntegrationId | [0]" --output text)"
if [[ "$INTEGRATION_ID" == "None" || -z "$INTEGRATION_ID" ]]; then
  INTEGRATION_ID="$(aws apigatewayv2 create-integration --api-id "$API_ID" --integration-type AWS_PROXY --integration-uri "$FUNC_ARN" --payload-format-version 2.0 --region "$REGION" --query IntegrationId --output text)"
fi

HAS_PROXY_ROUTE="$(aws apigatewayv2 get-routes --api-id "$API_ID" --region "$REGION" --query "Items[?RouteKey=='ANY /{proxy+}'] | length(@)" --output text)"
if [[ "$HAS_PROXY_ROUTE" != "1" ]]; then
  aws apigatewayv2 create-route --api-id "$API_ID" --route-key "ANY /{proxy+}" --target "integrations/${INTEGRATION_ID}" --region "$REGION" >/dev/null
fi

HAS_ROOT_ROUTE="$(aws apigatewayv2 get-routes --api-id "$API_ID" --region "$REGION" --query "Items[?RouteKey=='ANY /'] | length(@)" --output text)"
if [[ "$HAS_ROOT_ROUTE" != "1" ]]; then
  aws apigatewayv2 create-route --api-id "$API_ID" --route-key "ANY /" --target "integrations/${INTEGRATION_ID}" --region "$REGION" >/dev/null
fi

HAS_DEFAULT_STAGE="$(aws apigatewayv2 get-stages --api-id "$API_ID" --region "$REGION" --query "Items[?StageName=='\$default'] | length(@)" --output text)"
if [[ "$HAS_DEFAULT_STAGE" != "1" ]]; then
  aws apigatewayv2 create-stage --api-id "$API_ID" --stage-name '$default' --auto-deploy --region "$REGION" >/dev/null
else
  aws apigatewayv2 update-stage --api-id "$API_ID" --stage-name '$default' --auto-deploy --region "$REGION" >/dev/null
fi

SOURCE_ARN="arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/*"
if ! aws lambda get-policy --function-name "$FUNC_NAME" --region "$REGION" --query Policy --output text 2>/dev/null | grep -q "apigateway-invoke-permission"; then
  aws lambda add-permission \
    --function-name "$FUNC_NAME" \
    --statement-id apigateway-invoke-permission \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "$SOURCE_ARN" \
    --region "$REGION" >/dev/null
fi

API_URL="$(aws apigatewayv2 get-api --api-id "$API_ID" --region "$REGION" --query ApiEndpoint --output text)"
echo "API_ID=$API_ID"
echo "API_URL=$API_URL"
